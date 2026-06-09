// マルチプレイゲームロジック

const TOTAL_SAFE = (rows, cols, mines) => rows * cols - mines;

class MultiGame {
  constructor() {
    this.canvas    = document.getElementById('board-canvas');
    this.ctx       = this.canvas.getContext('2d');
    this.board     = null;
    this.ojama     = null;
    this.cellSize  = 32;
    this.state     = 'waiting'; // waiting | playing | won | lost | ended
    this.startTime = 0;
    this.elapsedMs = 0;
    this.timerInterval = null;
    this.roomId    = new URLSearchParams(location.search).get('roomId');

    const raw = sessionStorage.getItem('gameData');
    this.gameData  = raw ? JSON.parse(raw) : null;

    this.gs = new GameSocket();
    this.gs.connect();

    this._bindSocket();
    this._bindUI();
    this._bindMouseEvents();
    this._bindTouchEvents();
    this._bindResize();

    // セッションにボードデータがある場合は即開始
    if (this.gameData) {
      this._initBoard(this.gameData);
    } else {
      document.getElementById('status-overlay').classList.remove('hidden');
      document.getElementById('status-msg').textContent = 'ゲーム開始を待っています...';
      this.gs.emit('join_room', {
        roomId: this.roomId,
        playerName: sessionStorage.getItem('playerName') || 'プレイヤー',
      });
    }
  }

  // ========== ボード初期化 ==========
  _initBoard({ seed, rows, cols, mines }) {
    this.board     = new Board(rows, cols, mines, seed);
    this.ojama     = new OjamaManager(this.board, () => this._render());
    this.totalSafe = TOTAL_SAFE(rows, cols, mines);
    this.state     = 'playing';
    this.startTime = performance.now();
    this.timerInterval = setInterval(() => {
      this.elapsedMs = performance.now() - this.startTime;
      this._updateTimerDisplay();
    }, 100);

    this._computeCellSize(rows, cols);
    this._resizeCanvas(rows, cols);
    this._render();
    this._updateHUD();
    document.getElementById('status-overlay').classList.add('hidden');
  }

  // ========== ゲームアクション ==========
  _doOpen(row, col) {
    if (this.state !== 'playing') return;
    const result = this.board.open(row, col);
    this._render();
    this._updateHUD();
    this._emitProgress();

    if (result === 'mine') {
      this.board.revealAll();
      this._render();
      this.state = 'lost';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😵';
      this.gs.emit('game_over', { roomId: this.roomId });
      this._showStatus('💣 地雷を踏んだ...', false);
    } else if (result === 'win') {
      this.board.flagAll();
      this._render();
      this.state = 'won';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😎';
      this.gs.emit('game_clear', { roomId: this.roomId, time: this.elapsedMs });
      this._showStatus(`🎉 クリア！ ${this._formatTime(this.elapsedMs)}`, false);
    }
  }

  _doFlag(row, col) {
    if (this.state !== 'playing') return;
    this.board.toggleFlag(row, col);
    this._render();
    this._updateHUD();
  }

  _doChord(row, col) {
    if (this.state !== 'playing') return;
    const cell = this.board.grid[row][col];
    if (!cell.isOpen || cell.adjacentMines === 0) return;
    const result = this.board.chord(row, col);
    this._render();
    this._updateHUD();
    this._emitProgress();

    if (result === 'mine') {
      this.board.revealAll(); this._render();
      this.state = 'lost'; this._stopTimer();
      document.getElementById('reset-btn').textContent = '😵';
      this.gs.emit('game_over', { roomId: this.roomId });
      this._showStatus('💣 地雷を踏んだ...', false);
    } else if (result === 'win') {
      this.board.flagAll(); this._render();
      this.state = 'won'; this._stopTimer();
      document.getElementById('reset-btn').textContent = '😎';
      this.gs.emit('game_clear', { roomId: this.roomId, time: this.elapsedMs });
      this._showStatus(`🎉 クリア！ ${this._formatTime(this.elapsedMs)}`, false);
    }
  }

  _emitProgress() {
    this.gs.emit('cell_opened', { roomId: this.roomId, count: this.board.openedCount });
  }

  // ========== ソケットイベント ==========
  _bindSocket() {
    this.gs.on('game_start', (data) => {
      sessionStorage.setItem('gameData', JSON.stringify({ ...data, roomId: this.roomId }));
      this._initBoard(data);
    });

    this.gs.on('player_board', ({ playerId, openedCount, status, clearTime }) => {
      this._updateOpponent(playerId, openedCount, status, clearTime);
    });

    this.gs.on('player_eliminated', ({ playerId }) => {
      this._updateOpponent(playerId, null, 'eliminated', null);
    });

    this.gs.on('game_end', ({ ranking }) => {
      this.state = 'ended';
      this._stopTimer();
      this._showRanking(ranking);
    });

    // Phase 4: おじゃまイベント
    this.gs.on('receive_fake_flag', ()              => this.ojama?.receiveFakeFlag());
    this.gs.on('receive_fog',       ({ count })     => this.ojama?.receiveFog(count));
    this.gs.on('receive_noise',     ({ duration })  => this.ojama?.receiveNoise(duration));
    this.gs.on('receive_bonus',     ()              => this.ojama?.receiveBonus());
  }

