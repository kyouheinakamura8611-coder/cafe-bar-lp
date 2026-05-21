// ===== GAS Web App URL =====
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwabqeV2enmmmriEdwml3i1rZQq3tJIs1PRkwwpArYKLdRgMHpPKG6FqFVCUPMGEGKv/exec';

// ===== 選択状態 =====
let selectedGuests = 0;
let selectedDate   = '';
let selectedTime   = '';

// ===== ステップ管理 =====
function goStep(n) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.step-dot').forEach(d => {
    const s = parseInt(d.dataset.step);
    d.classList.toggle('active',    s === n);
    d.classList.toggle('completed', s < n);
  });
  document.getElementById('step' + n).classList.add('active');
  document.getElementById('form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== STEP 1：人数選択 =====
document.querySelectorAll('.guest-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.guest-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedGuests = parseInt(btn.dataset.num);
    setTimeout(() => goStep(2), 300);
  });
});

// ===== STEP 2：日付選択 =====
const pickDate    = document.getElementById('pickDate');
const dateNextBtn = document.getElementById('dateNextBtn');

// 今日以降・月曜除外
const today = new Date();
pickDate.min = today.toISOString().split('T')[0];

pickDate.addEventListener('change', () => {
  const d = new Date(pickDate.value + 'T00:00:00');
  if (d.getDay() === 1) {
    pickDate.setCustomValidity('月曜日は定休日です');
    dateNextBtn.disabled = true;
  } else {
    pickDate.setCustomValidity('');
    dateNextBtn.disabled = !pickDate.value;
  }
});

dateNextBtn.addEventListener('click', () => {
  if (!pickDate.value) return;
  selectedDate = pickDate.value;
  goStep(3);
  loadTimeSlots();
});

// ===== STEP 3：時間帯読み込み（JSONP）=====
function loadTimeSlots() {
  document.getElementById('timeLoading').style.display = 'block';
  document.getElementById('timeError').style.display   = 'none';
  document.getElementById('cafeTimes').style.display   = 'none';
  document.getElementById('barTimes').style.display    = 'none';
  document.getElementById('cafeGrid').innerHTML = '';
  document.getElementById('barGrid').innerHTML  = '';

  const cbName = 'gasAvailCb_' + Date.now();
  const timeout = setTimeout(() => {
    delete window[cbName];
    showTimeError('タイムアウトしました。ページを再読み込みしてください。');
  }, 10000);

  window[cbName] = (data) => {
    clearTimeout(timeout);
    delete window[cbName];
    document.getElementById('timeLoading').style.display = 'none';

    if (data.status !== 'ok' || !data.slots || data.slots.length === 0) {
      showTimeError('この日の予約枠が見つかりません。別の日をお選びください。');
      return;
    }
    renderTimeSlots(data.slots);
  };

  const script = document.createElement('script');
  script.src = GAS_URL + '?action=availability&date=' + selectedDate +
               '&guests=' + selectedGuests + '&callback=' + cbName;
  script.onerror = () => {
    clearTimeout(timeout);
    showTimeError('空き確認に失敗しました。再度お試しください。');
  };
  document.head.appendChild(script);
}

function showTimeError(msg) {
  document.getElementById('timeLoading').style.display = 'none';
  const el = document.getElementById('timeError');
  el.style.display = 'block';
  el.textContent   = msg;
}

function renderTimeSlots(slots) {
  const cafeGrid = document.getElementById('cafeGrid');
  const barGrid  = document.getElementById('barGrid');
  let hasCafe = false, hasBar = false;

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type      = 'button';
    btn.className = 'time-btn' + (slot.available ? '' : ' time-btn--full');
    btn.textContent = slot.time + (slot.available ? '' : '\n満席');
    btn.disabled  = !slot.available;

    if (slot.available) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTime = slot.time;
        setTimeout(() => goStep(4), 300);
        updateSummary();
      });
    }

    const h = parseInt(slot.time.split(':')[0]);
    if (h >= 18) {
      barGrid.appendChild(btn);
      hasBar = true;
    } else {
      cafeGrid.appendChild(btn);
      hasCafe = true;
    }
  });

  if (hasCafe) document.getElementById('cafeTimes').style.display = 'block';
  if (hasBar)  document.getElementById('barTimes').style.display  = 'block';
  if (!hasCafe && !hasBar) {
    showTimeError('この日は全時間帯が満席です。別の日をお選びください。');
  }
}

// ===== STEP 4：サマリー更新 =====
function updateSummary() {
  document.getElementById('summaryGuests').textContent = selectedGuests + '名';
  document.getElementById('summaryDate').textContent   = selectedDate.replace(/-/g, '/');
  document.getElementById('summaryTime').textContent   = selectedTime + '〜';
  document.getElementById('hiddenGuests').value = selectedGuests;
  document.getElementById('hiddenDate').value   = selectedDate;
  document.getElementById('hiddenTime').value   = selectedTime;
}

// ===== フォーム送信 =====
document.getElementById('lpForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector('.lp-submit-btn');

  // バリデーション
  const purpose = form.querySelector('input[name="purpose"]:checked');
  const name    = form.querySelector('input[name="name"]').value.trim();
  const phone   = form.querySelector('input[name="phone"]').value.trim();
  const email   = form.querySelector('input[name="email"]').value.trim();

  if (!purpose) { showMessage('ご利用目的を選択してください。', 'error'); return; }
  if (!name || !phone || !email) { showMessage('必須項目をすべて入力してください。', 'error'); return; }
  if (!selectedGuests || !selectedDate || !selectedTime) {
    showMessage('人数・日付・時間を最初から選び直してください。', 'error'); return;
  }

  submitBtn.textContent = '送信中...';
  submitBtn.disabled    = true;

  const data = {
    guests_num: selectedGuests,
    date:       selectedDate,
    time:       selectedTime,
    purpose:    purpose.value,
    name,
    phone,
    email,
    guests:     selectedGuests + '名',
    message:    form.querySelector('textarea[name="message"]').value.trim(),
  };

  try {
    await submitToGAS(data);
    form.reset();
    selectedGuests = 0; selectedDate = ''; selectedTime = '';
    goStep(1);
    showMessage('✅ ご予約を受け付けました！\n確認メールをご確認ください。営業時間内に担当者よりご連絡いたします。', 'success');
  } catch (err) {
    showMessage('送信に失敗しました。お電話（0877-35-9499）にてご連絡ください。', 'error');
  } finally {
    submitBtn.textContent = '予約を確定する';
    submitBtn.disabled    = false;
  }
});

// ===== 隠しiframeでGASに送信 =====
function submitToGAS(data) {
  return new Promise((resolve) => {
    const iframeName = 'gas_frame_' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name  = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form   = document.createElement('form');
    form.method  = 'GET';
    form.action  = GAS_URL;
    form.target  = iframeName;

    Object.entries(data).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type  = 'hidden';
      input.name  = k;
      input.value = v;
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

// ===== メッセージ表示 =====
function showMessage(text, type) {
  const msg = document.getElementById('formMessage');
  msg.className   = 'form-message form-message--' + type;
  msg.textContent = text;
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== スムーズスクロール =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    window.scrollTo({ top: target.offsetTop - 60, behavior: 'smooth' });
  });
});

// ===== Fixed CTA =====
const fixedCta = document.querySelector('.fixed-cta');
window.addEventListener('scroll', () => {
  if (fixedCta) {
    fixedCta.style.opacity      = window.scrollY > 100 ? '1' : '0';
    fixedCta.style.pointerEvents = window.scrollY > 100 ? 'auto' : 'none';
  }
});
