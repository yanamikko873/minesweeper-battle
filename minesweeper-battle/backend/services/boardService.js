'use strict';

// フロントエンドと同じシード付き乱数（board.js と必ず一致させること）
class SeededRandom {
  constructor(seed) { this.seed = seed >>> 0; }
  next() {
    let s = this.seed;
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    this.seed = s >>> 0;
    return this.seed / 0x100000000;
  }
  nextInt(max) { return Math.floor(this.next() * max); }
}

function dateToSeed(dateStr) {
  return parseInt(dateStr.replace(/-/g, ''), 10) % 0x7fffffff;
}

// 毎日パズルのボードメタデータを生成
function generateDailyBoard(dateStr) {
  return {
    date: dateStr,
    seed: dateToSeed(dateStr),
    rows: 16,
    cols: 16,
    mines: 40,
  };
}

// シード値から地雷座標を生成（サーバー側検証・Phase 4 おじゃま判定用）
function generateMinePositions(seed, rows, cols, mines, safeRow, safeCol) {
  const rng = new SeededRandom(seed);

  const safeSet = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeRow + dr, c = safeCol + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        safeSet.add(r * cols + c);
      }
    }
  }

  let candidates = Array.from({ length: rows * cols }, (_, i) => i).filter(i => !safeSet.has(i));

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, mines).map(idx => ({
    row: Math.floor(idx / cols),
    col: idx % cols,
  }));
}

module.exports = { generateDailyBoard, generateMinePositions, dateToSeed };
