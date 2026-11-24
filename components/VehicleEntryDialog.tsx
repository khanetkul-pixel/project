"use client";
// =====================================================
// VehicleEntryDialog.tsx — หน้าต่าง "บันทึกรถเข้า" (ใช้ในหน้ารายงานกิจกรรม)
// กดบันทึก → ส่งไปที่ API → ทุกเครื่องเห็นรถคันนี้
// =====================================================
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { createVehicle } from "@/lib/vehicle-api";
import { PROVINCES, VEHICLE_TYPES, isValidPlate, type Vehicle, type VehicleType } from "@/lib/vehicles";
import { findFloor, slotsOf, type LotFloor } from "@/lib/lot";

type Props = {
  layout: LotFloor[];   // ชั้นทั้งหมดของลาน
  onClose: () => void;
  onSaved: (vehicle: Vehicle) => void;
};

export function VehicleEntryDialog({ layout, onClose, onSaved }: Props) {
  const [plate, setPlate] = useState("");
  const [province, setProvince] = useState(PROVINCES[0]);
  const [type, setType] = useState<VehicleType>("Sedan");
  const [floor, setFloor] = useState(layout[0]?.id ?? 1);
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // ข้อมูลของชั้นที่เลือก (ตัวอักษรนำหน้า + จำนวนช่อง)
  // ช่องทั้งหมดของชั้นที่เลือก (ให้เลือกจากรายการ เพราะแต่ละแถวมีจำนวนช่องไม่เท่ากัน)
  const floorInfo = findFloor(layout, floor) ?? layout[0];
  const slotChoices = floorInfo ? slotsOf(floorInfo) : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // ตรวจทะเบียน
    const cleanPlate = plate.trim().replace(/\s+/g, " ");
    if (!isValidPlate(cleanPlate)) {
      setError("รูปแบบทะเบียนไม่ถูกต้อง เช่น 1กก 1122 หรือ กข 1234");
      return;
    }

    // ตรวจว่าเลือกช่องแล้ว
    if (!slot) {
      setError("กรุณาเลือกช่องจอด");
      return;
    }

    // ส่งไปบันทึก
    setSaving(true);
    try {
      const saved = await createVehicle({ plate: cleanPlate, province, type, floor, slot });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message); // เช่น ทะเบียนซ้ำ / ช่องมีรถแล้ว
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="dialog" style={{ padding: 0, gap: 0 }} onSubmit={handleSubmit} noValidate role="dialog" aria-modal="true">
        {/* หัวหน้าต่าง */}
        <div className="row-between" style={{ padding: "20px 24px 18px 28px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>บันทึกรถเข้า</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" style={{ border: 0, background: "transparent", color: "var(--text-2)", display: "inline-flex", padding: 4 }}>
            <Icon name="x" />
          </button>
        </div>

        {/* ช่องกรอก */}
        <div className="col" style={{ padding: "20px 28px", gap: 18 }}>
          <Field label="ทะเบียนรถ">
            <input value={plate} onChange={(e) => { setPlate(e.target.value); setError(""); }} placeholder="เช่น 1กก 1122" autoFocus />
          </Field>

          <Field label="จังหวัด">
            <select value={province} onChange={(e) => setProvince(e.target.value)}>
              {PROVINCES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </Field>

          <Field label="ประเภทรถ">
            <select value={type} onChange={(e) => setType(e.target.value as VehicleType)}>
              {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>

          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: 1 }}>
              <Field label="ชั้น">
                <select value={floor} onChange={(e) => { setFloor(Number(e.target.value)); setSlot(""); }}>
                  {layout.map((f) => (
                    <option key={f.id} value={f.id}>{f.name} (โซน {f.prefix})</option>
                  ))}
                </select>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="ช่อง">
                <select value={slot} onChange={(e) => { setSlot(e.target.value); setError(""); }}>
                  <option value="">— เลือกช่อง —</option>
                  {slotChoices.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {error && <span className="small text-danger" role="alert">{error}</span>}
        </div>

        {/* ปุ่มด้านล่าง */}
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, padding: "14px 24px 18px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** ช่องกรอก 1 ช่อง: ป้ายชื่อ + กล่อง */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label style={{ fontSize: 15 }}>{label}</label>
      <div className="input" style={{ background: "var(--surface)" }}>{children}</div>
    </div>
  );
}
