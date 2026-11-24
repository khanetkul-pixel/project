// =====================================================
// API บันทึกรถออก — POST /api/vehicles/<id>/exit
// เรียกจากตู้ Kiosk ทางออก หลังอ่านทะเบียนได้
//
// ออกได้เมื่อไม่มียอดค้าง: จ่ายแล้วและยังไม่เกินเวลาที่ให้ออก หรืออยู่ในช่วงจอดฟรี
// ยังค้างจ่าย → ตอบ 402 พร้อมยอดที่ต้องจ่าย (ไม้กั้นไม่เปิด)
//
// POST /api/vehicles/<id>/exit?force=1 → เอารถออกทันทีโดยไม่ตรวจการจ่าย
//   ใช้เฉพาะการจำลองในหน้าผังลานจอด (ทำให้ช่องว่าง)
// =====================================================
import { readRates, updateVehicles } from "@/lib/vehicle-store";
import { amountDue } from "@/lib/vehicles";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { rates } = await readRates();
  const force = new URL(req.url).searchParams.get("force") === "1";

  return updateVehicles((list) => {
    const car = list.find((v) => v.id === id);
    if (!car) {
      return { reply: Response.json({ error: "ไม่พบรถคันนี้" }, { status: 404 }) };
    }
    if (car.exitAt) {
      return { reply: Response.json({ error: "รถคันนี้ออกจากลานแล้ว" }, { status: 409 }) };
    }
    if (car.unreadable && !force) {
      return { reply: Response.json({ error: "ตู้ Kiosk อ่านทะเบียนไม่ได้ ให้เจ้าหน้าที่ตรวจสอบก่อน" }, { status: 409 }) };
    }

    const now = new Date();
    const due = amountDue(car, rates, now);
    if (due > 0 && !force) {
      let message = `ยังไม่ได้ชำระค่าจอด ฿${due}`;
      if (car.paidAt) message = `เกินเวลาออกหลังชำระ ต้องชำระเพิ่ม ฿${due}`;
      return { reply: Response.json({ error: message, due }, { status: 402 }) };
    }

    const updated = {
      ...car,
      exitAt: now.toISOString(),
      paidAmount: car.paidAmount ?? 0,
    };
    const newList = list.map((v) => (v.id === id ? updated : v));
    return { save: newList, reply: Response.json(updated) };
  });
}
