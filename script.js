// ===== GAS URL =====
const HP_GAS_URL = 'https://script.google.com/macros/s/AKfycbwabqeV2enmmmriEdwml3i1rZQq3tJIs1PRkwwpArYKLdRgMHpPKG6FqFVCUPMGEGKv/exec';

// ===== Header scroll =====
const header = document.getElementById('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

// ===== Hamburger =====
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

// ===== NEXT EVENT スライドショー =====
(function () {
  const INTERVAL = 4000; // 切り替え間隔（ミリ秒）4000 = 4秒

  const slideshow = document.getElementById('eventSlideshow');
  const dotsWrap  = document.getElementById('slideDots');
  if (!slideshow) return;

  const imgs = Array.from(slideshow.querySelectorAll('.slide-img'));
  if (imgs.length <= 1) return; // 1枚以下はスライド不要

  let current = 0;

  // ドットを動的生成
  imgs.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'slide-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', (i + 1) + '枚目');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });

  function goTo(n) {
    imgs[current].classList.remove('active');
    dotsWrap.children[current].classList.remove('active');
    current = (n + imgs.length) % imgs.length;
    imgs[current].classList.add('active');
    dotsWrap.children[current].classList.add('active');
  }

  // 自動切り替え（ホバー中は停止）
  let timer = setInterval(() => goTo(current + 1), INTERVAL);
  slideshow.addEventListener('mouseenter', () => clearInterval(timer));
  slideshow.addEventListener('mouseleave', () => {
    timer = setInterval(() => goTo(current + 1), INTERVAL);
  });

  // スワイプ対応（スマホ）
  let startX = 0;
  slideshow.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  slideshow.addEventListener('touchend',   e => {
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) goTo(current + (diff > 0 ? 1 : -1));
  });
})();

// ===== Fade-up on scroll =====
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
fadeEls.forEach(el => { el.classList.add('fade-up'); observer.observe(el); });

// ===== Smooth scroll =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.offsetTop - 68, behavior: 'smooth' });
  });
});

// ==================================================
// ステップ式予約フォーム（ホームページ用）
// ==================================================
let hpGuests   = 0;
let hpDate     = '';
let hpTime     = '';
let hpSeatType = 'table';

// ステップ移動
function hpGoStep(n) {
  document.querySelectorAll('.hp-step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.hp-step-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.toggle('active',    s === n);
    d.classList.toggle('completed', s < n);
  });
  document.getElementById('hp-step' + n).classList.add('active');
  const formSection = document.getElementById('reserve');
  if (formSection) window.scrollTo({ top: formSection.offsetTop - 68, behavior: 'smooth' });
}

// STEP 1：人数プルダウン
const hpGuestSel = document.getElementById('hp-guestSelect');
if (hpGuestSel) {
  hpGuestSel.addEventListener('change', function () {
    const val = parseInt(this.value);
    if (!val) return;
    hpGuests   = val;
    hpSeatType = 'table';
    document.querySelectorAll('.hp-seat-btn').forEach(b => b.classList.remove('selected'));
    const seatGrp = document.getElementById('hp-seatTypeGroup');
    if (val >= 5) {
      seatGrp.style.display = 'none';
      setTimeout(() => hpGoStep(2), 300);
    } else {
      seatGrp.style.display = 'block';
    }
  });
}

// STEP 1：席タイプ
document.querySelectorAll('.hp-seat-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hp-seat-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    hpSeatType = btn.dataset.type;
    setTimeout(() => hpGoStep(2), 300);
  });
});

