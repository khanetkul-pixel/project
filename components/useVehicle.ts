"use client";
// =====================================================
// useVehicle.ts — ดึงข้อมูลรถ 1 คันจากทะเบียน (ใช้ในหน้า /pay/[plate])
// วิธีใช้:  const { car, error, loading } = useVehicle("1กก 1122");
// =====================================================
import { useEffect, useState } from "react";
import { findVehicle } from "@/lib/vehicle-api";
import type { Vehicle } from "@/lib/vehicles";

export function useVehicle(plate: string) {
  const [car, setCar] = useState<Vehicle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!plate) return;
    try {
      const found = await findVehicle(plate);
      setCar(found);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }

  // โหลดครั้งแรก และทุกครั้งที่ทะเบียนเปลี่ยน
  useEffect(() => {
    load();
  }, [plate]);

  return { car, error, loading, reload: load };
}
