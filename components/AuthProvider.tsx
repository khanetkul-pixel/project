"use client";
// =====================================================
// AuthProvider.tsx — ระบบเข้าสู่ระบบ บัญชีผู้ดูแล และสิทธิ์ตามบทบาท
//
// ข้อมูลเก็บใน localStorage ของเบราว์เซอร์ (ระบบจริงควรย้ายไปเซิร์ฟเวอร์)
//   sp-accounts       รายชื่อบัญชี (รวมที่เพิ่ม/แก้ผ่านหน้าเว็บ)
//   sp-role-perms     สิทธิ์ของแต่ละบทบาท
//   sp-session        id ของบัญชีที่เข้าสู่ระบบอยู่
//   sp-accounts-code  สำเนาบัญชีในไฟล์ lib/accounts.ts ครั้งล่าสุดที่เห็น
//
// ทำไมต้องมี sp-accounts-code?
//   เพื่อให้ "แก้รหัสผ่านในไฟล์ lib/accounts.ts แล้วใช้ได้ทันที" โดยไม่ลบสิ่งที่แก้ผ่านหน้าเว็บ
//   วิธีคือ เทียบไฟล์ตอนนี้กับสำเนาครั้งก่อน → ช่องไหนในไฟล์เปลี่ยน ให้ใช้ค่าจากไฟล์
//
// วิธีใช้ในหน้าอื่น:  const { user, can, login, logout } = useAuth();
// =====================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_ACCOUNTS, DEFAULT_ROLE_PERMS, MENUS, MENU_HREF,
  type Account, type MenuKey, type Role, type RolePerms,
} from "@/lib/accounts";
import { resetLayout, resetMaintenance, resetRates, resetVehicles } from "@/lib/vehicle-api";

const KEY_ACCOUNTS = "sp-accounts";
const KEY_PERMS = "sp-role-perms";
const KEY_SESSION = "sp-session";
const KEY_CODE_COPY = "sp-accounts-code";

// ช่องที่ถ้าแก้ในไฟล์ lib/accounts.ts จะมีผลทันที
const CODE_FIELDS = ["name", "email", "username", "password", "role", "active"] as const;

// ---------------- อ่าน/เขียน localStorage ----------------

function loadFromBrowser<T>(key: string, fallback: T): T {
  try {
    const text = localStorage.getItem(key);
    if (text) return JSON.parse(text) as T;
  } catch {
    // อ่านไม่ได้ → ใช้ค่าเริ่มต้น
  }
  return fallback;
}

function saveToBrowser(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // บางเบราว์เซอร์ปิด localStorage — ไม่เป็นไร
  }
}

/** อ่าน id ของบัญชีที่เข้าสู่ระบบอยู่ (จำไว้ใน localStorage หรือ sessionStorage) */
function loadSession(): string | null {
  try {
    return localStorage.getItem(KEY_SESSION) ?? sessionStorage.getItem(KEY_SESSION);
  } catch {
    return null;
  }
}

function saveSession(accountId: string | null, remember: boolean) {
  try {
    localStorage.removeItem(KEY_SESSION);
    sessionStorage.removeItem(KEY_SESSION);
    if (accountId) {
      // remember = จดจำฉันไว้ → ปิดเบราว์เซอร์แล้วยังอยู่ / ไม่จดจำ → ปิดแท็บแล้วหลุด
      const storage = remember ? localStorage : sessionStorage;
      storage.setItem(KEY_SESSION, accountId);
    }
  } catch {
    // ไม่เป็นไร
  }
}

// ---------------- รวมบัญชีในเบราว์เซอร์กับบัญชีในไฟล์ ----------------

/**
 * รวมบัญชีที่เก็บในเบราว์เซอร์ เข้ากับบัญชีในไฟล์ lib/accounts.ts
 * กติกา: ช่องไหนในไฟล์ถูกแก้ (ต่างจากสำเนาครั้งก่อน) → ใช้ค่าจากไฟล์
 *        ช่องที่ไฟล์ไม่ได้แก้ → เก็บค่าที่แก้ผ่านหน้าเว็บไว้
 */
function mergeWithCode(stored: Account[]): Account[] {
  const lastCopy = loadFromBrowser<Account[]>(KEY_CODE_COPY, []);
  const result = stored.map((a) => ({ ...a }));

  for (const fromCode of DEFAULT_ACCOUNTS) {
    const before = lastCopy.find((a) => a.id === fromCode.id);
    const current = result.find((a) => a.id === fromCode.id);

    if (!current) {
      // ไม่มีบัญชีนี้ในเบราว์เซอร์:
      //   - เป็นบัญชีใหม่ที่เพิ่งเพิ่มในไฟล์ → เพิ่มเข้าไป
      //   - เคยมีแต่ถูกลบผ่านหน้าเว็บ → ไม่เอากลับมา (เว้นแต่ไฟล์ถูกแก้)
      const changedInCode = !before || CODE_FIELDS.some((field) => before[field] !== fromCode[field]);
      if (changedInCode) result.push({ ...fromCode });
      continue;
    }

    for (const field of CODE_FIELDS) {
      const changedInCode = !before || before[field] !== fromCode[field];
      if (changedInCode) {
        (current as Record<string, unknown>)[field] = fromCode[field];
      }
    }
  }

  // จำสำเนาไฟล์ครั้งนี้ไว้เทียบครั้งหน้า
  saveToBrowser(KEY_CODE_COPY, DEFAULT_ACCOUNTS);
  return result;
}

// ---------------- Context ----------------

export type LoginResult = { ok: true; home: string } | { ok: false; error: string };

