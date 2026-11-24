// =====================================================
// lot.ts — โครงสร้างลานจอด (ชั้น · แถว · ช่อง) และสร้างผังจากข้อมูลรถ
//
// ค่าเริ่มต้น: 3 ชั้น ชั้นละ 2 แถว แถวละ 8 ช่อง
//   ชั้น 1 = ช่อง A01–A16 · ชั้น 2 = B01–B16 · ชั้น 3 = C01–C16
// แต่ละแถวมีจำนวนช่องไม่เท่ากันได้
// แก้ได้ที่หน้า Admin › ผังลานจอด › "แก้ไขลานจอด" (บันทึกที่ .data/lot.json)
// =====================================================
import type { Vehicle } from "./vehicles";

// ---------- โครงสร้างชั้น ----------

/** ชั้น 1 ชั้นในการตั้งค่า */
export type LotFloor = {
  id: number;        // หมายเลขชั้น เช่น 1, 2, 3
  name: string;      // ชื่อที่แสดง เช่น "ชั้น 1"
  prefix: string;    // ตัวอักษรนำหน้าช่อง เช่น "A"
  rows: string[][];  // รหัสช่องแต่ละแถว เช่น [["A01","A02"], ["A03"]]
};

export const SLOTS_PER_ROW = 8;       // แถวใหม่ตั้งต้นที่ 8 ช่อง
export const MAX_SLOTS_PER_ROW = 12;  // แถวหนึ่งมีได้ไม่เกิน 12 ช่อง
export const MAX_ROWS_PER_FLOOR = 8;
export const MAX_SLOT_NUMBER = 99;    // เลขช่องสูงสุด (A99)
export const MAX_FLOORS = 10;
export const MAX_SLOTS_PER_FLOOR = 40; // ตอนสร้างชั้นใหม่ ใส่ได้ 1–40 ช่อง

/** รหัสช่อง เช่น slotId("B", 9) → "B09" */
export function slotId(prefix: string, number: number): string {
  return prefix + String(number).padStart(2, "0");
}

/** สร้างแถวตั้งต้น: ช่อง 1..total แบ่งแถวละ 8 */
export function makeRows(prefix: string, total: number): string[][] {
  const rows: string[][] = [];
  for (let n = 1; n <= total; n++) {
    if ((n - 1) % SLOTS_PER_ROW === 0) rows.push([]);
    rows[rows.length - 1].push(slotId(prefix, n));
  }
  return rows;
}

export const DEFAULT_LAYOUT: LotFloor[] = [
  { id: 1, name: "ชั้น 1", prefix: "A", rows: makeRows("A", 16) },
  { id: 2, name: "ชั้น 2", prefix: "B", rows: makeRows("B", 16) },
  { id: 3, name: "ชั้น 3", prefix: "C", rows: makeRows("C", 16) },
];

/**
 * แปลงข้อมูลชั้นจากไฟล์ให้อยู่ในรูปแบบปัจจุบัน
 * (ไฟล์จากเวอร์ชันก่อนเก็บแค่ "slots": 16 → แปลงเป็นแถวให้)
 */
export function normalizeLayout(raw: unknown): LotFloor[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_LAYOUT;
  return raw.map((f) => {
    const floor = f as Partial<LotFloor> & { slots?: number };
    const prefix = String(floor.prefix ?? "A");
    let rows = floor.rows;
    if (!Array.isArray(rows)) rows = makeRows(prefix, Number(floor.slots) || SLOTS_PER_ROW);
    return { id: Number(floor.id), name: String(floor.name ?? `ชั้น ${floor.id}`), prefix, rows };
  });
}

// ---------- ชนิดข้อมูลของผัง ----------

/** สถานะของช่องจอด: ว่าง / มีรถ / ปิดซ่อม */
export type SlotStatus = "free" | "occupied" | "maintenance";

/** ช่องจอด 1 ช่อง */
export type Slot = { id: string; status: SlotStatus; plate?: string; note?: string };

/** ช่องที่ปิดซ่อม 1 ช่อง (ตั้งค่าได้ที่หน้าผังลานจอด) */
export type MaintenanceItem = {
  slot: string;   // รหัสช่อง เช่น "B07"
  note: string;   // เหตุผล เช่น "พื้นแตก" (ว่างได้)
  since: string;  // เวลาที่เริ่มปิดซ่อม (ISO)
};

/** ชั้น 1 ชั้นในผัง (rows = ช่องจอดแบ่งเป็นแถว) */
export type Floor = { id: number; name: string; prefix: string; rows: Slot[][] };

// ---------- ฟังก์ชันเกี่ยวกับชั้นและช่อง ----------

/** หาชั้นจากหมายเลข */
export function findFloor(layout: LotFloor[], floorId: number): LotFloor | undefined {
  return layout.find((f) => f.id === floorId);
}

/** หาชั้นจากรหัสช่อง เช่น "B07" → ชั้น 2 */
export function floorOfSlot(layout: LotFloor[], slot: string): LotFloor | undefined {
  return layout.find((f) => f.prefix === slot.charAt(0));
}

