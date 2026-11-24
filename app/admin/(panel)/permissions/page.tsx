"use client";
// =====================================================
// หน้าสิทธิ์ผู้ดูแลระบบ — /admin/permissions  (Figma: 09 · สิทธิ์ผู้ดูแลระบบ)
//   ตารางบัญชีผู้ดูแล: เพิ่ม / แก้ไข / ลบ
//   ตารางสิทธิ์ตามบทบาท: ติ๊กว่าบทบาทไหนเข้าเมนูไหนได้ (บันทึกอัตโนมัติ)
//   ปุ่มรีเซ็ตข้อมูลตัวอย่าง
// =====================================================
import { useState, type CSSProperties } from "react";
import { Icon } from "@/components/Icon";
import { Badge, CardHead, Checkbox, PageHeader } from "@/components/ui";
import { AdminDialog } from "@/components/AdminDialog";
import { useAuth } from "@/components/AuthProvider";
import { MENUS, MENU_LABEL, ROLES, ROLE_LABEL, type Account, type Role } from "@/lib/accounts";
import { THAI_MONTHS_SHORT, buddhistYear, hhmm } from "@/lib/format";

// สีป้ายบทบาท
const ROLE_STYLE: Record<Role, CSSProperties> = {
  superadmin: { background: "var(--green-100)", color: "var(--green-700)" },
  staff: { background: "#e8f0fe", color: "#1d4ed8" },
  viewer: { background: "var(--bg)", color: "var(--text-2)", border: "1px solid var(--border)" },
};

