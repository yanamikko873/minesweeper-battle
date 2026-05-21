document.addEventListener('DOMContentLoaded', () => {
  // 今日の日付・難易度表示
  const today = new Date();
  document.getElementById('today-date').textContent =
    today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });

  // ソロプレイ（難易度選択して遷移）
  document.getElementById('btn-solo').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=intermediate';
  });

  document.getElementById('btn-beginner').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=beginner';
  });

  document.getElementById('btn-expert').addEventListener('click', () => {
    window.location.href = 'game.html?difficulty=expert';
  });

  document.getElementById('btn-private').addEventListener('click', () => {
    alert('合言葉対戦はPhase 3で実装予定です。');
  });

  document.getElementById('btn-random').addEventListener('click', () => {
    alert('ランダム対戦はPhase 3で実装予定です。');
  });
});
