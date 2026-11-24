// =====================================================
// xlsx.ts — สร้างไฟล์ Excel (.xlsx) ในเบราว์เซอร์ ไม่ต้องติดตั้งไลบรารีเพิ่ม
//
// วิธีใช้ (มือใหม่ใช้แค่ 2 ฟังก์ชันนี้ก็พอ ไม่ต้องอ่านส่วนอื่น):
//   downloadXlsx("รายงาน.xlsx", [ { name: "ชีต1", columns: [...], rows: [...] } ]);
//   stampedName("smart-parking_report")  → ชื่อไฟล์ที่มีวันที่-เวลาต่อท้าย
//
// เบื้องหลัง: ไฟล์ .xlsx คือไฟล์ zip ที่ข้างในเป็นไฟล์ XML หลายไฟล์
// ไฟล์นี้จึงมี 3 ส่วน: (1) สร้าง XML ของแต่ละชีต (2) รวมเป็น zip (3) สั่งดาวน์โหลด
// =====================================================

/** ค่าในเซลล์: ข้อความ ตัวเลข วันที่ ว่าง หรือ ตัวเลขที่บอกรูปแบบเอง */
export type Cell = string | number | Date | null | undefined | { value: number; format: "money" | "int" | "money-bold" };

/** คอลัมน์ */
export type Column = {
  header: string;   // ชื่อหัวคอลัมน์
  width?: number;   // ความกว้าง (ประมาณจำนวนตัวอักษร)
  format?: "text" | "int" | "money" | "date" | "day"; // date = วันที่+เวลา · day = วันที่อย่างเดียว
};

/** ชีต 1 แผ่น */
export type Sheet = {
  name: string;     // ชื่อแท็บชีต
  columns: Column[];
  rows: Cell[][];
  title?: string;   // ชื่อรายงานแถวบนสุด (ไม่ใส่ก็ได้)
};

// =====================================================
// ส่วนที่ 1: สร้าง XML ของชีต
// =====================================================

// หมายเลขสไตล์ (ต้องตรงกับลำดับ <xf> ใน cellXfs ของ STYLES ด้านล่าง)
const STYLE = { text: 0, header: 1, date: 2, money: 3, int: 4, title: 5, moneyBold: 6, day: 7 };

