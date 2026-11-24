// =====================================================
// API ข้อมูลรถ — /api/vehicles
//   GET    /api/vehicles                → รถทั้งหมด (ใหม่สุดก่อน)
//   GET    /api/vehicles?plate=1กก1122  → หารถจากทะเบียน
//   POST   /api/vehicles                → บันทึกรถเข้า  ส่ง { plate, province, type, floor, slot }
//   DELETE /api/vehicles                → ล้างกลับเป็นรถตัวอย่าง
// =====================================================
import { readLayout, readMaintenance, readVehicles, resetVehicles, updateVehicles } from "@/lib/vehicle-store";
import { VEHICLE_TYPES, isValidPlate, normalizePlate, type Vehicle, type VehicleType } from "@/lib/vehicles";
import { findFloor, normalizeSlot } from "@/lib/lot";

export const dynamic = "force-dynamic"; // ห้ามแคช ต้องได้ข้อมูลล่าสุดทุกครั้ง

/** ตอบกลับเป็น error พร้อมข้อความ */
function errorReply(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// ---------------- GET: ดูข้อมูล ----------------
export async function GET(req: Request) {
  const list = await readVehicles();
  const plate = new URL(req.url).searchParams.get("plate");

  // ไม่ได้ส่งทะเบียนมา → ส่งรถทั้งหมด (เรียงเวลาเข้า ใหม่สุดก่อน)
  if (!plate) {
    const sorted = [...list].sort((a, b) => b.entryAt.localeCompare(a.entryAt));
    return Response.json(sorted);
  }

  // หารถจากทะเบียน
  const matches = list.filter((v) => normalizePlate(v.plate) === normalizePlate(plate));
  if (matches.length === 0) {
    return errorReply("ไม่พบทะเบียนนี้ในลานจอด", 404);
  }

  // เอาคันที่ยังอยู่ในลานก่อน ถ้าไม่มี เอาครั้งล่าสุด
  const stillParked = matches.find((v) => !v.exitAt);
  if (stillParked) {
    return Response.json(stillParked);
  }
  matches.sort((a, b) => b.entryAt.localeCompare(a.entryAt));
  return Response.json(matches[0]);
}

// ---------------- POST: บันทึกรถเข้า ----------------
export async function POST(req: Request) {
  // 1) อ่านข้อมูลที่ส่งมา
  let body: Partial<Vehicle>;
  try {
    body = await req.json();
  } catch {
    return errorReply("ข้อมูลไม่ถูกต้อง", 400);
  }

  // 2) ตรวจข้อมูล
  const plate = String(body.plate ?? "").trim().replace(/\s+/g, " ");
  if (!isValidPlate(plate)) {
    return errorReply("รูปแบบทะเบียนไม่ถูกต้อง เช่น 1กก 1122", 400);
  }

  const floor = Number(body.floor);
  const layout = await readLayout();
  const floorInfo = findFloor(layout, floor);
  if (!floorInfo) {
    return errorReply("ไม่มีชั้นนี้ในลานจอด", 400);
  }

  const slot = normalizeSlot(floorInfo, String(body.slot ?? ""));
  if (!slot) {
    return errorReply(`ช่องจอดไม่ถูกต้อง ไม่มีช่องนี้ใน${floorInfo.name}`, 400);
  }

  let type: VehicleType = "Sedan";
  if (VEHICLE_TYPES.includes(body.type as VehicleType)) {
    type = body.type as VehicleType;
  }
  const province = String(body.province || "กรุงเทพมหานคร");

  // ช่องที่ปิดซ่อม จอดไม่ได้
  const maintenance = await readMaintenance();
  if (maintenance.some((m) => m.slot === slot)) {
    return errorReply(`ช่อง ${slot} ปิดซ่อมอยู่ เลือกช่องอื่น`, 409);
  }

  // 3) ตรวจซ้ำกับรถที่อยู่ในลาน แล้วบันทึก
  return updateVehicles((list) => {
    const parked = list.filter((v) => !v.exitAt);

    if (parked.some((v) => normalizePlate(v.plate) === normalizePlate(plate))) {
      return { reply: errorReply("ทะเบียนนี้จอดอยู่ในลานแล้ว", 409) };
    }
    if (parked.some((v) => v.slot === slot)) {
      return { reply: errorReply(`ช่อง ${slot} มีรถจอดอยู่แล้ว`, 409) };
    }

    const newCar: Vehicle = {
      // id เป็นตัวเลขเวลา + เลขสุ่ม 3 หลัก (กันซ้ำ) — หน้า QR/ใบเสร็จใช้ตัวเลขนี้เป็นเลขอ้างอิง
      id: "v" + Date.now() + String(Math.floor(Math.random() * 1000)).padStart(3, "0"),
      plate,
      province,
      type,
      floor,
      slot,
      entryAt: new Date().toISOString(),
      paidAt: null,
      paidAmount: null,
      exitAt: null,
    };

    return {
      save: [...list, newCar],
      reply: Response.json(newCar, { status: 201 }),
    };
  });
}

// ---------------- DELETE: รีเซ็ต ----------------
export async function DELETE() {
  const list = await resetVehicles();
  return Response.json(list);
}
