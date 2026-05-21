'use strict';
const express = require('express');
const router  = express.Router();
const boardService = require('../services/boardService');
const dynamoService = require('../services/dynamoService');

// GET /api/daily-board
router.get('/daily-board', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

    let board = await dynamoService.getDailyBoard(today);
    if (!board) {
      board = boardService.generateDailyBoard(today);
      await dynamoService.saveDailyBoard(today, board);
      console.log(`[Board] ${today} のパズルを生成しました (seed: ${board.seed})`);
    }

    res.json(board);
  } catch (err) {
    console.error('[Board] エラー:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
