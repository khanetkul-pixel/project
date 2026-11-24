// =====================================================
// API อัตราค่าจอด — /api/rates
//   GET    /api/rates                  → { rates, history }
//   PUT    /api/rates  { rates, who }  → บันทึกอัตราใหม่ + เพิ่มประวัติเฉพาะค่าที่เปลี่ยน
//   DELETE /api/rates                  → คืนค่าเริ่มต้น
// =====================================================
import { readRates, resetRates, updateRates } from "@/lib/vehicle-store";
import { describeRateChanges, sanitizeRates, type Rates } from "@/lib/fee";
import { buddhistYear, hhmm } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await readRates();
  return Response.json(data);
}

export async function PUT(req: Request) {
  let body: { rates?: Partial<Rates>; who?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  const who = body.who?.trim() || "ผู้ดูแลระบบ";
  const now = new Date();
  const when = `${now.getDate()}/${now.getMonth() + 1}/${buddhistYear(now)} · ${hhmm(now)}`;

  const data = await updateRates((current) => {
    const newRates = sanitizeRates(body.rates ?? {}, current.rates);

    // เพิ่มประวัติ เฉพาะค่าที่เปลี่ยน (เก็บล่าสุด 50 รายการ)
    const changes = describeRateChanges(current.rates, newRates);
    const newItems = changes.map((what) => ({ what, who, when }));
    const history = [...newItems, ...current.history].slice(0, 50);

    return { rates: newRates, history };
  });

  return Response.json(data);
}

export async function DELETE() {
  const data = await resetRates();
  return Response.json(data);
}
