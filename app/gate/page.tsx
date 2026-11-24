"use client";
// =====================================================
// หน้าจำลองประตูลานจอด (ใช้นำเสนองาน) — /gate
//
// ทางเข้า: รถมาถึง → ตู้ Kiosk อ่านทะเบียน → บันทึกรถเข้า + แนะนำชั้น → ไม้กั้นยก → รถเข้าลาน
// ทางออก: รถมาถึง → ตู้ Kiosk อ่านทะเบียน → คิดค่าจอด → ลูกค้าสแกน QR จ่าย → ไม้กั้นยก → รถออก
//
// ทุกขั้นตอนเรียก API จริง → เปิดหน้าผังลานจอดไว้อีกจอ จะเห็นช่องจอดเปลี่ยนตาม
//
// ภาพเคลื่อนไหวทำด้วย CSS (ดู .sim-* ใน app/globals.css)
//   แค่เปลี่ยนค่า เช่น pos: "away" → "gate" รถก็จะวิ่งเอง เพราะ CSS มี transition
// =====================================================
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, LogoMark } from "@/components/ui";
import { MockQR } from "@/components/mobile";
import { useRates } from "@/components/RatesProvider";
import { useVehicles } from "@/components/useVehicles";
import { createVehicle, exitVehicle, fetchLayout, fetchMaintenance, fetchVehicles, payVehicle } from "@/lib/vehicle-api";
import { VEHICLE_TYPES, amountDue, isValidPlate, minutesParked, randomItem, randomPlate, type Vehicle } from "@/lib/vehicles";
import { buildFloors, emptiestFloor, floorStats, totalSlots } from "@/lib/lot";
import { baht, durationLabel, hhmm } from "@/lib/format";

// =====================================================
// ตัวช่วย
// =====================================================

/** รอ ms มิลลิวินาที (ใช้กับ await) */
function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** สีรถในฉาก (ทุกคันสีเขียวเหมือนกัน) — อยากเปลี่ยนสี แก้ที่นี่ที่เดียว */
const CAR_COLOR = "#b60000";

/** สถานะการจ่ายสั้น ๆ ในรายการเลือกรถ */
function paymentText(car: Vehicle, due: number): string {
  if (due > 0) return `ค้าง ${baht(due)}`;
  if (car.paidAt) return "ชำระแล้ว";
  return "ฟรี";
}

// =====================================================
// สถานะของแต่ละช่องทาง (ทางเข้า / ทางออก)
// =====================================================

/** ตำแหน่งรถ: away = นอกจอซ้าย · gate = จอดหน้าไม้กั้น · passed = ผ่านไปแล้ว (นอกจอขวา) */
type CarPosition = "away" | "gate" | "passed";

type Lane = {
  step: string;        // ขั้นตอนตอนนี้ เช่น "idle", "arriving", "scanning", ...
  plate: string;       // ทะเบียน ("" = ไม่มีรถในฉาก)
  position: CarPosition;
  moving: boolean;     // ล้อหมุน
  reversing: boolean;  // ถอยหลัง
  noAnimation: boolean; // วางรถทันทีโดยไม่วิ่ง (ตอนเริ่ม)
  barrierUp: boolean;  // ไม้กั้นยกขึ้น
  scanning: boolean;   // ตู้ Kiosk กำลังอ่านทะเบียน
  plateRead: boolean;  // ตู้ Kiosk อ่านทะเบียนได้แล้ว
  car?: Vehicle;       // ข้อมูลรถจากระบบ
  due?: number;        // ยอดที่ต้องจ่าย
  paid?: number;       // ยอดที่จ่ายแล้ว
  minutes?: number;    // เวลาจอด
  message?: string;    // ข้อความ error
};

const EMPTY_LANE: Lane = {
  step: "idle", plate: "", position: "away",
  moving: false, reversing: false, noAnimation: true,
  barrierUp: false, scanning: false, plateRead: false,
};

