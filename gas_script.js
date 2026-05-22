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
function getAvailability(date, guests, seatType) {
  if (!date) return { status: 'error', message: 'date required' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('席管理');

  if (!sheet) return { status: 'nosheet', message: '席管理シートがありません' };

  const data  = sheet.getDataRange().getValues();
  const slots = [];

  for (let i = 1; i < data.length; i++) {
    if (formatDate(data[i][0]) !== date) continue;

    const time  = formatTime(data[i][1]);
    const cnt2  = parseInt(data[i][2]) || 0;
    const cnt4  = parseInt(data[i][3]) || 0;
    const cntC  = parseInt(data[i][4]) || 0;

    let available = false;

    if (seatType === 'counter') {
      // カウンター：guests人分の空きがあるか
      available = cntC >= guests;
    } else {
      // テーブル席
      if (guests <= 2) {
        available = cnt2 > 0 || cnt4 > 0;
      } else {
        available = cnt4 > 0;
      }
    }

    slots.push({ time, available });
  }

  return { status: 'ok', date, guests, seatType, slots };
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
        if (formatDate(data[i][0]) !== date || formatTime(data[i][1]) !== time) continue;

        const cnt2 = parseInt(data[i][2]) || 0;
        const cnt4 = parseInt(data[i][3]) || 0;
        const cntC = parseInt(data[i][4]) || 0;

        const seatType = params.seat_type || 'table';

        if (seatType === 'counter') {
          // カウンター：人数分を一度に減らす
          if (cntC >= guests) {
            sheet.getRange(i+1,5).setValue(cntC - guests);
            tableAssigned = 'カウンター';
          } else {
            return { status: 'full', message: 'カウンターの空き席が不足しています。' };
          }
        } else {
          // テーブル席
          if (guests <= 2) {
            if      (cnt2 > 0) { sheet.getRange(i+1,3).setValue(cnt2-1); tableAssigned = '2名テーブル'; }
            else if (cnt4 > 0) { sheet.getRange(i+1,4).setValue(cnt4-1); tableAssigned = '4名テーブル'; }
            else return { status: 'full', message: 'テーブル席が満席です。' };
          } else {
            if (cnt4 > 0) { sheet.getRange(i+1,4).setValue(cnt4-1); tableAssigned = '4名テーブル'; }
            else return { status: 'full', message: '4名テーブルが満席です。' };
          }
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
    sheet.appendRow(['受付日時','予約日','時間','名前','電話','メール','人数','テーブル','目的','ご要望','ステータス']);
    sheet.getRange(1,1,1,11).setFontWeight('bold').setBackground('#f5e6c8');
  } else {
    // ヘッダーに「ステータス」列がなければ追加
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!header.includes('ステータス')) {
      sheet.getRange(1, header.length + 1).setValue('ステータス');
      sheet.getRange(1, header.length + 1).setFontWeight('bold').setBackground('#f5e6c8');
    }
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
    '確定',  // ステータス初期値
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
// 時刻フォーマット（Sheetsが日付オブジェクトで返す場合に対応）
// ================================================================
function formatTime(t) {
  if (!t) return '';
  if (typeof t === 'string') return t;
  const dt = new Date(t);
  return String(dt.getHours()).padStart(2,'0') + ':' +
         String(dt.getMinutes()).padStart(2,'0');
}

// ================================================================
// ★ セットアップ：席管理シートを60日分生成
//   Apps Scriptの「実行」ボタンでこの関数を選んで実行してください
// ================================================================
// ================================================================
// キャンセル自動検知（予約リストのステータスを「キャンセル」に変えると自動復元）
// ※ この関数は onEdit という名前のままにしてください（自動実行されます）
// ================================================================
function onEdit(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== '予約リスト') return;

  const col = e.range.getColumn();
  const row = e.range.getRow();
  if (row <= 1) return; // ヘッダー行は無視

  // ステータス列（11列目）が「キャンセル」に変更された場合のみ処理
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = header.indexOf('ステータス') + 1;
  if (col !== statusCol) return;
  if (e.value !== 'キャンセル') return;

  // 予約情報を取得
  const rowData = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const reservationDate = formatDate(rowData[1]); // 予約日
  const reservationTime = formatTime(rowData[2]); // 時間
  const tableAssigned   = String(rowData[7]);      // テーブル種別

  if (!reservationDate || !reservationTime) return;

  // 席管理シートの対応行の席数を+1
  restoreSeat(reservationDate, reservationTime, tableAssigned);
}

// ================================================================
// 席数を1つ戻す（キャンセル時）
// ================================================================
function restoreSeat(date, time, tableType) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('席管理');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (formatDate(data[i][0]) !== date || formatTime(data[i][1]) !== time) continue;

    const MAX = { '2名テーブル': 2, '4名テーブル': 3, 'カウンター': 4 };

    if (tableType === '2名テーブル') {
      const cur = parseInt(data[i][2]) || 0;
      sheet.getRange(i+1, 3).setValue(Math.min(cur + 1, MAX['2名テーブル']));
    } else if (tableType === '4名テーブル') {
      const cur = parseInt(data[i][3]) || 0;
      sheet.getRange(i+1, 4).setValue(Math.min(cur + 1, MAX['4名テーブル']));
    } else if (tableType === 'カウンター') {
      const cur = parseInt(data[i][4]) || 0;
      sheet.getRange(i+1, 5).setValue(Math.min(cur + 1, MAX['カウンター']));
    }
    break;
  }
}

