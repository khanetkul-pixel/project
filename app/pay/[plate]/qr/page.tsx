"use client";
// =====================================================
// หน้าชำระผ่าน ThaiQR (มือถือลูกค้า) — /pay/<ทะเบียน>/qr  (Figma: 04 · User – ชำระผ่าน ThaiQR)
//
// การจำลอง: รอ 6 วินาที แล้วถือว่า "ธนาคารยืนยันว่าจ่ายแล้ว" → บันทึกการชำระ → ไปหน้าสำเร็จ
// ถ้าออกจากหน้านี้ก่อนครบ 6 วินาที หรือ QR หมดอายุ → จะไม่บันทึก
// ระบบจริง: สร้าง QR จาก PromptPay ของลานจอด แล้วรอธนาคารแจ้งผล
// =====================================================
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MobileShell, MockQR, TopBar, usePlateParam } from "@/components/mobile";
import { useRates } from "@/components/RatesProvider";
import { useVehicle } from "@/components/useVehicle";
import { payVehicle } from "@/lib/vehicle-api";
import { amountDue } from "@/lib/vehicles";
import { baht, twoDigits } from "@/lib/format";

const QR_LIFETIME_SECONDS = 10 * 60; // QR หมดอายุใน 10 นาที
const FAKE_BANK_DELAY_MS = 6000;     // จำลองว่าธนาคารยืนยันหลัง 6 วินาที

export default function PayQrPage() {
  const router = useRouter();
  const plate = usePlateParam();
  const { rates } = useRates();
  const { car, error, loading } = useVehicle(plate);

  const [secondsLeft, setSecondsLeft] = useState(QR_LIFETIME_SECONDS);
  const [payError, setPayError] = useState("");
  const [qrRound, setQrRound] = useState(0); // เพิ่มขึ้นทุกครั้งที่กด "สร้าง QR ใหม่"

  const backHref = `/pay/${encodeURIComponent(plate)}`;
  const successHref = `${backHref}/success`;
  const fee = car ? amountDue(car, rates) : 0;
  const needToPay = fee > 0;
  const expired = secondsLeft === 0;

  // นับถอยหลังทุก 1 วินาที
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [qrRound]);

  // จำลองธนาคารยืนยันการจ่าย
  useEffect(() => {
    if (!car) return;

    // ไม่มียอดต้องจ่ายแล้ว → ไปหน้าสำเร็จเลย
    if (!needToPay) {
      router.replace(successHref);
      return;
    }
    if (expired) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        await payVehicle(car.id);
        if (!cancelled) router.push(successHref);
      } catch (e) {
        if (!cancelled) setPayError((e as Error).message);
      }
    }, FAKE_BANK_DELAY_MS);

    // ออกจากหน้า / QR หมดอายุ / สร้าง QR ใหม่ → ยกเลิกตัวจับเวลา
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [car?.id, needToPay, expired, qrRound]);

  function renewQr() {
    setSecondsLeft(QR_LIFETIME_SECONDS);
    setPayError("");
    setQrRound(qrRound + 1);
  }

  if (loading) {
    return (
      <MobileShell>
        <TopBar title="ชำระเงิน" backHref={backHref} />
        <div className="m-content muted">กำลังโหลด…</div>
      </MobileShell>
    );
  }

  if (!car || error) {
    return (
      <MobileShell>
        <TopBar title="ชำระเงิน" backHref="/pay" />
        <div className="m-content"><div className="card">{error || "ไม่พบข้อมูลรถ"}</div></div>
      </MobileShell>
    );
  }

  // เลขอ้างอิง = ตัวเลข 10 หลักท้ายของ id รถ
  const reference = car.id.replace(/\D/g, "").slice(-10).padStart(10, "0");
  const countdown = `${twoDigits(Math.floor(secondsLeft / 60))}:${twoDigits(secondsLeft % 60)}`;

  return (
    <MobileShell>
      <TopBar title="ชำระเงิน" backHref={backHref} />
      <div className="m-content">
        <div className="card" style={{ padding: "24px 20px", alignItems: "center", gap: 14 }}>
          <div style={{ width: "100%", background: "#123366", color: "#fff", borderRadius: 12, padding: "10px 16px", textAlign: "center", fontSize: 14, fontWeight: 600 }}>
            THAI QR PAYMENT · PromptPay
          </div>
          <MockQR text={car.plate + reference} />
          <div style={{ fontSize: 32, fontWeight: 700 }}>{baht(fee, 2)}</div>
          <div className="small muted">Smart Parking Co., Ltd. · Ref {reference}</div>

          <div className="row" style={{ gap: 6, padding: "6px 12px", borderRadius: 999, background: "var(--warning-bg)", color: "var(--warning)", fontSize: 13, fontWeight: 500 }}>
            <Icon name="clock" size={16} />QR หมดอายุใน {countdown}
          </div>

          {expired && (
            <button type="button" className="btn btn-secondary" onClick={renewQr}>QR หมดอายุ · สร้าง QR ใหม่</button>
          )}
          {!expired && payError && <div className="small text-danger">{payError}</div>}
          {!expired && !payError && <div className="small text-green semibold">กำลังรอการชำระเงิน…</div>}
        </div>

        <div className="card" style={{ padding: 20, gap: 10 }}>
          <div className="semibold" style={{ fontSize: 14 }}>วิธีชำระ</div>
          <p className="muted" style={{ fontSize: 13 }}>1. บันทึกรูป QR หรือแคปหน้าจอ</p>
          <p className="muted" style={{ fontSize: 13 }}>2. เปิดแอปธนาคาร แล้วสแกนจ่าย</p>
          <p className="muted" style={{ fontSize: 13 }}>3. ระบบยืนยันอัตโนมัติ ออกได้ภายใน {rates.exitWithinMinutes} นาที</p>
        </div>
      </div>
    </MobileShell>
  );
}