// ชื่อขั้นตอนที่แสดงด้านบน และขั้นตอนไหนตรงกับป้ายลำดับที่เท่าไหร่
const ENTRY_STEP_NAMES = ["รถมาถึง", "อ่านทะเบียน", "บันทึกเข้า", "เปิดไม้กั้น", "เข้าลาน"];
const ENTRY_STEP_INDEX: Record<string, number> = { arriving: 0, scanning: 1, saving: 2, welcome: 2, opening: 3, passing: 4, done: 5 };

const EXIT_STEP_NAMES = ["รถมาถึง", "อ่านทะเบียน", "คิดค่าจอด", "ชำระเงิน", "เปิดไม้กั้น", "ออกจากลาน"];
const EXIT_STEP_INDEX: Record<string, number> = { arriving: 0, scanning: 1, fee: 2, pay: 3, paying: 3, paid: 3, opening: 4, passing: 5, done: 6 };

// เวลาของภาพเคลื่อนไหว (มิลลิวินาที) — ต้องตรงกับ transition ใน CSS
const DRIVE_TIME = 1900;
const SCAN_TIME = 1600;

// =====================================================
// หน้าหลัก
// =====================================================

export default function GateSimulationPage() {
  const { rates } = useRates();
  const { vehicles, maintenance, layout, reload } = useVehicles(3000);

  const [entry, setEntry] = useState<Lane>(EMPTY_LANE);
  const [exit, setExit] = useState<Lane>(EMPTY_LANE);
  const [plateInput, setPlateInput] = useState("");
  const [exitCarId, setExitCarId] = useState("");
  const [inputError, setInputError] = useState(""); // ทะเบียนที่พิมพ์ผิดรูปแบบ

  const pageOpen = useRef(true);                                   // false = ออกจากหน้าแล้ว (หยุดทุกอย่าง)
  const payButtonPressed = useRef<((ok: boolean) => void) | null>(null); // รอผู้ใช้กดจ่าย/ยกเลิก

  useEffect(() => {
    return () => { pageOpen.current = false; };
  }, []);

  // แก้สถานะบางช่องของช่องทาง (ช่องที่ไม่ระบุ คงค่าเดิม)
  function updateEntry(changes: Partial<Lane>) {
    setEntry((old) => ({ ...old, ...changes }));
  }
  function updateExit(changes: Partial<Lane>) {
    setExit((old) => ({ ...old, ...changes }));
  }


  // ---------- ข้อมูลที่แสดง ----------
  const now = new Date();
  const allCars = vehicles ?? [];
  const carsInLot = allCars.filter((v) => !v.exitAt);
  const floors = buildFloors(layout, allCars, maintenance);
  const freeSlots = floors.reduce((sum, f) => sum + floorStats(f).free, 0);
  const bestFloor = emptiestFloor(floors);

  // รถที่เลือกออกได้: คันที่มีค่าจอดค้างขึ้นก่อน (จะได้เห็นขั้นตอนจ่ายเงิน)
  const exitChoices = carsInLot
    .filter((v) => !v.unreadable)
    .map((v) => ({ car: v, due: amountDue(v, rates, now) }))
    .sort((a, b) => b.due - a.due);

  // ยังไม่ได้เลือกรถออก (หรือคันที่เลือกออกไปแล้ว) → เลือกคันแรกให้
  useEffect(() => {
    const stillThere = exitChoices.some((c) => c.car.id === exitCarId);
    if (exit.step === "idle" && !stillThere && exitChoices.length > 0) {
      setExitCarId(exitChoices[0].car.id);
    }
  }, [exit.step, exitCarId, exitChoices]);

  const entryBusy = entry.step !== "idle";
  const exitBusy = exit.step !== "idle";

  /** เกิดปัญหา → รอให้อ่านข้อความ แล้วรถถอยออก */
  async function reverseAway(update: (c: Partial<Lane>) => void, reset: () => void) {
    await wait(2600);
    if (!pageOpen.current) return;
    update({ position: "away", moving: true, reversing: true, noAnimation: false, scanning: false });
    await wait(DRIVE_TIME);
    if (!pageOpen.current) return;
    reset();
  }

  // =====================================================
  // ทางเข้า
  // =====================================================
  async function runEntry(): Promise<void> {
    // 0) เตรียมทะเบียน
    const taken = carsInLot.map((v) => v.plate);
    let plate = plateInput.trim().replace(/\s+/g, " ");
    if (plate === "") plate = randomPlate(taken);
    if (!isValidPlate(plate)) {
      setInputError(`ทะเบียน "${plate}" รูปแบบไม่ถูกต้อง เช่น 1กก 1122`);
      return;
    }
    setPlateInput("");
    setInputError("");

    // 1) รถวิ่งมาจอดหน้าไม้กั้น (วางไว้นอกจอก่อน แล้วค่อยให้วิ่งเข้ามา)
    setEntry({ ...EMPTY_LANE, step: "arriving", plate });
    await wait(60);
    updateEntry({ noAnimation: false, position: "gate", moving: true });
    await wait(DRIVE_TIME);
    if (!pageOpen.current) return;

    // 2) ตู้ Kiosk อ่านทะเบียน
    updateEntry({ step: "scanning", moving: false, scanning: true });
    await wait(SCAN_TIME);
    if (!pageOpen.current) return;
    updateEntry({ step: "saving", scanning: false, plateRead: true });

    // 3) แนะนำชั้นที่ว่างที่สุด แล้วบันทึกรถเข้า
    //    (ระบบบันทึกช่องว่างช่องแรกของชั้นนั้นไว้เบื้องหลัง ให้ผังลานจอดแสดงได้ — จอไม่บอกช่องกับผู้ขับ)
    let car: Vehicle;
    try {
      const [latestCars, latestRepairs, latestLayout] = await Promise.all([fetchVehicles(), fetchMaintenance(), fetchLayout()]);
      const latestFloors = buildFloors(latestLayout, latestCars, latestRepairs);
      const floor = emptiestFloor(latestFloors);
      const freeSlot = floor?.rows.flat().find((s) => s.status === "free");
      if (!floor || !freeSlot) throw new Error("ลานจอดเต็ม ไม่มีช่องว่าง");

      car = await createVehicle({
        plate,
        province: "กรุงเทพมหานคร",
        type: randomItem(VEHICLE_TYPES),
        floor: floor.id,
        slot: freeSlot.id,
      });
    } catch (e) {
      const message = (e as Error).message;
      updateEntry({ step: "error", message });
      await reverseAway(updateEntry, () => setEntry(EMPTY_LANE));
      return;
    }
    updateEntry({ step: "welcome", car });
    reload();
    await wait(1800);
    if (!pageOpen.current) return;

    // 4) ไม้กั้นยก
    updateEntry({ step: "opening", barrierUp: true });
    await wait(1000);
    if (!pageOpen.current) return;

    // 5) รถวิ่งเข้าลาน แล้วไม้กั้นลง
    updateEntry({ step: "passing", position: "passed", moving: true });
    await wait(DRIVE_TIME);
    if (!pageOpen.current) return;
    updateEntry({ step: "done", moving: false, barrierUp: false });
    await wait(1400);
    if (!pageOpen.current) return;
    setEntry(EMPTY_LANE);
  }

  // =====================================================
  // ทางออก
  // =====================================================
  async function runExit(carId: string): Promise<void> {
    // หาข้อมูลรถล่าสุดจากเซิร์ฟเวอร์
    let list: Vehicle[] = vehicles ?? [];
    try { list = await fetchVehicles(); } catch { /* ใช้ข้อมูลเดิม */ }
    const car = list.find((v) => v.id === carId && !v.exitAt);
    if (!car) {
      reload();
      return;
    }
    const plate = car.plate;

    // 1) รถวิ่งมาจอดหน้าไม้กั้น
    setExit({ ...EMPTY_LANE, step: "arriving", plate, car });
    await wait(60);
    updateExit({ noAnimation: false, position: "gate", moving: true });
    await wait(DRIVE_TIME);
    if (!pageOpen.current) return;

    // 2) ตู้ Kiosk อ่านทะเบียน
    updateExit({ step: "scanning", moving: false, scanning: true });
    await wait(SCAN_TIME);
    if (!pageOpen.current) return;

    // 3) คิดค่าจอด
    const due = amountDue(car, rates);
    const minutes = minutesParked(car);
    updateExit({ step: "fee", scanning: false, plateRead: true, due, minutes, paid: car.paidAmount ?? 0 });
    await wait(1500);
    if (!pageOpen.current) return;

    // 4) ชำระเงิน (ถ้ามียอดค้าง)
    if (due > 0) {
      updateExit({ step: "pay" });

      // รอผู้ใช้กดปุ่ม "จำลองลูกค้าสแกนจ่าย" หรือ "ยกเลิก"
      const customerPaid = await new Promise<boolean>((resolve) => {
        payButtonPressed.current = resolve;
      });
      payButtonPressed.current = null;
      if (!pageOpen.current) return;

      if (!customerPaid) {
        updateExit({ step: "error", message: "ยกเลิกการชำระ ไม้กั้นไม่เปิด" });
        await reverseAway(updateExit, () => setExit(EMPTY_LANE));
        return;
      }

      updateExit({ step: "paying" });
      try {
        const paidCar = await payVehicle(car.id);
        await wait(900);
        if (!pageOpen.current) return;
        updateExit({ step: "paid", paid: paidCar.paidAmount ?? 0 });
        reload();
      } catch (e) {
        updateExit({ step: "error", message: (e as Error).message });
        await reverseAway(updateExit, () => setExit(EMPTY_LANE));
        return;
      }
      await wait(1500);
      if (!pageOpen.current) return;
    }

    // 5) บันทึกรถออก (เซิร์ฟเวอร์ตรวจอีกครั้งว่าไม่มียอดค้าง)
    try {
      await exitVehicle(car.id);
    } catch (e) {
      updateExit({ step: "error", message: (e as Error).message });
      await reverseAway(updateExit, () => setExit(EMPTY_LANE));
      return;
    }

    // 6) ไม้กั้นยก → รถวิ่งออก → ไม้กั้นลง
    updateExit({ step: "opening", barrierUp: true });
    reload();
    await wait(1000);
    if (!pageOpen.current) return;
    updateExit({ step: "passing", position: "passed", moving: true });
    await wait(DRIVE_TIME);
    if (!pageOpen.current) return;
    updateExit({ step: "done", moving: false, barrierUp: false });
    await wait(1400);
    if (!pageOpen.current) return;
    setExit(EMPTY_LANE);
  }

  // =====================================================
  // หน้าจอ
  // =====================================================
  return (
    <div className="sim-page">
      {/* หัวหน้า + ตัวเลขสรุป */}
      <div className="sim-head">
        <div className="row" style={{ gap: 12 }}>
          <LogoMark size={40} />
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>จำลองการทำงานที่ประตูลานจอด</h1>
          </div>
        </div>
        <div className="sim-stats">
          <span className="sim-stat">รถในลาน<b>{vehicles ? `${carsInLot.length}/${totalSlots(layout)}` : "…"}</b></span>
          {floors.map((f) => (
            <span key={f.id} className="sim-stat">{f.name} ว่าง<b>{vehicles ? floorStats(f).free : "…"}</b></span>
          ))}
          <span className="sim-stat">อัตรา<b>ฟรี {rates.freeMinutes} นาที · ฿{rates.perHour}/ชม.</b></span>
        </div>
      </div>

      {/* ปุ่มด้านบน */}
      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Link href="/pay" target="_blank" className="btn btn-ghost">เปิดหน้าชำระเงินลูกค้า</Link>
      </div>

      <div className="sim-lanes">
        {/* ---------- ทางเข้า ---------- */}
        <section className="sim-lane">
          <div className="sim-lane-title">
            <h2><Icon name="car" />ประตูทางเข้า</h2>
            <StepChips names={ENTRY_STEP_NAMES} current={ENTRY_STEP_INDEX[entry.step] ?? -1} />
          </div>

          <Scene lane={entry} />

          <div className="sim-kiosk">
            <EntryScreen
              lane={entry}
              freeSlots={freeSlots}
              bestFloorName={bestFloor ? bestFloor.name : ""}
              freeMinutes={rates.freeMinutes}
              perHour={rates.perHour}
            />
          </div>

          <div className="sim-controls">
            <div className="input">
              <Icon name="search" size={18} color="var(--text-2)" />
              <input
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value)}
                placeholder="ทะเบียน (เว้นว่าง = สุ่ม)"
                disabled={entryBusy}
              />
            </div>
            <button className="btn btn-primary" onClick={() => runEntry()} disabled={entryBusy || !vehicles}>
              <Icon name="plus" size={18} />รถมาถึงทางเข้า
            </button>
          </div>
          {inputError && <span className="small" style={{ color: "#fca5a5" }}>{inputError}</span>}
        </section>

        {/* ---------- ทางออก ---------- */}
        <section className="sim-lane">
          <div className="sim-lane-title">
            <h2><Icon name="logout" />ประตูทางออก</h2>
            <StepChips names={EXIT_STEP_NAMES} current={EXIT_STEP_INDEX[exit.step] ?? -1} />
          </div>

          <Scene lane={exit} />

          <div className="sim-kiosk">
            <ExitScreen
              lane={exit}
              exitWithin={rates.exitWithinMinutes}
              onPay={() => payButtonPressed.current?.(true)}
              onCancel={() => payButtonPressed.current?.(false)}
            />
          </div>

          <div className="sim-controls">
            <select value={exitCarId} onChange={(e) => setExitCarId(e.target.value)} disabled={exitBusy || exitChoices.length === 0}>
              {exitChoices.length === 0 && <option value="">ไม่มีรถในลาน</option>}
              {exitChoices.map(({ car, due }) => (
                <option key={car.id} value={car.id}>
                  {car.plate} · ชั้น {car.floor} · {paymentText(car, due)}
                </option>
              ))}
            </select>
            <button className="btn btn-primary" onClick={() => runExit(exitCarId)} disabled={exitBusy || !exitCarId}>
              <Icon name="logout" size={18} />รถมาถึงทางออก
            </button>
          </div>
        </section>
      </div>

    </div>
  );
}

