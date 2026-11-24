"use client";
// =====================================================
// หน้า Dashboard — /admin  (Figma: 05 · Dashboard)
//   "วันนี้" = วันที่เปิดเว็บจริง
//   การ์ด "รถในลาน" และ "ช่องว่าง" ใช้ข้อมูลรถจริง (อัปเดตทุก 5 วินาที)
//   รายรับ จำนวนรถเข้า และกราฟรายรับ = ข้อมูลจำลองจาก lib/finance.ts (ตรงกับหน้ารายงานการเงิน)
//   กราฟช่วงเวลาหนาแน่น และสัดส่วนประเภทรถ = ข้อมูลจำลองจาก lib/data.ts
// =====================================================
import { useState } from "react";
import Link from "next/link";
import { BarChart, CardHead, KpiCard, PageHeader } from "@/components/ui";
import { DateRangePicker, rangeFor, type Range } from "@/components/DateRangePicker";
import { useVehicles } from "@/components/useVehicles";
import { DASHBOARD, today, type Period } from "@/lib/data";
import { addDays, againstLabel, deltaText, financeFor, periodWord } from "@/lib/finance";
import { buildFloors, emptiestFloor, floorStats, totalSlots } from "@/lib/lot";
import { THAI_MONTHS, THAI_WEEKDAYS, baht, buddhistYear, dayPeriod, thaiRange, thaiShortDate, twoDigits } from "@/lib/format";

const VEHICLE_NAMES = ["Sedan", "SUV", "Pickup", "อื่น ๆ"];

/** ข้อความใต้ชื่อหน้า ตามช่วงที่เลือก */
function subtitleFor(period: Period, range: Range): string {
  const d = range.start;
  if (period === "day") return `วัน${THAI_WEEKDAYS[d.getDay()]}ที่ ${thaiShortDate(d)}`;
  if (period === "week") return `สัปดาห์ที่ ${thaiRange(range.start, range.end)}`;
  if (period === "month") return `${THAI_MONTHS[d.getMonth()]} ${buddhistYear(d)}`;
  return thaiRange(range.start, range.end);
}

/**
 * ข้อมูลกราฟรายรับ
 *   วันนี้     → 7 วันล่าสุด (รายวัน)
 *   สัปดาห์นี้ → 7 วันของสัปดาห์ (รายวัน)
 *   เดือนนี้   → รวมรายสัปดาห์
 *   กำหนดเอง  → รายวันของช่วงที่เลือก
 */