// ไฟล์สไตล์ของ Excel: ฟอนต์ · สีหัวตาราง · เส้นขอบ · รูปแบบตัวเลข/วันที่
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="4">
<font><sz val="11"/><name val="Tahoma"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font>
<font><b/><sz val="14"/><color rgb="FF0F5132"/><name val="Tahoma"/></font>
<font><b/><sz val="11"/><name val="Tahoma"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF127A4A"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8E4"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
<xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="4" fontId="3" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** ใส่ข้อความลง XML อย่างปลอดภัย (แปลง & < > " และตัดอักขระพิเศษที่ Excel ไม่รับ) */
function escapeXml(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** เลขคอลัมน์ → ตัวอักษรแบบ Excel: 0 → A, 1 → B, 25 → Z, 26 → AA */
function columnLetter(index: number): string {
  let letters = "";
  let n = index + 1;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

/** วันที่ JavaScript → เลขวันที่แบบ Excel (Excel นับวันตั้งแต่ปี 1900) */
function toExcelDate(d: Date): number {
  const localTime = d.getTime() - d.getTimezoneOffset() * 60000;
  return localTime / 86400000 + 25569;
}

/** เลือกสไตล์ของเซลล์ตามชนิดข้อมูลและรูปแบบคอลัมน์ */
function styleFor(value: Cell, column?: Column): number {
  if (value instanceof Date) {
    return column?.format === "day" ? STYLE.day : STYLE.date;
  }
  if (typeof value === "object" && value !== null) {
    if (value.format === "money") return STYLE.money;
    if (value.format === "money-bold") return STYLE.moneyBold;
    return STYLE.int;
  }
  if (typeof value === "number") {
    if (column?.format === "money") return STYLE.money;
    if (column?.format === "int") return STYLE.int;
  }
  return STYLE.text;
}

/** XML ของเซลล์ 1 ช่อง เช่น <c r="B3" s="3"><v>60</v></c> */
function cellXml(ref: string, value: Cell, column?: Column, forceStyle?: number): string {
  if (value === null || value === undefined || value === "") {
    return ""; // เซลล์ว่าง ไม่ต้องเขียน
  }
  const style = forceStyle ?? styleFor(value, column);

  if (value instanceof Date) {
    return `<c r="${ref}" s="${style}"><v>${toExcelDate(value)}</v></c>`;
  }
  if (typeof value === "object") {
    return `<c r="${ref}" s="${style}"><v>${value.value}</v></c>`;
  }
  if (typeof value === "number") {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  }
  // ข้อความ
  return `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

/** แถวที่เป็นหัวตาราง (ถ้ามีชื่อรายงาน หัวตารางอยู่แถว 3 ไม่งั้นแถว 1) */
function headerRowOf(sheet: Sheet): number {
  return sheet.title ? 3 : 1;
}

/** XML ของชีตทั้งแผ่น */
function sheetXml(sheet: Sheet): string {
  const rowsXml: string[] = [];
  const headerRow = headerRowOf(sheet);

  // แถว 1: ชื่อรายงาน (แล้วเว้นแถว 2 ว่างไว้)
  if (sheet.title) {
    rowsXml.push(`<row r="1" ht="24" customHeight="1">${cellXml("A1", sheet.title, undefined, STYLE.title)}</row>`);
  }

  // แถวหัวตาราง
  let headerCells = "";
  sheet.columns.forEach((col, i) => {
    headerCells += cellXml(`${columnLetter(i)}${headerRow}`, col.header, undefined, STYLE.header);
  });
  rowsXml.push(`<row r="${headerRow}" ht="22" customHeight="1">${headerCells}</row>`);

  // แถวข้อมูล
  sheet.rows.forEach((row, rowIndex) => {
    const r = headerRow + 1 + rowIndex;
    let cells = "";
    row.forEach((value, i) => {
      cells += cellXml(`${columnLetter(i)}${r}`, value, sheet.columns[i]);
    });
    rowsXml.push(`<row r="${r}">${cells}</row>`);
  });

  const lastColumn = columnLetter(sheet.columns.length - 1);
  const lastRow = headerRow + Math.max(sheet.rows.length, 1);

  // ความกว้างคอลัมน์
  let colsXml = "";
  sheet.columns.forEach((col, i) => {
    colsXml += `<col min="${i + 1}" max="${i + 1}" width="${col.width ?? 14}" customWidth="1"/>`;
  });

  // pane = ตรึงแถวหัวไว้ตอนเลื่อน · autoFilter = ปุ่มกรองที่หัวตาราง
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${colsXml}</cols>
<sheetData>${rowsXml.join("")}</sheetData>
<autoFilter ref="A${headerRow}:${lastColumn}${lastRow}"/>
</worksheet>`;
}

/** บอก Excel ว่าปุ่มกรองของชีตนี้ครอบช่วงไหน (ต้องใส่ใน workbook.xml) */
function filterNameXml(sheet: Sheet, index: number): string {
  const headerRow = headerRowOf(sheet);
  const lastColumn = columnLetter(sheet.columns.length - 1);
  const lastRow = headerRow + Math.max(sheet.rows.length, 1);
  const quotedName = `'${sheet.name.replace(/'/g, "''")}'`;
  return `<definedName name="_xlnm._FilterDatabase" localSheetId="${index}" hidden="1">${escapeXml(quotedName)}!$A$${headerRow}:$${lastColumn}$${lastRow}</definedName>`;
}

// =====================================================
// ส่วนที่ 2: รวมไฟล์เป็น zip (แบบไม่บีบอัด)
// ส่วนนี้เขียนตามรูปแบบไฟล์ zip มาตรฐาน — ไม่ต้องแก้
// =====================================================

/** ตารางช่วยคำนวณ CRC32 (รหัสตรวจความถูกต้องของไฟล์ใน zip) */
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE.push(c >>> 0);
}

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** ตัวช่วยเขียนตัวเลขลงไบต์ (zip เก็บตัวเลขแบบ little-endian) */
class ByteWriter {
  bytes: Uint8Array;
  private view: DataView;
  private pos = 0;
  constructor(size: number) {
    this.bytes = new Uint8Array(size);
    this.view = new DataView(this.bytes.buffer);
  }
  u16(n: number) { this.view.setUint16(this.pos, n, true); this.pos += 2; }
  u32(n: number) { this.view.setUint32(this.pos, n, true); this.pos += 4; }
  raw(data: Uint8Array) { this.bytes.set(data, this.pos); this.pos += data.length; }
}

function makeZip(files: { name: string; data: string }[]): Uint8Array {
  const encoder = new TextEncoder();
  const now = new Date();
  // zip เก็บวันเวลาแบบ DOS
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const UTF8_FLAG = 0x0800; // ชื่อไฟล์เป็น UTF-8

  const localParts: Uint8Array[] = [];   // ส่วนหัว + เนื้อไฟล์ของแต่ละไฟล์
  const directory: Uint8Array[] = [];    // สารบัญท้าย zip
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.data);
    const crc = crc32(data);

    // หัวไฟล์ (local file header)
    const local = new ByteWriter(30 + name.length);
    local.u32(0x04034b50); local.u16(20); local.u16(UTF8_FLAG); local.u16(0);
    local.u16(dosTime); local.u16(dosDate); local.u32(crc);
    local.u32(data.length); local.u32(data.length);
    local.u16(name.length); local.u16(0);
    local.raw(name);

    // รายการในสารบัญ (central directory)
    const entry = new ByteWriter(46 + name.length);
    entry.u32(0x02014b50); entry.u16(20); entry.u16(20); entry.u16(UTF8_FLAG); entry.u16(0);
    entry.u16(dosTime); entry.u16(dosDate); entry.u32(crc);
    entry.u32(data.length); entry.u32(data.length);
    entry.u16(name.length); entry.u16(0); entry.u16(0); entry.u16(0); entry.u16(0);
    entry.u32(0); entry.u32(offset);
    entry.raw(name);

    localParts.push(local.bytes, data);
    directory.push(entry.bytes);
    offset += local.bytes.length + data.length;
  }

  let directorySize = 0;
  for (const d of directory) directorySize += d.length;

  // ท้ายไฟล์ zip (end of central directory)
  const end = new ByteWriter(22);
  end.u32(0x06054b50); end.u16(0); end.u16(0);
  end.u16(files.length); end.u16(files.length);
  end.u32(directorySize); end.u32(offset); end.u16(0);

  // ต่อทุกส่วนเข้าด้วยกัน
  const parts = [...localParts, ...directory, end.bytes];
  let totalSize = 0;
  for (const p of parts) totalSize += p.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

// =====================================================
// ส่วนที่ 3: สร้างไฟล์ .xlsx และดาวน์โหลด
// =====================================================

/** สร้างไฟล์ .xlsx เป็นข้อมูลไบต์ */
export function buildXlsx(sheets: Sheet[]): Uint8Array {
  // ชื่อชีตห้ามมี \ / ? * [ ] : และยาวไม่เกิน 31 ตัว
  const safeSheets = sheets.map((sheet, i) => {
    const cleanName = sheet.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);
    return { ...sheet, name: cleanName || `Sheet${i + 1}` };
  });

  const sheetOverrides = safeSheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("\n");
  const sheetList = safeSheets
    .map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const filterNames = safeSheets.map((sheet, i) => filterNameXml(sheet, i)).join("");
  const sheetLinks = safeSheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join("\n");

  const files = [
    {
      // บอกว่าในไฟล์มีอะไรบ้าง
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetOverrides}
</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      // รายชื่อชีต
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetList}</sheets>
<definedNames>${filterNames}</definedNames>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheetLinks}
<Relationship Id="rId${safeSheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: "xl/styles.xml", data: STYLES },
  ];

  safeSheets.forEach((sheet, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(sheet) });
  });

  return makeZip(files);
}

/** สร้างไฟล์ .xlsx แล้วดาวน์โหลดทันที */
export function downloadXlsx(filename: string, sheets: Sheet[]) {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);

  // สร้างลิงก์ชั่วคราว แล้วสั่งคลิกเพื่อดาวน์โหลด
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * ชื่อไฟล์ที่มีวันที่ต่อท้าย เช่น smart-parking_entry-exit_2026-11-08_2235.xlsx
 * (ใช้ภาษาอังกฤษ เพราะบางเบราว์เซอร์ตั้งชื่อไฟล์ภาษาไทยไม่ได้)
 */
export function stampedName(base: string, d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}.xlsx`;
}
