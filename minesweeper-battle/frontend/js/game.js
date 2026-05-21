class Game {
  constructor() {
    this.canvas = document.getElementById('board-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.board = null;
    this.difficulty = 'intermediate';
    this.cellSize = 32;
    this.state = 'idle'; // idle | playing | won | lost
    this.startTime = 0;
    this.elapsedMs = 0;
    this.timerInterval = null;
    // スマホ: タッチ長押しで旗モード
    this.flagMode = false;

    this._parseURLParams();
    this._bindUI();
    this._bindMouseEvents();
    this._bindTouchEvents();
    this._bindResize();
    this.newGame();
  }

  _parseURLParams() {
    const params = new URLSearchParams(location.search);
    const d = params.get('difficulty');
    if (d && DIFFICULTY[d]) this.difficulty = d;
    // 難易度セレクタに反映
    const sel = document.getElementById('difficulty-select');
    if (sel) sel.value = this.difficulty;
  }

  newGame() {
    clearInterval(this.timerInterval);
    this.state = 'idle';
    this.elapsedMs = 0;

    const { rows, cols, mines } = DIFFICULTY[this.difficulty];
    // 中級のみ今日のシード（毎日パズル）、他はランダム
    const seed = this.difficulty === 'intermediate' ? dateToSeed() : null;
    this.board = new Board(rows, cols, mines, seed);

    this._computeCellSize();
    this._resizeCanvas();
    this._render();
    this._updateHUD();
    this._updateTimerDisplay();
    document.getElementById('game-overlay').classList.add('hidden');
    document.getElementById('reset-btn').textContent = '🙂';
  }

  // ========== ゲームロジック ==========
  _doOpen(row, col) {
    if (this.state === 'won' || this.state === 'lost') return;
    if (this.state === 'idle') this._startTimer();

    const result = this.board.open(row, col);
    this._render();
    this._updateHUD();

    if (result === 'mine') {
      this.board.revealAll();
      this._render();
      this.state = 'lost';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😵';
      setTimeout(() => this._showOverlay('💣 GAME OVER', `タイム: ${this._formatTime(this.elapsedMs)}`), 250);
    } else if (result === 'win') {
      this.board.flagAll();
      this._render();
      this.state = 'won';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😎';
      setTimeout(() => this._showOverlay('🎉 CLEAR!', `タイム: ${this._formatTime(this.elapsedMs)}`), 250);
    }
  }

  _doFlag(row, col) {
    if (this.state === 'won' || this.state === 'lost' || this.state === 'idle') return;
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

    if (result === 'mine') {
      this.board.revealAll();
      this._render();
      this.state = 'lost';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😵';
      setTimeout(() => this._showOverlay('💣 GAME OVER', `タイム: ${this._formatTime(this.elapsedMs)}`), 250);
    } else if (result === 'win') {
      this.board.flagAll();
      this._render();
      this.state = 'won';
      this._stopTimer();
      document.getElementById('reset-btn').textContent = '😎';
      setTimeout(() => this._showOverlay('🎉 CLEAR!', `タイム: ${this._formatTime(this.elapsedMs)}`), 250);
    }
  }

  // ========== タイマー ==========
  _startTimer() {
    this.state = 'playing';
    this.startTime = performance.now() - this.elapsedMs;
    this.timerInterval = setInterval(() => {
      this.elapsedMs = performance.now() - this.startTime;
      this._updateTimerDisplay();
    }, 100);
  }

  _stopTimer() {
    clearInterval(this.timerInterval);
  }

  _updateTimerDisplay() {
    const secs = Math.min(999, Math.floor(this.elapsedMs / 1000));
    document.getElementById('timer-display').textContent = String(secs).padStart(3, '0');
  }

  _formatTime(ms) {
    const t = Math.floor(ms / 1000);
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  // ========== 描画 ==========
  _computeCellSize() {
    const { cols, rows } = DIFFICULTY[this.difficulty];
    const maxW = window.innerWidth - 24;
    const maxH = window.innerHeight - 130;
    const byW = Math.floor(maxW / cols);
    const byH = Math.floor(maxH / rows);
    this.cellSize = Math.max(22, Math.min(38, byW, byH));
  }

  _resizeCanvas() {
    const { rows, cols } = DIFFICULTY[this.difficulty];
    this.canvas.width = cols * this.cellSize;
    this.canvas.height = rows * this.cellSize;
  }

  _render() {
    const { ctx, board, cellSize } = this;
    const { rows, cols } = DIFFICULTY[this.difficulty];
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        drawCell(ctx, board.grid[r][c], c * cellSize, r * cellSize, cellSize, this.state);
      }
    }
  }

  _updateHUD() {
    const remaining = this.board.remainingMines;
    document.getElementById('mine-count').textContent =
      (remaining < 0 ? '-' : '') + String(Math.abs(remaining)).padStart(3, '0');
  }

  _showOverlay(title, msg) {
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-message').textContent = msg;
    document.getElementById('game-overlay').classList.remove('hidden');
  }

  // ========== 座標変換 ==========
  _cellAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const col = Math.floor((clientX - rect.left) / this.cellSize);
    const row = Math.floor((clientY - rect.top) / this.cellSize);
    const { rows, cols } = DIFFICULTY[this.difficulty];
    if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
    return { row, col };
  }

  // ========== マウス入力 ==========
  _bindMouseEvents() {
    // 左クリック: 開く（dblclickもclickを発火するが、開済みセルはno-op）
    this.canvas.addEventListener('click', e => {
      const pos = this._cellAt(e.clientX, e.clientY);
      if (!pos) return;
      this._doOpen(pos.row, pos.col);
    });

    // ダブルクリック: チョード（周囲一括開放）
    this.canvas.addEventListener('dblclick', e => {
      const pos = this._cellAt(e.clientX, e.clientY);
      if (!pos) return;
      this._doChord(pos.row, pos.col);
    });

    // 右クリック: 旗
    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      const pos = this._cellAt(e.clientX, e.clientY);
      if (!pos) return;
      this._doFlag(pos.row, pos.col);
    });
  }

  // ========== タッチ入力 ==========
  _bindTouchEvents() {
    let startPos = null;
    let startTime = 0;
    let longPressTimer = null;
    let lastTap = { pos: null, time: 0 };
    let didLongPress = false;

    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      startPos = this._cellAt(t.clientX, t.clientY);
      startTime = Date.now();
      didLongPress = false;

      if (!startPos) return;
      longPressTimer = setTimeout(() => {
        didLongPress = true;
        this._doFlag(startPos.row, startPos.col);
      }, 480);
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      clearTimeout(longPressTimer);
      if (!startPos || didLongPress) return;

      const duration = Date.now() - startTime;
      if (duration >= 480) return;

      // ダブルタップ判定（チョード）
      const now = Date.now();
      if (
        lastTap.pos &&
        lastTap.pos.row === startPos.row &&
        lastTap.pos.col === startPos.col &&
        now - lastTap.time < 320
      ) {
        this._doChord(startPos.row, startPos.col);
        lastTap = { pos: null, time: 0 };
        return;
      }

      lastTap = { pos: startPos, time: now };
      this._doOpen(startPos.row, startPos.col);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      clearTimeout(longPressTimer);
      startPos = null;
    }, { passive: false });

    // スマホ: 旗モード切り替えボタン
    const flagToggle = document.getElementById('flag-mode-btn');
    if (flagToggle) {
      flagToggle.addEventListener('click', () => {
        this.flagMode = !this.flagMode;
        flagToggle.classList.toggle('active', this.flagMode);
        flagToggle.textContent = this.flagMode ? '🚩 旗モード ON' : '🚩 旗モード';
      });
    }
  }

  // ========== UIバインド ==========
  _bindUI() {
    document.getElementById('reset-btn').addEventListener('click', () => this.newGame());

    const sel = document.getElementById('difficulty-select');
    if (sel) {
      sel.addEventListener('change', () => {
        this.difficulty = sel.value;
        const url = new URL(location.href);
        url.searchParams.set('difficulty', this.difficulty);
        history.replaceState(null, '', url);
        this.newGame();
      });
    }

    document.getElementById('overlay-retry').addEventListener('click', () => this.newGame());
    document.getElementById('overlay-home').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
    document.getElementById('btn-home').addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  _bindResize() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this._computeCellSize();
        this._resizeCanvas();
        this._render();
      }, 150);
    });
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
