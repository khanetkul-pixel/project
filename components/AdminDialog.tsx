"use client";
// =====================================================
// AdminDialog.tsx — หน้าต่างเพิ่ม / แก้ไขบัญชีผู้ดูแล (ใช้ในหน้าสิทธิ์ผู้ดูแลระบบ)
// initial = null → เพิ่มบัญชีใหม่ · มีค่า → แก้ไขบัญชีนั้น
// =====================================================
import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./Icon";
import { ROLES, ROLE_LABEL, type Account, type Role } from "@/lib/accounts";

type Props = {
  initial: Account | null;
  accounts: Account[];      // ใช้ตรวจอีเมลซ้ำ
  isSelf: boolean;          // กำลังแก้บัญชีตัวเอง (ห้ามเปลี่ยนบทบาท/ปิดบัญชี)
  onClose: () => void;
  onSave: (account: Account) => void;
};

export function AdminDialog({ initial, accounts, isSelf, onClose, onSave }: Props) {
  const editing = initial !== null;

  // ค่าในฟอร์ม
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initial?.role ?? "staff");
  const [active, setActive] = useState(initial?.active ?? true);
  const [error, setError] = useState("");

  /** ตรวจข้อมูลในฟอร์ม — คืนข้อความ error หรือ "" ถ้าผ่าน */
  function validate(cleanEmail: string): string {
    if (!name.trim()) return "กรุณากรอกชื่อ-นามสกุล";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return "รูปแบบอีเมลไม่ถูกต้อง";

    const emailTaken = accounts.some((a) => a.email.toLowerCase() === cleanEmail && a.id !== initial?.id);
    if (emailTaken) return "อีเมลนี้มีอยู่ในระบบแล้ว";

    if (!editing && password.length < 6) return "รหัสผ่านต้องมีอย่างน้อย 6 ตัว";
    if (editing && password !== "" && password.length < 6) return "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว";
    return "";
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const problem = validate(cleanEmail);
    if (problem) {
      setError(problem);
      return;
    }

    onSave({
      id: initial?.id ?? `u${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      username: cleanEmail.split("@")[0], // ชื่อผู้ใช้ = คำหน้า @
      password: password || initial?.password || "",
      role,
      active,
      lastLogin: initial?.lastLogin ?? null,
    });
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="dialog" style={{ padding: 0, gap: 0 }} onSubmit={handleSubmit} noValidate role="dialog" aria-modal="true">
        {/* หัวหน้าต่าง */}
        <div className="row-between" style={{ padding: "20px 24px 18px 28px", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>{editing ? "แก้ไขผู้ดูแล" : "เพิ่มผู้ดูแล"}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" style={{ border: 0, background: "transparent", color: "var(--text-2)", display: "inline-flex", padding: 4 }}>
            <Icon name="x" />
          </button>
        </div>

        {/* ช่องกรอก */}
        <div className="col" style={{ padding: "20px 28px", gap: 18 }}>
          <Field label="ชื่อ-นามสกุล">
            <input value={name} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="เช่น สมหญิง ใจงาม" autoFocus />
          </Field>

          <Field label="อีเมล">
            <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} placeholder="name@smartparking.co.th" />
          </Field>

          <Field label={editing ? "รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)" : "รหัสผ่าน (อย่างน้อย 6 ตัว)"}>
            <input type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} placeholder="••••••" autoComplete="new-password" />
          </Field>

          <Field label="บทบาท">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={isSelf}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </Field>

          <label className="row" style={{ gap: 10, fontSize: 15, opacity: isSelf ? 0.6 : 1 }}>
            <button
              type="button"
              className={active ? "checkbox on" : "checkbox"}
              onClick={() => { if (!isSelf) setActive(!active); }}
              aria-label="เปิดใช้งานบัญชีนี้"
              disabled={isSelf}
            >
              {active && <Icon name="check" size={16} color="#fff" />}
            </button>
            เปิดใช้งานบัญชีนี้
          </label>

          {isSelf && <span className="small muted">เปลี่ยนบทบาทหรือปิดบัญชีของตัวเองไม่ได้</span>}
          {error && <span className="small text-danger" role="alert">{error}</span>}
        </div>

        {/* ปุ่มด้านล่าง */}
        <div className="row" style={{ justifyContent: "flex-end", gap: 10, padding: "14px 24px 18px", borderTop: "1px solid var(--border)" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary">บันทึก</button>
        </div>
      </form>
    </div>
  );
}

/** ช่องกรอก 1 ช่อง: ป้ายชื่อ + กล่อง */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label style={{ fontSize: 15 }}>{label}</label>
      <div className="input" style={{ background: "var(--surface)" }}>{children}</div>
    </div>
  );
}
