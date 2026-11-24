"use client";
// =====================================================
// AdminShell.tsx — กรอบของทุกหน้า Admin (แถบเมนูซ้าย + เนื้อหา)
//   ยังไม่เข้าสู่ระบบ     → ส่งไปหน้า Login
//   ไม่มีสิทธิ์หน้านี้     → แสดงข้อความ "ไม่มีสิทธิ์เข้าหน้านี้"
// =====================================================
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Icon } from "./Icon";
import { useAuth } from "./AuthProvider";
import { MENUS, MENU_HREF, menuForPath, type MenuKey } from "@/lib/accounts";

export function AdminShell({ children }: { children: ReactNode }) {
  const { ready, user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";

  // ยังไม่เข้าสู่ระบบ → ไปหน้า Login
  useEffect(() => {
    if (ready && !user) {
      router.replace("/admin/login");
    }
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="muted" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        กำลังโหลด…
      </div>
    );
  }

  // หน้านี้เป็นของเมนูไหน และผู้ใช้เข้าได้ไหม
  const menu = menuForPath(pathname);
  const allowed = menu === null || can(menu);

  return (
    <div className="admin">
      <Sidebar />
      <main className="main">
        {allowed ? children : <NoPermission firstMenuHref={firstAllowedHref(can)} />}
      </main>
    </div>
  );
}

/** หน้าแรกที่ผู้ใช้เข้าได้ */
function firstAllowedHref(can: (menu: MenuKey) => boolean): string | null {
  const menu = MENUS.find((m) => can(m));
  return menu ? MENU_HREF[menu] : null;
}

function NoPermission({ firstMenuHref }: { firstMenuHref: string | null }) {
  return (
    <div className="card" style={{ alignItems: "center", textAlign: "center", padding: 48, marginTop: 40 }}>
      <span className="kpi-icon" style={{ background: "var(--warning-bg)", color: "var(--warning)" }}>
        <Icon name="lock" size={28} />
      </span>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>ไม่มีสิทธิ์เข้าหน้านี้</h1>
      <p className="muted">บทบาทของคุณยังไม่ได้รับสิทธิ์เข้าหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
      {firstMenuHref && (
        <Link href={firstMenuHref} className="btn btn-primary">กลับหน้าที่เข้าได้</Link>
      )}
    </div>
  );
}
