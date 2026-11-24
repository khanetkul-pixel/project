"use client";
// =====================================================
// หน้าอัตราค่าจอด — /admin/rates  (Figma: 11 · อัตราค่าจอด)
// ดู/แก้อัตราค่าจอด ช่องทางชำระ และประวัติการแก้ไข
// บันทึกที่เซิร์ฟเวอร์ → ทุกเครื่องคิดเงินตามอัตราใหม่
// =====================================================
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { CardHead, PageHeader, Toggle } from "@/components/ui";
import { RateDialog } from "@/components/RateDialog";
import { useRates } from "@/components/RatesProvider";
import { useAuth } from "@/components/AuthProvider";
import { calculateFee, billedHoursLabel, roundingLabel, type Rates } from "@/lib/fee";
import { baht, durationLabel } from "@/lib/format";

// ตัวอย่างเวลาจอด (นาที) ที่แสดงในตาราง — 1500 นาที = เกิน 1 วัน ให้เห็นเพดานต่อวัน
const EXAMPLE_MINUTES = [10, 40, 145, 360, 720, 1500];

export default function RatesPage() {
  const { rates, history, setRates } = useRates();
  const { user } = useAuth();
  const [editing, setEditing] = useState(false); // เปิดหน้าต่างแก้ไขอยู่หรือไม่

  function save(newRates: Rates) {
    setRates(newRates, user?.name); // ส่งชื่อคนแก้ไปเก็บในประวัติ
    setEditing(false);
  }

  function toggleThaiQR(on: boolean) {
    setRates({ ...rates, thaiQR: on }, user?.name);
  }

  return (
    <>
      <PageHeader
        title="อัตราค่าจอด"
        subtitle="กำหนดอัตราค่าจอด ช่องทางการชำระ และดูประวัติการแก้ไข"
        actions={<button className="btn btn-primary" onClick={() => setEditing(true)}>แก้ไขอัตราค่าจอด</button>}
      />

      <div className="split-left">
        {/* อัตราปัจจุบัน */}
        <div className="card" style={{ gap: 0 }}>
          <div style={{ paddingBottom: 8 }}>
            <CardHead
              title="อัตราปัจจุบัน"
              sub="ใช้กับทุกชั้น"
              right={
                <button className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 13, borderRadius: 10 }} onClick={() => setEditing(true)}>
                  <Icon name="edit" size={14} /> แก้ไข
                </button>
              }
            />
          </div>
          <div className="kv"><span>จอดฟรี</span><span>{rates.freeMinutes} นาที</span></div>
          <div className="kv"><span>ค่าจอดต่อชั่วโมง</span><span>{baht(rates.perHour)}</span></div>
          <div className="kv"><span>การปัดเศษ</span><span>{roundingLabel(rates.rounding)}</span></div>
          <div className="kv"><span>ค่าจอดสูงสุดต่อวัน</span><span>{baht(rates.maxPerDay)}</span></div>
          <div className="kv"><span>ต้องออกภายในหลังชำระ</span><span>{rates.exitWithinMinutes} นาที</span></div>
        </div>

        {/* ตัวอย่างการคิดค่าจอด */}
        <div className="card" style={{ gap: 8 }}>
          <CardHead title="ตัวอย่างการคิดค่าจอด" sub="คำนวณจากอัตราปัจจุบัน" />
          <table className="table">
            <thead>
              <tr>
                <th>เวลาจอด</th>
                <th style={{ width: 160 }}>คิดเป็น</th>
                <th style={{ width: 90 }}>ค่าจอด</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_MINUTES.map((minutes) => {
                const fee = calculateFee(minutes, rates);
                return (
                  <tr key={minutes}>
                    <td style={{ fontWeight: 500 }}>{durationLabel(minutes)}</td>
                    <td className="muted">{billedHoursLabel(minutes, rates)}</td>
                    <td className="semibold" style={{ color: fee === 0 ? "var(--green-700)" : undefined }}>{baht(fee)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ช่องทางการชำระ */}
        <div className="card" style={{ gap: 0, alignSelf: "start" }}>
          <div style={{ paddingBottom: 8 }}><CardHead title="ช่องทางการชำระ" /></div>
          <div className="kv"><span>PromptPay</span><span>{rates.promptPay}</span></div>
          <div className="kv">
            <span>รับชำระผ่าน ThaiQR</span>
            <Toggle on={rates.thaiQR} onChange={toggleThaiQR} label="รับชำระผ่าน ThaiQR" />
          </div>
        </div>

        {/* ประวัติการแก้ไข */}
        <div className="card" style={{ gap: 0 }}>
          <div style={{ paddingBottom: 8 }}>
            <CardHead title="ประวัติการแก้ไข" sub="บันทึกทุกครั้งที่มีการเปลี่ยนอัตรา" />
          </div>
          {history.map((item, i) => (
            <div key={i} className="row" style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green-500)", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{item.what}</div>
                <div className="small muted">{item.who} · {item.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editing && <RateDialog rates={rates} onClose={() => setEditing(false)} onSave={save} />}
    </>
  );
}
