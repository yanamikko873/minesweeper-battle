'use strict';
const boardService = require('../services/boardService');
const dynamoService = require('../services/dynamoService');

// ========== ストレージ ==========
const rooms = new Map(); // roomId → Room

// ========== ユーティリティ ==========
function randomId(len = 8) {
  return Math.random().toString(36).slice(2, 2 + len).toUpperCase();
}

function makeRoomCode() {
  // 衝突チェック付き4文字コード生成
  let code;
  do { code = randomId(4); } while ([...rooms.values()].some(r => r.roomCode === code));
  return code;
}

function makePlayer(socketId, playerName, isOwner = false) {
  return { socketId, playerName, isOwner, isReady: false, isEliminated: false, openedCount: 0, clearTime: null };
}

function roomPublic(room) {
  return {
    roomId:   room.roomId,
    roomCode: room.roomCode,
    status:   room.status,
    players:  [...room.players.values()].map(({ socketId, playerName, isOwner, isReady, isEliminated, openedCount, clearTime }) =>
      ({ socketId, playerName, isOwner, isReady, isEliminated, openedCount, clearTime })),
  };
}

// ランダムマッチング用の待機部屋を探す
function findWaitingRandomRoom() {
  for (const room of rooms.values()) {
    if (room.isRandom && room.status === 'waiting' && room.players.size < 4) return room;
  }
  return null;
}

// 期限切れ部屋を掃除（最後の操作から30分）
setInterval(() => {
  const limit = Date.now() - 30 * 60 * 1000;
  for (const [id, room] of rooms) {
    if (room.updatedAt < limit && room.status !== 'playing') rooms.delete(id);
  }
}, 5 * 60 * 1000);

// ========== 公開API ==========

function createRoom(isRandom = false) {
  const roomId   = randomId(8);
  const roomCode = isRandom ? null : makeRoomCode();
  const room = {
    roomId, roomCode, isRandom,
    players:   new Map(),
    status:    'waiting',
    boardData: null,
    countdown: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(roomId, room);
  return room;
}

function getRoomByCode(code) {
  return [...rooms.values()].find(r => r.roomCode === code) || null;
}

function getRoomBySocket(socketId) {
  return [...rooms.values()].find(r => r.players.has(socketId)) || null;
}

async function joinRoom(io, socket, roomId, playerName) {
  const room = rooms.get(roomId);
  if (!room) return socket.emit('error', { message: '部屋が見つかりません' });
  if (room.status !== 'waiting') return socket.emit('error', { message: '既にゲーム中です' });
  if (room.players.size >= 4) return socket.emit('error', { message: '満員です' });

  const isOwner = room.players.size === 0;
  room.players.set(socket.id, makePlayer(socket.id, playerName, isOwner));
  room.updatedAt = Date.now();
  socket.join(roomId);

  io.to(roomId).emit('room_updated', roomPublic(room));
  console.log(`[Room] ${playerName} が ${roomId} に参加 (${room.players.size}/4)`);

  // ランダムマッチング: 2人以上で30秒カウントダウン開始
  if (room.isRandom && room.players.size >= 2 && !room.countdown) {
    _startRandomCountdown(io, room);
  }
}

function setReady(io, socket, roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.players.has(socket.id)) return;
  room.players.get(socket.id).isReady = true;
  room.updatedAt = Date.now();
  io.to(roomId).emit('room_updated', roomPublic(room));
}

async function startGame(io, socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.get(socket.id);
  if (!player?.isOwner) return socket.emit('error', { message: '部屋主のみ開始できます' });
  if (room.players.size < 1) return socket.emit('error', { message: '2人以上必要です' });
  if (room.status !== 'waiting') return;

  await _doStartGame(io, room);
}

