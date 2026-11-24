// =====================================================
// fee.ts — อัตราค่าจอด และสูตรคิดค่าจอด
// ใช้ทั้งหน้าเว็บ (แสดงราคา) และเซิร์ฟเวอร์ (คิดเงินจริงตอนชำระ)
// =====================================================

/** วิธีปัดเศษเวลา: ปัดขึ้นเป็นชั่วโมง หรือปัดขึ้นทุก 30 นาที */
export type Rounding = "hour" | "half-hour";

/** การตั้งค่าอัตราค่าจอด (แก้ได้ที่หน้า Admin › อัตราค่าจอด) */
export type Rates = {
  freeMinutes: number;        // จอดฟรีกี่นาทีแรก
  perHour: number;            // ค่าจอดต่อชั่วโมง (บาท)
  maxPerDay: number;          // ค่าจอดสูงสุดต่อวัน (บาท)
  rounding: Rounding;         // วิธีปัดเศษ
  exitWithinMinutes: number;  // จ่ายแล้วต้องออกภายในกี่นาที
  promptPay: string;          // เบอร์ PromptPay ของลานจอด
  thaiQR: boolean;            // เปิดรับชำระผ่าน ThaiQR หรือไม่
};

/** ค่าเริ่มต้น */
export const DEFAULT_RATES: Rates = {
  freeMinutes: 15,
  perHour: 20,
  maxPerDay: 200,
  rounding: "hour",
  exitWithinMinutes: 15,
  promptPay: "081-234-5678",
  thaiQR: true,
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * นับจำนวนชั่วโมงที่ต้องจ่าย จากนาทีที่ต้องคิดเงิน
 * เช่น 61 นาที → ปัดเป็นชั่วโมง = 2 ชม. / ปัดทุก 30 นาที = 1.5 ชม.
 */
function billableHours(minutes: number, rates: Rates): number {
  if (rates.rounding === "hour") {
    return Math.ceil(minutes / 60);
  }
  return Math.ceil(minutes / 30) / 2;
}

/**
 * คิดค่าจอดจากจำนวนนาทีที่จอด
 *
 * ขั้นตอน:
 *   1. ถ้าจอดไม่เกินเวลาฟรี → 0 บาท
 *   2. แต่ละวันเต็ม (24 ชม.) คิดเท่ากับเพดานต่อวัน
 *   3. เวลาที่เหลือ: หักเวลาฟรี (เฉพาะวันแรก) → ปัดเศษ → คูณราคาต่อชั่วโมง → ไม่เกินเพดานต่อวัน
 *
 * ตัวอย่าง (ฟรี 15 นาที, 20 บาท/ชม.): จอด 145 นาที → หัก 15 = 130 นาที → ปัดเป็น 3 ชม. → 60 บาท
 */
export function calculateFee(minutes: number, rates: Rates = DEFAULT_RATES): number {
  if (minutes <= rates.freeMinutes) {
    return 0;
  }

  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const restMinutes = minutes - fullDays * MINUTES_PER_DAY;

  // หักเวลาฟรีเฉพาะวันแรก
  let billableMinutes = restMinutes;
  if (fullDays === 0) {
    billableMinutes = restMinutes - rates.freeMinutes;
  }

  const restFee = billableHours(billableMinutes, rates) * rates.perHour;
  const restFeeCapped = Math.min(restFee, rates.maxPerDay);

  return fullDays * rates.maxPerDay + restFeeCapped;
}

/** ข้อความอธิบายว่าคิดเงินกี่ชั่วโมง (ใช้ในตารางตัวอย่างหน้าอัตราค่าจอด) */
export function billedHoursLabel(minutes: number, rates: Rates = DEFAULT_RATES): string {
  if (minutes <= rates.freeMinutes) {
    return "ฟรี";
  }

  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const restMinutes = minutes - fullDays * MINUTES_PER_DAY;
  let billableMinutes = restMinutes;
  if (fullDays === 0) {
    billableMinutes = restMinutes - rates.freeMinutes;
  }

  // ข้อความของส่วนที่เหลือ
  const hours = billableHours(billableMinutes, rates);
  let restLabel = "";
  if (billableMinutes > 0) {
    if (hours * rates.perHour >= rates.maxPerDay) {
      restLabel = "ถึงเพดานต่อวัน";
    } else {
      restLabel = `${hours} ชม.`;
    }
  }

  if (fullDays === 0) {
    return restLabel;
  }
  if (restLabel === "") {
    return `${fullDays} วัน (เพดาน)`;
  }
  return `${fullDays} วัน (เพดาน) + ${restLabel}`;
}

/**
 * ตรวจค่าอัตราที่ส่งมาจากหน้าเว็บ (ใช้ใน API) — ค่าไหนผิด ให้ใช้ค่าเดิมแทน
 * กันกรณีส่งตัวอักษรหรือเลขติดลบมา
 */
export function sanitizeRates(input: Partial<Rates>, current: Rates = DEFAULT_RATES): Rates {
  function positiveNumber(value: unknown, fallback: number): number {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return n;
    return fallback;
  }

  let rounding = current.rounding;
  if (input.rounding === "hour" || input.rounding === "half-hour") {
    rounding = input.rounding;
  }

  let promptPay = current.promptPay;
  if (typeof input.promptPay === "string") {
    promptPay = input.promptPay.trim();
  }

  let thaiQR = current.thaiQR;
  if (typeof input.thaiQR === "boolean") {
    thaiQR = input.thaiQR;
  }

  return {
    freeMinutes: positiveNumber(input.freeMinutes, current.freeMinutes),
    perHour: positiveNumber(input.perHour, current.perHour),
    maxPerDay: positiveNumber(input.maxPerDay, current.maxPerDay),
    rounding,
    exitWithinMinutes: positiveNumber(input.exitWithinMinutes, current.exitWithinMinutes),
    promptPay,
    thaiQR,
  };
}

/** สร้างข้อความประวัติ เฉพาะค่าที่เปลี่ยน เช่น "ค่าจอดต่อชั่วโมง ฿20 → ฿25" */
export function describeRateChanges(before: Rates, after: Rates): string[] {
  const changes: string[] = [];

  if (after.perHour !== before.perHour) {
    changes.push(`ค่าจอดต่อชั่วโมง ฿${before.perHour} → ฿${after.perHour}`);
  }
  if (after.freeMinutes !== before.freeMinutes) {
    changes.push(`จอดฟรี ${before.freeMinutes} → ${after.freeMinutes} นาที`);
  }
  if (after.maxPerDay !== before.maxPerDay) {
    changes.push(`ค่าจอดสูงสุดต่อวัน ฿${before.maxPerDay} → ฿${after.maxPerDay}`);
  }
  if (after.exitWithinMinutes !== before.exitWithinMinutes) {
    changes.push(`ต้องออกภายใน ${before.exitWithinMinutes} → ${after.exitWithinMinutes} นาที`);
  }
  if (after.promptPay !== before.promptPay) {
    changes.push(`เปลี่ยน PromptPay เป็น ${after.promptPay}`);
  }
  if (after.rounding !== before.rounding) {
    changes.push(`การปัดเศษ: ${roundingLabel(after.rounding)}`);
  }
  if (after.thaiQR !== before.thaiQR) {
    changes.push(after.thaiQR ? "เปิดรับชำระผ่าน ThaiQR" : "ปิดรับชำระผ่าน ThaiQR");
  }

  return changes;
}

/** ชื่อวิธีปัดเศษเป็นภาษาไทย */
export function roundingLabel(rounding: Rounding): string {
  if (rounding === "hour") return "ปัดขึ้นเป็นชั่วโมง";
  return "ปัดขึ้นทุก 30 นาที";
}
