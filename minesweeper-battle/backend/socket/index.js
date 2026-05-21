'use strict';
const roomManager = require('./roomManager');

module.exports = function registerSocketEvents(io) {
  io.on('connection', socket => {
    console.log(`[Socket] 接続: ${socket.id}`);

    // 部屋に入室（合言葉マッチング）
    socket.on('join_room', ({ roomId, playerName }) => {
      roomManager.joinRoom(io, socket, roomId, playerName);
    });

    // ランダムマッチング
    socket.on('join_random', ({ playerName }) => {
      roomManager.joinRandom(io, socket, playerName);
    });

    // 準備完了
    socket.on('player_ready', ({ roomId }) => {
      roomManager.setReady(io, socket, roomId);
    });

    // ゲーム開始（部屋主のみ）
    socket.on('start_game', ({ roomId }) => {
      roomManager.startGame(io, socket, roomId);
    });

    // 開放セル数の進捗通知
    socket.on('cell_opened', ({ roomId, count }) => {
      roomManager.updateProgress(io, socket, roomId, count);
    });

    // クリア通知
    socket.on('game_clear', ({ roomId, time }) => {
      roomManager.handleClear(io, socket, roomId, time);
    });

    // ゲームオーバー通知
    socket.on('game_over', ({ roomId }) => {
      roomManager.handleGameOver(io, socket, roomId);
    });

    // 切断
    socket.on('disconnect', () => {
      roomManager.handleDisconnect(io, socket);
      console.log(`[Socket] 切断: ${socket.id}`);
    });
  });
};
