// ========== シード付き乱数 ==========
class SeededRandom {
  constructor(seed) {
    this.seed = seed >>> 0;
  }
  next() {
    // xorshift32
    let s = this.seed;
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 0x100000000;
  }
  nextInt(max) {
    return Math.floor(this.next() * max);
  }
}

// 今日の日付からシード値を生成
function dateToSeed(date = new Date()) {
  return parseInt(date.toISOString().slice(0, 10).replace(/-/g, ''), 10) % 0x7fffffff;
}

// ========== 難易度定義 ==========
const DIFFICULTY = {
  beginner:     { rows: 9,  cols: 9,  mines: 10, label: '初級 9×9' },
  intermediate: { rows: 16, cols: 16, mines: 40, label: '中級 16×16' },
  expert:       { rows: 16, cols: 30, mines: 99, label: '上級 30×16' },
};

// ========== ボードクラス ==========
class Board {
  constructor(rows, cols, totalMines, seed = null) {
    this.rows = rows;
    this.cols = cols;
    this.totalMines = totalMines;
    this.rng = seed !== null ? new SeededRandom(seed) : null;
    this.grid = this._createGrid();
    this.minesPlaced = false;
    this.openedCount = 0;
    this.flaggedCount = 0;
    this.fakeFlagCount = 0;
  }

  _createGrid() {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => ({
        row: r, col: c,
        isMine: false,
        isOpen: false,
        isFlagged: false,
        isExploded: false,
        adjacentMines: 0,
        isFakeFlag: false, // Phase 4: おじゃま偽フラグ
        isFog: false,      // Phase 4: おじゃま霧（再封鎖）
      }))
    );
  }

  _neighbors(r, c) {
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    return dirs
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols)
      .map(([nr, nc]) => this.grid[nr][nc]);
  }

  // 最初のクリック後に地雷を配置（クリックセル周辺は安全）
  _placeMines(safeRow, safeCol) {
    const safeSet = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeRow + dr, c = safeCol + dc;
        if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
          safeSet.add(r * this.cols + c);
        }
      }
    }

    let candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!safeSet.has(r * this.cols + c)) {
          candidates.push(r * this.cols + c);
        }
      }
    }

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = this.rng ? this.rng.nextInt(i + 1) : Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (let i = 0; i < this.totalMines; i++) {
      const r = Math.floor(candidates[i] / this.cols);
      const c = candidates[i] % this.cols;
      this.grid[r][c].isMine = true;
    }

    // 数字計算
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].isMine) {
          this.grid[r][c].adjacentMines = this._neighbors(r, c).filter(n => n.isMine).length;
        }
      }
    }

    this.minesPlaced = true;
  }

  // セルを開く。戻り値: 'mine' | 'win' | 'ok'
  open(row, col) {
    if (!this.minesPlaced) this._placeMines(row, col);

    const cell = this.grid[row][col];
    // 偽フラグ・旗は左クリックで開けない
    if (cell.isFlagged || cell.isFakeFlag) return 'ok';
    // 霧セル: 安全と分かっているので再開放するだけ
    if (cell.isFog) {
      cell.isFog = false;
      cell.isOpen = true;
      this.openedCount++;
      return this._checkWin() ? 'win' : 'ok';
    }
    if (cell.isOpen) return 'ok';

    if (cell.isMine) {
      cell.isOpen = true;
      cell.isExploded = true;
      return 'mine';
    }

    this._floodFill(row, col);
    return this._checkWin() ? 'win' : 'ok';
  }

  // 0マスから連鎖的に開く
  _floodFill(row, col) {
    const stack = [[row, col]];
    const visited = new Set();
    while (stack.length > 0) {
      const [r, c] = stack.pop();
      const key = r * this.cols + c;
      if (visited.has(key)) continue;
      visited.add(key);
      const cell = this.grid[r][c];
      if (cell.isOpen || cell.isFlagged || cell.isFakeFlag || cell.isMine) continue;
      cell.isOpen = true;
      cell.isFog = false;
      this.openedCount++;
      if (cell.adjacentMines === 0) {
        for (const n of this._neighbors(r, c)) {
          if (!n.isOpen) stack.push([n.row, n.col]);
        }
      }
    }
  }

  // 旗を立てる/外す（偽フラグは除去のみ）
  toggleFlag(row, col) {
    const cell = this.grid[row][col];
    if (cell.isOpen) return;
    if (cell.isFakeFlag) {
      // 偽フラグは除去するだけ（本物の旗は立てない）
      cell.isFakeFlag = false;
      this.fakeFlagCount--;
      return;
    }
    if (cell.isFlagged) {
      cell.isFlagged = false;
      this.flaggedCount--;
    } else {
      cell.isFlagged = true;
      this.flaggedCount++;
    }
  }

  // チョード: 周囲の旗数（偽旗含む）== 数字なら未開放セルを一括開放
  chord(row, col) {
    const cell = this.grid[row][col];
    if (!cell.isOpen || cell.adjacentMines === 0) return 'ok';
    const neighbors = this._neighbors(row, col);
    const flagCount = neighbors.filter(n => n.isFlagged || n.isFakeFlag).length;
    if (flagCount !== cell.adjacentMines) return 'ok';

    for (const n of neighbors) {
      if (!n.isOpen && !n.isFlagged && !n.isFakeFlag) {
        const result = this.open(n.row, n.col);
        if (result === 'mine') return 'mine';
        if (result === 'win') return 'win';
      }
    }
    return this._checkWin() ? 'win' : 'ok';
  }

  _checkWin() {
    return this.openedCount === this.rows * this.cols - this.totalMines;
  }

  // ゲームオーバー時に全地雷を表示
  revealAll() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine && !cell.isExploded) cell.isOpen = true;
      }
    }
  }

  // クリア時に全旗を立てる
  flagAll() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c].isMine) this.grid[r][c].isFlagged = true;
      }
    }
    this.flaggedCount = this.totalMines;
  }

  get remainingMines() {
    return this.totalMines - this.flaggedCount - this.fakeFlagCount;
  }

  // ========== Phase 4: おじゃまメソッド ==========

  // 偽フラグを閉じた安全セルにランダム配置
  addFakeFlag() {
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (!cell.isOpen && !cell.isFlagged && !cell.isFakeFlag && !cell.isMine) {
          candidates.push(cell);
        }
      }
    }
    if (candidates.length === 0) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    target.isFakeFlag = true;
    this.fakeFlagCount++;
  }

  // 霧: 開いているセルをランダムに再封鎖
  addFog(count = 3) {
    const candidates = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isOpen && !cell.isMine) candidates.push(cell);
      }
    }
    // shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    for (let i = 0; i < Math.min(count, candidates.length); i++) {
      candidates[i].isOpen = false;
      candidates[i].isFog = true;
      this.openedCount--;
    }
  }
}
