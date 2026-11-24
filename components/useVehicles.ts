"use client";
// =====================================================
// useVehicles.ts — ดึงรายการรถทั้งหมด + ช่องที่ปิดซ่อม + การตั้งค่าชั้น และดึงใหม่เองทุก ๆ กี่วินาที
// ใช้ในผังลานจอด / Dashboard / รายงาน / จอที่ตู้ → เครื่องอื่นบันทึกอะไร หน้านี้จะเห็นเอง
//
// วิธีใช้:  const { vehicles, maintenance, layout, error, reload } = useVehicles();
//          vehicles = null ระหว่างกำลังโหลดครั้งแรก
//          สร้างผัง:  buildFloors(layout, vehicles ?? [], maintenance)
// =====================================================
import { useEffect, useState } from "react";
import { fetchLayout, fetchMaintenance, fetchVehicles } from "@/lib/vehicle-api";
import type { Vehicle } from "@/lib/vehicles";
import { DEFAULT_LAYOUT, type LotFloor, type MaintenanceItem } from "@/lib/lot";

export function useVehicles(refreshEveryMs = 5000) {
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);
  const [layout, setLayout] = useState<LotFloor[]>(DEFAULT_LAYOUT);
  const [error, setError] = useState("");

  async function reload() {
    try {
      // ดึง 3 อย่างพร้อมกัน
      const [carList, repairList, floorList] = await Promise.all([fetchVehicles(), fetchMaintenance(), fetchLayout()]);
      setVehicles(carList);
      setMaintenance(repairList);
      setLayout(floorList);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    reload(); // โหลดครั้งแรก
    const timer = setInterval(reload, refreshEveryMs); // โหลดซ้ำเป็นระยะ
    return () => clearInterval(timer); // ปิดหน้า → หยุดโหลด
  }, [refreshEveryMs]);

  return { vehicles, maintenance, layout, error, reload };
}
