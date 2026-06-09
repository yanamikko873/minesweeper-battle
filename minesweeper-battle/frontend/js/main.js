document.addEventListener('DOMContentLoaded', () => {
  // 今日の日付表示
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  // ========== ソロプレイ ==========
  document.getElementById('btn-solo').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=intermediate';
  });
  document.getElementById('btn-beginner').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=beginner';
  });
  document.getElementById('btn-expert').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=expert';
  });

  // ========== 名前入力ヘルパー ==========
  function askName(then) {
    const stored = sessionStorage.getItem('playerName');
    if (stored) { then(stored); return; }
    const modal = document.getElementById('name-modal');
    const input = document.getElementById('name-input');
    modal.classList.remove('hidden');
    input.focus();
    document.getElementById('name-ok').onclick = () => {
      const name = input.value.trim() || 'プレイヤー';
      sessionStorage.setItem('playerName', name);
      modal.classList.add('hidden');
      then(name);
    };
  }

  // ========== 部屋を作る ==========
  document.getElementById('btn-create').addEventListener('click', () => {
    askName(async (name) => {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'private' }),
      });
      const { roomId } = await res.json();
      window.location.href = `room.html?roomId=${roomId}`;
    });
  });

  // ========== 合言葉で入室 ==========
  document.getElementById('btn-join').addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.trim().toUpperCase();
    if (!code) { alert('合言葉を入力してください'); return; }
    askName(async (name) => {
      const res = await fetch(`/api/rooms/${code}`);
      if (!res.ok) { alert('部屋が見つかりません'); return; }
      const { roomId } = await res.json();
      window.location.href = `room.html?roomId=${roomId}`;
    });
  });

  // Enterキーでも入室
  document.getElementById('room-code-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-join').click();
  });

  // ========== ランダム対戦 ==========
  let randomSocket = null;

  document.getElementById('btn-random').addEventListener('click', () => {
    askName((name) => {
      const modal = document.getElementById('random-modal');
      const statusEl = document.getElementById('random-status');
      modal.classList.remove('hidden');

      randomSocket = new GameSocket();
      randomSocket.connect();

      randomSocket.emit('join_random', { playerName: name });

      randomSocket.on('room_updated', (room) => {
        statusEl.textContent = `${room.players.length} 人待機中...`;
      });

      randomSocket.on('game_start', ({ seed, rows, cols, mines }) => {
        const room = new URLSearchParams(location.search).get('roomId');
        // roomId は room_updated で取得済みのはず、なければ sessionStorage から
        const rid = sessionStorage.getItem('currentRoomId') || '';
        sessionStorage.setItem('gameData', JSON.stringify({ seed, rows, cols, mines, roomId: rid }));
        modal.classList.add('hidden');
        window.location.href = `multi.html?roomId=${rid}`;
      });

      // room_updated で roomId を保存
      randomSocket.on('room_updated', (room) => {
        if (room.roomId) sessionStorage.setItem('currentRoomId', room.roomId);
      });
    });
  });

  document.getElementById('random-cancel').addEventListener('click', () => {
    randomSocket?.socket?.disconnect();
    document.getElementById('random-modal').classList.add('hidden');
  });
});
