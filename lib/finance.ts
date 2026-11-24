// =====================================================
// finance.ts — คำนวณตัวเลขหน้ารายงานการเงิน ตามช่วงวันที่ที่เลือก
// ข้อมูลรายรับเป็นตัวอย่าง (จำลอง) แต่วันเดิมจะได้ตัวเลขเดิมเสมอ
// ใช้ทั้งหน้ารายงานการเงินและ Dashboard → ตัวเลขสองหน้าตรงกัน
// ระบบจริง: เปลี่ยน revenueOfDay() ให้ดึงยอดรวมรายวันจากฐานข้อมูล
// =====================================================
import { SAMPLE_PAYMENTS } from "./data";
import { THAI_MONTHS_SHORT, THAI_WEEKDAYS_SHORT, buddhistYear, hhmm, twoDigits } from "./format";

/** ค่าจอดเฉลี่ยต่อรายการ (ตัวอย่าง) ใช้ประมาณจำนวนรายการจากรายรับ */
export const AVG_FEE = 37.2;

// ---------------- ตัวช่วยเรื่องวันที่ ----------------

/** ตัดเวลาออก เหลือแค่วันที่ (เวลา 00:00) */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** บวก/ลบจำนวนวัน */
export function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/** รายชื่อวันทั้งหมดตั้งแต่ start ถึง end */
function listDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let d = startOfDay(start);
  const last = startOfDay(end);
  while (d <= last) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

// ---------------- รายรับ ----------------

/** รายรับ (บาท) ของวันหนึ่ง — สร้างตัวเลขสุ่มแบบคงที่จากวันที่ (วันเดิม → ตัวเลขเดิมทุกครั้ง) */
export function revenueOfDay(d: Date): number {
  // แปลงวันที่เป็นตัวเลข เช่น 15 พ.ย. 2026 → 20261115 แล้วสุ่มจากตัวเลขนี้
  const dateNumber = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  const x = Math.sin(dateNumber) * 10000;
  const random = x - Math.floor(x); // 0 ถึง 1
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const thousands = 8 + random * 4 + (isWeekend ? 3 : 0); // 8,000–15,000 บาท
  return Math.round(thousands * 1000);
}

/** รวมรายรับของหลายวัน */
function sumRevenue(days: Date[]): number {
  let total = 0;
  for (const d of days) total += revenueOfDay(d);
  return total;
}

// สัดส่วนรายรับแต่ละชั่วโมง 06:00–22:00 (เช้ากับเย็นคนเยอะ)
const HOUR_WEIGHTS = [3, 6, 9, 8, 6, 5, 6, 6, 5, 5, 6, 8, 10, 9, 6, 4, 2];
const FIRST_HOUR = 6;

// ---------------- สรุปรายงาน ----------------

/** แท่งกราฟ 1 แท่ง */
export type Bar = { label: string; sub?: string; value: number; date: Date; hour?: number };

export type FinanceSummary = {
  days: Date[];         // วันทั้งหมดในช่วง
  total: number;        // รายรับรวม
  count: number;        // จำนวนรายการชำระ
  avg: number;          // ค่าจอดเฉลี่ยต่อรายการ
  prevTotal: number;    // รายรับช่วงก่อนหน้า (ยาวเท่ากัน) ใช้เปรียบเทียบ
  prevCount: number;
  bars: Bar[];          // ข้อมูลกราฟ
  barMode: "hour" | "day";
  peak: Bar;            // แท่งที่สูงที่สุด
};

