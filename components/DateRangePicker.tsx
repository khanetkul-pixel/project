"use client";
// =====================================================
// DateRangePicker.tsx — ปุ่มเลือกช่วงวันที่ + ปฏิทินแบบเปิด-ปิด
// มีช่วงด่วน: วันนี้ / สัปดาห์นี้ / เดือนนี้ / กำหนดเอง (คลิกวันเริ่ม แล้วคลิกวันสิ้นสุด)
// ใช้ในหน้า Dashboard และรายงานการเงิน
// =====================================================
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { THAI_MONTHS, THAI_WEEKDAYS_SHORT, buddhistYear, sameDay, thaiNumericDate, thaiRange } from "@/lib/format";
import type { Period } from "@/lib/data";

export type Range = { start: Date; end: Date };

/** หาช่วงวันที่ของ "วันนี้ / สัปดาห์นี้ / เดือนนี้" โดยนับจากวันที่ today */
export function rangeFor(period: Exclude<Period, "custom">, today: Date): Range {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (period === "day") {
    return { start: day, end: day };
  }

  if (period === "week") {
    // สัปดาห์เริ่มวันจันทร์: นับย้อนไปหาวันจันทร์
    const daysSinceMonday = (day.getDay() + 6) % 7;
    const monday = new Date(day);
    monday.setDate(day.getDate() - daysSinceMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday };
  }

  // เดือนนี้: วันที่ 1 ถึงวันสุดท้ายของเดือน (วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้)
  const firstDay = new Date(day.getFullYear(), day.getMonth(), 1);
  const lastDay = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  return { start: firstDay, end: lastDay };
}

