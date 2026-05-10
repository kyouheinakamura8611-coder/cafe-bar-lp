// ================================================================
// Haze Coffee&Bar 予約フォーム受信スクリプト
// Google Apps Script に貼り付けて使用してください
// ================================================================

// ▼ 設定：店舗への通知メールアドレスを入力してください
const STORE_EMAIL = 'YOUR_STORE_EMAIL@gmail.com';
const STORE_NAME  = 'Haze Coffee&Bar';

// ================================================================
// POST受信（フォーム送信時に呼ばれる）
// ================================================================
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // 1. スプレッドシートに記録
    saveToSheet(data);

    // 2. お客様へ確認メール送信
    sendConfirmationToCustomer(data);

    // 3. 店舗へ通知メール送信
    sendNotificationToStore(data);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GASのURLテスト用
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'GAS is running.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ================================================================
// スプレッドシートに予約データを記録
// ================================================================
function saveToSheet(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // ヘッダーがなければ追加
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '受付日時', 'ご利用目的', 'お名前', '電話番号',
      'メールアドレス', 'ご希望日', 'ご利用人数', 'ご要望・ご質問'
    ]);
    sheet.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#f5e6c8');
  }

  const purposeMap = {
    cafe:   'カフェ利用',
    bar:    'バー利用',
    goukon: '合コン・個室',
    event:  'イベント参加',
    party:  '貸切パーティ',
    other:  'その他',
  };

  sheet.appendRow([
    new Date(),
    purposeMap[data.purpose] || data.purpose,
    data.name,
    data.phone,
    data.email,
    data.date,
    data.guests  || '未記入',
    data.message || '特になし',
  ]);
}

// ================================================================
// お客様への確認メール
// ================================================================
function sendConfirmationToCustomer(data) {
  const purposeMap = {
    cafe:   'カフェ利用',
    bar:    'バー利用',
    goukon: '合コン・個室',
    event:  'イベント参加',
    party:  '貸切パーティ',
    other:  'その他',
  };

  const subject = `【${STORE_NAME}】予約リクエストを受け付けました`;
  const body = `
${data.name} 様

この度はHaze Coffee&Barへのご予約リクエストありがとうございます。
以下の内容で受け付けいたしました。

─────────────────────────
■ 予約内容
─────────────────────────
ご利用目的　：${purposeMap[data.purpose] || data.purpose}
お名前　　　：${data.name} 様
電話番号　　：${data.phone}
ご希望日　　：${data.date}
ご利用人数　：${data.guests || '未記入'}
ご要望　　　：${data.message || '特になし'}
─────────────────────────

担当者より営業時間内（10:00〜22:00）にご連絡いたします。
お急ぎの場合はお電話（0877-35-9499）にてご連絡ください。

今後ともHaze Coffee&Barをよろしくお願いいたします。

─────────────────────────
Haze Coffee&Bar
〒769-0201 香川県綾歌郡宇多津町浜一番丁７−１
TEL: 0877-35-9499
営業時間：CAFÉ 11:00〜17:00 / BAR 18:00〜27:00
定休日：月曜日
─────────────────────────
  `.trim();

  GmailApp.sendEmail(data.email, subject, body);
}

// ================================================================
// 店舗への通知メール
// ================================================================
function sendNotificationToStore(data) {
  const purposeMap = {
    cafe:   'カフェ利用',
    bar:    'バー利用',
    goukon: '合コン・個室',
    event:  'イベント参加',
    party:  '貸切パーティ',
    other:  'その他',
  };

  const subject = `【新規予約】${data.name}様 - ${purposeMap[data.purpose] || data.purpose}`;
  const body = `
新しい予約リクエストが届きました。

─────────────────────────
■ 予約内容
─────────────────────────
受付日時　　：${new Date().toLocaleString('ja-JP')}
ご利用目的　：${purposeMap[data.purpose] || data.purpose}
お名前　　　：${data.name} 様
電話番号　　：${data.phone}
メール　　　：${data.email}
ご希望日　　：${data.date}
ご利用人数　：${data.guests || '未記入'}
ご要望　　　：${data.message || '特になし'}
─────────────────────────

※ 営業時間内にお客様へのご連絡をお願いします。
  `.trim();

  GmailApp.sendEmail(STORE_EMAIL, subject, body);
}
