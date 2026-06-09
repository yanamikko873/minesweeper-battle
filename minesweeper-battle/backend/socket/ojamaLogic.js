'use strict';

// ========== おじゃま送信しきい値 ==========
const FAKE_FLAG_STEP = 5;   // 5セル開くごとに偽フラグ1個
const FOG_STEP       = 15;  // 15セル開くごとに霧3マス

/**
 * プレイヤーが openedCount を更新したとき、おじゃまを判定して送信
 * @param {Server}   io
 * @param {object}   room      roomManager の Room
 * @param {string}   senderId  送信元の socketId
 * @param {number}   newCount  更新後の openedCount
 * @param {number}   oldCount  更新前の openedCount
 */
function checkAndSend(io, room, senderId, newCount, oldCount) {
  const opponents = [...room.players.keys()].filter(id => id !== senderId);
  if (opponents.length === 0) return;

  const pick = () => opponents[Math.floor(Math.random() * opponents.length)];

  // 霧しきい値 (FOG_STEP の倍数)
  const oldFog = Math.floor(oldCount / FOG_STEP);
  const newFog = Math.floor(newCount / FOG_STEP);
  for (let i = oldFog + 1; i <= newFog; i++) {
    io.to(pick()).emit('receive_fog', { count: 3 });
    console.log(`[Ojama] 霧: ${senderId.slice(-4)} → ランダム相手 (${i * FOG_STEP}セル到達)`);
  }

  // 偽フラグしきい値 (FAKE_FLAG_STEP の倍数、霧と重複するステップは除く)
  const oldFake = Math.floor(oldCount / FAKE_FLAG_STEP);
  const newFake = Math.floor(newCount / FAKE_FLAG_STEP);
  for (let i = oldFake + 1; i <= newFake; i++) {
    if (i * FAKE_FLAG_STEP % FOG_STEP === 0) continue; // 霧と重複
    io.to(pick()).emit('receive_fake_flag', {});
    console.log(`[Ojama] 偽フラグ: ${senderId.slice(-4)} → ランダム相手 (${i * FAKE_FLAG_STEP}セル到達)`);
  }
}

/**
 * プレイヤーが地雷を踏んだとき、他プレイヤーにボーナスを送信
 */
function sendBonus(io, room, eliminatedId) {
  for (const id of room.players.keys()) {
    if (id !== eliminatedId) {
      io.to(id).emit('receive_bonus', {});
    }
  }
  console.log(`[Ojama] ボーナス: ${eliminatedId.slice(-4)} が脱落 → 全相手に送信`);
}

/**
 * ノイズおじゃまを手動送信（将来的にトリガー追加予定）
 */
function sendNoise(io, targetSocketId, duration = 5000) {
  io.to(targetSocketId).emit('receive_noise', { duration });
}

module.exports = { checkAndSend, sendBonus, sendNoise };
