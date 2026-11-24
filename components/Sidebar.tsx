"use client";
// =====================================================
// Sidebar.tsx — แถบเมนูด้านซ้ายของหน้า Admin
// แสดงเฉพาะเมนูที่บทบาทของผู้ใช้เข้าได้ + ชื่อผู้ใช้ + ปุ่มออกจากระบบ
// =====================================================
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "./Icon";
import { LogoMark } from "./ui";
import { useAuth } from "./AuthProvider";
import { ROLE_LABEL, type MenuKey } from "@/lib/accounts";

const MENU: { key: MenuKey; href: string; label: string; icon: IconName }[] = [
  { key: "dashboard", href: "/admin", label: "ภาพรวม", icon: "dashboard" },
  { key: "map", href: "/admin/parking-map", label: "ผังลานจอด", icon: "layers" },
  { key: "rates", href: "/admin/rates", label: "อัตราค่าจอด", icon: "wallet" },
  { key: "reports", href: "/admin/reports", label: "รายงาน", icon: "chart" },
  { key: "admins", href: "/admin/permissions", label: "สิทธิ์ผู้ดูแลระบบ", icon: "users" },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user, can, logout } = useAuth();

  // เมนูที่ผู้ใช้คนนี้เข้าได้
  const visibleMenu = MENU.filter((m) => can(m.key));

  // เมนูนี้คือหน้าที่เปิดอยู่หรือไม่
  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  function handleLogout() {
    logout();
    router.push("/admin/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <LogoMark />
        <div>
          <div className="brand-name">Smart Parking</div>
          <div className="brand-sub"></div>
        </div>
      </div>

      <nav className="col" style={{ gap: 6 }}>
        {visibleMenu.map((m) => (
          <Link key={m.href} href={m.href} className={isActive(m.href) ? "nav-item active" : "nav-item"}>
            <Icon name={m.icon} />
            {m.label}
          </Link>
        ))}
      </nav>

      <div className="grow" />

      {user && (
        <div className="user-card">
          <span className="avatar">{user.name[0]}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--green-200)" }}>{ROLE_LABEL[user.role]}</div>
          </div>
        </div>
      )}

      <button
        type="button"
        className="logout"
        style={{ marginTop: 6, background: "transparent", fontFamily: "inherit" }}
        onClick={handleLogout}
      >
        <Icon name="logout" size={18} />
        ออกจากระบบ
      </button>
    </aside>
  );
}
