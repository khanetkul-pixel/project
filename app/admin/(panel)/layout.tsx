// โครงหน้าฝั่ง Admin: ตรวจการเข้าสู่ระบบ + แถบเมนูซ้าย + เนื้อหา (ใช้กับทุกหน้าในโฟลเดอร์ (panel))
import { AdminShell } from "@/components/AdminShell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
