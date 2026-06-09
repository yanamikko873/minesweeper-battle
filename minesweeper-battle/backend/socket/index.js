'use strict';
const roomManager = require('./roomManager');
const ojama       = require('./ojamaLogic');

module.exports = function registerSocketEvents(io) {
  io.on('connection', socket => {
    console.log(`[Socket] 接続: ${socket.id}`);

    socket.on('join_room', ({ roomId, playerName }) => {
      roomManager.joinRoom(io, socket, roomId, playerName);
    });

    socket.on('join_random', ({ playerName }) => {
      roomManager.joinRandom(io, socket, playerName);
    });

    socket.on('player_ready', ({ roomId }) => {
      roomManager.setReady(io, socket, roomId);
    });

    socket.on('start_game', ({ roomId }) => {
      roomManager.startGame(io, socket, roomId);
    });

    // Phase 4: セル開放数でおじゃま判定
    socket.on('cell_opened', ({ roomId, count }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room) {
        const player   = room.players.get(socket.id);
        const oldCount = player?.openedCount ?? 0;
        roomManager.updateProgress(io, socket, roomId, count);
        if (room.status === 'playing') {
          ojama.checkAndSend(io, room, socket.id, count, oldCount);
        }
      }
    });

    socket.on('game_clear', ({ roomId, time }) => {
      roomManager.handleClear(io, socket, roomId, time);
    });

    // Phase 4: 地雷踏みで全相手にボーナス
    socket.on('game_over', ({ roomId }) => {
      const room = roomManager.getRoomBySocket(socket.id);
      if (room && room.status === 'playing') {
        ojama.sendBonus(io, room, socket.id);
      }
      roomManager.handleGameOver(io, socket, roomId);
    });

    socket.on('disconnect', () => {
      roomManager.handleDisconnect(io, socket);
      console.log(`[Socket] 切断: ${socket.id}`);
    });
  });
};