const PRESETS: { key: Period; label: string }[] = [
  { key: "day", label: "วันนี้" },
  { key: "week", label: "สัปดาห์นี้" },
  { key: "month", label: "เดือนนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

/** วันที่ 1 ของเดือนที่ date อยู่ */
function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** วันทั้งหมดที่แสดงในปฏิทิน 1 หน้า (6 สัปดาห์ = 42 วัน เริ่มวันอาทิตย์) */
function calendarDays(month: Date): Date[] {
  const first = firstOfMonth(month);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // ถอยไปวันอาทิตย์

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

type Props = {
  today: Date;
  period: Period;
  range: Range;
  onApply: (period: Period, range: Range) => void;
};

export function DateRangePicker({ today, period, range, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<Period>(period); // ค่าที่เลือกไว้แต่ยังไม่กดตกลง
  const [draft, setDraft] = useState<Range>(range);
  const [firstClick, setFirstClick] = useState<Date | null>(null); // วันแรกที่คลิกตอนกำหนดเอง
  const [month, setMonth] = useState(firstOfMonth(range.end));     // เดือนที่กำลังดูในปฏิทิน
  const boxRef = useRef<HTMLDivElement | null>(null);

  // เปิดปฏิทินใหม่ → เริ่มจากค่าปัจจุบัน
  useEffect(() => {
    if (open) {
      setDraftPeriod(period);
      setDraft(range);
      setFirstClick(null);
      setMonth(firstOfMonth(range.end));
    }
  }, [open, period, range]);

  // คลิกนอกกล่อง → ปิด
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const box = boxRef.current;
      if (box && !box.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function choosePreset(p: Period) {
    setDraftPeriod(p);
    setFirstClick(null);
    if (p !== "custom") {
      const r = rangeFor(p, today);
      setDraft(r);
      setMonth(firstOfMonth(r.end));
    }
  }

  function clickDay(d: Date) {
    setDraftPeriod("custom");
    if (firstClick === null) {
      // คลิกครั้งแรก = วันเริ่ม
      setFirstClick(d);
      setDraft({ start: d, end: d });
    } else {
      // คลิกครั้งที่สอง = วันสิ้นสุด (ถ้าคลิกวันก่อนหน้า ให้สลับกัน)
      if (d < firstClick) {
        setDraft({ start: d, end: firstClick });
      } else {
        setDraft({ start: firstClick, end: d });
      }
      setFirstClick(null);
    }
  }

  function changeMonth(step: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + step, 1));
  }

  function apply() {
    onApply(draftPeriod, draft);
    setOpen(false);
  }

  /** class ของช่องวันที่ในปฏิทิน (ไว้ระบายสีช่วงที่เลือก) */
  function cellClass(d: Date, column: number): string {
    const inRange = d >= draft.start && d <= draft.end;
    const classes = ["cal-cell"];
    if (inRange) {
      classes.push("in-range");
      if (sameDay(d, draft.start) || column === 0) classes.push("range-start");
      if (sameDay(d, draft.end) || column === 6) classes.push("range-end");
    }
    return classes.join(" ");
  }

  function dayClass(d: Date): string {
    const inRange = d >= draft.start && d <= draft.end;
    const otherMonth = d.getMonth() !== month.getMonth();
    const isEdge = sameDay(d, draft.start) || sameDay(d, draft.end);
    const classes = ["cal-day"];
    if (otherMonth && !inRange) classes.push("outside");
    if (isEdge) classes.push("edge");
    return classes.join(" ");
  }

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {/* ปุ่มที่แสดงช่วงวันที่ */}
      <button type="button" className="pill" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="calendar" size={18} color="var(--green-700)" />
        {thaiRange(range.start, range.end)}
        <Icon name="chevronDown" size={16} color="var(--text-2)" />
      </button>

      {open && (
        <div className="popover" role="dialog" aria-label="เลือกช่วงวันที่">
          {/* ช่วงด่วน */}
          <div className="presets">
            <div className="small semibold muted" style={{ padding: "0 4px 6px" }}>ช่วงเวลาด่วน</div>
            {PRESETS.map((p) => (
              <button key={p.key} type="button" className={draftPeriod === p.key ? "active" : ""} onClick={() => choosePreset(p.key)}>
                {p.label}
              </button>
            ))}
          </div>

          {/* ปฏิทิน */}
          <div className="calendar">
            <div className="row-between">
              <button type="button" className="icon-btn" style={{ padding: 6 }} aria-label="เดือนก่อน" onClick={() => changeMonth(-1)}>
                <Icon name="chevronLeft" size={18} color="var(--text)" />
              </button>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {THAI_MONTHS[month.getMonth()]} {buddhistYear(month)}
              </div>
              <button type="button" className="icon-btn" style={{ padding: 6 }} aria-label="เดือนถัดไป" onClick={() => changeMonth(1)}>
                <Icon name="chevronRight" size={18} color="var(--text)" />
              </button>
            </div>

            <div className="cal-grid">
              {THAI_WEEKDAYS_SHORT.map((w) => (
                <div key={w} className="cal-dow">{w}</div>
              ))}
              {calendarDays(month).map((d, i) => (
                <div key={i} className={cellClass(d, i % 7)}>
                  <button type="button" className={dayClass(d)} onClick={() => clickDay(d)}>
                    {d.getDate()}
                  </button>
                </div>
              ))}
            </div>

            <div className="row" style={{ gap: 8 }}>
              <div className="date-box">
                <div className="tiny muted">วันเริ่มต้น</div>
                <div className="semibold" style={{ fontSize: 14 }}>{thaiNumericDate(draft.start)}</div>
              </div>
              <span className="muted">–</span>
              <div className="date-box">
                <div className="tiny muted">วันสิ้นสุด</div>
                <div className="semibold" style={{ fontSize: 14 }}>{thaiNumericDate(draft.end)}</div>
              </div>
            </div>

            <div className="row" style={{ gap: 10 }}>
              <button type="button" className="btn btn-secondary grow" onClick={() => setOpen(false)}>ยกเลิก</button>
              <button type="button" className="btn btn-primary grow" onClick={apply}>ตกลง</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
