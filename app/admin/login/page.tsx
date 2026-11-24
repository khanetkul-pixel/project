"use client";
// =====================================================
// หน้าเข้าสู่ระบบ — /admin/login  (Figma: 00 · Admin – Login)
// บัญชีที่เข้าได้ ดูในไฟล์ lib/accounts.ts (หน้าเว็บไม่แสดงรายชื่อบัญชี)
// =====================================================
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { LogoMark } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { MENUS, MENU_HREF } from "@/lib/accounts";

export default function LoginPage() {
  const router = useRouter();
  const { ready, user, can, login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(""); // ข้อความตอนกด "ลืมรหัสผ่าน"

  // ถ้าเข้าสู่ระบบอยู่แล้ว → ไปหน้าแรกที่เข้าได้เลย
  useEffect(() => {
    if (ready && user) {
      const firstMenu = MENUS.find((m) => can(m));
      router.replace(firstMenu ? MENU_HREF[firstMenu] : "/admin");
    }
  }, [ready, user]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault(); // ไม่ให้เบราว์เซอร์โหลดหน้าใหม่
    setInfo("");

    if (!username.trim() || !password) {
      setError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
      return;
    }

    const result = login(username, password, remember);
    if (result.ok) {
      router.push(result.home);
    } else {
      setError(result.error);
    }
  }

  const inputStyle = error ? { borderColor: "var(--danger)" } : undefined;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--surface)" }}>
      {/* ฝั่งซ้าย: แบรนด์ */}
      <section style={{ width: 680, maxWidth: "47vw", background: "var(--green-700)", color: "#fff", padding: "56px 64px", display: "flex", flexDirection: "column" }}>
        <div className="row">
          <LogoMark size={48} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Auto Parking</div>
            <div style={{ fontSize: 13, color: "var(--green-200)" }}></div>
          </div>
        </div>
      </section>

      {/* ฝั่งขวา: ฟอร์ม */}
      <section style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 64px", position: "relative" }}>
        <form onSubmit={handleSubmit} className="col" style={{ width: 400, gap: 20 }} noValidate>
          <span style={{ alignSelf: "flex-start", padding: 12, borderRadius: 14, background: "var(--green-100)", color: "var(--green-700)", display: "inline-flex" }}>
            <Icon name="shield" size={26} />
          </span>

          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>เข้าสู่ระบบผู้ดูแล</h1>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบจัดการลานจอด</p>
          </div>

          {/* ชื่อผู้ใช้ */}
          <div className="field">
            <label htmlFor="username">ชื่อผู้ใช้ หรือ อีเมล</label>
            <div className="input" style={inputStyle}>
              <Icon name="user" color="var(--text-2)" />
              <input
                id="username"
                value={username}
                placeholder="ชื่อผู้ใช้ หรือ อีเมล"
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          {/* รหัสผ่าน */}
          <div className="field">
            <label htmlFor="password">รหัสผ่าน</label>
            <div className="input" style={inputStyle}>
              <Icon name="lock" color="var(--text-2)" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                placeholder="รหัสผ่าน"
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                style={{ border: 0, background: "transparent", padding: 0, color: "var(--text-2)", display: "inline-flex" }}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} />
              </button>
            </div>
            {error && <span className="small text-danger" role="alert">{error}</span>}
          </div>

          {/* จดจำฉัน + ลืมรหัสผ่าน */}
          <div className="row-between">
            <label className="row" style={{ gap: 8, fontSize: 14, cursor: "pointer" }}>
              <button
                type="button"
                className={remember ? "checkbox on" : "checkbox"}
                style={{ width: 18, height: 18 }}
                onClick={() => setRemember(!remember)}
                aria-label="จดจำฉันไว้"
              >
                {remember && <Icon name="check" size={14} color="#fff" />}
              </button>
              จดจำฉันไว้
            </label>
            <button
              type="button"
              className="text-green semibold"
              style={{ fontSize: 14, border: 0, background: "transparent", padding: 0 }}
              onClick={() => setInfo("กรุณาติดต่อผู้ดูแลระบบ (Super Admin) เพื่อตั้งรหัสผ่านใหม่")}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>

          <button type="submit" className="btn btn-primary btn-block" style={{ padding: 14 }}>เข้าสู่ระบบ</button>

          <div
            className="row"
            style={{
              gap: 8, padding: "10px 14px", borderRadius: 10, fontSize: 12,
              background: info ? "var(--warning-bg)" : "var(--green-50)",
              color: info ? "var(--warning)" : "var(--green-800)",
            }}
          >
            <Icon name="lock" size={16} />
            {info || "สิทธิ์การเข้าถึงเมนูขึ้นกับบทบาทที่ผู้ดูแลระบบกำหนด"}
          </div>
        </form>
        </section>
    </div>
  );
}