function revenueChart(period: Period, range: Range) {
  // วันนี้: ดู 7 วันล่าสุด
  if (period === "day") {
    const f = financeFor(addDays(range.start, -6), range.start);
    return {
      title: "รายรับ 7 วันล่าสุด",
      rangeText: thaiRange(addDays(range.start, -6), range.start),
      values: f.bars.map((b) => b.value),
      labels: f.bars.map((b) => b.label),
      subLabels: f.bars.map((b) => b.sub ?? ""),
      total: f.total,
      delta: deltaText(f.total, f.prevTotal, "จาก 7 วันก่อนหน้า"),
      highlight: f.bars.length - 1, // เน้นแท่งวันนี้
    };
  }

  const f = financeFor(range.start, range.end);

  // เดือนนี้: รวมเป็นรายสัปดาห์ (ทุก 7 วัน)
  if (period === "month") {
    const values: number[] = [];
    const labels: string[] = [];
    for (let i = 0; i < f.bars.length; i += 7) {
      const week = f.bars.slice(i, i + 7);
      values.push(week.reduce((sum, b) => sum + b.value, 0));
      labels.push(`ส.${values.length}`);
    }
    return {
      title: `รายรับรายสัปดาห์ · ${THAI_MONTHS[range.start.getMonth()]}`,
      rangeText: thaiRange(range.start, range.end),
      values,
      labels,
      subLabels: undefined,
      total: f.total,
      delta: deltaText(f.total, f.prevTotal, "จากเดือนก่อน"),
      highlight: values.indexOf(Math.max(...values)),
    };
  }

  // สัปดาห์นี้ / กำหนดเอง: รายวัน
  const values = f.bars.map((b) => b.value);
  return {
    title: period === "week" ? "รายรับรายวัน · สัปดาห์นี้" : "รายรับรายวัน · ช่วงที่เลือก",
    rangeText: thaiRange(range.start, range.end),
    values,
    labels: f.bars.map((b) => b.label),
    subLabels: f.bars.some((b) => b.sub) ? f.bars.map((b) => b.sub ?? "") : undefined,
    total: f.total,
    delta: deltaText(f.total, f.prevTotal, againstLabel(period, f.days.length)),
    highlight: values.indexOf(Math.max(...values)),
  };
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("day");
  const [range, setRange] = useState<Range>(() => rangeFor("day", today()));

  // ---------- ข้อมูลรถจริง ----------
  const { vehicles, maintenance, layout } = useVehicles();
  const floors = buildFloors(layout, vehicles ?? [], maintenance);
  const capacity = totalSlots(layout);
  let carsNow = 0;
  let freeSlots = 0;
  for (const f of floors) {
    carsNow += floorStats(f).occupied;
    freeSlots += floorStats(f).free;
  }
  const mostFree = emptiestFloor(floors);

  let carsValue = "…";
  let carsDelta = "กำลังโหลด…";
  let freeValue = "…";
  let freeDelta = "กำลังโหลด…";
  if (vehicles) {
    carsValue = `${carsNow} / ${capacity}`;
    carsDelta = `${Math.round((carsNow / capacity) * 100)}% ของความจุทั้งหมด`;
    freeValue = `${freeSlots} ช่อง`;
    freeDelta = mostFree ? `${mostFree.name} ว่างมากที่สุด` : "";
  }

  // ---------- รายรับและจำนวนรถเข้า (จำลอง) ----------
  const summary = financeFor(range.start, range.end);
  const against = againstLabel(period, summary.days.length);
  const chart = revenueChart(period, range);

  // ---------- กราฟช่วงเวลาหนาแน่น ----------
  const hours = DASHBOARD.peakHours.map((_, i) => 6 + i);
  const hourLabels = hours.map((h) => `${twoDigits(h)}.00`);
  const vehicleMix = DASHBOARD.vehicleMix[period];

  function applyRange(p: Period, r: Range) {
    setPeriod(p);
    setRange(r);
  }

  return (
    <>
      <PageHeader
        title="ภาพรวมลานจอด"
        subtitle={subtitleFor(period, range)}
        actions={<DateRangePicker today={today()} period={period} range={range} onApply={applyRange} />}
      />

      {/* การ์ดตัวเลข 4 ใบ */}
      <div className="grid-4">
        <KpiCard href="/admin/parking-map" icon="car" title="รถในลานตอนนี้" value={carsValue} delta={carsDelta} />
        <KpiCard href="/admin/parking-map" icon="layers" title="ช่องจอดว่าง" value={freeValue} delta={freeDelta} />
        <KpiCard
          href="/admin/reports/finance"
          icon="wallet"
          title={`รายรับ${periodWord(period)}`}
          value={baht(summary.total)}
          delta={deltaText(summary.total, summary.prevTotal, against)}
        />
        <KpiCard
          href="/admin/reports/activity"
          icon="chart"
          title={`รถเข้า${periodWord(period)}`}
          value={`${summary.count.toLocaleString("en-US")} คัน`}
          delta={deltaText(summary.count, summary.prevCount, against)}
        />
      </div>

      <div className="split">
        {/* กราฟรายรับ */}
        <Link href="/admin/reports/finance" className="card">
          <CardHead title={chart.title} sub={chart.rangeText} />
          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
            <span style={{ fontSize: 30, fontWeight: 700 }}>{baht(chart.total)}</span>
            <span className="small semibold text-green">{chart.delta}</span>
          </div>
          <BarChart values={chart.values} labels={chart.labels} subLabels={chart.subLabels} highlight={chart.highlight} />
        </Link>

        {/* สัดส่วนประเภทรถ */}
        <Link href="/admin/reports/activity" className="card">
          <CardHead title="ประเภทรถที่เข้าใช้งาน" sub={`${periodWord(period)} · ${summary.count.toLocaleString("en-US")} คัน`} />
          {VEHICLE_NAMES.map((name, i) => (
            <div key={name} className="col" style={{ gap: 6 }}>
              <div className="row-between">
                <span style={{ fontSize: 14, fontWeight: 500 }}>{name}</span>
                <span className="text-green semibold" style={{ fontSize: 14 }}>{vehicleMix[i]}%</span>
              </div>
              <div className="track"><div style={{ width: `${vehicleMix[i]}%` }} /></div>
            </div>
          ))}
        </Link>
      </div>

      {/* กราฟช่วงเวลาหนาแน่น */}
      <Link href="/admin/reports/activity" className="card">
        <CardHead title="ช่วงเวลาหนาแน่น" sub={`จำนวนรถเข้า-ออกเฉลี่ยรายชั่วโมง ${DASHBOARD.peakNote[period]} · เวลาเป็น น.`} />
        <BarChart
          values={DASHBOARD.peakHours}
          labels={hourLabels}
          subLabels={hours.map(dayPeriod)}
          height={130}
          colorFor={(value) => {
            if (value >= 55) return "dark";
            if (value >= 40) return "mid";
            return "light";
          }}
        />
      </Link>
    </>
  );
}
