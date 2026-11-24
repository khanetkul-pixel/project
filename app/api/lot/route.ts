// =====================================================
// API โครงสร้างลานจอด (ชั้น · แถว · ช่อง) — /api/lot
//   GET    /api/lot                                       → โครงสร้างทั้งหมด
//   POST   /api/lot  { action: "addFloor", slots, name }  → เพิ่มชั้นใหม่ต่อท้าย (ช่อง 1..slots แถวละ 8)
//   POST   /api/lot  { action: "addRow", floorId, slots } → เพิ่มแถวใหม่ท้ายชั้น
//   POST   /api/lot  { action: "addSlot", floorId, row }  → เพิ่ม 1 ช่องท้ายแถว (row = ลำดับแถว เริ่มที่ 0)
//   POST   /api/lot  { action: "removeSlot", slot }       → ลบช่อง (ต้องไม่มีรถจอด)
//   POST   /api/lot  { action: "removeRow", floorId, row }→ ลบทั้งแถว (ต้องไม่มีรถจอด)
//   DELETE /api/lot?id=4                                  → ลบชั้น (ต้องไม่มีรถจอด และต้องเหลืออย่างน้อย 1 ชั้น)
//   DELETE /api/lot?reset=1                               → คืนค่าเริ่มต้น 3 ชั้น
// =====================================================
import { readLayout, readVehicles, resetLayout, updateLayout, updateMaintenance } from "@/lib/vehicle-store";
import {
  MAX_FLOORS, MAX_ROWS_PER_FLOOR, MAX_SLOTS_PER_FLOOR, MAX_SLOTS_PER_ROW, MAX_SLOT_NUMBER,
  findFloor, floorOfSlot, makeNextFloor, nextSlotId, slotId, slotsOf,
} from "@/lib/lot";

export const dynamic = "force-dynamic";

