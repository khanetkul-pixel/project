"use client";
// =====================================================
// หน้ารายงานการเงิน — /admin/reports/finance  (Figma: 07 · รายงาน · แท็บการเงิน)
// ทุกตัวเลข (การ์ด · กราฟ · ตาราง · Excel) เปลี่ยนตามช่วงวันที่ที่เลือก
// ตัวเลขรายรับเป็นข้อมูลตัวอย่าง (lib/finance.ts) ยกเว้นชีต "ชำระผ่านหน้า pay" ใน Excel ที่เป็นข้อมูลจริง
// =====================================================
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, BarChart, CardHead, KpiCard, PageHeader } from "@/components/ui";
import { ReportTabs } from "@/components/ReportTabs";
import { DateRangePicker, rangeFor, type Range } from "@/components/DateRangePicker";
import { today, type Period, type TxStatus } from "@/lib/data";
import { fetchVehicles } from "@/lib/vehicle-api";
import { baht, thaiRange } from "@/lib/format";
import { downloadXlsx, stampedName, type Sheet } from "@/lib/xlsx";
import { againstLabel, deltaText, financeFor, peakLabel, periodWord, transactionsIn, type FinanceSummary } from "@/lib/finance";
import type { Vehicle } from "@/lib/vehicles";

/** ข้อความและสีของสถานะรายการชำระ */
const TX_STATUS: Record<TxStatus, { tone: "success" | "warning" | "danger"; label: string }> = {
  ok: { tone: "success", label: "สำเร็จ" },
  pending: { tone: "warning", label: "รอยืนยัน" },
  failed: { tone: "danger", label: "ล้มเหลว" },
};

/** รถที่ชำระเงินจริงในช่วงวันที่ที่เลือก */
async function paidCarsIn(range: Range): Promise<Vehicle[]> {
  let list: Vehicle[] = [];
  try {
    list = await fetchVehicles();
  } catch {
    return [];
  }
  const from = range.start.getTime();
  const to = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate() + 1).getTime();
  return list.filter((v) => {
    if (!v.paidAt || !v.paidAmount) return false;
    const paidTime = new Date(v.paidAt).getTime();
    return paidTime >= from && paidTime < to;
  });
}

/** ส่งออกรายงานการเงินเป็นไฟล์ Excel */
async function exportFinance(range: Range, period: Period, f: FinanceSummary) {
  const rangeText = thaiRange(range.start, range.end);
  const against = againstLabel(period, f.days.length);
  const paidCars = await paidCarsIn(range);
  const transactions = transactionsIn(range.start, range.end);

  // ชีต 1: สรุป
  const summary: Sheet = {
    name: "สรุป",
    title: `รายงานการเงิน · Smart Parking · ${rangeText}`,
    columns: [{ header: "รายการ", width: 30 }, { header: "ค่า", width: 18 }, { header: "เทียบช่วงก่อน", width: 26 }],
    rows: [
      [`รายรับ${periodWord(period)} (บาท)`, { value: f.total, format: "money-bold" }, deltaText(f.total, f.prevTotal, against)],
      ["จำนวนรายการชำระ", { value: f.count, format: "int" }, deltaText(f.count, f.prevCount, against)],
      ["ค่าจอดเฉลี่ยต่อคัน (บาท)", { value: Math.round(f.avg * 100) / 100, format: "money" }, ""],
      ["สัดส่วนชำระผ่าน ThaiQR (%)", { value: 100, format: "int" }, "ช่องทางเดียว"],
      [f.barMode === "hour" ? "ช่วงเวลารายรับสูงสุด" : "วันที่รายรับสูงสุด", peakLabel(f.peak), ""],
      ["รายรับสูงสุด (บาท)", { value: f.peak.value, format: "money" }, ""],
    ],
  };

  // ชีต 2: รายรับรายชั่วโมง (เลือกวันเดียว) หรือรายวัน
  let byTime: Sheet;
  if (f.barMode === "hour") {
    byTime = {
      name: "รายรับรายชั่วโมง",
      title: `รายรับรายชั่วโมง · ${rangeText}`,
      columns: [{ header: "ช่วงเวลา", width: 16 }, { header: "รายรับ (บาท)", width: 16, format: "money" }],
      rows: f.bars.map((b) => [peakLabel(b), b.value]),
    };
  } else {
    byTime = {
      name: "รายรับรายวัน",
      title: `รายรับรายวัน · ${rangeText}`,
      columns: [{ header: "วันที่", width: 14, format: "day" }, { header: "รายรับ (บาท)", width: 16, format: "money" }],
      rows: f.bars.map((b) => [b.date, b.value]),
    };
  }

  // ชีต 3: ช่องทางการชำระ
  const channels: Sheet = {
    name: "ช่องทางการชำระ",
    title: `ช่องทางการชำระ · ${rangeText}`,
    columns: [
      { header: "ช่องทาง", width: 30 },
      { header: "สัดส่วน (%)", width: 12, format: "int" },
      { header: "จำนวนเงิน (บาท)", width: 18, format: "money" },
    ],
    rows: [["ThaiQR (สแกนจากมือถือ)", 100, f.total]],
  };

  // ชีต 4: รายการชำระล่าสุด (ตัวอย่าง)
  const recent: Sheet = {
    name: "รายการชำระล่าสุด",
    title: `รายการชำระเงินล่าสุด · ${rangeText}`,
    columns: [
      { header: "เลขที่รายการ", width: 20 },
      { header: "ทะเบียน", width: 14 },
      { header: "วัน-เวลา", width: 16 },
      { header: "ช่องทาง", width: 14 },
      { header: "จำนวนเงิน (บาท)", width: 16, format: "money" },
      { header: "สถานะ", width: 12 },
    ],
    rows: transactions.map((t) => [t.id, t.plate, t.time, t.channel, t.amount, TX_STATUS[t.status].label]),
  };

  // ชีต 5: ชำระจริงผ่านหน้า /pay
  const realPayments: Sheet = {
    name: "ชำระผ่านหน้า pay",
    title: `ชำระจริงผ่านหน้า /pay · ${rangeText}`,
    columns: [
      { header: "ทะเบียน", width: 14 },
      { header: "จังหวัด", width: 16 },
      { header: "ชั้น/ช่อง", width: 10 },
      { header: "เวลาเข้า", width: 18, format: "date" },
      { header: "เวลาชำระ", width: 18, format: "date" },
      { header: "ช่องทาง", width: 18 },
      { header: "จำนวนเงิน (บาท)", width: 16, format: "money" },
    ],
    rows: paidCars.map((v) => [
      v.plate,
      v.province,
      `${v.floor}/${v.slot}`,
      new Date(v.entryAt),
      new Date(v.paidAt as string),
      "ThaiQR · PromptPay",
      v.paidAmount ?? 0,
    ]),
  };

  downloadXlsx(stampedName("smart-parking_finance"), [summary, byTime, channels, recent, realPayments]);
}