async function _doStartGame(io, room) {
  room.status = 'playing';
  room.updatedAt = Date.now();

  // 今日のボードデータを取得
  const today = new Date().toISOString().slice(0, 10);
  let board = await dynamoService.getDailyBoard(today);
  if (!board) {
    board = boardService.generateDailyBoard(today);
    await dynamoService.saveDailyBoard(today, board);
  }
  room.boardData = board;

  io.to(room.roomId).emit('game_start', {
    seed: board.seed, rows: board.rows, cols: board.cols, mines: board.mines,
  });
  console.log(`[Room] ゲーム開始: ${room.roomId} (${room.players.size}人)`);
}

function _startRandomCountdown(io, room) {
  let remaining = 30;
  room.countdown = setInterval(async () => {
    remaining--;
    io.to(room.roomId).emit('room_updated', { ...roomPublic(room), countdown: remaining });

    if (remaining <= 0 || room.players.size >= 4) {
      clearInterval(room.countdown);
      room.countdown = null;
      if (room.players.size >= 2 && room.status === 'waiting') {
        await _doStartGame(io, room);
      }
    }
  }, 1000);
}

function updateProgress(io, socket, roomId, openedCount) {
  const room = rooms.get(roomId);
  if (!room || !room.players.has(socket.id)) return;
  room.players.get(socket.id).openedCount = openedCount;

  // 他プレイヤーに進捗通知
  socket.to(roomId).emit('player_board', {
    playerId: socket.id,
    openedCount,
    status: 'playing',
  });
}

function handleClear(io, socket, roomId, time) {
  const room = rooms.get(roomId);
  if (!room || !room.players.has(socket.id)) return;

  const player = room.players.get(socket.id);
  player.clearTime = time;
  room.updatedAt = Date.now();

  socket.to(roomId).emit('player_board', {
    playerId: socket.id,
    openedCount: player.openedCount,
    status: 'clear',
    clearTime: time,
  });

  // 全員クリア or 脱落済みかチェック
  _checkGameEnd(io, room);
}

function handleGameOver(io, socket, roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.players.has(socket.id)) return;

  const player = room.players.get(socket.id);
  player.isEliminated = true;
  room.updatedAt = Date.now();

  io.to(roomId).emit('player_eliminated', { playerId: socket.id });
  _checkGameEnd(io, room);
}

function _checkGameEnd(io, room) {
  const players = [...room.players.values()];
  const active   = players.filter(p => !p.isEliminated && p.clearTime === null);
  if (active.length > 0) return; // まだ終わっていない

  room.status = 'finished';
  room.updatedAt = Date.now();

  const ranking = players
    .filter(p => p.clearTime !== null)
    .sort((a, b) => a.clearTime - b.clearTime)
    .map((p, i) => ({ rank: i + 1, playerId: p.socketId, playerName: p.playerName, clearTime: p.clearTime }));

  io.to(room.roomId).emit('game_end', { ranking });
  console.log(`[Room] ゲーム終了: ${room.roomId}`);
}

function handleDisconnect(io, socket) {
  const room = getRoomBySocket(socket.id);
  if (!room) return;

  const player = room.players.get(socket.id);
  room.players.delete(socket.id);
  room.updatedAt = Date.now();

  if (room.players.size === 0) {
    if (room.countdown) clearInterval(room.countdown);
    rooms.delete(room.roomId);
    return;
  }

  // 部屋主が抜けた場合、次のプレイヤーに引き継ぐ
  if (player?.isOwner) {
    const next = room.players.values().next().value;
    if (next) next.isOwner = true;
  }

  io.to(room.roomId).emit('room_updated', roomPublic(room));

  if (room.status === 'playing') {
    _checkGameEnd(io, room);
  }
}

// ランダムマッチング用: 待機部屋を探してなければ作る
async function joinRandom(io, socket, playerName) {
  let room = findWaitingRandomRoom();
  if (!room) room = createRoom(true);
  await joinRoom(io, socket, room.roomId, playerName);
  return room;
}

module.exports = {
  createRoom, getRoomByCode, getRoomBySocket,
  joinRoom, joinRandom, setReady, startGame,
  updateProgress, handleClear, handleGameOver, handleDisconnect,
};