// STEP 2：日付
const hpPickDate    = document.getElementById('hp-pickDate');
const hpDateNextBtn = document.getElementById('hp-dateNextBtn');
if (hpPickDate) {
  const today = new Date();
  hpPickDate.min = today.toISOString().split('T')[0];
  hpPickDate.addEventListener('change', () => {
    const d   = new Date(hpPickDate.value + 'T00:00:00');
    const day = d.getDay();
    if (day !== 5 && day !== 6) { // 金(5)・土(6)のみ営業
      hpPickDate.setCustomValidity('営業日は金曜日・土曜日のみです');
      hpDateNextBtn.disabled = true;
    } else {
      hpPickDate.setCustomValidity('');
      hpDateNextBtn.disabled = !hpPickDate.value;
    }
  });
  hpDateNextBtn.addEventListener('click', () => {
    if (!hpPickDate.value) return;
    hpDate = hpPickDate.value;
    hpGoStep(3);
    hpLoadTimeSlots();
  });
}

// STEP 3：時間帯を静的表示（空き確認は送信時にGAS側で実施）
function hpLoadTimeSlots() {
  document.getElementById('hp-timeLoading').style.display = 'none';
  document.getElementById('hp-timeError').style.display   = 'none';
  document.getElementById('hp-cafeTimes').style.display   = 'none';
  document.getElementById('hp-cafeGrid').innerHTML = '';
  document.getElementById('hp-barGrid').innerHTML  = '';

  const BAR_SLOTS = ['21:00','21:30','22:00','22:30','23:00','23:30'];
  const barGrid   = document.getElementById('hp-barGrid');

  BAR_SLOTS.forEach(time => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'hp-time-btn';
    btn.textContent = time;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hp-time-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      hpTime = time;
      setTimeout(() => { hpGoStep(4); hpUpdateSummary(); }, 300);
    });
    barGrid.appendChild(btn);
  });

  document.getElementById('hp-barTimes').style.display = 'block';
}

// ===== バー目的ラジオ：再タップで選択解除（HP用）=====
let _lastHpBarPurpose = null;
document.querySelectorAll('input[name="hp-barPurpose"]').forEach(radio => {
  radio.addEventListener('click', function () {
    if (_lastHpBarPurpose === this) {
      this.checked = false;
      _lastHpBarPurpose = null;
      document.getElementById('hp-hiddenPurpose').value = 'bar';
    } else {
      _lastHpBarPurpose = this;
      document.getElementById('hp-hiddenPurpose').value = this.value;
    }
  });
});

function hpShowTimeError(msg) {
  document.getElementById('hp-timeLoading').style.display = 'none';
  const el = document.getElementById('hp-timeError');
  el.style.display = 'block';
  el.textContent   = msg;
}

function hpRenderTimeSlots(slots) {
  const cafeGrid = document.getElementById('hp-cafeGrid');
  const barGrid  = document.getElementById('hp-barGrid');
  let hasCafe = false, hasBar = false;

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'hp-time-btn' + (slot.available ? '' : ' full');
    btn.textContent = slot.time;
    btn.disabled    = !slot.available;

    if (slot.available) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.hp-time-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        hpTime = slot.time;
        setTimeout(() => { hpGoStep(4); hpUpdateSummary(); }, 300);
      });
    }

    const [hh, mm] = slot.time.split(':').map(Number);
    const mins = hh * 60 + mm;
    // バーのみ表示（カフェ時間帯は非表示）
    if (mins >= 1260 && mins <= 1410) { barGrid.appendChild(btn); hasBar = true; }
  });

  if (hasCafe) document.getElementById('hp-cafeTimes').style.display = 'block';
  if (hasBar)  document.getElementById('hp-barTimes').style.display  = 'block';
  if (!hasCafe && !hasBar) hpShowTimeError('この日は全時間帯が満席です。別の日をお選びください。');
}

// STEP 4：サマリー更新
function hpIsBarTime(time) {
  const [h, m] = time.split(':').map(Number);
  return (h * 60 + m) >= 1260;
}