export default function FinanceReportPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [range, setRange] = useState<Range>(() => rangeFor("month", today()));

  const f = financeFor(range.start, range.end);
  const rangeText = thaiRange(range.start, range.end);
  const against = againstLabel(period, f.days.length);
  const transactions = transactionsIn(range.start, range.end);

  function applyRange(p: Period, r: Range) {
    setPeriod(p);
    setRange(r);
  }

  return (
    <>
      <PageHeader
        title="รายงาน"
        subtitle="ภาพรวมและรายละเอียดรายรับทั้งหมด"
        actions={
          <>
            <DateRangePicker today={today()} period={period} range={range} onApply={applyRange} />
            <button className="btn btn-primary" onClick={() => exportFinance(range, period, f)}>
              <Icon name="download" size={18} />ส่งออก Excel
            </button>
          </>
        }
      />
      <ReportTabs />

      {/* การ์ดตัวเลข */}
      <div className="grid-4">
        <KpiCard icon="wallet" title={`รายรับ${periodWord(period)}`} value={baht(f.total)} delta={deltaText(f.total, f.prevTotal, against)} />
        <KpiCard icon="chart" title="จำนวนรายการชำระ" value={f.count.toLocaleString("en-US")} delta={deltaText(f.count, f.prevCount, against)} />
        <KpiCard icon="car" title="ค่าจอดเฉลี่ยต่อคัน" value={baht(f.avg, 2)} delta={rangeText} />
        <KpiCard icon="qr" title="ชำระผ่าน ThaiQR" value="100%" delta="ช่องทางเดียวของระบบ" />
      </div>

      <div className="split">
        {/* กราฟรายรับ */}
        <div className="card">
          <CardHead
            title={f.barMode === "hour" ? "รายรับรายชั่วโมง" : "รายรับรายวัน"}
            sub={rangeText}
            right={<span className="small semibold text-green">สูงสุด {baht(f.peak.value)} ({peakLabel(f.peak)})</span>}
          />
          <BarChart
            values={f.bars.map((b) => b.value)}
            labels={f.bars.map((b) => b.label)}
            subLabels={f.bars.some((b) => b.sub) ? f.bars.map((b) => b.sub ?? "") : undefined}
            height={170}
            colorFor={() => "dark"}
          />
        </div>

        {/* ช่องทางการชำระ */}
        <div className="card">
          <CardHead title="ช่องทางการชำระ" sub={rangeText} />
          <span style={{ height: 14, borderRadius: 4, width: "100%", background: "var(--green-700)" }} />
          <div className="row" style={{ gap: 10 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: "var(--green-700)", flexShrink: 0 }} />
            <div className="grow">
              <div style={{ fontSize: 14, fontWeight: 500 }}>ThaiQR (สแกนจากมือถือ)</div>
              <div className="small muted">100% ของรายรับ</div>
            </div>
            <span className="semibold" style={{ fontSize: 14 }}>{baht(f.total)}</span>
          </div>
        </div>
      </div>

      {/* ตารางรายการชำระ */}
      <div className="card">
        <CardHead title="รายการชำระเงินล่าสุด" sub={`แสดง ${transactions.length} จาก ${f.count.toLocaleString("en-US")} รายการ · ${rangeText}`} />
        <table className="table">
          <thead>
            <tr><th>เลขที่รายการ</th><th>ทะเบียน</th><th>วัน-เวลา</th><th>ช่องทาง</th><th>จำนวนเงิน</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.plate}</td>
                <td>{t.time}</td>
                <td>{t.channel}</td>
                <td>{baht(t.amount, 2)}</td>
                <td><Badge tone={TX_STATUS[t.status].tone}>{TX_STATUS[t.status].label}</Badge></td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>ไม่มีรายการในช่วงนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