// =====================================================
// ชิ้นส่วนหน้าจอ
// =====================================================

/** ป้ายขั้นตอน: ทำแล้ว ✓ · กำลังทำ (สีเขียว) · ยังไม่ถึง (จาง) */
function StepChips({ names, current }: { names: string[]; current: number }) {
  return (
    <div className="sim-steps">
      {names.map((name, i) => {
        let className = "sim-step";
        if (i < current) className += " done";
        if (i === current) className += " active";
        return (
          <span key={name} className={className}>
            {i < current ? "✓ " : ""}{name}
          </span>
        );
      })}
    </div>
  );
}

/**
 * ฉาก: ถนน · ตู้ Kiosk · ไม้กั้น (และรถตอนวิ่งผ่าน)
 * ทุกอย่างวางตำแหน่งเทียบกับเสาไม้กั้น ซึ่งอยู่ที่ 66% ของความกว้างฉาก
 */
function Scene({ lane }: { lane: Lane }) {
  const POST = "66%";

  // ตำแหน่งรถ (CSS จะทำให้รถวิ่งไปตำแหน่งใหม่เอง)
  let carLeft = "-170px";                                   // นอกจอซ้าย
  if (lane.position === "gate") carLeft = `calc(${POST} - 258px)`; // จอดหน้าไม้กั้น
  if (lane.position === "passed") carLeft = "calc(100% + 30px)";   // นอกจอขวา

  // สีไฟ: เขียว = ไม้กั้นเปิด · เหลือง = กำลังตรวจ/รอจ่าย · แดง = หยุด
  let light = "red";
  if (lane.scanning || lane.step === "pay" || lane.step === "paying") light = "amber";
  if (lane.barrierUp) light = "green";

  let carClass = "sim-car";
  if (lane.noAnimation) carClass += " instant";
  if (lane.moving) carClass += " moving";
  if (lane.reversing) carClass += " reverse";

  return (
    <div className="sim-scene">
      {/* ถนน */}
      <div className="sim-road" />

      {/* ป้ายบนจอ */}
      {lane.scanning && (
        <div className="sim-lpr"><Icon name="kiosk" size={14} />กำลังอ่านทะเบียน…</div>
      )}
      {lane.plateRead && (
        <div className="sim-lpr"><Icon name="kiosk" size={14} /><b>{lane.plate}</b> <Icon name="check" size={14} /></div>
      )}

      {/* ตู้ Kiosk อ่านทะเบียน (อยู่หลังรถ รถจอดชิดตู้) */}
      <div className="sim-booth" style={{ left: `calc(${POST} - 190px)` }}>
        <BoothScreen lane={lane} />
        <div className={lane.scanning ? "sim-booth-reader on" : "sim-booth-reader"} />
        <div className="sim-booth-slot" />
      </div>

      {/* รถ */}
      {lane.plate !== "" && (
        <div className={carClass} style={{ left: carLeft }}>
          <CarPicture />
          <span className="plate">{lane.plate}</span>
        </div>
      )}

      {/* ไม้กั้น + เสา + ไฟ */}
      <div className={lane.barrierUp ? "sim-arm open" : "sim-arm"} style={{ left: `calc(${POST} - 98px)` }} />
      <div className="sim-post" style={{ left: `calc(${POST} - 6px)` }} />
      <div className={`sim-light ${light}`} style={{ left: `calc(${POST} - 8px)` }} />
    </div>
  );
}

