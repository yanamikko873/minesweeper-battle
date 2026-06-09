// Phase 4: おじゃまシステム（フロントエンド）

class OjamaManager {
  constructor(board, onUpdate) {
    this.board     = board;
    this.onUpdate  = onUpdate; // 再描画コールバック
    this.noiseMap  = null;
    this.noiseTimer = null;
  }

  // -------- 受信ハンドラ --------

  receiveFakeFlag() {
    this.board.addFakeFlag();
    this._notify('⚠️ 偽フラグ攻撃！');
    this.onUpdate();
  }

  receiveFog(count = 3) {
    this.board.addFog(count);
    this._notify(`🌫️ 霧攻撃！ ${count}マス再封鎖`);
    this.onUpdate();
  }

  receiveNoise(duration = 5000) {
    this._buildNoiseMap();
    this._notify('🔀 ノイズ攻撃！ 数字が乱れた');
    this.onUpdate();
    clearTimeout(this.noiseTimer);
    this.noiseTimer = setTimeout(() => {
      this.noiseMap = null;
      this._notify('✅ ノイズ解除');
      this.onUpdate();
    }, duration);
  }

  // 地雷踏み時のボーナス: おじゃまを1つ解除
  receiveBonus() {
    // 偽フラグを1つ除去
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.grid[r][c];
        if (cell.isFakeFlag) {
          cell.isFakeFlag = false;
          this.board.fakeFlagCount--;
          this._notify('🎁 おじゃま解除ボーナス！');
          this.onUpdate();
          return;
        }
      }
    }
    // 偽フラグがなければ霧を1つ解除
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.grid[r][c];
        if (cell.isFog) {
          cell.isFog = false;
          cell.isOpen = true;
          this.board.openedCount++;
          this._notify('🎁 おじゃま解除ボーナス！');
          this.onUpdate();
          return;
        }
      }
    }
  }

  // -------- ノイズ数字取得 --------
  // cell.js の drawCell から呼ばれる想定（または game で上書き）
  getDisplayNumber(cell) {
    if (!this.noiseMap || !cell.isOpen || cell.isMine) return cell.adjacentMines;
    const key = `${cell.row},${cell.col}`;
    return this.noiseMap.get(key) ?? cell.adjacentMines;
  }

  _buildNoiseMap() {
    this.noiseMap = new Map();
    for (let r = 0; r < this.board.rows; r++) {
      for (let c = 0; c < this.board.cols; c++) {
        const cell = this.board.grid[r][c];
        if (cell.isOpen && !cell.isMine && cell.adjacentMines > 0) {
          const shift = Math.random() < 0.5 ? 1 : -1;
          this.noiseMap.set(`${r},${c}`, Math.max(1, Math.min(8, cell.adjacentMines + shift)));
        }
      }
    }
  }

  // -------- 通知バナー --------
  _notify(msg) {
    const el = document.getElementById('ojama-notice');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden', 'fade-out');
    clearTimeout(this._noticeTimer);
    this._noticeTimer = setTimeout(() => el.classList.add('fade-out'), 2000);
  }
}
