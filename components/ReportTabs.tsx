"use client";
// =====================================================
// ReportTabs.tsx — แท็บด้านบนของหน้ารายงาน: รายงานกิจกรรม / รายงานการเงิน
// =====================================================
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin/reports/activity", label: "รายงานกิจกรรม", icon: "chart" },
  { href: "/admin/reports/finance", label: "รายงานการเงิน", icon: "wallet" },
];

export function ReportTabs() {
  const pathname = usePathname() ?? "";

  return (
    <div className="tabs">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "tab active" : "tab"}>
            <Icon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
