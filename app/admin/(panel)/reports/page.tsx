// /admin/reports → เปิดแท็บรายงานกิจกรรมเป็นค่าเริ่มต้น
import { redirect } from "next/navigation";

export default function ReportsIndex() {
  redirect("/admin/reports/activity");
}
