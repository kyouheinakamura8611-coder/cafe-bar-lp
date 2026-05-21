// ================================================================
// Haze Coffee&Bar 予約フォーム受信スクリプト v2
// ================================================================

const STORE_EMAIL = 'moruno1027@gmail.com';
const STORE_NAME  = 'Haze Coffee&Bar';

// ================================================================
// GET受信（空き確認・予約送信）
// ================================================================
function doGet(e) {
  const action   = e.parameter.action || '';
  const callback = e.parameter.callback || '';

  try {
    let result;

    if (action === 'availability') {
      // 空き確認
      result = getAvailability(e.parameter.date, parseInt(e.parameter.guests) || 1);

    } else if (e.parameter.name) {
      // 予約送信
      result = processReservation(e.parameter);

    } else {
      result = { status: 'ok', message: 'GAS is running.' };
    }

    const json = JSON.stringify(result);
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('Error: ' + err.message);
    const json = JSON.stringify({ status: 'error', message: err.message });
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + json + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(json)
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) { return doGet(e); }

// ================================================================
// 空き確認
// ================================================================
function getAvailability(date, guests) {
  if (!date) return { status: 'error', message: 'date required' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('席管理');

  if (!sheet) return { status: 'nosheet', message: '席管理シートがありません' };

  const data  = sheet.getDataRange().getValues();
  const slots = [];

  for (let i = 1; i < data.length; i++) {
    if (formatDate(data[i][0]) !== date) continue;

    const time  = String(data[i][1]);
    const cnt2  = parseInt(data[i][2]) || 0; // 2名テーブル残数
    const cnt4  = parseInt(data[i][3]) || 0; // 4名テーブル残数
    const cntC  = parseInt(data[i][4]) || 0; // カウンター残席

    let available = false;
    if (guests <= 2) {
      available = (cnt2 > 0 || cnt4 > 0 || cntC > 0);
    } else {
      available = cnt4 > 0;
    }

    slots.push({ time, available });
  }

  return { status: 'ok', date, guests, slots };
}

// ================================================================
// 予約処理
// ================================================================
function processReservation(params) {
  const guests = parseInt(params.guests_num) || 1;
  const date   = params.date;
  const time   = params.time;
  let tableAssigned = '';

  // 席数を1つ減らす
  if (date && time) {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('席管理');

    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (formatDate(data[i][0]) !== date || String(data[i][1]) !== time) continue;

        const cnt2 = parseInt(data[i][2]) || 0;
        const cnt4 = parseInt(data[i][3]) || 0;
        const cntC = parseInt(data[i][4]) || 0;

        if (guests <= 2) {
          if      (cnt2 > 0) { sheet.getRange(i+1,3).setValue(cnt2-1); tableAssigned = '2名テーブル'; }
          else if (cnt4 > 0) { sheet.getRange(i+1,4).setValue(cnt4-1); tableAssigned = '4名テーブル'; }
          else if (cntC > 0) { sheet.getRange(i+1,5).setValue(cntC-1); tableAssigned = 'カウンター'; }
          else return { status: 'full', message: 'ご指定の時間帯は満席です。' };
        } else {
          if (cnt4 > 0) { sheet.getRange(i+1,4).setValue(cnt4-1); tableAssigned = '4名テーブル'; }
          else return { status: 'full', message: '4名席が満席です。別の時間をお選びください。' };
        }
        break;
      }
    }
  }

  params.tableAssigned = tableAssigned;
  saveToSheet(params);
  sendConfirmationToCustomer(params);
  sendNotificationToStore(params);

  return { status: 'success' };
}

// ================================================================
// スプレッドシートに記録
// ================================================================
function saveToSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('予約リスト');

  if (!sheet) {
    sheet = ss.insertSheet('予約リスト');
    sheet.appendRow(['受付日時','予約日','時間','名前','電話','メール','人数','テーブル','目的','ご要望']);
    sheet.getRange(1,1,1,10).setFontWeight('bold').setBackground('#f5e6c8');
  }

  const purposeMap = {
    cafe:'カフェ', bar:'バー', goukon:'合コン/個室',
    event:'イベント', party:'貸切', other:'その他'
  };

  sheet.appendRow([
    new Date(),
    data.date    || '',
    data.time    || '',
    data.name    || '',
    data.phone   || '',
    data.email   || '',
    data.guests  || '',
    data.tableAssigned || '',
    purposeMap[data.purpose] || data.purpose || '',
    data.message || '',
  ]);
}