/** เวลาเข้าระบบล่าสุด เช่น "7 พ.ย. 2569 00:05" */
function lastLoginText(iso: string | null): string {
  if (!iso) return "ยังไม่เคยเข้า";
  const d = new Date(iso);
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${buddhistYear(d)} ${hhmm(d)}`;
}

export default function PermissionsPage() {
  const { accounts, rolePerms, user, saveAccount, deleteAccount, setRolePerm, resetDemo } = useAuth();

  // หน้าต่างที่เปิดอยู่
  const [editingAccount, setEditingAccount] = useState<Account | null>(null); // บัญชีที่กำลังแก้
  const [addingNew, setAddingNew] = useState(false);                         // กำลังเพิ่มบัญชีใหม่
  const [deleting, setDeleting] = useState<Account | null>(null);            // บัญชีที่กำลังจะลบ
  const [confirmReset, setConfirmReset] = useState(false);

  const activeCount = accounts.filter((a) => a.active).length;

  function countByRole(role: Role): number {
    return accounts.filter((a) => a.role === role).length;
  }

  function closeDialog() {
    setEditingAccount(null);
    setAddingNew(false);
  }

  const dialogOpen = addingNew || editingAccount !== null;

  return (
    <>
      <PageHeader
        title="สิทธิ์ผู้ดูแลระบบ"
        subtitle="จัดการบัญชีผู้ดูแลและกำหนดว่าแต่ละบทบาทเข้าหน้าไหนได้บ้าง"
        actions={
          <button className="btn btn-primary" onClick={() => setAddingNew(true)}>
            <Icon name="plus" size={18} />เพิ่มผู้ดูแล
          </button>
        }
      />

      {/* ---------- บัญชีผู้ดูแล ---------- */}
      <div className="card">
        <CardHead title="บัญชีผู้ดูแล" sub={`${accounts.length} บัญชี · ใช้งานอยู่ ${activeCount}`} />
        <table className="table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th style={{ width: 160 }}>บทบาท</th>
              <th style={{ width: 130 }}>สถานะ</th>
              <th style={{ width: 170 }}>เข้าระบบล่าสุด</th>
              <th style={{ width: 170 }} />
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const isMe = account.id === user?.id;
              return (
                <tr key={account.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="avatar" style={{ background: "var(--green-100)", color: "var(--green-700)" }}>
                        {account.name[0]}
                      </span>
                      <div>
                        <div>
                          {account.name}
                          {isMe && <span className="muted" style={{ fontWeight: 400 }}>  (คุณ)</span>}
                        </div>
                        <div className="small muted" style={{ fontWeight: 400 }}>{account.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge" style={ROLE_STYLE[account.role]}>{ROLE_LABEL[account.role]}</span></td>
                  <td>
                    <Badge tone={account.active ? "success" : "neutral"}>{account.active ? "ใช้งาน" : "ปิดใช้งาน"}</Badge>
                  </td>
                  <td className="muted">{lastLoginText(account.lastLogin)}</td>
                  <td>
                    <div className="row" style={{ gap: 14, justifyContent: "flex-end" }}>
                      <button
                        className="row"
                        style={{ gap: 6, border: 0, background: "transparent", fontSize: 14, color: "var(--text)" }}
                        onClick={() => setEditingAccount(account)}
                      >
                        <Icon name="edit" size={16} />แก้ไข
                      </button>
                      <button
                        className="row"
                        style={{
                          gap: 6, border: 0, background: "transparent", fontSize: 14,
                          color: isMe ? "var(--neutral-300)" : "var(--danger)",
                          cursor: isMe ? "not-allowed" : "pointer",
                        }}
                        disabled={isMe}
                        title={isMe ? "ลบบัญชีของตัวเองไม่ได้" : undefined}
                        onClick={() => setDeleting(account)}
                      >
                        <Icon name="trash" size={16} />ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ---------- สิทธิ์ตามบทบาท ---------- */}
      <div className="card">
        <CardHead title="สิทธิ์ตามบทบาท" sub="ติ๊กเพื่อให้บทบาทนั้นเข้าหน้าได้ · บันทึกอัตโนมัติ" />
        <table className="table">
          <thead>
            <tr>
              <th>บทบาท</th>
              {MENUS.map((menu) => (
                <th key={menu} style={{ textAlign: "center", width: 120 }}>{MENU_LABEL[menu]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const locked = role === "superadmin"; // Super Admin เข้าได้ทุกหน้าเสมอ แก้ไม่ได้
              return (
                <tr key={role}>
                  <td>
                    <div>{ROLE_LABEL[role]}</div>
                    <div className="small muted" style={{ fontWeight: 400 }}>{countByRole(role)} คน</div>
                  </td>
                  {MENUS.map((menu) => (
                    <td key={menu} style={{ textAlign: "center", opacity: locked ? 0.45 : 1 }}>
                      <Checkbox
                        on={locked || rolePerms[role][menu]}
                        onChange={(value) => { if (!locked) setRolePerm(role, menu, value); }}
                        label={`${ROLE_LABEL[role]} – ${MENU_LABEL[menu]}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="small muted">Super Admin มีสิทธิ์ทุกหน้าเสมอ (แก้ไขไม่ได้ เพื่อกันไม่ให้ไม่มีใครเข้าระบบได้)</p>
      </div>

      {/* ---------- รีเซ็ตข้อมูลตัวอย่าง ---------- */}
      <div className="card">
        <CardHead title="ข้อมูลตัวอย่าง" sub="ล้างข้อมูลทั้งหมด (รถ ชั้น ช่องซ่อม อัตราค่าจอด บัญชี สิทธิ์) แล้วสร้างข้อมูลตัวอย่างใหม่" />
        <button
          className="btn btn-ghost"
          style={{ alignSelf: "flex-start", padding: "10px 16px", fontSize: 14 }}
          onClick={() => setConfirmReset(true)}
        >
          <Icon name="rotate" size={16} />รีเซ็ตข้อมูลตัวอย่าง
        </button>
      </div>

      {/* ---------- หน้าต่างต่าง ๆ ---------- */}
      {dialogOpen && (
        <AdminDialog
          initial={editingAccount}
          accounts={accounts}
          isSelf={editingAccount !== null && editingAccount.id === user?.id}
          onClose={closeDialog}
          onSave={(account) => { saveAccount(account); closeDialog(); }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="ลบผู้ดูแล"
          message={`ต้องการลบบัญชี "${deleting.name}" (${deleting.email}) ใช่ไหม? บัญชีนี้จะเข้าสู่ระบบไม่ได้อีก`}
          confirmLabel="ลบบัญชี"
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={() => { deleteAccount(deleting.id); setDeleting(null); }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="รีเซ็ตข้อมูลตัวอย่าง"
          message="ข้อมูลรถ ชั้นที่เพิ่ม ช่องที่ปิดซ่อม อัตราค่าจอด บัญชีที่เพิ่ม และสิทธิ์ที่แก้ จะกลับเป็นค่าเริ่มต้นทั้งหมด"
          confirmLabel="รีเซ็ต"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => resetDemo()}
        />
      )}
    </>
  );
}

/** หน้าต่างยืนยัน (ใช่ / ยกเลิก) */
function ConfirmDialog({ title, message, confirmLabel, danger = false, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="dialog" style={{ width: 420 }} role="alertdialog" aria-modal="true">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
        <p className="muted" style={{ fontSize: 14 }}>{message}</p>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
          <button className="btn btn-primary" style={danger ? { background: "var(--danger)" } : undefined} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