/** จอเล็กบนตู้ Kiosk ในฉาก — บอกสถานะสั้น ๆ */
function BoothScreen({ lane }: { lane: Lane }) {
  // กำลังอ่าน: มีเส้นสแกนวิ่งขึ้นลง
  if (lane.scanning) {
    return (
      <div className="sim-booth-screen">
        <div className="sim-booth-scanline" />
        กำลังอ่าน
      </div>
    );
  }

  let text = "พร้อม";
  let tone = "";
  if (lane.plateRead) text = lane.plate;
  if (lane.step === "pay" || lane.step === "paying") {
    text = "สแกนจ่าย";
    tone = "warn";
  }
  if (lane.step === "paid" || lane.barrierUp) {
    text = "เชิญผ่าน";
    tone = "ok";
  }
  if (lane.step === "error") {
    text = "ไม่ผ่าน";
    tone = "err";
  }

  let icon: "kiosk" | "check" | "qr" = "kiosk";
  if (tone === "ok") icon = "check";
  if (tone === "warn") icon = "qr";

  return (
    <div className={tone ? `sim-booth-screen ${tone}` : "sim-booth-screen"}>
      <Icon name={icon} size={12} />
      {text}
    </div>
  );
}

/** รูปรถมุมด้านข้าง (หันหัวไปทางขวา) */
function CarPicture() {
  return (
    <svg width="140" height="59" viewBox="0 0 150 64" aria-hidden="true">
      {/* ตัวรถ */}
      <path
        d="M8 34 Q10 26 22 25 L42 23 L58 9 Q62 6 70 6 L104 6 Q112 6 117 12 L128 24 L138 26 Q146 28 146 36 L146 44 Q146 48 142 48 L8 48 Q4 48 4 44 L4 38 Q4 34 8 34 Z"
        fill={CAR_COLOR} stroke="rgba(0,0,0,.25)" strokeWidth="1.2"
      />
      {/* กระจก */}
      <path d="M62 11 Q64 9 70 9 L86 9 L86 24 L48 24 Z" fill="#cfe8f7" opacity=".9" />
      <path d="M90 9 L104 9 Q110 9 113 13 L122 24 L90 24 Z" fill="#cfe8f7" opacity=".9" />
      {/* ไฟหน้า / ไฟท้าย */}
      <rect x="140" y="30" width="6" height="5" rx="2" fill="#fde68a" />
      <rect x="4" y="34" width="5" height="5" rx="2" fill="#ef4444" />
      {/* ล้อ (class "wheel" ทำให้หมุนตอนรถวิ่ง) */}
      <g className="wheel">
        <circle cx="36" cy="48" r="11" fill="#111827" />
        <circle cx="36" cy="48" r="5" fill="#9ca3af" />
        <rect x="35" y="38" width="2" height="20" fill="#6b7280" />
      </g>
      <g className="wheel">
        <circle cx="116" cy="48" r="11" fill="#111827" />
        <circle cx="116" cy="48" r="5" fill="#9ca3af" />
        <rect x="115" y="38" width="2" height="20" fill="#6b7280" />
      </g>
    </svg>
  );
}

