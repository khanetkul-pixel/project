// =====================================================
// API บันทึกการชำระ — POST /api/vehicles/<id>/pay
//
// เซิร์ฟเวอร์คิดยอดเงินเองจากอัตราค่าจอด (ไม่เชื่อยอดที่หน้าเว็บส่งมา กันคนแก้ยอดเป็น 0)
// ถ้าเคยจ่ายแล้วแต่ออกไม่ทันเวลา จะคิดเฉพาะส่วนที่ต้องจ่ายเพิ่ม
//
// ⚠️ ระบบจริงต้องรอธนาคารยืนยันว่าเงินเข้าแล้ว (webhook) ก่อนบันทึก
// =====================================================
import { readRates, updateVehicles } from "@/lib/vehicle-store";
import { amountDue } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rates } = await readRates();

  return updateVehicles((list) => {
    const car = list.find((v) => v.id === id);
    if (!car) {
      return { reply: Response.json({ error: "ไม่พบรถคันนี้" }, { status: 404 }) };
    }
    if (car.exitAt) {
      return { reply: Response.json({ error: "รถคันนี้ออกจากลานแล้ว" }, { status: 409 }) };
    }

    const now = new Date();
    const due = amountDue(car, rates, now);

    // ไม่มียอดค้าง (จ่ายแล้ว หรืออยู่ในช่วงจอดฟรี) → ไม่ต้องบันทึกซ้ำ
    if (due <= 0) {
      return { reply: Response.json(car) };
    }

    const updated = {
      ...car,
      paidAt: now.toISOString(),
      paidAmount: (car.paidAmount ?? 0) + due,
    };
    const newList = list.map((v) => (v.id === id ? updated : v));
    return { save: newList, reply: Response.json(updated) };
  });
}
