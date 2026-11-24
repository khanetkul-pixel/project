"use client";
// =====================================================
// หน้าผังลานจอด — /admin/parking-map  (Figma: 08 · ผังลานจอด)
// เลือกชั้นทางซ้าย ดูช่องจอดทางขวา · อัปเดตเองทุก 5 วินาที
//
// กดปุ่ม "แก้ไขลานจอด" ด้านบน เพื่อเข้าโหมดแก้ไข แล้ว
//   เพิ่มชั้น          → กรอกจำนวนช่องในกล่อง "เพิ่มชั้น" ด้านซ้าย
//   ลบชั้น            → เลือกชั้น แล้วกด "ลบชั้นนี้" (ลบได้เฉพาะชั้นที่ไม่มีรถ)
//   เพิ่มแถว           → กรอกจำนวนช่องใต้ผัง แล้วกด "เพิ่มแถว" (มีทางวิ่งคั่นทุกแถว)
//   ลบแถว             → กด "ลบแถว" ใต้แถวนั้น (ต้องไม่มีรถ)
//   เพิ่มช่อง          → กดปุ่ม + ท้ายแถว (แต่ละแถวมีจำนวนช่องไม่เท่ากันได้)
//   เลือกเครื่องมือ แล้วกดช่องที่ต้องการ:
//     "มีรถ"    → บังคับให้มีรถ (ใส่รถทะเบียนสุ่ม)
//     "ว่าง"    → บังคับให้ว่าง (เอารถออก / เปิดช่องซ่อม)
//     "ปิดซ่อม" → ปิดช่องเพื่อปรับปรุง (ใส่เหตุผลได้) กดซ้ำ = เปิดใช้งาน
//     "ลบช่อง"  → ลบช่องนั้นออกจากผัง (ต้องไม่มีรถ)
//   ปุ่ม "เติมรถทั้งชั้น" / "ทำให้ว่างทั้งชั้น" → เปลี่ยนทั้งชั้นทีเดียว
// ช่องที่ปิดซ่อม: บันทึกรถเข้าไม่ได้ ไม่นับเป็นช่องว่าง และจอทางเข้าจะไม่แนะนำ
// =====================================================
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, CardHead, PageHeader, ParkingSlot } from "@/components/ui";
import { useVehicles } from "@/components/useVehicles";
import {
  addFloor, addRow, addSlot, closeSlotForRepair, createVehicle, forceExitVehicle,
  removeFloor, removeRow, removeSlot, reopenSlot,
} from "@/lib/vehicle-api";
import { VEHICLE_TYPES, randomItem, randomPlate } from "@/lib/vehicles";
import {
  MAX_ROWS_PER_FLOOR, MAX_SLOTS_PER_FLOOR, MAX_SLOTS_PER_ROW,
  buildFloors, floorOfSlot, floorStats, totalSlots, type Slot,
} from "@/lib/lot";
import { hhmm, thaiShortDate } from "@/lib/format";

/** เครื่องมือในโหมดแก้ไข: ใส่รถ / ทำให้ว่าง / ปิดซ่อม / ลบช่อง */
type Tool = "car" | "free" | "repair" | "delete";

const TOOLS: { key: Tool; label: string; className: string }[] = [
  { key: "car", label: "มีรถ", className: "occupied" },
  { key: "free", label: "ว่าง", className: "free" },
  { key: "repair", label: "ปิดซ่อม", className: "maintenance" },
  { key: "delete", label: "ลบช่อง", className: "delete" },
];