  // ========== 相手ボード更新 ==========
  _updateOpponent(playerId, openedCount, status, clearTime) {
    const card = document.querySelector(`.opponent-card[data-id="${playerId}"]`);
    if (!card) {
      // 新規カード追加
      const area = document.getElementById('opponents-area');
      const div = document.createElement('div');
      div.className = 'opponent-card';
      div.dataset.id = playerId;
      div.innerHTML = `
        <div class="op-name">${playerId.slice(-4)}</div>
        <div class="op-status">プレイ中</div>
        <div class="op-bar-wrap"><div class="op-bar"></div></div>
        <div class="op-count">0 / ${this.totalSafe}</div>`;
      area.appendChild(div);
      return this._updateOpponent(playerId, openedCount, status, clearTime);
    }
    if (openedCount !== null) {
      const pct = Math.round((openedCount / this.totalSafe) * 100);
      card.querySelector('.op-bar').style.width = pct + '%';
      card.querySelector('.op-count').textContent = `${openedCount} / ${this.totalSafe}`;
    }
    const statusEl = card.querySelector('.op-status');
    if (status === 'clear')      { statusEl.textContent = `😎 ${this._formatTime(clearTime)}`; card.classList.add('cleared'); }
    else if (status === 'eliminated') { statusEl.textContent = '💣 脱落'; card.classList.add('eliminated'); }
  }

  _showRanking(ranking) {
    const ol = document.getElementById('ranking-list');
    ol.innerHTML = '';
    ranking.forEach(({ rank, playerName, clearTime }) => {
      const li = document.createElement('li');
      li.textContent = `${rank}位: ${playerName} (${this._formatTime(clearTime)})`;
      ol.appendChild(li);
    });
    document.getElementById('result-overlay').classList.remove('hidden');
  }

  _showStatus(msg, overlay = true) {
    if (overlay) {
      document.getElementById('status-msg').textContent = msg;
      document.getElementById('status-overlay').classList.remove('hidden');
    } else {
      const el = document.getElementById('inline-status');
      if (el) el.textContent = msg;
    }
  }

  // ========== 描画 ==========
  _computeCellSize(rows, cols) {
    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - 160;
    this.cellSize = Math.max(20, Math.min(36, Math.floor(maxW / cols), Math.floor(maxH / rows)));
  }

  _resizeCanvas(rows, cols) {
    this.canvas.width  = cols * this.cellSize;
    this.canvas.height = rows * this.cellSize;
  }

  _render() {
    if (!this.board) return;
    const { ctx, board, cellSize, ojama } = this;
    const { rows, cols } = board;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board.grid[r][c];
        // ノイズ中は表示数字を差し替え
        const displayCell = ojama && ojama.noiseMap
          ? { ...cell, adjacentMines: ojama.getDisplayNumber(cell) }
          : cell;
        drawCell(ctx, displayCell, c * cellSize, r * cellSize, cellSize, this.state);
      }
    }
  }

  _updateHUD() {
    if (!this.board) return;
    const rem = this.board.remainingMines;
    document.getElementById('mine-count').textContent =
      (rem < 0 ? '-' : '') + String(Math.abs(rem)).padStart(3, '0');
  }

  _updateTimerDisplay() {
    document.getElementById('timer-display').textContent =
      String(Math.min(999, Math.floor(this.elapsedMs / 1000))).padStart(3, '0');
  }

  _stopTimer() { clearInterval(this.timerInterval); }

  _formatTime(ms) {
    const t = Math.floor(ms / 1000);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  // ========== 入力 ==========
  _cellAt(cx, cy) {
    if (!this.board) return null;
    const rect = this.canvas.getBoundingClientRect();
    const col  = Math.floor((cx - rect.left)  / this.cellSize);
    const row  = Math.floor((cy - rect.top)   / this.cellSize);
    if (row < 0 || row >= this.board.rows || col < 0 || col >= this.board.cols) return null;
    return { row, col };
  }

  _bindMouseEvents() {
    this.canvas.addEventListener('click', e => {
      const p = this._cellAt(e.clientX, e.clientY); if (p) this._doOpen(p.row, p.col);
    });
    this.canvas.addEventListener('dblclick', e => {
      const p = this._cellAt(e.clientX, e.clientY); if (p) this._doChord(p.row, p.col);
    });
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const p = this._cellAt(e.clientX, e.clientY); if (p) this._doFlag(p.row, p.col);
    });
  }

  _bindTouchEvents() {
    let startPos = null, startTime = 0, longTimer = null, lastTap = { pos: null, time: 0 }, didLong = false;
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      startPos = this._cellAt(t.clientX, t.clientY);
      startTime = Date.now(); didLong = false;
      if (!startPos) return;
      longTimer = setTimeout(() => { didLong = true; this._doFlag(startPos.row, startPos.col); }, 480);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault(); clearTimeout(longTimer);
      if (!startPos || didLong || Date.now() - startTime >= 480) return;
      const now = Date.now();
      if (lastTap.pos?.row === startPos.row && lastTap.pos?.col === startPos.col && now - lastTap.time < 320) {
        this._doChord(startPos.row, startPos.col);
        lastTap = { pos: null, time: 0 }; return;
      }
      lastTap = { pos: startPos, time: now };
      this._doOpen(startPos.row, startPos.col);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault(); clearTimeout(longTimer); startPos = null;
    }, { passive: false });
  }

  _bindUI() {
    document.getElementById('reset-btn').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    document.getElementById('btn-home').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    const retryBtn = document.getElementById('result-home');
    if (retryBtn) retryBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
  }

  _bindResize() {
    let t;
    window.addEventListener('resize', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (!this.board) return;
        this._computeCellSize(this.board.rows, this.board.cols);
        this._resizeCanvas(this.board.rows, this.board.cols);
        this._render();
      }, 150);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => { new MultiGame(); });
