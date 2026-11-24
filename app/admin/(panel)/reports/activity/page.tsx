"use client";
// =====================================================
// หน้ารายงานกิจกรรม — /admin/reports/activity  (Figma: 06 · รายงาน · แท็บกิจกรรม)
//   heat map และกราฟประเภทรถ = ข้อมูลตัวอย่าง (lib/data.ts)
//   ตารางรถเข้า-ออก = ข้อมูลจริง อัปเดตเองทุก 5 วินาที · ค้นหาทะเบียน · ส่งออก Excel
// =====================================================
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, CardHead, PageHeader } from "@/components/ui";
import { ReportTabs } from "@/components/ReportTabs";
import { VehicleEntryDialog } from "@/components/VehicleEntryDialog";
import { useRates } from "@/components/RatesProvider";
import { useVehicles } from "@/components/useVehicles";
import { HEATMAP_FLOOR2, VEHICLES_BY_TIME } from "@/lib/data";
import { STATUS_INFO, amountDue, minutesParked, normalizePlate, statusOf, type Vehicle } from "@/lib/vehicles";
import type { Rates } from "@/lib/fee";
import { baht, durationLabel, hhmm, thaiShortDate } from "@/lib/format";
import { downloadXlsx, stampedName } from "@/lib/xlsx";

// สีของ heat map: [พื้นหลัง, ตัวอักษร] จากน้อยไปมาก
const HEAT_COLORS = [
  ["var(--green-50)", "var(--text-2)"],
  ["var(--green-100)", "var(--green-700)"],
  ["var(--green-200)", "var(--green-800)"],
  ["var(--green-500)", "#fff"],
  ["var(--green-700)", "#fff"],
  ["var(--green-900)", "#fff"],
];

// สีของ Sedan / SUV / Pickup
const TYPE_NAMES = ["Sedan", "SUV", "Pickup"];
const TYPE_COLORS = ["var(--green-700)", "var(--green-500)", "var(--green-200)"];

/** วันที่ + เวลา เช่น "31 ต.ค. 2569 14:20" */
function dateTime(iso: string): string {
  const d = new Date(iso);
  return `${thaiShortDate(d)} ${hhmm(d)}`;
}

/** ค่าจอดรวม = ที่จ่ายแล้ว + ที่ยังค้าง */
function totalFee(v: Vehicle, rates: Rates, now: Date): number {
  return (v.paidAmount ?? 0) + amountDue(v, rates, now);
}

/** ข้อความค่าจอดในตาราง ("~" = ประมาณ เพราะรถยังไม่จ่าย ราคายังขึ้นได้) */
function feeText(v: Vehicle, rates: Rates, now: Date): string {
  const status = statusOf(v, rates, now);
  if (status === "check") return "—";
  const text = baht(totalFee(v, rates, now));
  if (status === "parked" || status === "overdue") return "~" + text;
  return text;
}

