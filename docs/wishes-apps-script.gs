/**
 * Lời chúc → Google Sheet (chỉ ghi, không đọc).
 *
 * Trang mời gửi mỗi lời chúc tới script này; script thêm một dòng vào bảng tính.
 * Không ai đọc được lời chúc qua script — chỉ người mở được bảng tính mới xem được.
 *
 * Cài đặt (làm một lần, bằng tài khoản Google của bạn):
 *   1. Mở bảng tính "lời chúc" → Tiện ích mở rộng (Extensions) → Apps Script.
 *   2. Xóa hết nội dung có sẵn, dán toàn bộ tệp này vào, bấm Lưu.
 *   3. Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment) → loại "Ứng dụng web" (Web app):
 *        - Thực thi dưới dạng (Execute as): Tôi (Me)
 *        - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 *      Bấm Triển khai, cấp quyền khi được hỏi (màn hình "Google chưa xác minh ứng dụng này":
 *      Nâng cao → Đi tới dự án).
 *   4. Chép "URL ứng dụng web" (kết thúc bằng /exec) vào WISHES.endpoint trong src/config.ts.
 *   5. Trong bảng tính: Chia sẻ → Quyền truy cập chung → "Bị hạn chế", để chỉ mình bạn xem được.
 *
 * Sửa script về sau: Deploy → Manage deployments → bút chì → Version: New version (URL giữ nguyên).
 */

// (dùng khi script không gắn sẵn vào bảng tính)
var SHEET_ID = '1BecRUlJYy7eiv7fUAFPwjG_JswJ4ME3vH1-Yp2xVlzU'
// tên trang tính để ghi; để trống = trang đầu tiên
var SHEET_NAME = ''
// dừng nhận khi bảng đã quá dài (chống bị gửi rác)
var MAX_ROWS = 5000

function doPost(e) {
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    // ô bẫy: người thật không bao giờ điền
    if (d.website) return reply({ ok: true })
    var name = clean(d.name, 40)
    var wish = clean(d.wish, 80)
    var id = clean(d.id, 48)
    if (!wish) return reply({ ok: false, error: 'empty' })

    // trang mời gửi lại khi mạng chập chờn: cùng một mã thì chỉ ghi một lần
    var cache = CacheService.getScriptCache()
    if (id && cache.get(id)) return reply({ ok: true, dup: true })

    var lock = LockService.getScriptLock()
    lock.waitLock(10000)
    try {
      var sh = sheet()
      if (sh.getLastRow() === 0) {
        sh.appendRow(['Thời gian', 'Tên khách', 'Lời chúc', 'Mã'])
        sh.setFrozenRows(1)
      }
      if (sh.getLastRow() > MAX_ROWS) return reply({ ok: false, error: 'full' })
      sh.appendRow([new Date(), name, wish, id])
    } finally {
      lock.releaseLock()
    }
    if (id) cache.put(id, '1', 21600)
    return reply({ ok: true })
  } catch (err) {
    return reply({ ok: false, error: String(err) })
  }
}

// mở URL bằng trình duyệt chỉ thấy chữ "ok": không trả về lời chúc nào
function doGet() {
  return ContentService.createTextOutput('ok')
}

function sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID)
  return (SHEET_NAME && ss.getSheetByName(SHEET_NAME)) || ss.getSheets()[0]
}

// cắt ngắn, bỏ ký tự điều khiển, và không để nội dung chạy như công thức
function clean(v, max) {
  var s = String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, max)
  if (/^[=+\-@]/.test(s)) s = "'" + s
  return s
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
