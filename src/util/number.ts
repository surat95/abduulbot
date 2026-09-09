/** แปลงข้อความเป็นตัวเลข และฟอร์แมตกลับเป็นเงินบาท */

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** แปลงเลขไทย ๐-๙ เป็นเลขอารบิก */
export function normaliseDigits(input: string): string {
  return input.replace(/[๐-๙]/g, (char) => String(THAI_DIGITS.indexOf(char)));
}

/**
 * ดึงตัวเลขออกจากข้อความในเซลล์ตาราง เช่น "฿ 12,345.50", "12.345,50", "(1,200)"
 * คืน null ถ้าไม่มีตัวเลขที่ใช้ได้จริง
 */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;

  const text = normaliseDigits(raw).trim();
  // วงเล็บในรายงานบัญชี = ค่าติดลบ
  const isNegative = /^\(.*\)$/.test(text) || text.includes('-');

  // เก็บเฉพาะตัวเลข จุด และคอมมา
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalised: string;
  if (lastComma === -1 && lastDot === -1) {
    normalised = cleaned;
  } else if (lastComma > lastDot) {
    // คอมมาอยู่หลังสุด — เป็นตัวคั่นหลักพัน ("12,345") หรือทศนิยมแบบยุโรป ("12.345,50")?
    // ถ้าไม่มีจุดเลย และหลังคอมมามีเลข 3 ตัวพอดี ให้ถือว่าเป็นตัวคั่นหลักพัน
    const digitsAfterComma = cleaned.length - lastComma - 1;
    if (lastDot === -1 && digitsAfterComma === 3) {
      normalised = cleaned.replace(/,/g, '');
    } else {
      // ยุโรป: ทิ้งจุด (ตัวคั่นหลักพัน) แล้วให้คอมมาตัวสุดท้ายเป็นจุดทศนิยม
      normalised =
        cleaned.slice(0, lastComma).replace(/[.,]/g, '') + '.' + cleaned.slice(lastComma + 1);
    }
  } else {
    // ไทย/อังกฤษ: 12,345.50 -> คอมมาคือตัวคั่นหลักพัน
    normalised = cleaned.replace(/,/g, '');
  }

  // กันกรณีมีจุดหลายตัว (เช่น 1.234.567) ให้ถือว่าจุดเป็นตัวคั่นหลักพัน
  const dotCount = (normalised.match(/\./g) ?? []).length;
  if (dotCount > 1) normalised = normalised.replace(/\./g, '');

  const value = Number.parseFloat(normalised);
  if (!Number.isFinite(value)) return null;

  return isNegative ? -Math.abs(value) : value;
}

/** "12,345.50 บาท" */
export function formatBaht(amount: number): string {
  const formatted = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${formatted} บาท`;
}

/** "12,345" — ใช้กับจำนวนนับ เช่น จำนวนคนไข้ */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('th-TH').format(value);
}