// ★ 実行前にスプレッドシートから「席管理」シートを手動で削除してください
function setupSeatManagement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.insertSheet('席管理');

  const SLOTS = ['07:00','07:30','08:00','08:30','09:00','09:30',
                 '10:00','10:30','11:00','11:30','12:00','12:30',
                 '13:00','13:30','14:00','14:30','15:00','15:30',
                 '21:00','21:30','22:00','22:30','23:00'];

  const rows = [['日付','時間','2名残数','4名残数','カウンター残席','備考']];
  const today = new Date();

  for (let d = 0; d < 30; d++) {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d);
    if (dt.getDay() === 1) continue;
    const ds = dt.getFullYear() + '-' +
               String(dt.getMonth()+1).padStart(2,'0') + '-' +
               String(dt.getDate()).padStart(2,'0');
    SLOTS.forEach(t => rows.push([ds, t, 2, 3, 4, '']));
  }

  sheet.getRange(1, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.getUi().alert('✅ 完了！' + (rows.length - 1) + '行を生成しました。');
}

// 追加で次の30日分を生成する関数
function addNextMonth() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('席管理');
  if (!sheet) { SpreadsheetApp.getUi().alert('先にsetupSeatManagementを実行してください。'); return; }

  const lastRow  = sheet.getLastRow();
  const lastDate = lastRow > 1 ? new Date(sheet.getRange(lastRow, 1).getValue()) : new Date();
  lastDate.setDate(lastDate.getDate() + 1);

  const slots = [];
  for (let h = 11; h <= 16; h++) { slots.push(String(h).padStart(2,'0')+':00'); slots.push(String(h).padStart(2,'0')+':30'); }
  for (let h = 18; h <= 26; h++) { slots.push(String(h).padStart(2,'0')+':00'); slots.push(String(h).padStart(2,'0')+':30'); }

  const rows = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date(lastDate);
    date.setDate(lastDate.getDate() + d);
    if (date.getDay() === 1) continue;
    const dateStr = formatDate(date);
    slots.forEach(t => rows.push([dateStr, t, 2, 3, 4, '']));
  }

  if (rows.length > 0) sheet.getRange(lastRow + 1, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.getUi().alert('✅ 次の30日分を追加しました！');
}

// lp.js側での時間帯判定と合わせる
// カフェ：07:00〜15:30 / バー：21:00〜23:00
