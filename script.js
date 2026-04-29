// Header scroll effect
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

// Hamburger menu
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

hamburger.addEventListener('click', () => {
  hamburger.classList.toggle('active');
  mobileNav.classList.toggle('open');
});

function closeMobileNav() {
  hamburger.classList.remove('active');
  mobileNav.classList.remove('open');
}

// Fade-up on scroll
const fadeEls = document.querySelectorAll(
  '.menu-card, .private-card, .event-card, .concept__text, .concept__image, .gallery-item, .info-card'
);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

fadeEls.forEach(el => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// Form submit (demo)
document.getElementById('reserveForm').addEventListener('submit', (e) => {
  e.preventDefault();
  alert('ご予約を受け付けました。確認メールをお送りしますのでしばらくお待ちください。');
  e.target.reset();
});

// Smooth scroll offset for fixed header
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 68;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});
