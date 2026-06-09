// セルの数字色（クラシックマインスイーパー準拠、ダーク背景向けに明度調整）
const NUMBER_COLORS = [
  '',         // 0（表示なし）
  '#6699ff',  // 1 青
  '#55dd77',  // 2 緑
  '#ff6655',  // 3 赤
  '#aa88ff',  // 4 紫
  '#ff9944',  // 5 オレンジ
  '#44dddd',  // 6 シアン
  '#ffffff',  // 7 白
  '#aaaaaa',  // 8 グレー
];

// セル描画
function drawCell(ctx, cell, x, y, size, gameState) {
  const isLost = gameState === 'lost';

  if (cell.isOpen) {
    // 開いたセル
    ctx.fillStyle = cell.isExploded ? '#7a1a1a' : '#2a3050';
    ctx.fillRect(x, y, size, size);

    // 枠線
    ctx.strokeStyle = '#1a1e35';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    if (cell.isMine) {
      drawMine(ctx, x + size / 2, y + size / 2, size * 0.3, cell.isExploded);
    } else if (cell.adjacentMines > 0) {
      ctx.fillStyle = NUMBER_COLORS[cell.adjacentMines] || '#fff';
      ctx.font = `bold ${Math.floor(size * 0.58)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.adjacentMines, x + size / 2, y + size / 2 + 1);
    }
  } else {
    // 閉じたセル（3D浮き出し風）
    ctx.fillStyle = '#4a5280';
    ctx.fillRect(x, y, size, size);

    // ハイライト（左・上）
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x, y, size, 2);
    ctx.fillRect(x, y, 2, size);

    // シャドウ（右・下）
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x, y + size - 2, size, 2);
    ctx.fillRect(x + size - 2, y, 2, size);

    if (cell.isFlagged || cell.isFakeFlag) {
      // 偽フラグは見た目を本物と同じにして惑わす（色だけ微妙に違う）
      drawFlag(ctx, x + size / 2, y + size / 2, size * 0.3, cell.isFakeFlag);
    } else if (cell.isFog) {
      // 霧: 薄い青で封鎖感を演出
      ctx.fillStyle = 'rgba(100,150,255,0.18)';
      ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    } else if (isLost && cell.isMine) {
      // ゲームオーバー時に地雷を薄く表示
      ctx.globalAlpha = 0.55;
      drawMine(ctx, x + size / 2, y + size / 2, size * 0.28, false);
      ctx.globalAlpha = 1.0;
    }
  }

  // 誤フラグ（ゲームオーバー時、旗があるのに地雷でない）
  if (isLost && cell.isFlagged && !cell.isMine) {
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    const pad = size * 0.22;
    ctx.beginPath();
    ctx.moveTo(x + pad, y + pad);
    ctx.lineTo(x + size - pad, y + size - pad);
    ctx.moveTo(x + size - pad, y + pad);
    ctx.lineTo(x + pad, y + size - pad);
    ctx.stroke();
  }
}

// 地雷アイコン描画
function drawMine(ctx, cx, cy, r, exploded) {
  const color = exploded ? '#ff8888' : '#cccccc';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // 本体
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // 8方向スパイク
  ctx.lineWidth = Math.max(1, r * 0.28);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
    ctx.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5);
    ctx.stroke();
  }

  // 光沢
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// 旗アイコン描画（isFake=true のとき偽旗: オレンジ色）
function drawFlag(ctx, cx, cy, r, isFake = false) {
  // ポール
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.beginPath();
  ctx.moveTo(cx, cy + r);
  ctx.lineTo(cx, cy - r);
  ctx.stroke();

  // 旗（三角形）: 偽フラグはオレンジ色で本物と区別しにくくする
  ctx.fillStyle = isFake ? '#ff8800' : '#ff3333';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 1.3, cy - r * 0.35);
  ctx.lineTo(cx, cy + r * 0.1);
  ctx.closePath();
  ctx.fill();

  // 台座
  ctx.strokeStyle = '#dddddd';
  ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.65, cy + r);
  ctx.lineTo(cx + r * 0.65, cy + r);
  ctx.stroke();
}
