"use client";
// =====================================================
// mobile.tsx — ชิ้นส่วนของหน้ามือถือฝั่งลูกค้า (/pay)
//   MobileShell   กรอบหน้าจอมือถือ
//   TopBar        แถบบนพร้อมปุ่มย้อนกลับ
//   usePlateParam อ่านทะเบียนจาก URL
//   MockQR        รูป QR จำลอง
// =====================================================
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./Icon";

/** กรอบหน้าจอมือถือ (บนคอมจะแสดงเป็นจอแคบตรงกลาง) */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="mobile-wrap">
      <div className="mobile">{children}</div>
    </div>
  );
}

/** แถบด้านบน: ปุ่มย้อนกลับ + ชื่อหน้า */
export function TopBar({ title, backHref }: { title: string; backHref: string }) {
  return (
    <div className="m-topbar">
      <Link href={backHref} aria-label="ย้อนกลับ" style={{ display: "inline-flex" }}>
        <Icon name="back" size={22} />
      </Link>
      {title}
    </div>
  );
}

/** อ่านทะเบียนจาก URL เช่น /pay/1กก%201122 → "1กก 1122" */
export function usePlateParam(): string {
  const params = useParams<{ plate: string }>();
  const raw = params?.plate ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * รูป QR จำลอง (ลายจุดสร้างจากข้อความ — ข้อความเดิมได้ลายเดิม)
 * ⚠️ สแกนจ่ายจริงไม่ได้ ระบบจริงต้องสร้าง ThaiQR/PromptPay ตามมาตรฐานธนาคาร
 */
export function MockQR({ text, size = 220 }: { text: string; size?: number }) {
  const N = 25; // ขนาดตาราง 25×25 จุด

  // ตัวสุ่มแบบคงที่ เริ่มจากข้อความ
  let seed = 0;
  for (const ch of text) {
    seed = (seed * 31 + ch.charCodeAt(0)) % 233280;
  }
  function random(): number {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  // สี่เหลี่ยมใหญ่ 3 มุม (ลักษณะเด่นของ QR)
  function isCorner(x: number, y: number): boolean {
    return (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  }
  function cornerDot(x: number, y: number): boolean {
    const cx = x < 7 ? x : x - (N - 7);
    const cy = y < 7 ? y : y - (N - 7);
    const onBorder = cx === 0 || cx === 6 || cy === 0 || cy === 6;
    const inCenter = cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4;
    return onBorder || inCenter;
  }

  // เลือกว่าจุดไหนเป็นสีดำ
  const dots: { x: number; y: number }[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const black = isCorner(x, y) ? cornerDot(x, y) : random() > 0.52;
      if (black) dots.push({ x, y });
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${N} ${N}`} shapeRendering="crispEdges" role="img" aria-label="QR สำหรับชำระเงิน">
      <rect width={N} height={N} fill="#fff" />
      {dots.map((d) => (
        <rect key={`${d.x}-${d.y}`} x={d.x} y={d.y} width={1} height={1} fill="var(--text)" />
      ))}
    </svg>
  );
}
