// =====================================================
// vehicles.ts — ข้อมูลรถในลานจอด: ชนิดข้อมูล · สถานะ · ยอดที่ต้องจ่าย · รถตัวอย่าง
// ใช้ร่วมกันทั้งเซิร์ฟเวอร์ (API) และหน้าเว็บ
// =====================================================
import { calculateFee, type Rates } from "./fee";

export type VehicleType = "Sedan" | "SUV" | "Pickup";

/** ข้อมูลรถ 1 คัน (1 ครั้งที่เข้าลานจอด) */
export type Vehicle = {
  id: string;
  plate: string;              // ทะเบียน เช่น "1กก 1122"
  province: string;           // จังหวัด
  type: VehicleType;          // ประเภทรถ
  floor: number;              // ชั้นที่จอด
  slot: string;               // ช่องที่จอด เช่น "B14"
  entryAt: string;            // เวลาเข้า (รูปแบบ ISO เช่น "2026-11-12T01:30:00.000Z")
  paidAt: string | null;      // เวลาชำระ (null = ยังไม่ชำระ)
  paidAmount: number | null;  // ยอดที่ชำระแล้ว (บาท)
  exitAt: string | null;      // เวลาออก (null = ยังอยู่ในลาน)
  unreadable?: boolean;       // true = ตู้ Kiosk อ่านทะเบียนไม่ได้
};

export const VEHICLE_TYPES: VehicleType[] = ["Sedan", "SUV", "Pickup"];

export const PROVINCES = ["กรุงเทพมหานคร", "นนทบุรี", "ปทุมธานี", "สมุทรปราการ", "นครปฐม", "ชลบุรี", "เชียงใหม่", "ขอนแก่น"];

// ---------------- สถานะ ----------------

export type VehicleStatus = "parked" | "paid" | "overdue" | "exited" | "free" | "check";

/** ข้อความและสีของแต่ละสถานะ (ใช้กับป้ายสถานะในตาราง) */
export const STATUS_INFO: Record<VehicleStatus, { tone: "success" | "warning" | "neutral" | "danger"; label: string }> = {
  parked: { tone: "warning", label: "ยังจอดอยู่" },
  paid: { tone: "success", label: "ชำระแล้ว · รอออก" },
  overdue: { tone: "danger", label: "เกินเวลาออก · ต้องชำระเพิ่ม" },
  exited: { tone: "success", label: "ชำระแล้ว" },
  free: { tone: "neutral", label: "ฟรีช่วงแรก" },
  check: { tone: "danger", label: "ตรวจสอบทะเบียน" },
};

/**
 * หาสถานะของรถ
 * ส่ง rates มาด้วย ถ้าอยากรู้ว่า "จ่ายแล้วแต่ออกช้าเกินเวลา" หรือไม่
 */
export function statusOf(v: Vehicle, rates?: Rates, now: Date = new Date()): VehicleStatus {
  if (v.unreadable) return "check";

  // ออกจากลานแล้ว
  if (v.exitAt) {
    if ((v.paidAmount ?? 0) > 0) return "exited";
    return "free";
  }

  // ยังอยู่ในลาน และจ่ายแล้ว
  if (v.paidAt) {
    if (rates && amountDue(v, rates, now) > 0) return "overdue";
    return "paid";
  }

  return "parked";
}

// ---------------- ทะเบียน ----------------

/** ตัดช่องว่างออก เพื่อเทียบทะเบียน: "1กก 1122" กับ "1กก1122" ถือว่าเป็นคันเดียวกัน */
export function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, "");
}

/**
 * ตรวจรูปแบบทะเบียนรถไทย
 *   [ตัวเลข 0–1 ตัว][ตัวอักษรไทย 1–3 ตัว][เว้นวรรคหรือไม่ก็ได้][ตัวเลข 1–4 ตัว]
 *   ตัวอย่างที่ถูก: "1กก 1122", "กข 1234", "7ขข4589"
 */
export function isValidPlate(plate: string): boolean {
  return /^[0-9]?[ก-ฮ]{1,3}\s?\d{1,4}$/.test(plate.trim());
}