/** รหัสช่องทั้งหมดของชั้น (เรียงตามแถว) */
export function slotsOf(floor: LotFloor): string[] {
  return floor.rows.flat();
}

/**
 * ตรวจว่าช่องนี้มีอยู่จริงบนชั้นนั้นหรือไม่
 * ถูกต้อง → คืนรหัสแบบมาตรฐาน เช่น ("b9" บนชั้น B) → "B09"
 * ไม่ถูกต้อง → คืน null
 */
export function normalizeSlot(floor: LotFloor, slot: string): string | null {
  const text = slot.trim().toUpperCase();   // " b9 " → "B9"
  const number = Number(text.slice(1));      // 9
  if (text.charAt(0) !== floor.prefix || !Number.isInteger(number)) return null;

  const id = slotId(floor.prefix, number);
  return slotsOf(floor).includes(id) ? id : null;
}

/** ตรวจว่ารหัสช่องนี้มีอยู่จริงในลานหรือไม่ เช่น "B07" → true */
export function isRealSlot(layout: LotFloor[], slot: string): boolean {
  const floor = floorOfSlot(layout, slot);
  if (!floor) return false;
  return slotsOf(floor).includes(slot);
}

/** จำนวนช่องทั้งหมดในลาน */
export function totalSlots(layout: LotFloor[]): number {
  let total = 0;
  for (const f of layout) total += slotsOf(f).length;
  return total;
}

/**
 * รหัสช่องใหม่ถัดไปของชั้น = เลขที่มากที่สุดตอนนี้ + 1 (เช่น มีถึง A16 → A17)
 * เลขเกิน 99 แล้ว → null
 */
export function nextSlotId(floor: LotFloor): string | null {
  let max = 0;
  for (const id of slotsOf(floor)) max = Math.max(max, Number(id.slice(1)));
  if (max >= MAX_SLOT_NUMBER) return null;
  return slotId(floor.prefix, max + 1);
}

/**
 * สร้างชั้นใหม่ต่อจากชั้นสุดท้าย
 *   หมายเลข = ชั้นสูงสุด + 1 · ตัวอักษร = ตัวแรกที่ยังไม่มีใครใช้ (A, B, C, ...)
 *   ช่อง 1..slots แบ่งแถวละ 8
 */
export function makeNextFloor(layout: LotFloor[], slots: number, name?: string): LotFloor | null {
  const usedLetters = layout.map((f) => f.prefix);
  let prefix = "";
  for (let code = 65; code <= 90; code++) {           // 65 = "A", 90 = "Z"
    const letter = String.fromCharCode(code);
    if (!usedLetters.includes(letter)) {
      prefix = letter;
      break;
    }
  }
  if (prefix === "") return null; // ตัวอักษรหมดแล้ว

  let maxId = 0;
  for (const f of layout) maxId = Math.max(maxId, f.id);
  const id = maxId + 1;

  return { id, name: name?.trim() || `ชั้น ${id}`, prefix, rows: makeRows(prefix, slots) };
}

// ---------- สร้างผัง ----------

/**
 * สร้างผังทุกชั้นจากการตั้งค่าชั้น รายการรถ และช่องที่ปิดซ่อม
 *   ช่องที่มีรถยังไม่ออก → "occupied" (มีรถ)
 *   ช่องที่อยู่ในรายการซ่อม → "maintenance" (ปิดซ่อม)
 *   นอกนั้น → "free" (ว่าง)
 */
export function buildFloors(layout: LotFloor[], vehicles: Vehicle[], maintenance: MaintenanceItem[] = []): Floor[] {
  const parked = vehicles.filter((v) => !v.exitAt); // รถที่ยังอยู่ในลาน

  // สถานะของช่อง 1 ช่อง
  function slotStatus(id: string): Slot {
    const car = parked.find((v) => v.slot === id);
    if (car) return { id, status: "occupied", plate: car.plate };
    const repair = maintenance.find((m) => m.slot === id);
    if (repair) return { id, status: "maintenance", note: repair.note };
    return { id, status: "free" };
  }

  // แต่ละชั้น: แปลงรหัสช่องในทุกแถวเป็นช่องพร้อมสถานะ (คงรูปแถวตามที่ตั้งไว้)
  return layout.map((f) => ({
    id: f.id,
    name: f.name,
    prefix: f.prefix,
    rows: f.rows.map((row) => row.map(slotStatus)),
  }));
}

/** นับจำนวนช่องแต่ละสถานะของชั้น */
export function floorStats(floor: Floor) {
  const all = floor.rows.flat();
  return {
    total: all.length,
    free: all.filter((s) => s.status === "free").length,
    occupied: all.filter((s) => s.status === "occupied").length,
    maintenance: all.filter((s) => s.status === "maintenance").length,
  };
}

/** หาชั้นที่ว่างมากที่สุด */
export function emptiestFloor(floors: Floor[]): Floor | null {
  let best: Floor | null = null;
  for (const f of floors) {
    if (best === null || floorStats(f).free > floorStats(best).free) {
      best = f;
    }
  }
  return best;
}