type AuthContextValue = {
  ready: boolean;              // โหลดข้อมูลจากเบราว์เซอร์เสร็จแล้วหรือยัง
  accounts: Account[];
  rolePerms: RolePerms;
  user: Account | null;        // คนที่เข้าสู่ระบบอยู่ (null = ยังไม่เข้า)
  can: (menu: MenuKey) => boolean;
  login: (usernameOrEmail: string, password: string, remember: boolean) => LoginResult;
  logout: () => void;
  saveAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  setRolePerm: (role: Role, menu: MenuKey, value: boolean) => void;
  resetDemo: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [rolePerms, setRolePerms] = useState<RolePerms>(DEFAULT_ROLE_PERMS);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // เปิดเว็บครั้งแรก → โหลดข้อมูลจากเบราว์เซอร์
  useEffect(() => {
    const merged = mergeWithCode(loadFromBrowser(KEY_ACCOUNTS, DEFAULT_ACCOUNTS));
    setAccounts(merged);
    saveToBrowser(KEY_ACCOUNTS, merged);
    setRolePerms(loadFromBrowser(KEY_PERMS, DEFAULT_ROLE_PERMS));
    setSessionId(loadSession());
    setReady(true);
  }, []);

  function updateAccounts(next: Account[]) {
    setAccounts(next);
    saveToBrowser(KEY_ACCOUNTS, next);
  }

  // คนที่เข้าสู่ระบบอยู่ (บัญชีที่ถูกปิดใช้งาน ถือว่าไม่ได้เข้า)
  let user: Account | null = accounts.find((a) => a.id === sessionId) ?? null;
  if (user && !user.active) user = null;

  /** ผู้ใช้คนนี้เข้าเมนูนี้ได้ไหม */
  function can(menu: MenuKey): boolean {
    if (!user) return false;
    if (user.role === "superadmin") return true; // Super Admin เข้าได้ทุกหน้าเสมอ
    return rolePerms[user.role][menu];
  }

  /** เข้าสู่ระบบ — คืน ok พร้อมหน้าแรกที่เข้าได้ หรือคืนข้อความ error */
  function login(usernameOrEmail: string, password: string, remember: boolean): LoginResult {
    // เผื่อแก้ไฟล์ lib/accounts.ts ระหว่างเปิดหน้าเว็บค้างไว้ → รวมค่าใหม่ก่อนตรวจ
    const latest = mergeWithCode(accounts);

    const key = usernameOrEmail.trim().toLowerCase();
    const account = latest.find((a) => a.email.toLowerCase() === key || a.username.toLowerCase() === key);

    // ไม่บอกว่าผิดที่ชื่อหรือรหัสผ่าน (ปลอดภัยกว่า)
    if (!account || account.password !== password) {
      updateAccounts(latest);
      return { ok: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    }
    if (!account.active) {
      updateAccounts(latest);
      return { ok: false, error: "บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ" };
    }

    // บันทึกเวลาเข้าระบบล่าสุด
    const withLastLogin = latest.map((a) => {
      if (a.id === account.id) return { ...a, lastLogin: new Date().toISOString() };
      return a;
    });
    updateAccounts(withLastLogin);
    saveSession(account.id, remember);
    setSessionId(account.id);

    // หาหน้าแรกที่บทบาทนี้เข้าได้
    const perms = account.role === "superadmin" ? DEFAULT_ROLE_PERMS.superadmin : rolePerms[account.role];
    const firstMenu = MENUS.find((m) => perms[m]);
    const home = firstMenu ? MENU_HREF[firstMenu] : "/admin";
    return { ok: true, home };
  }

  function logout() {
    saveSession(null, false);
    setSessionId(null);
  }

  /** เพิ่มบัญชีใหม่ หรือแก้บัญชีเดิม (ดูจาก id) */
  function saveAccount(account: Account) {
    const exists = accounts.some((a) => a.id === account.id);
    if (exists) {
      updateAccounts(accounts.map((a) => (a.id === account.id ? account : a)));
    } else {
      updateAccounts([...accounts, account]);
    }
  }

  function deleteAccount(id: string) {
    updateAccounts(accounts.filter((a) => a.id !== id));
  }

  /** ติ๊ก/เอาติ๊กออก สิทธิ์ของบทบาท (Super Admin แก้ไม่ได้) */
  function setRolePerm(role: Role, menu: MenuKey, value: boolean) {
    if (role === "superadmin") return;
    const next: RolePerms = {
      ...rolePerms,
      [role]: { ...rolePerms[role], [menu]: value },
    };
    setRolePerms(next);
    saveToBrowser(KEY_PERMS, next);
  }

  /** ล้างข้อมูลทั้งหมดกลับเป็นข้อมูลตัวอย่าง (ยังเข้าสู่ระบบอยู่) */
  async function resetDemo() {
    try { await resetVehicles(); } catch { /* ล้างข้อมูลรถไม่สำเร็จ */ }
    try { await resetRates(); } catch { /* รีเซ็ตอัตราไม่สำเร็จ */ }
    try { await resetMaintenance(); } catch { /* ล้างช่องซ่อมไม่สำเร็จ */ }
    try { await resetLayout(); } catch { /* คืนค่าชั้นไม่สำเร็จ */ }
    try {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("sp-") && key !== KEY_SESSION) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ไม่เป็นไร
    }
    window.location.reload(); // โหลดหน้าใหม่ให้ทุกส่วนใช้ข้อมูลชุดใหม่
  }

  const value: AuthContextValue = {
    ready, accounts, rolePerms, user, can, login, logout,
    saveAccount, deleteAccount, setRolePerm, resetDemo,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องใช้ภายใน <AuthProvider>");
  return ctx;
}
