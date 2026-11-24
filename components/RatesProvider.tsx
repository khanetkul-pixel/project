"use client";
// =====================================================
// RatesProvider.tsx — เก็บอัตราค่าจอดไว้ที่เดียว ให้ทุกหน้าใช้ร่วมกัน
//
// อัตราจริงเก็บที่เซิร์ฟเวอร์ (/api/rates) → ทุกเครื่องเห็นค่าเดียวกัน
// หน้านี้ดึงค่าใหม่ทุก 15 วินาที และทุกครั้งที่กลับมาที่แท็บ
// → แอดมินแก้ราคาที่คอม มือถือลูกค้าคิดเงินตามได้เอง
//
// วิธีใช้ในหน้าอื่น:  const { rates } = useRates();
// =====================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_RATES, type Rates } from "@/lib/fee";
import { fetchRates, saveRates, type RateHistoryItem } from "@/lib/vehicle-api";

type RatesContextValue = {
  rates: Rates;                                        // อัตราปัจจุบัน
  history: RateHistoryItem[];                          // ประวัติการแก้ไข
  setRates: (rates: Rates, who?: string) => Promise<void>; // บันทึกอัตราใหม่
};

const RatesContext = createContext<RatesContextValue>({
  rates: DEFAULT_RATES,
  history: [],
  setRates: async () => {},
});

export function RatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRatesState] = useState<Rates>(DEFAULT_RATES);
  const [history, setHistory] = useState<RateHistoryItem[]>([]);

  /** ดึงอัตราล่าสุดจากเซิร์ฟเวอร์ */
  async function load() {
    try {
      const data = await fetchRates();
      setRatesState(data.rates);
      setHistory(data.history);
    } catch {
      // ต่อเซิร์ฟเวอร์ไม่ได้ → ใช้ค่าเดิมไปก่อน
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, []);

  /** บันทึกอัตราใหม่ (who = ชื่อคนที่แก้) */
  async function setRates(next: Rates, who?: string) {
    setRatesState(next); // แสดงผลทันที แล้วค่อยบันทึก
    try {
      const data = await saveRates(next, who);
      setRatesState(data.rates);
      setHistory(data.history);
    } catch {
      await load(); // บันทึกไม่สำเร็จ → โหลดค่าจริงกลับมา
    }
  }

  return (
    <RatesContext.Provider value={{ rates, history, setRates }}>
      {children}
    </RatesContext.Provider>
  );
}

export function useRates() {
  return useContext(RatesContext);
}
