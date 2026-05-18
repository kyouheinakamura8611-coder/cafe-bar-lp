// ===== GAS Web App URL（デプロイ後にここを書き換えてください）=====
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwabqeV2enmmmriEdwml3i1rZQq3tJIs1PRkwwpArYKLdRgMHpPKG6FqFVCUPMGEGKv/exec';

// ===== スムーズスクロール =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const offset = 60;
    window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
  });
});

// ===== フォーム送信（GAS連携）=====
document.getElementById('lpForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('.lp-submit-btn');

  // バリデーション
  const purpose = form.querySelector('input[name="purpose"]:checked');
  if (!purpose) {
    showMessage('ご利用目的を選択してください。', 'error');
    return;
  }
  const name  = form.querySelector('input[name="name"]').value.trim();
  const phone = form.querySelector('input[name="phone"]').value.trim();
  const email = form.querySelector('input[name="email"]').value.trim();
  const date  = form.querySelector('input[name="date"]').value;
  if (!name || !phone || !email || !date) {
    showMessage('必須項目をすべて入力してください。', 'error');
    return;
  }

  // 送信中の表示
  submitBtn.textContent = '送信中...';
  submitBtn.disabled = true;

  // フォームデータ収集
  const data = {
    purpose: purpose.value,
    name,
    phone,
    email,
    date,
    guests:  form.querySelector('select[name="guests"]').value,
    message: form.querySelector('textarea[name="message"]').value.trim(),
  };

  try {
    // 隠しiframe経由でGASにフォーム送信（リダイレクト対応・最も確実）
    await submitToGAS(data);

    // 成功表示
    form.reset();
    showMessage('✅ 予約リクエストを受け付けました！\nご入力いただいたメールアドレスに確認メールをお送りしました。\n営業時間内に担当者よりご連絡いたします。', 'success');

  } catch (err) {
    showMessage('送信に失敗しました。お手数ですがお電話（0877-35-9499）にてご連絡ください。', 'error');
  } finally {
    submitBtn.textContent = '予約リクエストを送信する';
    submitBtn.disabled = false;
  }
});

// ===== 隠しiframeでGASに送信 =====
function submitToGAS(data) {
  return new Promise((resolve) => {
    const iframeName = 'gas_frame_' + Date.now();

    // 隠しiframe作成
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    // フォーム作成
    const form = document.createElement('form');
    form.method = 'GET';
    form.action = GAS_URL;
    form.target = iframeName;

    // フィールド追加
    Object.entries(data).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    // 送信後クリーンアップ
    setTimeout(() => {
      document.body.removeChild(form);
      document.body.removeChild(iframe);
      resolve();
    }, 2000);
  });
}

// ===== メッセージ表示 =====
function showMessage(text, type) {
  let msg = document.getElementById('formMessage');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'formMessage';
    document.getElementById('lpForm').before(msg);
  }
  msg.className = 'form-message form-message--' + type;
  msg.textContent = text;
  msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ===== Fixed CTA スクロール表示 =====
const fixedCta = document.querySelector('.fixed-cta');
window.addEventListener('scroll', () => {
  if (fixedCta) {
    fixedCta.style.opacity = window.scrollY > 100 ? '1' : '0';
    fixedCta.style.pointerEvents = window.scrollY > 100 ? 'auto' : 'none';
  }
});