function errorReply(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/** รหัสช่องที่มีรถจอดอยู่ตอนนี้ */
async function occupiedSlots(): Promise<string[]> {
  const vehicles = await readVehicles();
  return vehicles.filter((v) => !v.exitAt).map((v) => v.slot);
}

/** ลบช่องที่ไม่มีแล้วออกจากรายการช่องซ่อม */
async function forgetRepairs(slots: string[]) {
  await updateMaintenance((list) => ({
    save: list.filter((m) => !slots.includes(m.slot)),
    reply: null,
  }));
}

// ---------------- GET: ดูโครงสร้าง ----------------
export async function GET() {
  const layout = await readLayout();
  return Response.json(layout);
}

// ---------------- POST: แก้โครงสร้าง ----------------
export async function POST(req: Request) {
  let body: { action?: string; slots?: number; name?: string; floorId?: number; row?: number; slot?: string };
  try {
    body = await req.json();
  } catch {
    return errorReply("ข้อมูลไม่ถูกต้อง", 400);
  }

  const action = body.action ?? "addFloor";
  const occupied = await occupiedSlots();

  // ---------- เพิ่มชั้น ----------
  if (action === "addFloor") {
    const slots = Number(body.slots);
    if (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS_PER_FLOOR) {
      return errorReply(`จำนวนช่องต้องเป็น 1–${MAX_SLOTS_PER_FLOOR}`, 400);
    }
    const name = String(body.name ?? "").slice(0, 30);
    return updateLayout((layout) => {
      if (layout.length >= MAX_FLOORS) {
        return { reply: errorReply(`เพิ่มได้สูงสุด ${MAX_FLOORS} ชั้น`, 409) };
      }
      const newFloor = makeNextFloor(layout, slots, name);
      if (!newFloor) {
        return { reply: errorReply("เพิ่มชั้นไม่ได้ ตัวอักษรนำหน้าช่องหมดแล้ว", 409) };
      }
      const newLayout = [...layout, newFloor];
      return { save: newLayout, reply: Response.json(newLayout, { status: 201 }) };
    });
  }

  // ---------- เพิ่มแถว ----------
  if (action === "addRow") {
    const count = Number(body.slots);
    if (!Number.isInteger(count) || count < 1 || count > MAX_SLOTS_PER_ROW) {
      return errorReply(`จำนวนช่องในแถวต้องเป็น 1–${MAX_SLOTS_PER_ROW}`, 400);
    }
    return updateLayout((layout) => {
      const floor = findFloor(layout, Number(body.floorId));
      if (!floor) return { reply: errorReply("ไม่พบชั้นนี้", 404) };
      if (floor.rows.length >= MAX_ROWS_PER_FLOOR) {
        return { reply: errorReply(`ชั้นหนึ่งมีได้สูงสุด ${MAX_ROWS_PER_FLOOR} แถว`, 409) };
      }

      // สร้างรหัสช่องใหม่ต่อจากเลขสูงสุดของชั้น เช่น มีถึง A16 → แถวใหม่ A17, A18, ...
      const first = nextSlotId(floor);
      if (!first) return { reply: errorReply("เลขช่องของชั้นนี้เต็มแล้ว (สูงสุด 99)", 409) };
      const startNumber = Number(first.slice(1));
      if (startNumber + count - 1 > MAX_SLOT_NUMBER) {
        return { reply: errorReply("เลขช่องของชั้นนี้ไม่พอ (สูงสุด 99)", 409) };
      }
      const newRow: string[] = [];
      for (let i = 0; i < count; i++) {
        newRow.push(slotId(floor.prefix, startNumber + i));
      }

      const updated = { ...floor, rows: [...floor.rows, newRow] };
      const newLayout = layout.map((f) => (f.id === floor.id ? updated : f));
      return { save: newLayout, reply: Response.json(newLayout, { status: 201 }) };
    });
  }

  // ---------- เพิ่มช่อง ----------
  if (action === "addSlot") {
    return updateLayout((layout) => {
      const floor = findFloor(layout, Number(body.floorId));
      const rowIndex = Number(body.row);
      if (!floor || !floor.rows.at(rowIndex)) return { reply: errorReply("ไม่พบแถวนี้", 404) };
      const row = floor.rows.at(rowIndex) as string[];
      if (row.length >= MAX_SLOTS_PER_ROW) {
        return { reply: errorReply(`แถวหนึ่งมีได้สูงสุด ${MAX_SLOTS_PER_ROW} ช่อง`, 409) };
      }
      const id = nextSlotId(floor);
      if (!id) return { reply: errorReply("เลขช่องของชั้นนี้เต็มแล้ว (สูงสุด 99)", 409) };

      const rows = floor.rows.map((r, i) => (i === rowIndex ? [...r, id] : r));
      const newLayout = layout.map((f) => (f.id === floor.id ? { ...floor, rows } : f));
      return { save: newLayout, reply: Response.json(newLayout, { status: 201 }) };
    });
  }

  // ---------- ลบช่อง ----------
  if (action === "removeSlot") {
    const slot = String(body.slot ?? "").toUpperCase();
    if (occupied.includes(slot)) {
      return errorReply(`ช่อง ${slot} มีรถจอดอยู่ ลบไม่ได้ ต้องรอรถออกก่อน`, 409);
    }
    const reply = await updateLayout((layout) => {
      const floor = floorOfSlot(layout, slot);
      if (!floor || !slotsOf(floor).includes(slot)) return { reply: errorReply("ไม่พบช่องนี้", 404) };
      if (slotsOf(floor).length <= 1) {
        return { reply: errorReply("ชั้นต้องเหลืออย่างน้อย 1 ช่อง (ถ้าไม่ใช้แล้วให้ลบชั้น)", 409) };
      }
      // เอาช่องออกจากแถว แถวไหนว่างแล้วลบแถวนั้นทิ้ง
      const rows = floor.rows.map((r) => r.filter((id) => id !== slot)).filter((r) => r.length > 0);
      const newLayout = layout.map((f) => (f.id === floor.id ? { ...floor, rows } : f));
      return { save: newLayout, reply: Response.json(newLayout) };
    });
    if (reply.ok) await forgetRepairs([slot]);
    return reply;
  }

  // ---------- ลบแถว ----------
  if (action === "removeRow") {
    let removed: string[] = [];
    const reply = await updateLayout((layout) => {
      const floor = findFloor(layout, Number(body.floorId));
      const rowIndex = Number(body.row);
      const row = floor?.rows.at(rowIndex);
      if (!floor || !row) return { reply: errorReply("ไม่พบแถวนี้", 404) };
      if (floor.rows.length <= 1) {
        return { reply: errorReply("ชั้นต้องเหลืออย่างน้อย 1 แถว (ถ้าไม่ใช้แล้วให้ลบชั้น)", 409) };
      }
      const carsHere = row.filter((id) => occupied.includes(id));
      if (carsHere.length > 0) {
        return { reply: errorReply(`แถวนี้มีรถจอดอยู่ ${carsHere.length} คัน ลบไม่ได้`, 409) };
      }
      removed = row;
      const rows = floor.rows.filter((_, i) => i !== rowIndex);
      const newLayout = layout.map((f) => (f.id === floor.id ? { ...floor, rows } : f));
      return { save: newLayout, reply: Response.json(newLayout) };
    });
    if (reply.ok) await forgetRepairs(removed);
    return reply;
  }

  return errorReply("ไม่รู้จักคำสั่งนี้", 400);
}

// ---------------- DELETE: ลบชั้น / รีเซ็ต ----------------
export async function DELETE(req: Request) {
  const params = new URL(req.url).searchParams;

  if (params.get("reset")) {
    const layout = await resetLayout();
    return Response.json(layout);
  }

  const floorId = Number(params.get("id"));
  const layout = await readLayout();
  const floor = findFloor(layout, floorId);
  if (!floor) {
    return errorReply("ไม่พบชั้นนี้", 404);
  }
  if (layout.length <= 1) {
    return errorReply("ต้องเหลืออย่างน้อย 1 ชั้น", 409);
  }

  // มีรถจอดอยู่ในชั้นนี้ → ลบไม่ได้
  const occupied = await occupiedSlots();
  const parkedHere = occupied.filter((s) => s.charAt(0) === floor.prefix);
  if (parkedHere.length > 0) {
    return errorReply(`${floor.name} มีรถจอดอยู่ ${parkedHere.length} คัน ลบไม่ได้ ต้องรอรถออกก่อน`, 409);
  }

  // ลบช่องซ่อมของชั้นนี้ทิ้งด้วย
  await forgetRepairs(slotsOf(floor));

  return updateLayout((current) => {
    const newLayout = current.filter((f) => f.id !== floorId);
    return { save: newLayout, reply: Response.json(newLayout) };
  });
}
