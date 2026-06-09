// Socket.io クライアント薄ラッパー
// multi.js / room.js から利用する

class GameSocket {
  constructor() {
    this.socket = null;
  }

  connect() {
    // server.js が frontend/ を静的配信しているので同一オリジン
    this.socket = io();
    this.socket.on('connect', () => {
      console.log('[Socket] 接続:', this.socket.id);
    });
    this.socket.on('disconnect', () => {
      console.log('[Socket] 切断');
    });
    this.socket.on('error', ({ message }) => {
      console.warn('[Socket] エラー:', message);
      alert('エラー: ' + message);
    });
    return this;
  }

  on(event, fn)       { this.socket.on(event, fn);      return this; }
  off(event, fn)      { this.socket.off(event, fn);     return this; }
  emit(event, data)   { this.socket.emit(event, data);  return this; }
  get id()            { return this.socket?.id ?? null; }
  get connected()     { return this.socket?.connected ?? false; }
}
