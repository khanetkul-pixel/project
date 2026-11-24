// =====================================================
// vehicle-api.ts — ฟังก์ชันที่หน้าเว็บใช้เรียก API (คุยกับเซิร์ฟเวอร์)
// ทุกฟังก์ชันคืนค่าเป็น Promise ใช้กับ await ได้ เช่น  const cars = await fetchVehicles();
// ถ้าเซิร์ฟเวอร์ตอบ error จะโยน Error พร้อมข้อความภาษาไทยจากเซิร์ฟเวอร์
// =====================================================
import type { Vehicle } from "./vehicles";
import type { Rates } from "./fee";
import type { LotFloor, MaintenanceItem } from "./lot";

/** อ่านคำตอบจากเซิร์ฟเวอร์ ถ้าไม่สำเร็จ → โยน Error */
async function readResponse<T>(res: Response): Promise<T> {
  let data: { error?: string } = {};
  try {
    data = await res.json();
  } catch {
    // คำตอบไม่ใช่ JSON
  }
  if (!res.ok) {
    throw new Error(data.error || "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง");
  }
  return data as T;
}

/** ส่งคำขอแบบ POST / PUT พร้อมข้อมูล JSON */
function sendJson(url: string, method: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// ---------------- ข้อมูลรถ ----------------

/** รถทั้งหมด (ใหม่สุดก่อน) */
export async function fetchVehicles(): Promise<Vehicle[]> {
  const res = await fetch("/api/vehicles", { cache: "no-store" });
  return readResponse<Vehicle[]>(res);
}

/** หารถจากทะเบียน */
export async function findVehicle(plate: string): Promise<Vehicle> {
  const res = await fetch(`/api/vehicles?plate=${encodeURIComponent(plate)}`, { cache: "no-store" });
  return readResponse<Vehicle>(res);
}

/** บันทึกรถเข้า */
export async function createVehicle(data: Pick<Vehicle, "plate" | "province" | "type" | "floor" | "slot">): Promise<Vehicle> {
  const res = await sendJson("/api/vehicles", "POST", data);
  return readResponse<Vehicle>(res);
}

/** บันทึกการชำระ (เซิร์ฟเวอร์คิดยอดเงินเอง ไม่ต้องส่งยอด) */
export async function payVehicle(id: string): Promise<Vehicle> {
  const res = await sendJson(`/api/vehicles/${id}/pay`, "POST");
  return readResponse<Vehicle>(res);
}

/** บันทึกรถออก (ถ้ายังค้างชำระ จะ error พร้อมบอกยอดค้าง) */
export async function exitVehicle(id: string): Promise<Vehicle> {
  const res = await sendJson(`/api/vehicles/${id}/exit`, "POST");
  return readResponse<Vehicle>(res);
}

/** เอารถออกทันทีโดยไม่ตรวจการจ่าย (ใช้จำลองในหน้าผังลานจอดเท่านั้น) */
export async function forceExitVehicle(id: string): Promise<Vehicle> {
  const res = await sendJson(`/api/vehicles/${id}/exit?force=1`, "POST");
  return readResponse<Vehicle>(res);
}

/** ล้างข้อมูลรถกลับเป็นรถตัวอย่าง */
export async function resetVehicles(): Promise<Vehicle[]> {
  const res = await fetch("/api/vehicles", { method: "DELETE" });
  return readResponse<Vehicle[]>(res);
}

// ---------------- อัตราค่าจอด ----------------

export type RateHistoryItem = { what: string; who: string; when: string };
export type RatesData = { rates: Rates; history: RateHistoryItem[] };

/** อ่านอัตราค่าจอด + ประวัติการแก้ไข */
export async function fetchRates(): Promise<RatesData> {
  const res = await fetch("/api/rates", { cache: "no-store" });
  return readResponse<RatesData>(res);
}

/** บันทึกอัตราค่าจอด (who = ชื่อคนที่แก้ ใช้เก็บประวัติ) */
export async function saveRates(rates: Rates, who?: string): Promise<RatesData> {
  const res = await sendJson("/api/rates", "PUT", { rates, who });
  return readResponse<RatesData>(res);
}

/** คืนอัตราค่าจอดเป็นค่าเริ่มต้น */
export async function resetRates(): Promise<RatesData> {
  const res = await fetch("/api/rates", { method: "DELETE" });
  return readResponse<RatesData>(res);
}

// ---------------- ช่องที่ปิดซ่อม ----------------

/** รายการช่องที่ปิดซ่อม */
export async function fetchMaintenance(): Promise<MaintenanceItem[]> {
  const res = await fetch("/api/maintenance", { cache: "no-store" });
  return readResponse<MaintenanceItem[]>(res);
}

/** ปิดช่องเพื่อซ่อม (note = เหตุผล ไม่ใส่ก็ได้) */
export async function closeSlotForRepair(slot: string, note: string): Promise<MaintenanceItem[]> {
  const res = await sendJson("/api/maintenance", "POST", { slot, note });
  return readResponse<MaintenanceItem[]>(res);
}

/** เปิดใช้ช่องที่ซ่อมเสร็จแล้ว */
export async function reopenSlot(slot: string): Promise<MaintenanceItem[]> {
  const res = await fetch(`/api/maintenance?slot=${encodeURIComponent(slot)}`, { method: "DELETE" });
  return readResponse<MaintenanceItem[]>(res);
}

/** ล้างช่องซ่อมทั้งหมด (ใช้ตอนรีเซ็ตข้อมูลตัวอย่าง) */
export async function resetMaintenance(): Promise<MaintenanceItem[]> {
  const res = await fetch("/api/maintenance?all=1", { method: "DELETE" });
  return readResponse<MaintenanceItem[]>(res);
}

// ---------------- ชั้นของลานจอด ----------------

/** การตั้งค่าชั้นทั้งหมด */
export async function fetchLayout(): Promise<LotFloor[]> {
  const res = await fetch("/api/lot", { cache: "no-store" });
  return readResponse<LotFloor[]>(res);
}

/** แก้โครงสร้างลานจอด (ส่งคำสั่งไปที่ /api/lot) */
async function changeLayout(command: Record<string, unknown>): Promise<LotFloor[]> {
  const res = await sendJson("/api/lot", "POST", command);
  return readResponse<LotFloor[]>(res);
}

/** เพิ่มชั้นใหม่ (slots = จำนวนช่อง, name = ชื่อชั้น ไม่ใส่ก็ได้) */
export function addFloor(slots: number, name: string): Promise<LotFloor[]> {
  return changeLayout({ action: "addFloor", slots, name });
}

/** เพิ่มแถวใหม่ท้ายชั้น */
export function addRow(floorId: number, slots: number): Promise<LotFloor[]> {
  return changeLayout({ action: "addRow", floorId, slots });
}

/** เพิ่ม 1 ช่องท้ายแถว (row = ลำดับแถว เริ่มที่ 0) */
export function addSlot(floorId: number, row: number): Promise<LotFloor[]> {
  return changeLayout({ action: "addSlot", floorId, row });
}

/** ลบช่อง (ลบได้เฉพาะช่องที่ไม่มีรถ) */
export function removeSlot(slot: string): Promise<LotFloor[]> {
  return changeLayout({ action: "removeSlot", slot });
}

/** ลบทั้งแถว (ลบได้เฉพาะแถวที่ไม่มีรถ) */
export function removeRow(floorId: number, row: number): Promise<LotFloor[]> {
  return changeLayout({ action: "removeRow", floorId, row });
}

/** ลบชั้น (ลบได้เฉพาะชั้นที่ไม่มีรถจอด) */
export async function removeFloor(floorId: number): Promise<LotFloor[]> {
  const res = await fetch(`/api/lot?id=${floorId}`, { method: "DELETE" });
  return readResponse<LotFloor[]>(res);
}

/** คืนการตั้งค่าชั้นเป็นค่าเริ่มต้น (ใช้ตอนรีเซ็ตข้อมูลตัวอย่าง) */
export async function resetLayout(): Promise<LotFloor[]> {
  const res = await fetch("/api/lot?reset=1", { method: "DELETE" });
  return readResponse<LotFloor[]>(res);
}

// ---------------- ค้นหาล่าสุด (หน้า /pay) ----------------
// เก็บไว้ในตัวแปรของหน้าเว็บเท่านั้น ไม่บันทึกลงเครื่อง
// → เข้าหน้ารายละเอียดแล้วกดย้อนกลับ ยังเห็นรายการ แต่รีเฟรช/เปิดใหม่จะว่างเสมอ

export type Recent = { plate: string; at: string };

let recentList: Recent[] = [];

export function getRecent(): Recent[] {
  return recentList;
}

export function addRecent(plate: string) {
  // เอาทะเบียนเดิมออกก่อน (ถ้ามี) แล้วใส่ไว้บนสุด เก็บแค่ 5 รายการ
  const others = recentList.filter((r) => r.plate.replace(/\s/g, "") !== plate.replace(/\s/g, ""));
  recentList = [{ plate, at: new Date().toISOString() }, ...others].slice(0, 5);
}

/** ลบรายการเก่าที่เวอร์ชันก่อนเคยบันทึกไว้ในเบราว์เซอร์ */
export function clearSavedRecent() {
  try {
    localStorage.removeItem("sp-recent-plates");
  } catch {
    // บางเบราว์เซอร์ปิด localStorage — ไม่เป็นไร
  }
}
