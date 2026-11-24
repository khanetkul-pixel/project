"use client";
// =====================================================
// RateDialog.tsx — หน้าต่างตั้งค่าอัตราค่าจอด (ใช้ในหน้าอัตราค่าจอด)
// แก้ค่าแล้วจะเห็นตัวอย่างการคิดเงินทันที กด "บันทึก" เพื่อใช้จริง
// =====================================================
import { useState } from "react";
import { Icon } from "./Icon";
import { Toggle } from "./ui";
import { calculateFee, billedHoursLabel, type Rates } from "@/lib/fee";
import { durationLabel, baht } from "@/lib/format";

type Props = {
  rates: Rates;
  onClose: () => void;
  onSave: (rates: Rates) => void;
};

const SAMPLE_MINUTES = 145; // ตัวอย่าง: จอด 2 ชม. 25 นาที

export function RateDialog({ rates, onClose, onSave }: Props) {
  const [form, setForm] = useState<Rates>(rates);

  /** แก้ค่า 1 ช่องในฟอร์ม */
  function update<K extends keyof Rates>(key: K, value: Rates[K]) {
    setForm({ ...form, [key]: value });
  }

  /** แปลงข้อความในช่องเป็นตัวเลข (ตัดตัวอักษรออก ไม่ติดลบ) */
  function toNumber(text: string): number {
    const n = Number(text.replace(/[^\d.]/g, ""));
    return n > 0 ? n : 0;
  }

  const example =
    `ตัวอย่าง: จอด ${durationLabel(SAMPLE_MINUTES)} → หักฟรี ${form.freeMinutes} นาที → ` +
    `คิด ${billedHoursLabel(SAMPLE_MINUTES, form)} = ${baht(calculateFee(SAMPLE_MINUTES, form))}`;

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true">
        {/* หัวหน้าต่าง */}
        <div className="row-between" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>ตั้งค่าอัตราค่าจอด</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>ใช้กับทุกชั้น · ทุกเครื่องคิดเงินตามอัตรานี้</p>
          </div>
          <button type="button" className="icon-btn" style={{ padding: 6, background: "var(--bg)", border: 0 }} onClick={onClose} aria-label="ปิด">
            <Icon name="x" size={18} />
          </button>
        </div>

        {/* ค่าจอด */}
        <div className="semibold text-green" style={{ fontSize: 13 }}>ค่าจอด</div>
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <NumberField label="จอดฟรี" unit="นาที" value={form.freeMinutes} onChange={(t) => update("freeMinutes", toNumber(t))} />
          <NumberField label="ค่าจอดต่อชั่วโมง" unit="บาท" value={form.perHour} onChange={(t) => update("perHour", toNumber(t))} />
        </div>
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <NumberField label="ค่าจอดสูงสุดต่อวัน" unit="บาท" value={form.maxPerDay} onChange={(t) => update("maxPerDay", toNumber(t))} />
          <div className="field grow">
            <label htmlFor="rounding">การปัดเศษ</label>
            <div className="input">
              <select id="rounding" value={form.rounding} onChange={(e) => update("rounding", e.target.value as Rates["rounding"])}>
                <option value="hour">ปัดขึ้นเป็นชั่วโมง</option>
                <option value="half-hour">ปัดขึ้นทุก 30 นาที</option>
              </select>
            </div>
          </div>
        </div>

        {/* การชำระเงิน */}
        <div className="semibold text-green" style={{ fontSize: 13 }}>การชำระเงิน</div>
        <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
          <NumberField label="ต้องออกภายในหลังชำระ" unit="นาที" value={form.exitWithinMinutes} onChange={(t) => update("exitWithinMinutes", toNumber(t))} />
          <div className="field grow">
            <label htmlFor="promptpay">PromptPay</label>
            <div className="input">
              <input id="promptpay" value={form.promptPay} onChange={(e) => update("promptPay", e.target.value)} />
            </div>
          </div>
        </div>
        <div className="row-between">
          <span style={{ fontSize: 14, fontWeight: 500 }}>รับชำระผ่าน ThaiQR</span>
          <Toggle on={form.thaiQR} onChange={(v) => update("thaiQR", v)} label="รับชำระผ่าน ThaiQR" />
        </div>

        {/* ตัวอย่างการคิดเงิน */}
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "var(--green-50)", color: "var(--green-800)", fontSize: 13, fontWeight: 500 }}>
          {example}
        </div>

        <div className="row" style={{ gap: 10 }}>
          <button type="button" className="btn btn-secondary grow" onClick={onClose}>ยกเลิก</button>
          <button type="button" className="btn btn-primary grow" onClick={() => onSave(form)}>บันทึกอัตราค่าจอด</button>
        </div>
      </div>
    </div>
  );
}

/** ช่องกรอกตัวเลข + หน่วย */
function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (text: string) => void }) {
  return (
    <div className="field grow">
      <label>{label}</label>
      <div className="input">
        <input inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="unit">{unit}</span>
      </div>
    </div>
  );
}