function hpUpdateSummary() {
  const seatLabel = hpSeatType === 'counter' ? 'カウンター' : 'テーブル席';
  document.getElementById('hp-summaryGuests').textContent = hpGuests + '名・' + seatLabel;
  document.getElementById('hp-summaryDate').textContent   = hpDate.replace(/-/g, '/');
  document.getElementById('hp-summaryTime').textContent   = hpTime + '〜';
  document.getElementById('hp-hiddenGuests').value   = hpGuests;
  document.getElementById('hp-hiddenDate').value     = hpDate;
  document.getElementById('hp-hiddenTime').value     = hpTime;
  document.getElementById('hp-hiddenSeatType').value = hpSeatType;

  const barGrp = document.getElementById('hp-barPurposeGroup');
  if (hpIsBarTime(hpTime)) {
    barGrp.style.display = 'block';
    document.getElementById('hp-hiddenPurpose').value = 'bar';
    document.querySelectorAll('input[name="hp-barPurpose"]').forEach(r => r.checked = false);
    _lastHpBarPurpose = null;
    const partyBtn   = document.querySelector('input[name="hp-barPurpose"][value="party"]');
    const partyLabel = document.getElementById('hp-partyPurposeBtn');
    if (partyBtn && partyLabel) {
      const ok = hpGuests >= 10;
      partyBtn.disabled = !ok;
      partyLabel.classList.toggle('hp-purpose-btn--disabled', !ok);
      partyLabel.title = ok ? '' : '10名以上からご利用いただけます';
    }
  } else {
    barGrp.style.display = 'none';
    document.getElementById('hp-hiddenPurpose').value = 'cafe';
  }
}

// フォーム送信
const hpForm = document.getElementById('hp-reserveForm');
if (hpForm) {
  hpForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const submitBtn = hpForm.querySelector('.hp-submit-btn');
    const name  = hpForm.querySelector('input[name="name"]').value.trim();
    const phone = hpForm.querySelector('input[name="phone"]').value.trim();
    const email = hpForm.querySelector('input[name="email"]').value.trim();

    if (hpIsBarTime(hpTime)) {
      const barP = hpForm.querySelector('input[name="hp-barPurpose"]:checked');
      document.getElementById('hp-hiddenPurpose').value = barP ? barP.value : 'bar';
    }
    if (!name || !phone || !email) {
      hpShowMessage('必須項目をすべて入力してください。', 'error'); return;
    }
    if (!hpGuests || !hpDate || !hpTime) {
      hpShowMessage('人数・日付・時間を最初から選び直してください。', 'error'); return;
    }

    submitBtn.textContent = '送信中...';
    submitBtn.disabled    = true;

    const data = {
      guests_num: hpGuests,
      date:       hpDate,
      time:       hpTime,
      purpose:    document.getElementById('hp-hiddenPurpose').value,
      seat_type:  hpSeatType,
      name, phone, email,
      guests:     hpGuests + '名',
      message:    hpForm.querySelector('textarea[name="message"]').value.trim(),
    };

    try {
      await hpSubmitToGAS(data);
      hpForm.reset();
      hpGuests = 0; hpDate = ''; hpTime = ''; hpSeatType = 'table';
      document.getElementById('hp-guestSelect').value = '';
      document.getElementById('hp-seatTypeGroup').style.display = 'none';
      hpGoStep(1);
      hpShowMessage('✅ ご予約を受け付けました！\n詳細をメールで送付しました。ご確認ください。', 'success');
    } catch {
      hpShowMessage('送信に失敗しました。お電話（0877-35-9499）にてご連絡ください。', 'error');
    } finally {
      submitBtn.textContent = '予約を確定する';
      submitBtn.disabled    = false;
    }
  });
}

function hpSubmitToGAS(data) {
  return new Promise((resolve) => {
    const iframeName = 'hp_gas_' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name  = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
    const form   = document.createElement('form');
    form.method  = 'GET';
    form.action  = HP_GAS_URL;
    form.target  = iframeName;
    Object.entries(data).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = k; input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    setTimeout(() => {
      document.body.removeChild(form);
      document.body.removeChild(iframe);
      resolve();
    }, 2000);
  });
}

function hpShowMessage(text, type) {
  const msg = document.getElementById('hp-form-message');
  if (!msg) return;
  msg.style.display = 'block';
  msg.className  = 'hp-form-message ' + type;
  msg.textContent = text;
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
