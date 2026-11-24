"use client";
// =====================================================
// หน้าค้นหาทะเบียน (มือถือลูกค้า) — /pay  (Figma: 02 · User – ค้นหาทะเบียน)
// ลูกค้าสแกน QR ที่เสา/ผนังแล้วเปิดหน้านี้ → กรอกทะเบียน → ไปหน้ารายละเอียดการจอด
// =====================================================
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/ui";
import { MobileShell } from "@/components/mobile";
import { addRecent, clearSavedRecent, findVehicle, getRecent, type Recent } from "@/lib/vehicle-api";
import { hhmm, sameDay } from "@/lib/format";

/** เวลาที่ค้นหา เช่น "วันนี้ 14:20" / "เมื่อวาน 09:12" / "5/11 10:00" */
function whenText(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (sameDay(d, today)) return `วันนี้ ${hhmm(d)}`;
  if (sameDay(d, yesterday)) return `เมื่อวาน ${hhmm(d)}`;
  return `${d.getDate()}/${d.getMonth() + 1} ${hhmm(d)}`;
}

export default function PaySearchPage() {
  const router = useRouter();
  const [plate, setPlate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  // เปิดหน้า → ล้างรายการเก่าในเครื่อง แล้วแสดงรายการที่ค้นในรอบนี้ (รีเฟรชแล้วจะว่าง)
  useEffect(() => {
    clearSavedRecent();
    setRecent(getRecent());
  }, []);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!plate.trim()) {
      setError("กรุณากรอกเลขทะเบียน");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const car = await findVehicle(plate);
      addRecent(car.plate);
      router.push(`/pay/${encodeURIComponent(car.plate)}`);
    } catch (err) {
      setError((err as Error).message); // เช่น "ไม่พบทะเบียนนี้ในลานจอด"
      setLoading(false);
    }
  }

  return (
    <MobileShell>
      {/* ส่วนหัวสีเขียว */}
      <div className="m-hero">
        <div className="row" style={{ gap: 8 }}>
          <LogoMark size={32} />
          <span style={{ fontSize: 15, fontWeight: 600 }}>Smart Parking</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>ชำระค่าจอดรถ</h1>
        <p style={{ fontSize: 14, color: "var(--green-100)" }}>กรอกเลขทะเบียนรถของคุณเพื่อดูค่าจอดและชำระเงิน</p>
      </div>

      <div className="m-content" style={{ paddingTop: 0 }}>
        {/* ฟอร์มค้นหา */}
        <form onSubmit={handleSearch} className="card" style={{ padding: 20, gap: 14, marginTop: -20 }} noValidate>
          <label htmlFor="plate" style={{ fontSize: 14, fontWeight: 500 }}>เลขทะเบียนรถ</label>
          <div className="input" style={{ borderColor: error ? "var(--danger)" : "var(--green-500)", borderWidth: 1.5 }}>
            <Icon name="search" color="var(--text-2)" />
            <input
              id="plate"
              value={plate}
              onChange={(e) => { setPlate(e.target.value); setError(""); }}
              style={{ fontSize: 17, fontWeight: 500 }}
              placeholder="เช่น 1กก 1122"
              autoComplete="off"
            />
          </div>
          {error && <span className="small text-danger" role="alert">{error}</span>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "กำลังค้นหา…" : "ค้นหา"}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <Icon name="qr" size={16} color="var(--green-700)" />
            <span className="small muted">สแกน QR ที่เสาหรือผนังเพื่อเปิดหน้านี้</span>
          </div>
        </form>

        {/* ค้นหาล่าสุด */}
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>ค้นหาล่าสุด</h2>
        {recent.length === 0 && <p className="small muted">ยังไม่มีการค้นหา</p>}
        {recent.map((r) => (
          <Link
            key={r.plate}
            href={`/pay/${encodeURIComponent(r.plate)}`}
            className="card"
            style={{ padding: "14px 20px", flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <span className="kpi-icon"><Icon name="car" /></span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{r.plate}</div>
              <div className="small muted">{whenText(r.at)}</div>
            </div>
          </Link>
        ))}
      </div>
    </MobileShell>
  );
}
