// เปิด http://localhost:3000 แล้วไปหน้าเข้าสู่ระบบผู้ดูแลทันที
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin/login");
}