/** สุ่มของ 1 อย่างจากรายการ */
export function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** สุ่มทะเบียน เช่น "5ณต 9686" (ไม่ซ้ำกับทะเบียนใน takenPlates) — ใช้ในการจำลอง */
export function randomPlate(takenPlates: string[]): string {
  const letters = Array.from("กขคงจฉชฌญฎฐฒณดตถทธนบปผพฟภมยรลวศษสหฬอฮ");
  const taken = takenPlates.map(normalizePlate);
  for (let i = 0; i < 50; i++) {
    const digit = 1 + Math.floor(Math.random() * 9);
    const number = 1000 + Math.floor(Math.random() * 9000);
    const plate = `${digit}${randomItem(letters)}${randomItem(letters)} ${number}`;
    if (!taken.includes(normalizePlate(plate))) return plate;
  }
  return `9ฮฮ ${Date.now() % 10000}`;
}

// ---------------- เวลาและเงิน ----------------

/** จอดมาแล้วกี่นาที (ถ้ายังไม่ออก นับถึงตอนนี้) */
export function minutesParked(v: Vehicle, now: Date = new Date()): number {
  const start = new Date(v.entryAt).getTime();
  const end = v.exitAt ? new Date(v.exitAt).getTime() : now.getTime();
  const minutes = Math.round((end - start) / 60000);
  return Math.max(0, minutes);
}

/**
 * ยอดที่ยังต้องจ่าย ณ ตอนนี้ (บาท)
 *   - ออกไปแล้ว                         → 0
 *   - ยังไม่จ่าย                         → ค่าจอดทั้งหมด
 *   - จ่ายแล้ว และยังอยู่ในเวลาที่ให้ออก   → 0
 *   - จ่ายแล้ว แต่ออกช้าเกินเวลา          → ค่าจอดรวมถึงตอนนี้ − ที่จ่ายไปแล้ว
 * ใช้ทั้งหน้าชำระเงิน จอที่ตู้ และ API (เซิร์ฟเวอร์คิดเงินด้วยสูตรนี้)
 */
export function amountDue(v: Vehicle, rates: Rates, now: Date = new Date()): number {
  if (v.exitAt) return 0;

  const totalFee = calculateFee(minutesParked(v, now), rates);
  if (!v.paidAt) return totalFee;

  const mustExitBy = new Date(v.paidAt).getTime() + rates.exitWithinMinutes * 60000;
  if (now.getTime() <= mustExitBy) return 0;

  const alreadyPaid = v.paidAmount ?? 0;
  return Math.max(0, totalFee - alreadyPaid);
}

// ---------------- รถตัวอย่าง ----------------

/**
 * รถตัวอย่างตอนเปิดระบบครั้งแรก (หรือกดรีเซ็ต)
 * คอลัมน์: ทะเบียน · จังหวัด · ประเภท · ชั้น · ช่อง · เข้ามากี่นาทีก่อน
 */
