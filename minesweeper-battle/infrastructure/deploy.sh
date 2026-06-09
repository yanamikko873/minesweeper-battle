#!/bin/bash
# EC2 へのデプロイスクリプト（Phase 5 AWS デプロイ用）
# 使い方: ./deploy.sh <EC2_HOST>
# 例: ./deploy.sh ec2-xx-xx-xx-xx.ap-northeast-1.compute.amazonaws.com

set -euo pipefail

EC2_HOST="${1:?EC2ホスト名を引数で渡してください}"
EC2_USER="ec2-user"
KEY_FILE="${KEY_FILE:-~/.ssh/id_rsa}"
REMOTE_DIR="/home/ec2-user/minesweeper-battle"

echo "=== [1/4] バックエンドを EC2 に転送 ==="
rsync -avz --exclude 'node_modules' \
  -e "ssh -i $KEY_FILE" \
  ../minesweeper-battle/backend/ \
  "${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/backend/"

echo "=== [2/4] npm install ==="
ssh -i "$KEY_FILE" "${EC2_USER}@${EC2_HOST}" \
  "cd ${REMOTE_DIR}/backend && npm install --omit=dev"

echo "=== [3/4] PM2 で再起動 ==="
ssh -i "$KEY_FILE" "${EC2_USER}@${EC2_HOST}" \
  "cd ${REMOTE_DIR}/backend && pm2 start server.js --name minesweeper-battle || pm2 restart minesweeper-battle"

echo "=== [4/4] フロントエンドを S3 に同期 ==="
# S3_BUCKET 環境変数を設定してから実行してください
# 例: export S3_BUCKET=my-minesweeper-bucket
if [ -n "${S3_BUCKET:-}" ]; then
  aws s3 sync ../minesweeper-battle/frontend/ "s3://${S3_BUCKET}/" \
    --delete \
    --cache-control "public, max-age=3600"
  echo "S3 同期完了: s3://${S3_BUCKET}"
else
  echo "[スキップ] S3_BUCKET が未設定のため S3 同期をスキップ"
fi

echo "=== デプロイ完了 ==="