/** ส่งออก Excel 2 ชีต: รายการรถ + สรุป */
function exportExcel(list: Vehicle[], rates: Rates, search: string) {
  const now = new Date();
  const stamp = `${thaiShortDate(now)} ${hhmm(now)} น.`;

  // ตัวเลขสำหรับชีตสรุป
  const paidCars = list.filter((v) => v.paidAt);
  let paidTotal = 0;
  let pendingTotal = 0;
  for (const v of list) {
    if (v.paidAt) paidTotal += v.paidAmount ?? 0;
    if (!v.unreadable) pendingTotal += amountDue(v, rates, now);
  }

  // แถวของชีตรายการรถ
  const rows = list.map((v) => {
    const minutes = minutesParked(v, now);
    const status = statusOf(v, rates, now);
    let statusText = STATUS_INFO[status].label;
    if (status === "parked" || status === "overdue") statusText += " (ค่าจอดโดยประมาณ)";
    return [
      v.plate,
      v.province,
      v.type,
      new Date(v.entryAt),
      v.paidAt ? new Date(v.paidAt) : null,
      v.exitAt ? new Date(v.exitAt) : null,
      minutes,
      durationLabel(minutes),
      v.unreadable ? null : totalFee(v, rates, now),
      statusText,
    ];
  });

  let title = `รายการรถเข้า-ออก · Smart Parking · ข้อมูล ณ ${stamp}`;
  if (search) title += ` · ค้นหา "${search}"`;

  downloadXlsx(stampedName("smart-parking_entry-exit", now), [
    {
      name: "รายการรถเข้า-ออก",
      title,
      columns: [
        { header: "ทะเบียน", width: 14 },
        { header: "จังหวัด", width: 16 },
        { header: "ประเภท", width: 10 },
        { header: "เวลาเข้า", width: 18, format: "date" },
        { header: "เวลาชำระ", width: 18, format: "date" },
        { header: "เวลาออก", width: 18, format: "date" },
        { header: "จอด (นาที)", width: 12, format: "int" },
        { header: "ระยะเวลา", width: 16 },
        { header: "ค่าจอด (บาท)", width: 14, format: "money" },
        { header: "สถานะ", width: 20 },
      ],
      rows,
    },
    {
      name: "สรุป",
      title: `สรุป · ข้อมูล ณ ${stamp}`,
      columns: [{ header: "รายการ", width: 34 }, { header: "จำนวน", width: 16 }],
      rows: [
        ["รถทั้งหมดในรายงาน (คัน)", { value: list.length, format: "int" }],
        ["ยังอยู่ในลานจอด (คัน)", { value: list.filter((v) => !v.exitAt).length, format: "int" }],
        ["ออกจากลานแล้ว (คัน)", { value: list.filter((v) => v.exitAt).length, format: "int" }],
        ["ชำระแล้ว (คัน)", { value: paidCars.length, format: "int" }],
        ["รอตรวจสอบทะเบียน (คัน)", { value: list.filter((v) => v.unreadable).length, format: "int" }],
        ["ยอดที่ชำระแล้ว (บาท)", { value: paidTotal, format: "money-bold" }],
        ["ค่าจอดค้างชำระโดยประมาณ (บาท)", { value: pendingTotal, format: "money" }],
        ["อัตรา", `ฟรี ${rates.freeMinutes} นาทีแรก · ${rates.perHour} บาท/ชม. · สูงสุด ${rates.maxPerDay} บาท/วัน`],
      ],
    },
  ]);
}

