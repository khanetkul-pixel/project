// =====================================================
// vehicle-store.ts — อ่าน/เขียนข้อมูล (ทำงานฝั่งเซิร์ฟเวอร์เท่านั้น ใช้ใน API)
//
// ข้อมูลมี 4 ชุด:
//   vehicles     ข้อมูลรถทุกคัน
//   rates        อัตราค่าจอด + ประวัติการแก้ไข
//   maintenance  ช่องที่ปิดซ่อม
//   lot          ลานจอดมีกี่ชั้น แต่ละชั้นมีแถวไหน ช่องไหน
//
// เลือกที่เก็บให้เองอัตโนมัติ:
//   1) มีค่า Upstash Redis ใน Environment Variables → เก็บใน Redis (ใช้บน Vercel ได้จริง ข้อมูลไม่หาย)
//   2) รันบน Vercel แต่ยังไม่ได้ตั้ง Redis → เก็บใน /tmp (กดได้ แต่ข้อมูลหายเองเป็นระยะ)
//   3) รันในเครื่อง (npm run dev) → เก็บเป็นไฟล์ในโฟลเดอร์ .data เหมือนเดิม
// =====================================================
import { promises as fs } from "fs";
import path from "path";
import { seedVehicles, type Vehicle } from "./vehicles";
import { DEFAULT_RATES, sanitizeRates, type Rates } from "./fee";
import { RATE_HISTORY } from "./data";
import { DEFAULT_LAYOUT, normalizeLayout, type LotFloor, type MaintenanceItem } from "./lot";

// ชื่อข้อมูลแต่ละชุด (ใช้เป็นชื่อไฟล์ และชื่อ key ใน Redis)
const VEHICLES = "vehicles";
const RATES = "rates";
const MAINTENANCE = "maintenance";
const LAYOUT = "lot";

// ---------------- ที่เก็บแบบที่ 1: Upstash Redis ----------------
// ค่า 2 ตัวนี้ได้จากหน้า Upstash หรือ Vercel → Storage (ชื่อไหนก็ได้ในสองชุดนี้)
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const useRedis = Boolean(REDIS_URL && REDIS_TOKEN);

/** ส่งคำสั่งไปที่ Redis ผ่าน REST API เช่น ["GET", "key"] หรือ ["SET", "key", "ค่า"] */
async function redis(command: string[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || json.error) throw new Error("Redis error: " + (json.error ?? res.status));
  return json.result;
}

// ---------------- ที่เก็บแบบที่ 2-3: ไฟล์ ----------------
// บน Vercel เขียนได้แค่โฟลเดอร์ /tmp ส่วนในเครื่องใช้โฟลเดอร์ .data ของโปรเจกต์
const DATA_FOLDER = process.env.VERCEL ? "/tmp/smart-parking-data" : path.join(process.cwd(), ".data");

function fileOf(name: string): string {
  return path.join(DATA_FOLDER, name + ".json");
}

// ---------------- อ่าน/เขียนข้อมูล ----------------

/** บันทึกข้อมูล */
async function saveJson(name: string, data: unknown): Promise<void> {
  const text = JSON.stringify(data);
  if (useRedis) {
    await redis(["SET", "smart-parking:" + name, text]);
    return;
  }
  // เขียนไฟล์ชั่วคราวก่อน แล้วค่อยเปลี่ยนชื่อ → ไฟล์ไม่เสียถ้าเซิร์ฟเวอร์ดับกลางทาง
  await fs.mkdir(DATA_FOLDER, { recursive: true });
  const tempFile = fileOf(name) + ".tmp";
  await fs.writeFile(tempFile, text, "utf8");
  await fs.rename(tempFile, fileOf(name));
}

/** อ่านข้อมูล ถ้ายังไม่มี → สร้างจากข้อมูลตั้งต้นที่ให้มา */
async function loadJson<T>(name: string, makeDefault: () => T): Promise<T> {
  let text: string | null = null;
  if (useRedis) {
    text = (await redis(["GET", "smart-parking:" + name])) as string | null;
  } else {
    text = await fs.readFile(fileOf(name), "utf8").catch(() => null);
  }
  if (text) return JSON.parse(text) as T;

  const data = makeDefault();
  await saveJson(name, data);
  return data;
}

// ---------------- คิวงาน: ให้แก้ข้อมูลทีละคำขอ ----------------
// ถ้ามี 2 เครื่องบันทึกพร้อมกัน แล้วต่างคนต่างอ่าน-แก้-เขียน ข้อมูลของคนหนึ่งจะหาย
// จึงให้ทุกงานแก้ข้อมูลต่อคิวกัน ทำเสร็จทีละงาน
// (เก็บคิวไว้ใน globalThis เพื่อให้ทุกไฟล์ API ใช้คิวเดียวกัน)

const shared = globalThis as unknown as { saveQueue?: Promise<unknown> };