/** สรุปรายรับของช่วงวันที่ และเทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน */
export function financeFor(start: Date, end: Date): FinanceSummary {
  const days = listDays(start, end);
  const total = sumRevenue(days);
  const count = Math.round(total / AVG_FEE);

  // ช่วงก่อนหน้า เช่น เลือก 7 วัน → เทียบกับ 7 วันก่อนหน้านั้น
  const prevDays = days.map((d) => addDays(d, -days.length));
  const prevTotal = sumRevenue(prevDays);
  const prevCount = Math.round(prevTotal / AVG_FEE);

  let bars: Bar[];
  let barMode: "hour" | "day";

  if (days.length === 1) {
    // เลือกวันเดียว → กราฟรายชั่วโมง
    barMode = "hour";
    const weightSum = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
    bars = HOUR_WEIGHTS.map((weight, i) => {
      const hour = FIRST_HOUR + i;
      return {
        label: i % 2 === 0 ? twoDigits(hour) : "", // แสดงป้ายเว้นชั่วโมง ไม่ให้แน่นเกิน
        value: Math.round((total * weight) / weightSum),
        date: days[0],
        hour,
      };
    });
  } else {
    // หลายวัน → กราฟรายวัน
    barMode = "day";
    bars = days.map((d, i) => {
      // ถ้าเกิน 14 วัน แสดงป้ายทุก 5 วัน (และวันสุดท้าย)
      const showLabel = days.length <= 14 || i % 5 === 0 || i === days.length - 1;
      return {
        label: showLabel ? String(d.getDate()) : "",
        sub: days.length <= 7 ? THAI_WEEKDAYS_SHORT[d.getDay()] : undefined,
        value: revenueOfDay(d),
        date: d,
      };
    });
  }

  // หาแท่งที่สูงที่สุด
  let peak = bars[0];
  for (const b of bars) {
    if (b.value > peak.value) peak = b;
  }

  const avg = count > 0 ? total / count : 0;
  return { days, total, count, avg, prevTotal, prevCount, bars, barMode, peak };
}

// ---------------- ข้อความ ----------------

/** ข้อความเปรียบเทียบ เช่น "▲ 9.4% จากเมื่อวาน" */
export function deltaText(current: number, previous: number, against: string): string {
  if (!previous) return "";
  const percent = ((current - previous) / previous) * 100;
  const arrow = percent >= 0 ? "▲" : "▼";
  return `${arrow} ${Math.abs(percent).toFixed(1)}% ${against}`;
}

/** คำว่า "จากช่วงก่อน" ให้ตรงกับช่วงที่เลือก */
export function againstLabel(period: string, dayCount: number): string {
  if (period === "day") return "จากเมื่อวาน";
  if (period === "week") return "จากสัปดาห์ก่อน";
  if (period === "month") return "จากเดือนก่อน";
  return `จาก ${dayCount} วันก่อนหน้า`;
}

/** ชื่อช่วงสำหรับหัวการ์ด */
export function periodWord(period: string): string {
  if (period === "day") return "วันนี้";
  if (period === "week") return "สัปดาห์นี้";
  if (period === "month") return "เดือนนี้";
  return "ช่วงที่เลือก";
}

/** ป้ายของแท่งกราฟ เช่น "ศ 2 ต.ค." หรือ "17:00–18:00 น." */
export function peakLabel(bar: Bar): string {
  if (bar.hour !== undefined) {
    return `${twoDigits(bar.hour)}:00–${twoDigits(bar.hour + 1)}:00 น.`;
  }
  const d = bar.date;
  return `${THAI_WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]}`;
}

// ---------------- รายการชำระตัวอย่าง ----------------

/**
 * รายการชำระตัวอย่างของวันนี้ (เวลานับย้อนจากตอนนี้)
 * แสดงเฉพาะเมื่อช่วงที่เลือกครอบวันนี้
 */
export function transactionsIn(start: Date, end: Date) {
  const now = new Date();
  const todayDate = startOfDay(now);
  const inRange = startOfDay(start) <= todayDate && todayDate <= startOfDay(end);
  if (!inRange) return [];

  return SAMPLE_PAYMENTS.map((p, i) => {
    const t = new Date(now.getTime() - p.minutesAgo * 60000);
    const id = `TX-${buddhistYear(t)}${twoDigits(t.getMonth() + 1)}${twoDigits(t.getDate())}${twoDigits(t.getHours())}${twoDigits(t.getMinutes())}${i + 1}`;
    return {
      id,
      plate: p.plate,
      time: `${t.getDate()} ${THAI_MONTHS_SHORT[t.getMonth()]} ${hhmm(t)}`,
      channel: "ThaiQR",
      amount: p.amount,
      status: p.status,
    };
  });
}
