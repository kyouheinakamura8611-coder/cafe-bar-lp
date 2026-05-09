// スムーズスクロール（固定ヘッダー分オフセット）
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 60;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});

// フォーム送信（デモ）
document.getElementById('lpForm').addEventListener('submit', e => {
  e.preventDefault();
  alert('予約リクエストを受け付けました。\n確認メールをお送りしますのでしばらくお待ちください。');
  e.target.reset();
});

// スクロールでFixed CTAの表示
const fixedCta = document.querySelector('.fixed-cta');
window.addEventListener('scroll', () => {
  fixedCta.style.opacity = window.scrollY > 100 ? '1' : '0';
  fixedCta.style.pointerEvents = window.scrollY > 100 ? 'auto' : 'none';
});
