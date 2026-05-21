'use strict';
require('dotenv').config();

// ローカル開発用のインメモリキャッシュ
const memoryCache = new Map();

const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true';
const TABLE_NAME   = process.env.DYNAMODB_TABLE || 'daily_boards';

// DynamoDB クライアント（Phase 5 デプロイ時に有効化）
let dynamo = null;
if (USE_DYNAMODB) {
  try {
    const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
    const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
    const base = new DynamoDBClient({ region: process.env.AWS_REGION || 'ap-northeast-1' });
    dynamo = DynamoDBDocumentClient.from(base);
    console.log('[DynamoDB] クライアント初期化完了');
  } catch (e) {
    console.warn('[DynamoDB] SDK が見つかりません。インメモリで動作します。');
  }
}

async function getDailyBoard(date) {
  // 1. インメモリキャッシュ
  if (memoryCache.has(date)) return memoryCache.get(date);

  // 2. DynamoDB（有効な場合）
  if (dynamo) {
    try {
      const { GetCommand } = require('@aws-sdk/lib-dynamodb');
      const res = await dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { date } }));
      if (res.Item) {
        memoryCache.set(date, res.Item);
        return res.Item;
      }
    } catch (e) {
      console.warn('[DynamoDB] 取得失敗:', e.message);
    }
  }

  return null;
}

async function saveDailyBoard(date, data) {
  memoryCache.set(date, data);

  if (dynamo) {
    try {
      const { PutCommand } = require('@aws-sdk/lib-dynamodb');
      await dynamo.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: { ...data, createdAt: new Date().toISOString() },
      }));
      console.log(`[DynamoDB] ${date} のボードを保存しました`);
    } catch (e) {
      console.warn('[DynamoDB] 保存失敗:', e.message);
    }
  }
}

module.exports = { getDailyBoard, saveDailyBoard };
