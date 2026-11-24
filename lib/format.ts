// =====================================================
// format.ts — ฟังก์ชันแปลงตัวเลข / วันที่ / เวลา ให้เป็นข้อความภาษาไทย
// ใช้ได้ทุกหน้า เช่น baht(1500) → "฿1,500"
// =====================================================

export const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

// เรียงตาม getDay() ของ JavaScript: 0 = อาทิตย์, 1 = จันทร์, ...
export const THAI_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const THAI_WEEKDAYS_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

/** เติม 0 ข้างหน้าให้ครบ 2 หลัก เช่น 5 → "05" */
export function twoDigits(n: number): string {
  return String(n).padStart(2, "0");
}

/** จำนวนเงิน เช่น baht(12480) → "฿12,480" และ baht(60, 2) → "฿60.00" */
export function baht(amount: number, decimals = 0): string {
  const text = amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return "฿" + text;
}

/** ปี พ.ศ. = ปี ค.ศ. + 543 */
export function buddhistYear(date: Date): number {
  return date.getFullYear() + 543;
}

/** วันที่แบบสั้น เช่น "31 ต.ค. 2569" */
export function thaiShortDate(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${buddhistYear(date)}`;
}

/** วันที่แบบตัวเลข เช่น "31/10/2569" */
export function thaiNumericDate(date: Date): string {
  return `${twoDigits(date.getDate())}/${twoDigits(date.getMonth() + 1)}/${buddhistYear(date)}`;
}

/** เวลา เช่น "14:20" */
export function hhmm(date: Date): string {
  return `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

/** สองวันนี้เป็นวันเดียวกันหรือไม่ (ไม่สนเวลา) */
export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * ช่วงวันที่แบบสั้น
 *   วันเดียว        → "31 ต.ค. 2569"
 *   เดือนเดียวกัน   → "1 – 31 ต.ค. 2569"
 *   คนละเดือน      → "26 ต.ค. – 1 พ.ย. 2569"
 */
export function thaiRange(start: Date, end: Date): string {
  if (sameDay(start, end)) {
    return thaiShortDate(start);
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const endText = `${end.getDate()} ${THAI_MONTHS_SHORT[end.getMonth()]} ${buddhistYear(end)}`;
  if (sameMonth) {
    return `${start.getDate()} – ${endText}`;
  }
  return `${start.getDate()} ${THAI_MONTHS_SHORT[start.getMonth()]} – ${endText}`;
}

/** ระยะเวลา เช่น 145 นาที → "2 ชม. 25 นาที" */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} นาที`;
  if (mins === 0) return `${hours} ชม.`;
  return `${hours} ชม. ${mins} นาที`;
}

/** ช่วงของวันจากชั่วโมง (ใช้ใต้กราฟช่วงเวลาหนาแน่น) */
export function dayPeriod(hour: number): string {
  if (hour <= 11) return "เช้า";
  if (hour === 12) return "เที่ยง";
  if (hour <= 15) return "บ่าย";
  if (hour <= 18) return "เย็น";
  return "ค่ำ";
}