function oneAtATime<T>(job: () => Promise<T>): Promise<T> {
  const previous = shared.saveQueue ?? Promise.resolve();
  const current = previous.then(job);
  shared.saveQueue = current.catch(() => undefined); // งานนี้พังก็ไม่ทำให้คิวค้าง
  return current;
}

// ---------------- ข้อมูลรถ ----------------

/** อ่านรถทั้งหมด */
export function readVehicles(): Promise<Vehicle[]> {
  return loadJson(VEHICLES, () => seedVehicles());
}

/**
 * แก้ข้อมูลรถแบบปลอดภัย (ต่อคิว)
 * ฟังก์ชัน change ได้รายการรถปัจจุบัน แล้วคืนค่า:
 *   { save: รายการใหม่ (ถ้าต้องการบันทึก), reply: ค่าที่จะส่งกลับ }
 */
export function updateVehicles<T>(change: (list: Vehicle[]) => { save?: Vehicle[]; reply: T }): Promise<T> {
  return oneAtATime(async () => {
    const list = await readVehicles();
    const result = change(list);
    if (result.save) {
      await saveJson(VEHICLES, result.save);
    }
    return result.reply;
  });
}

/** ล้างข้อมูลรถกลับเป็นรถตัวอย่าง */
export function resetVehicles(): Promise<Vehicle[]> {
  return oneAtATime(async () => {
    const list = seedVehicles();
    await saveJson(VEHICLES, list);
    return list;
  });
}

// ---------------- อัตราค่าจอด ----------------

export type RateHistoryItem = { what: string; who: string; when: string };
export type RatesData = { rates: Rates; history: RateHistoryItem[] };

function defaultRatesData(): RatesData {
  return { rates: DEFAULT_RATES, history: RATE_HISTORY };
}

/** อ่านอัตราค่าจอด + ประวัติ */
export async function readRates(): Promise<RatesData> {
  const data = await loadJson(RATES, defaultRatesData);
  return {
    rates: sanitizeRates(data.rates ?? {}),
    history: data.history ?? [],
  };
}

/** แก้อัตราค่าจอดแบบปลอดภัย (ต่อคิว) */
export function updateRates(change: (data: RatesData) => RatesData): Promise<RatesData> {
  return oneAtATime(async () => {
    const next = change(await readRates());
    await saveJson(RATES, next);
    return next;
  });
}

/** คืนอัตราค่าจอดเป็นค่าเริ่มต้น */
export function resetRates(): Promise<RatesData> {
  return oneAtATime(async () => {
    const data = defaultRatesData();
    await saveJson(RATES, data);
    return data;
  });
}

// ---------------- ช่องที่ปิดซ่อม ----------------

/** อ่านรายการช่องที่ปิดซ่อม (เริ่มต้น = ไม่มี) */
export function readMaintenance(): Promise<MaintenanceItem[]> {
  return loadJson<MaintenanceItem[]>(MAINTENANCE, () => []);
}

/** แก้รายการช่องที่ปิดซ่อมแบบปลอดภัย (ต่อคิว) */
export function updateMaintenance<T>(change: (list: MaintenanceItem[]) => { save?: MaintenanceItem[]; reply: T }): Promise<T> {
  return oneAtATime(async () => {
    const result = change(await readMaintenance());
    if (result.save) {
      await saveJson(MAINTENANCE, result.save);
    }
    return result.reply;
  });
}

/** ล้างรายการช่องซ่อมทั้งหมด */
export function resetMaintenance(): Promise<MaintenanceItem[]> {
  return oneAtATime(async () => {
    await saveJson(MAINTENANCE, []);
    return [];
  });
}

// ---------------- ชั้นของลานจอด ----------------

/** อ่านการตั้งค่าชั้น (เริ่มต้น = 3 ชั้น ชั้นละ 16 ช่อง) */
export async function readLayout(): Promise<LotFloor[]> {
  const raw = await loadJson<unknown>(LAYOUT, () => DEFAULT_LAYOUT);
  return normalizeLayout(raw); // แปลงไฟล์จากเวอร์ชันก่อน (ที่เก็บแค่จำนวนช่อง) ให้เป็นแถว
}

/** แก้การตั้งค่าชั้นแบบปลอดภัย (ต่อคิว) */
export function updateLayout<T>(change: (layout: LotFloor[]) => { save?: LotFloor[]; reply: T }): Promise<T> {
  return oneAtATime(async () => {
    const result = change(await readLayout());
    if (result.save) {
      await saveJson(LAYOUT, result.save);
    }
    return result.reply;
  });
}

/** คืนการตั้งค่าชั้นเป็นค่าเริ่มต้น */
export function resetLayout(): Promise<LotFloor[]> {
  return oneAtATime(async () => {
    await saveJson(LAYOUT, DEFAULT_LAYOUT);
    return DEFAULT_LAYOUT;
  });
}
