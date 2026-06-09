// 待機ルーム画面ロジック

const gs = new GameSocket();
gs.connect();

const params     = new URLSearchParams(location.search);
const roomId     = params.get('roomId');
const playerName = sessionStorage.getItem('playerName') || 'プレイヤー';
let isOwner      = false;

// ========== UI要素 ==========
const roomCodeEl   = document.getElementById('room-code');
const playerListEl = document.getElementById('player-list');
const startBtn     = document.getElementById('start-btn');
const readyBtn     = document.getElementById('ready-btn');
const countdownEl  = document.getElementById('countdown');
const statusEl     = document.getElementById('status-msg');

// ========== 入室 ==========
gs.emit('join_room', { roomId, playerName });

// ========== イベント ==========
gs.on('room_updated', (room) => {
  if (room.roomCode) roomCodeEl.textContent = room.roomCode;
  renderPlayers(room.players);

  // 自分がオーナーか判定
  const me = room.players.find(p => p.socketId === gs.id);
  isOwner = me?.isOwner ?? false;
  startBtn.style.display = isOwner ? 'block' : 'none';

  if (room.countdown !== undefined) {
    countdownEl.textContent = `ゲーム開始まで ${room.countdown} 秒`;
    countdownEl.style.display = 'block';
  }

  statusEl.textContent = `${room.players.length} 人参加中`;
});

gs.on('game_start', ({ seed, rows, cols, mines }) => {
  // マルチゲーム画面に遷移（ボードデータをセッションに保存）
  sessionStorage.setItem('gameData', JSON.stringify({ seed, rows, cols, mines, roomId }));
  window.location.href = `multi.html?roomId=${roomId}`;
});

// ========== ボタン ==========
readyBtn.addEventListener('click', () => {
  gs.emit('player_ready', { roomId });
  readyBtn.disabled = true;
  readyBtn.textContent = '準備完了 ✅';
});

startBtn.addEventListener('click', () => {
  gs.emit('start_game', { roomId });
});

document.getElementById('btn-home').addEventListener('click', () => {
  window.location.href = 'index.html';
});

// ========== レンダー ==========
function renderPlayers(players) {
  playerListEl.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'player-item' + (p.socketId === gs.id ? ' me' : '');
    const crown = p.isOwner ? '👑 ' : '';
    const ready = p.isReady ? ' ✅' : '';
    li.textContent = `${crown}${p.playerName}${ready}`;
    playerListEl.appendChild(li);
  });
}