export default function ActivityReportPage() {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false); // เปิดหน้าต่างบันทึกรถเข้าอยู่หรือไม่
  const { rates } = useRates();
  const { vehicles, layout, error, reload } = useVehicles(); // ดึงข้อมูลใหม่ทุก 5 วินาที

  const now = new Date();
  const all = vehicles ?? [];
  const shown = all.filter((v) => normalizePlate(v.plate).includes(normalizePlate(search)));
  const inLot = all.filter((v) => !v.exitAt).length;

  let tableSub = "กำลังโหลด…";
  if (vehicles) {
    tableSub = `แสดง ${shown.length} จาก ${all.length} รายการ · ยังอยู่ในลาน ${inLot} คัน · อัปเดตอัตโนมัติทุก 5 วินาที`;
  }

  return (
    <>
      <PageHeader
        title="รายงาน"
        subtitle="รายการเข้า-ออก ช่วงเวลาหนาแน่น และการใช้งานช่องจอด"
        actions={
          <>
            <span className="pill"><Icon name="layers" size={18} color="var(--text-2)" />ทุกชั้น</span>
            <button className="btn btn-secondary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} />บันทึกรถเข้า
            </button>
            <button className="btn btn-primary" onClick={() => exportExcel(shown, rates, search.trim())} disabled={!vehicles}>
              <Icon name="download" size={18} />ส่งออก Excel
            </button>
          </>
        }
      />
      <ReportTabs />

      <div className="split" style={{ gridTemplateColumns: "minmax(0, 1fr) 420px" }}>
        {/* Heat map ชั้น 2 */}
        <div className="card">
          <CardHead title="Heat map การใช้งานช่องจอด" sub="ชั้น 2 · อัตราการใช้งานเฉลี่ย (% ของเวลาเปิดทำการ)" />
          <div className="col" style={{ background: "var(--bg)", borderRadius: 14, padding: 16, gap: 8 }}>
            {HEATMAP_FLOOR2.map((row, rowIndex) => (
              <div key={rowIndex} className="col" style={{ gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
                  {row.map((percent, colIndex) => {
                    const level = Math.min(5, Math.floor(percent / 18)); // 0–5
                    const [background, color] = HEAT_COLORS[level];
                    const slotName = "B" + String(rowIndex * 8 + colIndex + 1).padStart(2, "0");
                    return (
                      <div key={colIndex} style={{ background, color, borderRadius: 10, padding: "12px 0", textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{slotName}</div>
                        <div style={{ fontSize: 15, fontWeight: 700 }}>{percent}%</div>
                      </div>
                    );
                  })}
                </div>
                {rowIndex === 0 && <span className="driveway">→ ทางวิ่ง →</span>}
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted">น้อย</span>
            {HEAT_COLORS.map(([background], i) => (
              <span key={i} style={{ width: 28, height: 10, borderRadius: 3, background }} />
            ))}
            <span className="small muted">มาก</span>
          </div>
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "var(--green-50)", color: "var(--green-800)", fontSize: 13 }}>
            ช่องใกล้ทางเข้า (B01–B05) ถูกใช้งานมากที่สุด · ช่องท้ายแถว B14–B16 ใช้งานน้อยกว่า 20%
          </div>
        </div>

        {/* ประเภทรถตามช่วงเวลา */}
        <div className="card">
          <CardHead title="ประเภทรถตามช่วงเวลา" sub="จำนวนคันเฉลี่ยต่อวัน" />
          <div className="row" style={{ gap: 14 }}>
            {TYPE_NAMES.map((name, i) => (
              <span key={name} className="row small muted" style={{ gap: 6, fontWeight: 500 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: TYPE_COLORS[i] }} />
                {name}
              </span>
            ))}
          </div>
          {VEHICLES_BY_TIME.map((slot) => {
            const total = slot.values.reduce((a, b) => a + b, 0);
            return (
              <div key={slot.range} className="col" style={{ gap: 6 }}>
                <div className="row-between">
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{slot.range} น.</span>
                  <span className="text-green semibold" style={{ fontSize: 13 }}>{total} คัน</span>
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  {slot.values.map((count, i) => (
                    <span key={i} style={{ height: 12, borderRadius: 3, background: TYPE_COLORS[i], width: `${(count / 150) * 100}%` }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ตารางรถเข้า-ออก */}
      <div className="card">
        <CardHead
          title="รายการรถเข้า-ออก"
          sub={tableSub}
          right={
            <div className="input" style={{ minHeight: 38, width: 240 }}>
              <Icon name="search" size={18} color="var(--text-2)" />
              <input placeholder="ค้นหาทะเบียน..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ fontSize: 13, padding: "8px 0" }} />
            </div>
          }
        />
        <table className="table">
          <thead>
            <tr>
              <th>ทะเบียน</th><th>ประเภท</th><th>เวลาเข้า</th><th>เวลาออก</th><th>ระยะเวลา</th><th>ค่าจอด</th><th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((v) => {
              const status = STATUS_INFO[statusOf(v, rates, now)];
              return (
                <tr key={v.id}>
                  <td className="semibold">{v.plate}</td>
                  <td>{v.type}</td>
                  <td>{dateTime(v.entryAt)}</td>
                  <td>{v.exitAt ? dateTime(v.exitAt) : "—"}</td>
                  <td>{durationLabel(minutesParked(v, now))}</td>
                  <td>{feeText(v, rates, now)}</td>
                  <td><Badge tone={status.tone}>{status.label}</Badge></td>
                </tr>
              );
            })}
            {vehicles && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>
                  {search ? `ไม่พบทะเบียน "${search}"` : "ยังไม่มีรายการ"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {error && <span className="small text-danger">โหลดข้อมูลไม่สำเร็จ: {error}</span>}
        <span className="small muted">~ = ค่าจอดโดยประมาณ ณ ตอนนี้ (รถยังไม่ชำระ)</span>
      </div>

      {adding && (
        <VehicleEntryDialog
          layout={layout}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); reload(); }}
        />
      )}
    </>
  );
}
