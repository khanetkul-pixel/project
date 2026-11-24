"use client";
// =====================================================
// หน้าชำระเงินสำเร็จ (มือถือลูกค้า) — /pay/<ทะเบียน>/success  (Figma: 04a · User – ชำระเงินสำเร็จ)
// แสดงใบเสร็จจากข้อมูลการชำระจริง และเวลาที่ต้องออกจากลาน
// =====================================================
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { MobileShell, TopBar, usePlateParam } from "@/components/mobile";
import { useRates } from "@/components/RatesProvider";
import { useVehicle } from "@/components/useVehicle";
import { baht, hhmm, thaiShortDate } from "@/lib/format";

export default function PaySuccessPage() {
  const plate = usePlateParam();
  const { rates } = useRates();
  const { car, loading } = useVehicle(plate);

  if (loading) {
    return <MobileShell><div className="m-content muted">กำลังโหลด…</div></MobileShell>;
  }

  if (!car || !car.paidAt) {
    return (
      <MobileShell>
        <TopBar title="การชำระเงิน" backHref="/pay" />
        <div className="m-content">
          <div className="card" style={{ alignItems: "center", textAlign: "center" }}>
            <p className="semibold">ยังไม่พบการชำระของทะเบียน {plate}</p>
            <Link href={`/pay/${encodeURIComponent(plate)}`} className="btn btn-primary btn-block">กลับไปหน้ารายละเอียด</Link>
          </div>
        </div>
      </MobileShell>
    );
  }

  const paidAt = new Date(car.paidAt);
  const mustExitBy = new Date(paidAt.getTime() + rates.exitWithinMinutes * 60000);
  const transactionId = "TX-" + car.id.replace(/\D/g, "").slice(-13);

  // แถวในใบเสร็จ: [หัวข้อ, ค่า]
  const receipt = [
    ["ทะเบียนรถ", car.plate],
    ["ช่องทาง", "ThaiQR · PromptPay"],
    ["เวลาชำระ", `${thaiShortDate(paidAt)} · ${hhmm(paidAt)}`],
    ["เลขที่รายการ", transactionId],
  ];

  return (
    <MobileShell>
      <div className="m-content" style={{ paddingTop: 48, alignItems: "center" }}>
        <span style={{ padding: 22, borderRadius: "50%", background: "var(--green-100)", color: "var(--green-700)", display: "inline-flex" }}>
          <Icon name="check" size={44} />
        </span>

        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>ชำระเงินสำเร็จ</h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 4 }}>ขอบคุณที่ใช้บริการ Smart Parking</p>
        </div>

        <div className="text-green" style={{ fontSize: 36, fontWeight: 700 }}>{baht(car.paidAmount ?? 0, 2)}</div>

        <div className="card" style={{ padding: "18px 20px", gap: 12, width: "100%" }}>
          {receipt.map(([label, value]) => (
            <div key={label} className="row-between" style={{ fontSize: 14 }}>
              <span className="muted">{label}</span>
              <span className="semibold">{value}</span>
            </div>
          ))}
        </div>

        <div className="row" style={{ gap: 10, width: "100%", padding: "12px 16px", borderRadius: 14, background: "var(--warning-bg)", color: "var(--warning)", fontSize: 13, fontWeight: 500 }}>
          <Icon name="clock" />
          กรุณาออกจากลานจอดภายใน {rates.exitWithinMinutes} นาที (ก่อน {hhmm(mustExitBy)}) ไม้กั้นจะเปิดอัตโนมัติเมื่อตู้ Kiosk ทางออกอ่านทะเบียน
        </div>

        <div className="grow" />
        <Link href="/pay" className="btn btn-primary btn-block">เสร็จสิ้น</Link>
      </div>
    </MobileShell>
  );
}