export default function ParkingMapPage() {
  const [floorId, setFloorId] = useState(2);       // ชั้นที่เลือกอยู่
  const [editMode, setEditMode] = useState(false); // อยู่ในโหมดแก้ไขลานจอดหรือไม่
  const [tool, setTool] = useState<Tool>("car");   // เครื่องมือที่เลือก
  const [note, setNote] = useState("");            // เหตุผลที่ปิดซ่อม
  const [message, setMessage] = useState("");      // ข้อความแจ้งผล
  const [saving, setSaving] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");   // ชื่อชั้นใหม่ (ไม่ใส่ก็ได้)
  const [newFloorSlots, setNewFloorSlots] = useState("16"); // จำนวนช่องของชั้นใหม่
  const [newRowSlots, setNewRowSlots] = useState("8");      // จำนวนช่องของแถวใหม่
  const { vehicles, maintenance, layout, error, reload } = useVehicles();

  const floors = buildFloors(layout, vehicles ?? [], maintenance);
  const floor = floors.find((f) => f.id === floorId) ?? floors[0];
  const stats = floorStats(floor);

  /** ชื่อชั้นจากรหัสช่อง เช่น "B07" → "ชั้น 2" */
  function floorNameOf(slotId: string): string {
    const found = floorOfSlot(layout, slotId);
    return found ? found.name : "";
  }

  /** ปุ่ม "เพิ่มชั้น" */
  async function handleAddFloor() {
    const slots = Number(newFloorSlots);
    if (!Number.isInteger(slots) || slots < 1 || slots > MAX_SLOTS_PER_FLOOR) {
      setMessage(`จำนวนช่องต้องเป็น 1–${MAX_SLOTS_PER_FLOOR}`);
      return;
    }
    setSaving(true);
    try {
      const newLayout = await addFloor(slots, newFloorName);
      const added = newLayout[newLayout.length - 1];
      setMessage(`เพิ่ม${added.name} แล้ว (${slots} ช่อง · ${added.prefix}01–${added.prefix}${String(slots).padStart(2, "0")})`);
      setFloorId(added.id); // เลือกชั้นใหม่ให้เลย
      setNewFloorName("");
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setSaving(false);
  }

  /** ปุ่ม "ลบชั้นนี้" */
  async function handleRemoveFloor() {
    if (!window.confirm(`ต้องการลบ${floor.name} ใช่ไหม?`)) return;
    setSaving(true);
    try {
      const newLayout = await removeFloor(floor.id);
      setMessage(`ลบ${floor.name} แล้ว`);
      setFloorId(newLayout[0].id);
      await reload();
    } catch (e) {
      setMessage((e as Error).message); // เช่น ยังมีรถจอดอยู่
    }
    setSaving(false);
  }

  // ---------- คำสั่งย่อยที่ใช้ในการจำลอง ----------

  /** รถที่จอดอยู่ในช่องนี้ (ถ้ามี) */
  function carInSlot(slotId: string) {
    return (vehicles ?? []).find((v) => !v.exitAt && v.slot === slotId);
  }

  /** ใส่รถจำลองลงช่อง (ทะเบียนสุ่ม) */
  async function putCar(slotId: string, takenPlates: string[]): Promise<string> {
    const floorInfo = floorOfSlot(layout, slotId);
    const plate = randomPlate(takenPlates);
    await createVehicle({
      plate,
      province: "กรุงเทพมหานคร",
      type: randomItem(VEHICLE_TYPES),
      floor: floorInfo ? floorInfo.id : 1,
      slot: slotId,
    });
    return plate;
  }

  /** เอารถออกจากช่อง (ไม่ตรวจการจ่าย เพราะเป็นการจำลอง) */
  async function removeCar(slotId: string) {
    const car = carInSlot(slotId);
    if (car) await forceExitVehicle(car.id);
  }

  /** ทะเบียนของรถทุกคันที่อยู่ในลาน (กันสุ่มซ้ำ) */
  function platesInLot(): string[] {
    return (vehicles ?? []).filter((v) => !v.exitAt).map((v) => v.plate);
  }

  // ---------- กดช่องตอนอยู่ในโหมดตั้งค่า ----------
  async function handleSlotClick(slot: Slot) {
    if (saving) return;
    setSaving(true);
    try {
      if (tool === "car") {
        // ใส่รถ
        if (slot.status === "occupied") {
          setMessage(`ช่อง ${slot.id} มีรถอยู่แล้ว`);
        } else {
          if (slot.status === "maintenance") await reopenSlot(slot.id);
          const plate = await putCar(slot.id, platesInLot());
          setMessage(`ใส่รถ ${plate} ในช่อง ${slot.id} แล้ว`);
        }
      }

      if (tool === "free") {
        // ทำให้ว่าง
        if (slot.status === "occupied") {
          await removeCar(slot.id);
          setMessage(`เอารถ ${slot.plate} ออกจากช่อง ${slot.id} แล้ว`);
        } else if (slot.status === "maintenance") {
          await reopenSlot(slot.id);
          setMessage(`เปิดใช้ช่อง ${slot.id} แล้ว`);
        } else {
          setMessage(`ช่อง ${slot.id} ว่างอยู่แล้ว`);
        }
      }

      if (tool === "delete") {
        // ลบช่องออกจากผัง
        if (slot.status === "occupied") {
          setMessage(`ช่อง ${slot.id} มีรถ ${slot.plate} จอดอยู่ ลบไม่ได้ (ใช้เครื่องมือ "ว่าง" เอารถออกก่อน)`);
        } else {
          await removeSlot(slot.id);
          setMessage(`ลบช่อง ${slot.id} แล้ว`);
        }
      }

      if (tool === "repair") {
        // ปิดซ่อม / เปิดใช้งาน
        if (slot.status === "occupied") {
          setMessage(`ช่อง ${slot.id} มีรถ ${slot.plate} จอดอยู่ ปิดซ่อมไม่ได้ (ใช้เครื่องมือ "ว่าง" เอารถออกก่อน)`);
        } else if (slot.status === "maintenance") {
          await reopenSlot(slot.id);
          setMessage(`เปิดใช้ช่อง ${slot.id} แล้ว`);
        } else {
          await closeSlotForRepair(slot.id, note);
          setMessage(`ปิดซ่อมช่อง ${slot.id} แล้ว${note ? ` (${note})` : ""}`);
        }
      }

      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setSaving(false);
  }

  // ---------- จำลองทั้งชั้น ----------

  /** เติมรถทุกช่องว่างของชั้นที่เลือก */
  async function fillFloor() {
    const freeSlots = floor.rows.flat().filter((s) => s.status === "free");
    if (freeSlots.length === 0) {
      setMessage(`${floor.name} ไม่มีช่องว่างแล้ว`);
      return;
    }
    setSaving(true);
    const taken = platesInLot();
    try {
      for (const slot of freeSlots) {
        const plate = await putCar(slot.id, taken);
        taken.push(plate);
      }
      setMessage(`เติมรถ ${freeSlots.length} คันใน${floor.name} แล้ว`);
    } catch (e) {
      setMessage((e as Error).message);
    }
    await reload();
    setSaving(false);
  }

  /** เอารถออกทุกช่องของชั้นที่เลือก */
  async function clearFloor() {
    const occupiedSlots = floor.rows.flat().filter((s) => s.status === "occupied");
    if (occupiedSlots.length === 0) {
      setMessage(`${floor.name} ไม่มีรถจอดอยู่`);
      return;
    }
    setSaving(true);
    try {
      for (const slot of occupiedSlots) {
        await removeCar(slot.id);
      }
      setMessage(`เอารถออก ${occupiedSlots.length} คันจาก${floor.name} แล้ว`);
    } catch (e) {
      setMessage((e as Error).message);
    }
    await reload();
    setSaving(false);
  }

  /** ปุ่ม "เปิดใช้งาน" ในรายการช่องซ่อม */
  async function handleReopen(slotId: string) {
    setSaving(true);
    try {
      await reopenSlot(slotId);
      setMessage(`เปิดใช้ช่อง ${slotId} แล้ว`);
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setSaving(false);
  }

  // ---------- แก้แถวและช่อง ----------

  /** ทำงาน 1 อย่างกับเซิร์ฟเวอร์ แล้วโหลดผังใหม่ (แสดงข้อความสำเร็จหรือ error) */
  async function runChange(job: () => Promise<unknown>, successText: string) {
    setSaving(true);
    try {
      await job();
      setMessage(successText);
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
    setSaving(false);
  }

  /** ปุ่ม + ท้ายแถว: เพิ่ม 1 ช่อง */
  function handleAddSlot(rowIndex: number) {
    runChange(() => addSlot(floor.id, rowIndex), `เพิ่มช่องในแถวที่ ${rowIndex + 1} แล้ว`);
  }

  /** ปุ่ม "ลบแถว" */
  function handleRemoveRow(rowIndex: number) {
    if (!window.confirm(`ต้องการลบแถวที่ ${rowIndex + 1} ของ${floor.name} ใช่ไหม?`)) return;
    runChange(() => removeRow(floor.id, rowIndex), `ลบแถวที่ ${rowIndex + 1} แล้ว`);
  }

  /** ปุ่ม "เพิ่มแถว" */
  function handleAddRow() {
    const count = Number(newRowSlots);
    if (!Number.isInteger(count) || count < 1 || count > MAX_SLOTS_PER_ROW) {
      setMessage(`จำนวนช่องในแถวต้องเป็น 1–${MAX_SLOTS_PER_ROW}`);
      return;
    }
    runChange(() => addRow(floor.id, count), `เพิ่มแถวใหม่ ${count} ช่องใน${floor.name} แล้ว`);
  }

  function toggleEditMode() {
    setEditMode(!editMode);
    setMessage("");
  }

  return (
    <>
      <PageHeader
        title="ผังลานจอด"
        subtitle="ดูสถานะช่องจอดแบบเรียลไทม์ และแก้ไขชั้น แถว ช่องจอด"
        actions={
          <button className={editMode ? "btn btn-primary" : "btn btn-secondary"} onClick={toggleEditMode}>
            <Icon name={editMode ? "check" : "settings"} size={18} />
            {editMode ? "เสร็จสิ้น" : "แก้ไขลานจอด"}
          </button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        {/* ---------- ซ้าย: รายชื่อชั้น + รายการช่องซ่อม ---------- */}
        <div className="col" style={{ gap: 20 }}>
          <div className="card" style={{ gap: 10 }}>
            <CardHead title="ชั้นจอดรถ" sub={`${floors.length} ชั้น · ${totalSlots(layout)} ช่อง`} />
            {floors.map((f) => {
              const s = floorStats(f);
              const selected = f.id === floorId;
              const usedPercent = s.total > 0 ? ((s.total - s.free) / s.total) * 100 : 0;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFloorId(f.id)}
                  className="col"
                  style={{
                    gap: 8,
                    textAlign: "left",
                    padding: "12px 14px 14px",
                    borderRadius: 12,
                    background: selected ? "var(--green-50)" : "var(--surface)",
                    border: selected ? "1.5px solid var(--green-500)" : "1px solid var(--border)",
                  }}
                >
                  <div className="row-between">
                    <span className="semibold" style={{ fontSize: 14, color: selected ? "var(--green-800)" : "var(--text)" }}>
                      {f.name}
                    </span>
                    <span className="small muted" style={{ fontWeight: 500 }}>
                      ว่าง {s.free}/{s.total}{s.maintenance > 0 ? ` · ซ่อม ${s.maintenance}` : ""}
                    </span>
                  </div>
                  <div className="track"><div style={{ width: `${usedPercent}%` }} /></div>
                </button>
              );
            })}
          </div>

          {/* เพิ่มชั้น (แสดงเฉพาะโหมดแก้ไข) */}
          {editMode && (
            <div className="card" style={{ gap: 10 }}>
              <CardHead title="เพิ่มชั้น" sub="ชั้นใหม่จะต่อท้ายชั้นสุดท้าย" />
              <div className="field">
                <label>ชื่อชั้น (ไม่ใส่ก็ได้)</label>
                <div className="input" style={{ minHeight: 38 }}>
                  <input value={newFloorName} onChange={(e) => setNewFloorName(e.target.value)} placeholder="เช่น ชั้นดาดฟ้า" style={{ fontSize: 13 }} />
                </div>
              </div>
              <div className="field">
                <label>จำนวนช่อง (1–{MAX_SLOTS_PER_FLOOR})</label>
                <div className="input" style={{ minHeight: 38 }}>
                  <input
                    inputMode="numeric"
                    value={newFloorSlots}
                    onChange={(e) => setNewFloorSlots(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    style={{ fontSize: 13 }}
                  />
                  <span className="unit">ช่อง</span>
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={handleAddFloor} disabled={saving}>
                <Icon name="plus" size={18} />เพิ่มชั้น
              </button>
            </div>
          )}

          {/* รายการช่องที่ปิดซ่อม (ทุกชั้น) */}
          <div className="card" style={{ gap: 10 }}>
            <CardHead title="ช่องที่ปิดซ่อม" sub={maintenance.length === 0 ? "ไม่มีช่องที่ปิดซ่อม" : `${maintenance.length} ช่อง`} />
            {maintenance.map((m) => (
              <div key={m.slot} className="row-between" style={{ padding: "8px 0", borderTop: "1px solid var(--border)", alignItems: "flex-start" }}>
                <div>
                  <div className="semibold" style={{ fontSize: 14 }}>{m.slot} · {floorNameOf(m.slot)}</div>
                  <div className="small muted">{m.note || "ไม่ระบุเหตุผล"}</div>
                  <div className="tiny muted">ตั้งแต่ {thaiShortDate(new Date(m.since))} {hhmm(new Date(m.since))}</div>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12, borderRadius: 8 }}
                  onClick={() => handleReopen(m.slot)}
                  disabled={saving}
                >
                  เปิดใช้งาน
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ---------- ขวา: ผังของชั้นที่เลือก ---------- */}
        <div className="card" style={{ gap: 14 }}>
          <CardHead
            title={`ผัง${floor.name}`}
            sub={vehicles ? "สถานะช่องจอดแบบเรียลไทม์ · อัปเดตอัตโนมัติทุก 5 วินาที" : "กำลังโหลด…"}
            right={
              editMode && floors.length > 1 ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "6px 12px", fontSize: 13, color: "var(--danger)" }}
                  onClick={handleRemoveFloor}
                  disabled={saving}
                >
                  <Icon name="trash" size={16} />ลบชั้นนี้
                </button>
              ) : undefined
            }
          />
          {error && <span className="small text-danger">โหลดข้อมูลไม่สำเร็จ: {error}</span>}

          {/* แถบเครื่องมือ (แสดงเฉพาะโหมดแก้ไข) */}
          {editMode && (
            <div className="col" style={{ gap: 10, padding: "12px 14px", borderRadius: 12, background: "var(--warning-bg)" }}>
              <div className="row" style={{ gap: 8, fontSize: 14, fontWeight: 600, color: "var(--warning)" }}>
                <Icon name="settings" size={18} />
                เลือกเครื่องมือ แล้วกดช่องจอด · กด + ท้ายแถวเพื่อเพิ่มช่อง
              </div>

              {/* ปุ่มเลือกเครื่องมือ */}
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {TOOLS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={tool === t.key ? "tool-chip active" : "tool-chip"}
                    onClick={() => setTool(t.key)}
                  >
                    <span className={`tool-swatch ${t.className}`} />
                    {t.label}
                  </button>
                ))}
                <span className="grow" />
                <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={fillFloor} disabled={saving}>
                  เติมรถทั้งชั้น
                </button>
                <button type="button" className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 13 }} onClick={clearFloor} disabled={saving}>
                  ทำให้ว่างทั้งชั้น
                </button>
              </div>

              {/* เหตุผลปิดซ่อม (เฉพาะเครื่องมือปิดซ่อม) */}
              {tool === "repair" && (
                <div className="input" style={{ background: "#fff", minHeight: 38 }}>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เหตุผลที่ปิดซ่อม (ไม่ใส่ก็ได้) เช่น พื้นแตก, ทาสีเส้นใหม่"
                    style={{ fontSize: 13 }}
                  />
                </div>
              )}
            </div>
          )}
          {saving && <span className="small muted">กำลังบันทึก…</span>}
          {message && <span className="small semibold" style={{ color: "var(--green-800)" }}>{message}</span>}

          <div className="lot">
            {floor.rows.map((row, i) => {
              const isLast = i === floor.rows.length - 1;
              return (
                <div key={i} className="col" style={{ alignItems: "center", gap: 8 }}>
                  <div className="slot-row">
                    {row.map((slot) => (
                      <ParkingSlot
                        key={slot.id}
                        slot={slot}
                        onClick={editMode ? () => handleSlotClick(slot) : undefined}
                      />
                    ))}

                    {/* ปุ่ม + เพิ่มช่องท้ายแถว (โหมดแก้ไข) */}
                    {editMode && row.length < MAX_SLOTS_PER_ROW && (
                      <button type="button" className="slot slot-add" onClick={() => handleAddSlot(i)} disabled={saving} title="เพิ่มช่องท้ายแถวนี้">
                        <Icon name="plus" size={22} />
                        <span className="status">เพิ่มช่อง</span>
                      </button>
                    )}
                  </div>

                  {/* ข้อมูลแถว + ปุ่มลบแถว (โหมดแก้ไข) */}
                  {editMode && (
                    <div className="row small muted" style={{ gap: 10 }}>
                      แถวที่ {i + 1} · {row.length} ช่อง
                      {floor.rows.length > 1 && (
                        <button type="button" className="row-action" onClick={() => handleRemoveRow(i)} disabled={saving}>
                          <Icon name="trash" size={14} />ลบแถว
                        </button>
                      )}
                    </div>
                  )}

                  {/* ทางวิ่งคั่นระหว่างทุกแถว (ยกเว้นหลังแถวสุดท้าย) */}
                  {!isLast && <span className="driveway">→ ทางวิ่ง →</span>}
                </div>
              );
            })}

            {/* เพิ่มแถวใหม่ (โหมดแก้ไข) */}
            {editMode && floor.rows.length < MAX_ROWS_PER_FLOOR && (
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <span className="small semibold">เพิ่มแถวใหม่</span>
                <div className="input" style={{ minHeight: 36, width: 110, background: "#fff" }}>
                  <input
                    inputMode="numeric"
                    value={newRowSlots}
                    onChange={(e) => setNewRowSlots(e.target.value.replace(/\D/g, "").slice(0, 2))}
                    style={{ fontSize: 13, padding: "6px 0" }}
                    aria-label="จำนวนช่องของแถวใหม่"
                  />
                  <span className="unit">ช่อง</span>
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }} onClick={handleAddRow} disabled={saving}>
                  <Icon name="plus" size={16} />เพิ่มแถว
                </button>
              </div>
            )}
          </div>

          <div className="row" style={{ gap: 10 }}>
            <Badge tone="success">ว่าง {stats.free}</Badge>
            <Badge tone="danger">มีรถ {stats.occupied}</Badge>
            <Badge tone="neutral">ปิดซ่อม {stats.maintenance}</Badge>
          </div>
        </div>
      </div>
    </>
  );
}
