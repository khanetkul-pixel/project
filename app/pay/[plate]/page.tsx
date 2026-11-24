"use client";
// =====================================================
// หน้ารายละเอียดการจอด (มือถือลูกค้า) — /pay/<ทะเบียน>  (Figma: 03 · User – รายละเอียดการจอด)
// แสดงเวลาเข้า เวลาจอด ค่าจอด และปุ่มไปชำระเงิน
// =====================================================
import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui";
import { MobileShell, TopBar, usePlateParam } from "@/components/mobile";
import { useRates } from "@/components/RatesProvider";
import { useVehicle } from "@/components/useVehicle";
import { amountDue, minutesParked, type Vehicle } from "@/lib/vehicles";
import { baht, durationLabel, hhmm, thaiShortDate } from "@/lib/format";

export default function PayDetailPage() {
  const plate = usePlateParam();
  const { rates } = useRates();
  const { car, error, loading } = useVehicle(plate);

  // อัปเดต "เวลาปัจจุบัน" ทุก 30 วินาที (ค่าจอดจะขึ้นเองเมื่อครบชั่วโมง)
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <MobileShell>
        <TopBar title="รายละเอียดการจอด" backHref="/pay" />
        <div className="m-content muted">กำลังโหลด…</div>
      </MobileShell>
    );
  }

  if (!car || error) {
    return (
      <MobileShell>
        <TopBar title="รายละเอียดการจอด" backHref="/pay" />
        <div className="m-content">
          <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
            <Icon name="search" size={32} color="var(--text-2)" />
            <p className="semibold">ไม่พบทะเบียน {plate}</p>
            <p className="small muted">{error}</p>
            <Link href="/pay" className="btn btn-primary btn-block">ค้นหาใหม่</Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  // ---------- คำนวณสถานะ ----------
  const minutes = minutesParked(car, now);
  const due = amountDue(car, rates, now);         // ยอดที่ยังต้องจ่าย
  const exited = car.exitAt !== null;              // ออกจากลานแล้ว
  const overdue = car.paidAt !== null && due > 0;  // จ่ายแล้ว แต่ออกช้าเกินเวลา → ต้องจ่ายเพิ่ม
  const paid = car.paidAt !== null && !overdue;    // จ่ายแล้ว ยังออกทันเวลา

  // ตัวเลขใหญ่ที่แสดง: จ่ายแล้ว → ยอดที่จ่าย · ยังไม่จ่าย → ยอดที่ต้องจ่าย
  const shownAmount = paid || exited ? car.paidAmount ?? 0 : due;
  const leaveTime = exited ? new Date(car.exitAt as string) : now;
  const href = `/pay/${encodeURIComponent(car.plate)}`;

  return (
    <MobileShell>
      <TopBar title="รายละเอียดการจอด" backHref="/pay" />
      <div className="m-content">
        {/* กล่องแสดงว่าบันทึกเข้าโดยตู้ Kiosk */}
        <div style={{ height: 170, borderRadius: 20, background: "var(--green-100)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--green-700)" }}>
          <Icon name="kiosk" size={32} />
          <span className="small">บันทึกเข้าโดยตู้ Kiosk ทางเข้า</span>
        </div>

        {/* ทะเบียน + ป้ายสถานะ */}
        <div className="card" style={{ padding: 20, gap: 6 }}>
          <div className="row-between">
            <span style={{ fontSize: 24, fontWeight: 700 }}>{car.plate}</span>
            <StatusBadge exited={exited} overdue={overdue} paid={paid} due={due} />
          </div>
          <span className="muted" style={{ fontSize: 13 }}>
            {car.type} · ชั้น {car.floor} · {car.province}
          </span>
        </div>

        {/* รายละเอียดเวลาและเงิน */}
        <div className="card" style={{ padding: 20, gap: 0 }}>
          <div className="kv"><span>เวลาเข้า</span><span>{thaiShortDate(new Date(car.entryAt))} · {hhmm(new Date(car.entryAt))}</span></div>
          <div className="kv"><span>{exited ? "เวลาออก" : "เวลาปัจจุบัน"}</span><span>{thaiShortDate(leaveTime)} · {hhmm(leaveTime)}</span></div>
          <div className="kv"><span>จำนวนชั่วโมง</span><span>{durationLabel(minutes)}</span></div>
          <div className="kv"><span>อัตรา</span><span>ฟรี {rates.freeMinutes} นาทีแรก · {rates.perHour} บาท/ชม.</span></div>
          <div className="row-between" style={{ paddingTop: 14 }}>
            <span className="semibold" style={{ fontSize: 16 }}>{amountLabel(car, paid, exited, overdue)}</span>
            <span className="text-green" style={{ fontSize: 24, fontWeight: 700 }}>{baht(shownAmount, 2)}</span>
          </div>
        </div>

        <div className="grow" />

        {/* ปุ่มด้านล่าง */}
        <BottomButton exited={exited} paid={paid} overdue={overdue} due={due} href={href} />
      </div>
    </MobileShell>
  );
}

function StatusBadge({ exited, overdue, paid, due }: { exited: boolean; overdue: boolean; paid: boolean; due: number }) {
  if (exited) return <Badge tone="neutral">ออกจากลานแล้ว</Badge>;
  if (overdue) return <Badge tone="danger">เกินเวลาออก</Badge>;
  if (paid) return <Badge tone="success">ชำระแล้ว</Badge>;
  if (due > 0) return <Badge tone="warning">รอชำระ</Badge>;
  return <Badge tone="success">ฟรี</Badge>;
}

function amountLabel(car: Vehicle, paid: boolean, exited: boolean, overdue: boolean): string {
  if (paid || exited) return "ชำระแล้ว";
  if (overdue) return `ชำระเพิ่ม (จ่ายแล้ว ${baht(car.paidAmount ?? 0)})`;
  return "ค่าจอดทั้งหมด";
}

function BottomButton({ exited, paid, overdue, due, href }: { exited: boolean; paid: boolean; overdue: boolean; due: number; href: string }) {
  if (exited) {
    return <div className="btn btn-ghost btn-block">รถคันนี้ออกจากลานแล้ว</div>;
  }
  if (paid) {
    return <Link href={`${href}/success`} className="btn btn-secondary btn-block">ดูใบเสร็จการชำระ</Link>;
  }
  if (due > 0) {
    const word = overdue ? "ชำระเพิ่ม" : "ชำระค่าจอด";
    return <Link href={`${href}/qr`} className="btn btn-primary btn-block">{word} {baht(due)}</Link>;
  }
  return <div className="btn btn-secondary btn-block">ยังอยู่ในช่วงจอดฟรี ออกได้เลย</div>;
}
