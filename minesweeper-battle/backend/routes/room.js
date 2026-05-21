'use strict';
const express     = require('express');
const router      = express.Router();
const roomManager = require('../socket/roomManager');

// POST /api/rooms  →  部屋を作成
router.post('/rooms', (req, res) => {
  const { type } = req.body;
  if (type !== 'private' && type !== 'random') {
    return res.status(400).json({ error: 'type は "private" か "random" を指定してください' });
  }

  const room = roomManager.createRoom(type === 'random');
  res.status(201).json({
    roomId:   room.roomId,
    roomCode: room.roomCode,
    status:   room.status,
  });
});

// GET /api/rooms/:roomCode  →  部屋情報取得
router.get('/rooms/:roomCode', (req, res) => {
  const room = roomManager.getRoomByCode(req.params.roomCode.toUpperCase());
  if (!room) return res.status(404).json({ error: '部屋が見つかりません' });

  res.json({
    roomId:      room.roomId,
    playerCount: room.players.size,
    maxPlayers:  4,
    status:      room.status,
  });
});

module.exports = router;