/** หัวของจอที่ตู้ */
function ScreenHeader({ text }: { text: string }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <LogoMark onLight size={28} />
      <span className="text-green semibold" style={{ fontSize: 14 }}>Smart Parking · {text}</span>
    </div>
  );
}

/** จอที่ตู้ทางเข้า — เปลี่ยนข้อความตามขั้นตอน */
function EntryScreen({ lane, freeSlots, bestFloorName, freeMinutes, perHour }: {
  lane: Lane;
  freeSlots: number;
  bestFloorName: string;
  freeMinutes: number;
  perHour: number;
}) {
  const header = <ScreenHeader text="จอทางเข้า" />;

  if (lane.step === "idle") {
    return (
      <>
        {header}
        <div className="big">ยินดีต้อนรับ</div>
        <div className="muted">รอรถเข้า · ช่องว่างทั้งหมด {freeSlots} ช่อง{bestFloorName ? ` · แนะนำ${bestFloorName}` : ""}</div>
        <div className="small muted">ฟรี {freeMinutes} นาทีแรก · {perHour} บาท/ชม.</div>
      </>
    );
  }

  if (lane.step === "arriving" || lane.step === "scanning") {
    return (
      <>
        {header}
        <div className="big">{lane.step === "arriving" ? "รถกำลังเข้ามา…" : "กำลังอ่านทะเบียน…"}</div>
        <div className="muted">กรุณาจอดรถให้ชิดตู้ Kiosk</div>
      </>
    );
  }

  if (lane.step === "saving") {
    return (
      <>
        {header}
        <div className="big">{lane.plate}</div>
        <div className="muted">กำลังบันทึกและหาชั้นที่ว่าง…</div>
      </>
    );
  }

  if (lane.step === "error") {
    return (
      <>
        {header}
        <div className="big" style={{ color: "var(--danger)" }}>เข้าไม่ได้</div>
        <div>{lane.message}</div>
        <Badge tone="danger">ไม้กั้นไม่เปิด</Badge>
      </>
    );
  }

  // welcome / opening / passing / done
  return (
    <>
      {header}
      <div className="row-between">
        <div className="big">{lane.plate}</div>
        <Badge tone="success">{lane.step === "done" ? "เข้าลานแล้ว" : "ไม้กั้นเปิด"}</Badge>
      </div>
      {lane.car && (
        <div style={{ background: "var(--green-700)", color: "#fff", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>แนะนำขึ้นชั้น {lane.car.floor} · ว่างมากที่สุด</div>
          <div style={{ fontSize: 12, color: "var(--green-100)" }}>
            เวลาเข้า {hhmm(new Date(lane.car.entryAt))} · ฟรี {freeMinutes} นาทีแรก · {perHour} บาท/ชม.
          </div>
        </div>
      )}
    </>
  );
}

/** จอที่ตู้ทางออก — เปลี่ยนข้อความตามขั้นตอน */
function ExitScreen({ lane, exitWithin, onPay, onCancel }: {
  lane: Lane;
  exitWithin: number;
  onPay: () => void;
  onCancel: () => void;
}) {
  const header = <ScreenHeader text="จอทางออก" />;
  const due = lane.due ?? 0;
  const paid = lane.paid ?? 0;

  if (lane.step === "idle") {
    return (
      <>
        {header}
        <div className="big">ขอบคุณที่ใช้บริการ</div>
        <div className="muted">เลือกรถด้านล่างแล้วกด &quot;รถมาถึงทางออก&quot;</div>
      </>
    );
  }

  if (lane.step === "arriving" || lane.step === "scanning") {
    return (
      <>
        {header}
        <div className="big">{lane.step === "arriving" ? "รถกำลังเข้ามา…" : "กำลังอ่านทะเบียน…"}</div>
        <div className="muted">กรุณาจอดรถให้ชิดตู้ Kiosk</div>
      </>
    );
  }

  if (lane.step === "error") {
    return (
      <>
        {header}
        <div className="big" style={{ color: "var(--danger)" }}>ออกไม่ได้</div>
        <div>{lane.message}</div>
        <Badge tone="danger">ไม้กั้นไม่เปิด</Badge>
      </>
    );
  }

  const carInfo = (
    <div className="col" style={{ gap: 0 }}>
      <div className="kv"><span>ทะเบียน</span><span>{lane.plate}</span></div>
      <div className="kv"><span>เวลาจอด</span><span>{durationLabel(lane.minutes ?? 0)}</span></div>
    </div>
  );

  // รอจ่ายเงิน: แสดง QR + ปุ่มจำลองการจ่าย
  if (lane.step === "pay" || lane.step === "paying") {
    let action = (
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" onClick={onPay}><Icon name="qr" size={18} />จำลองลูกค้าสแกนจ่าย</button>
        <button className="btn btn-ghost" onClick={onCancel}>ยกเลิก</button>
      </div>
    );
    if (lane.step === "paying") action = <div className="small text-green semibold">กำลังยืนยันการชำระกับธนาคาร…</div>;

    return (
      <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
        <div className="col" style={{ gap: 8, flex: 1 }}>
          {header}
          {carInfo}
          <div style={{ color: "var(--warning)", fontSize: 14, fontWeight: 600 }}>
            {lane.car?.paidAt ? "เกินเวลาออก · ต้องชำระเพิ่ม" : "ค่าจอดที่ต้องชำระ"}
          </div>
          <div className="big" style={{ color: "var(--warning)" }}>{baht(due, 2)}</div>
          {action}
        </div>
        <div className="col" style={{ alignItems: "center", gap: 4 }}>
          <div style={{ background: "#123366", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>THAI QR · PromptPay</div>
          <MockQR text={lane.plate + due} size={120} />
        </div>
      </div>
    );
  }

  // fee / paid / opening / passing / done
  let amountText = baht(due, 2);
  if (paid > 0) amountText = baht(paid, 2);
  else if (due === 0) amountText = "ฟรี";

  let status = "ไม้กั้นเปิด · ขอบคุณที่ใช้บริการ";
  if (lane.step === "paid") status = "ชำระสำเร็จ · กำลังเปิดไม้กั้น";
  if (lane.step === "done") status = "ออกจากลานแล้ว · เดินทางปลอดภัย";
  if (lane.step === "fee") {
    if (due > 0) status = "กำลังคิดค่าจอด…";
    else if (lane.car?.paidAt) status = `ชำระไว้แล้ว · ออกได้ภายใน ${exitWithin} นาทีหลังชำระ`;
    else status = "อยู่ในช่วงจอดฟรี · ออกได้เลย";
  }

  return (
    <>
      {header}
      {carInfo}
      <div className="row-between">
        <span className="semibold">{paid > 0 ? "ชำระแล้ว" : "ค่าจอด"}</span>
        <span className="text-green" style={{ fontSize: 24, fontWeight: 700 }}>{amountText}</span>
      </div>
      <Badge tone="success">{status}</Badge>
    </>
  );
}
