// =====================================================
// API ช่องที่ปิดซ่อม — /api/maintenance
//   GET    /api/maintenance                     → รายการช่องที่ปิดซ่อม
//   POST   /api/maintenance  { slot, note }     → ปิดช่องเพื่อซ่อม
//   DELETE /api/maintenance?slot=B07            → เปิดใช้ช่องนั้นอีกครั้ง
//   DELETE /api/maintenance?all=1               → เปิดทุกช่อง (ใช้ตอนรีเซ็ตข้อมูลตัวอย่าง)
//
// ช่องที่ปิดซ่อม: บันทึกรถเข้าช่องนั้นไม่ได้ และไม่นับเป็นช่องว่าง
// =====================================================
import { readLayout, readMaintenance, readVehicles, resetMaintenance, updateMaintenance } from "@/lib/vehicle-store";
import { isRealSlot } from "@/lib/lot";

export const dynamic = "force-dynamic";

function errorReply(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// ---------------- GET: ดูรายการ ----------------
export async function GET() {
  const list = await readMaintenance();
  return Response.json(list);
}

// ---------------- POST: ปิดช่องเพื่อซ่อม ----------------
export async function POST(req: Request) {
  let body: { slot?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return errorReply("ข้อมูลไม่ถูกต้อง", 400);
  }

  const slot = String(body.slot ?? "").trim().toUpperCase();
  const note = String(body.note ?? "").trim().slice(0, 100); // เหตุผลยาวไม่เกิน 100 ตัวอักษร

  const layout = await readLayout();
  if (!isRealSlot(layout, slot)) {
    return errorReply("ไม่มีช่องนี้ในลานจอด", 400);
  }

  // ช่องที่มีรถจอดอยู่ ปิดซ่อมไม่ได้ (ต้องรอรถออกก่อน)
  const vehicles = await readVehicles();
  const carInSlot = vehicles.find((v) => !v.exitAt && v.slot === slot);
  if (carInSlot) {
    return errorReply(`ช่อง ${slot} มีรถ ${carInSlot.plate} จอดอยู่ ปิดซ่อมไม่ได้`, 409);
  }

  return updateMaintenance((list) => {
    if (list.some((m) => m.slot === slot)) {
      return { reply: errorReply(`ช่อง ${slot} ปิดซ่อมอยู่แล้ว`, 409) };
    }
    const newList = [...list, { slot, note, since: new Date().toISOString() }];
    newList.sort((a, b) => a.slot.localeCompare(b.slot)); // เรียงตามรหัสช่อง
    return { save: newList, reply: Response.json(newList) };
  });
}

// ---------------- DELETE: เปิดใช้ช่องอีกครั้ง ----------------
export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams;

  if (params.get("all")) {
    const list = await resetMaintenance();
    return Response.json(list);
  }

  const slot = String(params.get("slot") ?? "").toUpperCase();
  return updateMaintenance((list) => {
    const newList = list.filter((m) => m.slot !== slot);
    return { save: newList, reply: Response.json(newList) };
  });
}
