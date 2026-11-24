// =====================================================
// accounts.ts — บัญชีผู้ดูแล บทบาท และสิทธิ์เข้าแต่ละเมนู
//
// ✏️ แก้ชื่อผู้ใช้ / อีเมล / รหัสผ่าน ในรายการ DEFAULT_ACCOUNTS ด้านล่าง
//    บันทึกไฟล์แล้วเข้าสู่ระบบด้วยค่าใหม่ได้ทันที
//
// ⚠️ ระบบจริงห้ามเก็บรหัสผ่านในโค้ดหน้าเว็บแบบนี้
//    ต้องตรวจรหัสผ่านที่เซิร์ฟเวอร์ และเก็บแบบเข้ารหัส (hash)
// =====================================================

// ---------------- บทบาท ----------------

export type Role = "superadmin" | "staff" | "viewer";

export const ROLES: Role[] = ["superadmin", "staff", "viewer"];

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "Super Admin",
  staff: "staff",
  viewer: "viewer",
};

// ---------------- เมนู ----------------

/** เมนูที่กำหนดสิทธิ์ได้ (ตรงกับแถบเมนูซ้าย) */
export type MenuKey = "dashboard" | "map" | "rates" | "reports" | "admins";

export const MENUS: MenuKey[] = ["dashboard", "map", "rates", "reports", "admins"];

export const MENU_LABEL: Record<MenuKey, string> = {
  dashboard: "ภาพรวม",
  map: "ผังลานจอด",
  rates: "อัตราค่าจอด",
  reports: "รายงาน",
  admins: "จัดการผู้ดูแล",
};

/** URL ของแต่ละเมนู */
export const MENU_HREF: Record<MenuKey, string> = {
  dashboard: "/admin",
  map: "/admin/parking-map",
  rates: "/admin/rates",
  reports: "/admin/reports",
  admins: "/admin/permissions",
};

/** หาว่า URL นี้เป็นของเมนูไหน เช่น "/admin/rates" → "rates" */
export function menuForPath(pathname: string): MenuKey | null {
  if (pathname === "/admin") return "dashboard";
  for (const menu of MENUS) {
    if (menu !== "dashboard" && pathname.startsWith(MENU_HREF[menu])) {
      return menu;
    }
  }
  return null;
}

// ---------------- สิทธิ์ตามบทบาท ----------------

/** สิทธิ์ของทุกบทบาท: true = เข้าเมนูนั้นได้ */
export type RolePerms = Record<Role, Record<MenuKey, boolean>>;

export const DEFAULT_ROLE_PERMS: RolePerms = {
  superadmin: { dashboard: true, map: true, rates: true, reports: true, admins: true },
  staff: { dashboard: true, map: true, rates: false, reports: true, admins: false },
  viewer: { dashboard: true, map: false, rates: false, reports: true, admins: false },
};

// ---------------- บัญชี ----------------

export type Account = {
  id: string;
  name: string;
  email: string;
  username: string;         // เข้าสู่ระบบด้วยชื่อนี้ หรืออีเมลก็ได้
  password: string;
  role: Role;
  active: boolean;          // false = ปิดใช้งาน เข้าสู่ระบบไม่ได้
  lastLogin: string | null; // เวลาเข้าระบบล่าสุด (ISO)
};

/** บัญชีที่ใช้เข้าสู่ระบบได้ (หน้าเว็บไม่แสดงรายการนี้ ให้ดูจากไฟล์นี้) */
export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: "u1",
    name: "Super admin",
    email: "superadmin@smartparking.co.th",
    username: "superadmin",
    password: "superadmin",
    role: "superadmin",
    active: true,
    lastLogin: "2026-11-07T00:05:00",
  },
  {
    id: "u2",
    name: "Staff",
    email: "staff@smartparking.co.th",
    username: "staff",
    password: "staff",
    role: "staff",
    active: true,
    lastLogin: "2026-11-06T08:12:00",
  },
  {
    id: "u3",
    name: "Viewer",
    email: "viewer@smartparking.co.th",
    username: "viewer",
    password: "viewer",
    role: "viewer",
    active: true,
    lastLogin: null,
  },
  
];