const SAMPLE_PARKED: [string, string, VehicleType, number, string, number][] = [
  ["1กก 1122", "กรุงเทพมหานคร", "Sedan", 2, "B14", 145],
  ["7ขข 4589", "กรุงเทพมหานคร", "SUV", 1, "A03", 103],
  ["9กก 9999", "กรุงเทพมหานคร", "Sedan", 2, "B05", 140],
  ["5กง 9034", "นนทบุรี", "SUV", 1, "A11", 520],
  ["กข 1201", "กรุงเทพมหานคร", "SUV", 1, "A01", 67],
  ["ทพ 552", "กรุงเทพมหานคร", "Pickup", 1, "A02", 114],
  ["ฉก 3310", "กรุงเทพมหานคร", "Sedan", 1, "A05", 161],
  ["2กพ 781", "กรุงเทพมหานคร", "Sedan", 1, "A06", 208],
  ["บต 6622", "กรุงเทพมหานคร", "SUV", 1, "A07", 255],
  ["1กร 4410", "กรุงเทพมหานคร", "Pickup", 1, "A09", 302],
  ["กท 1020", "กรุงเทพมหานคร", "Sedan", 1, "A12", 349],
  ["ศข 8845", "กรุงเทพมหานคร", "Sedan", 1, "A13", 396],
  ["3กม 2209", "กรุงเทพมหานคร", "SUV", 1, "A15", 23],
  ["วศ 7715", "กรุงเทพมหานคร", "Pickup", 1, "A16", 70],
  ["งก 2214", "กรุงเทพมหานคร", "Sedan", 2, "B01", 117],
  ["คพ 836", "กรุงเทพมหานคร", "Sedan", 2, "B02", 164],
  ["ยร 8916", "กรุงเทพมหานคร", "SUV", 2, "B04", 211],
  ["พร 3084", "กรุงเทพมหานคร", "Pickup", 2, "B06", 258],
  ["7กก 4965", "กรุงเทพมหานคร", "Sedan", 2, "B10", 305],
  ["รก 4812", "กรุงเทพมหานคร", "Sedan", 2, "B11", 352],
  ["กก 442", "กรุงเทพมหานคร", "SUV", 2, "B12", 399],
  ["6ญษ 3065", "กรุงเทพมหานคร", "Pickup", 2, "B13", 26],
  ["7ขข 2241", "กรุงเทพมหานคร", "Sedan", 2, "B15", 73],
  ["กฌ 4959", "กรุงเทพมหานคร", "Sedan", 2, "B16", 120],
  ["ขค 5501", "กรุงเทพมหานคร", "SUV", 3, "C01", 167],
  ["4กพ 1187", "กรุงเทพมหานคร", "Pickup", 3, "C03", 214],
  ["ผล 3390", "กรุงเทพมหานคร", "Sedan", 3, "C04", 261],
  ["1ขจ 6620", "กรุงเทพมหานคร", "Sedan", 3, "C06", 308],
  ["นม 4471", "กรุงเทพมหานคร", "SUV", 3, "C07", 355],
  ["กม 9081", "กรุงเทพมหานคร", "Pickup", 3, "C09", 402],
  ["ชบ 2233", "กรุงเทพมหานคร", "Sedan", 3, "C10", 29],
  ["8กข 5560", "กรุงเทพมหานคร", "Sedan", 3, "C12", 76],
  ["ภร 7790", "กรุงเทพมหานคร", "SUV", 3, "C13", 123],
  ["ดต 1146", "กรุงเทพมหานคร", "Pickup", 3, "C15", 170],
];

/** สร้างรายการรถตัวอย่าง — เวลาเข้า/ออกนับย้อนจาก "ตอนนี้" */
export function seedVehicles(now: Date = new Date()): Vehicle[] {
  // แปลง "กี่นาทีก่อน" เป็นเวลาจริง
  function minutesAgo(min: number): string {
    return new Date(now.getTime() - min * 60000).toISOString();
  }

  const list: Vehicle[] = [];

  // รถที่ยังจอดอยู่
  SAMPLE_PARKED.forEach(([plate, province, type, floor, slot, entered], i) => {
    list.push({
      id: `v${i + 1}`,
      plate, province, type, floor, slot,
      entryAt: minutesAgo(entered),
      paidAt: null,
      paidAmount: null,
      exitAt: null,
    });
  });

  // รถที่จ่ายแล้วและออกไปแล้ว
  list.push({
    id: "v90", plate: "3กค 7710", province: "ปทุมธานี", type: "Pickup", floor: 3, slot: "C08",
    entryAt: minutesAgo(470), paidAt: minutesAgo(270), paidAmount: 80, exitAt: minutesAgo(265),
  });

  // รถที่ออกในช่วงจอดฟรี (ไม่ต้องจ่าย)
  list.push({
    id: "v91", plate: "ฒษ 2201", province: "กรุงเทพมหานคร", type: "Sedan", floor: 2, slot: "B03",
    entryAt: minutesAgo(200), paidAt: null, paidAmount: 0, exitAt: minutesAgo(188),
  });

  // รถที่ตู้ Kiosk อ่านทะเบียนไม่ได้
  list.push({
    id: "v92", plate: "อ่านไม่ได้", province: "—", type: "Sedan", floor: 2, slot: "B07",
    entryAt: minutesAgo(33), paidAt: null, paidAmount: null, exitAt: null, unreadable: true,
  });

  return list;
}
