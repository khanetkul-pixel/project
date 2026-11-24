// =====================================================
// ui.tsx — ชิ้นส่วนหน้าจอเล็ก ๆ ที่ใช้ซ้ำหลายหน้า
// (โลโก้ · ป้ายสถานะ · หัวหน้า · หัวการ์ด · การ์ดตัวเลข · ช่องจอด · กราฟแท่ง · สวิตช์ · ช่องติ๊ก)
// สีและขนาดกำหนดไว้ใน app/globals.css
// =====================================================
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import type { Slot } from "@/lib/lot";

/** โลโก้ตัว P (onLight = ใช้บนพื้นสีขาว) */
export function LogoMark({ onLight = false, size = 42 }: { onLight?: boolean; size?: number }) {
  const className = onLight ? "logo-mark on-light" : "logo-mark";
  return (
    <span className={className} style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}>
      P
    </span>
  );
}

/** สีของป้ายสถานะ */
export type Tone = "success" | "danger" | "warning" | "neutral";

/** ป้ายสถานะ เช่น <Badge tone="success">ชำระแล้ว</Badge> */
export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

/** หัวของหน้า: ชื่อหน้า + คำอธิบาย + ปุ่มด้านขวา */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub">{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** หัวของการ์ด: ชื่อ + คำอธิบาย + ของด้านขวา */
export function CardHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="row-between">
      <div>
        <h3 className="card-title">{title}</h3>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** การ์ดตัวเลขสรุป (KPI) — ใส่ href เพื่อให้กดไปหน้าอื่นได้ */
export function KpiCard({ icon, title, value, delta, href }: {
  icon: IconName;
  title: string;
  value: string;
  delta: string;
  href?: string;
}) {
  const content = (
    <>
      <div className="kpi-head">
        <span className="kpi-icon"><Icon name={icon} /></span>
        {title}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-delta">{delta}</div>
    </>
  );

  if (href) {
    return <Link href={href} className="card kpi">{content}</Link>;
  }
  return <div className="card kpi">{content}</div>;
}

/**
 * ช่องจอด 1 ช่องในผังลานจอด
 * ใส่ onClick → ช่องกดได้ (ใช้ตอนตั้งค่าช่องซ่อม)
 */
export function ParkingSlot({ slot, onClick }: { slot: Slot; onClick?: () => void }) {
  let text = "มีรถ";
  if (slot.status === "free") text = "ว่าง";
  if (slot.status === "maintenance") text = "ปิดซ่อม";

  // ข้อความตอนเอาเมาส์ชี้
  let hint = slot.plate;
  if (slot.status === "maintenance") hint = slot.note ? `ปิดซ่อม: ${slot.note}` : "ปิดซ่อม";

  const content = (
    <>
      <span className="label">{slot.id}</span>
      <Icon name={slot.status === "maintenance" ? "wrench" : "car"} size={22} />
      <span className="status">{text}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={`slot ${slot.status} clickable`} title={hint} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={`slot ${slot.status}`} title={hint}>{content}</div>;
}

/**
 * กราฟแท่งแบบง่าย
 *   values    = ความสูงของแต่ละแท่ง
 *   labels    = ป้ายใต้แท่ง
 *   highlight = ลำดับแท่งที่จะเน้นสีเข้ม
 *   colorFor  = ฟังก์ชันเลือกสีเอง (ถ้าไม่ใส่ จะใช้ highlight)
 */
export function BarChart({ values, labels, height = 172, highlight, colorFor, subLabels }: {
  values: number[];
  labels: string[];
  height?: number;
  highlight?: number;
  colorFor?: (value: number, index: number) => "light" | "mid" | "dark";
  subLabels?: string[];
}) {
  const max = Math.max(...values);

  function barClass(value: number, index: number): string {
    let tone: "light" | "mid" | "dark" = index === highlight ? "dark" : "light";
    if (colorFor) tone = colorFor(value, index);
    if (tone === "light") return "bar";
    return `bar ${tone}`;
  }

  return (
    <div className="bars" style={{ height: height + (subLabels ? 40 : 24) }}>
      {values.map((value, i) => {
        const barHeight = Math.max(6, Math.round((value / max) * height));
        return (
          <div className="bar-col" key={i} title={String(value)}>
            <div className={barClass(value, i)} style={{ height: barHeight }} />
            <span className="bar-label">
              {labels[i] || " "}
              {subLabels && (
                <>
                  <br />
                  <span style={{ opacity: 0.75, fontSize: 10 }}>{subLabels[i]}</span>
                </>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** สวิตช์เปิด/ปิด */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={on ? "switch on" : "switch"}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

/** ช่องติ๊ก */
export function Checkbox({ on, onChange, label }: { on: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      className={on ? "checkbox on" : "checkbox"}
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    >
      {on && <Icon name="check" size={16} color="#fff" />}
    </button>
  );
}