// ================================================================
// お客様への確認メール
// ================================================================
function sendConfirmationToCustomer(data) {
  if (!data.email) return;
  const subject = `【${STORE_NAME}】ご予約を承りました`;
  const body = `
${data.name} 様

ご予約ありがとうございます。以下の内容で承りました。

━━━━━━━━━━━━━━━━━━━
■ ご予約内容
━━━━━━━━━━━━━━━━━━━
日　付：${data.date}
時　間：${data.time}〜
人　数：${data.guests}
お席　：${data.tableAssigned || '当日ご案内'}
ご要望：${data.message || 'なし'}
━━━━━━━━━━━━━━━━━━━

当日のご来店をお待ちしております。
ご不明な点は下記までお気軽にご連絡ください。

${STORE_NAME}
〒769-0201 香川県綾歌郡宇多津町浜一番丁７−１
TEL: 0877-35-9499
CAFÉ 11:00〜17:00 ／ BAR 18:00〜27:00
定休日：月曜日
  `.trim();
  GmailApp.sendEmail(data.email, subject, body);
}

// ================================================================
// 店舗への通知メール
// ================================================================
function sendNotificationToStore(data) {
  const subject = `【新規予約】${data.name}様 ${data.date} ${data.time}〜`;
  const body = `
新しいご予約が入りました。

━━━━━━━━━━━━━━━━━━━
日　付：${data.date}
時　間：${data.time}〜
人　数：${data.guests}
テーブル：${data.tableAssigned || '未割当'}
名　前：${data.name}
電　話：${data.phone}
メール：${data.email}
ご要望：${data.message || 'なし'}
━━━━━━━━━━━━━━━━━━━
  `.trim();
  GmailApp.sendEmail(STORE_EMAIL, subject, body);
}

// ================================================================
// 日付フォーマット
// ================================================================
function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  const dt = new Date(d);
  return dt.getFullYear() + '-' +
    String(dt.getMonth()+1).padStart(2,'0') + '-' +
    String(dt.getDate()).padStart(2,'0');
}

// ================================================================
// ★ セットアップ：席管理シートを60日分生成
//   Apps Scriptの「実行」ボタンでこの関数を選んで実行してください
// ================================================================
function setupSeatManagement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('席管理');

  if (sheet) {
    sheet.clearContents();
  } else {
    sheet = ss.insertSheet('席管理');
  }

  // ヘッダー
  sheet.appendRow([
    '日付', '時間',
    '2名テーブル残数\n(最大2)',
    '4名テーブル残数\n(最大3)',
    'カウンター残席\n(最大4)',
    '備考'
  ]);
  sheet.getRange(1,1,1,6).setFontWeight('bold').setBackground('#c6efce');
  sheet.setFrozenRows(1);

  // 時間枠生成
  const cafeSlots = [];
  for (let h = 11; h <= 16; h++) {
    cafeSlots.push(String(h).padStart(2,'0') + ':00');
    cafeSlots.push(String(h).padStart(2,'0') + ':30');
  }
  // 16:30まで（17:00閉店の30分前）
  const barSlots = [];
  for (let h = 18; h <= 26; h++) {
    barSlots.push(String(h).padStart(2,'0') + ':00');
    barSlots.push(String(h).padStart(2,'0') + ':30');
  }

  const today = new Date();
  const rows  = [];

  for (let d = 0; d < 60; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d);
    if (date.getDay() === 1) continue; // 月曜定休

    const dateStr = formatDate(date);
    [...cafeSlots, ...barSlots].forEach(t => {
      rows.push([dateStr, t, 2, 3, 4, '']);
    });
  }

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);

  // 残数0のセルを赤くする条件付き書式
  const numRange = sheet.getRange(2, 3, rows.length, 3);
  const rule = SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(0)
    .setBackground('#ffcccc')
    .setFontColor('#cc0000')
    .setRanges([numRange])
    .build();
  sheet.setConditionalFormatRules([rule]);

  // 列幅調整
  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 70);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 120);

  SpreadsheetApp.getUi().alert('✅ セットアップ完了！\n60日分の予約枠を生成しました。\n数字を直接編集して席数を管理できます。');
}
