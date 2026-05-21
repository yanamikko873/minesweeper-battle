'use strict';
require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const path     = require('path');

const app        = express();
const httpServer = http.createServer(app);

// Socket.io（開発時は全オリジン許可、本番は CORS_ORIGIN 環境変数で制限）
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// ========== ミドルウェア ==========
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ========== 静的ファイル配信（ローカル開発用） ==========
// 本番は S3+CloudFront から配信するので不要になる
app.use(express.static(path.join(__dirname, '../frontend')));

// ========== REST API ==========
app.use('/api', require('./routes/board'));
app.use('/api', require('./routes/room'));

// ヘルスチェック
app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ========== Socket.io ==========
require('./socket/index')(io);

// ========== 起動 ==========
const PORT = parseInt(process.env.PORT || '3000', 10);
httpServer.listen(PORT, () => {
  console.log(`✅ サーバー起動: http://localhost:${PORT}`);
  console.log(`   ヘルスチェック: http://localhost:${PORT}/health`);
  console.log(`   毎日ボードAPI:  http://localhost:${PORT}/api/daily-board`);
});
