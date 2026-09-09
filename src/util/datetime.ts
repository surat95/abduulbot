/**
 * จัดการวันที่แบบ "ปฏิทิน" (ปี/เดือน/วัน) ไม่ผูกกับ timezone ของเซิร์ฟเวอร์
 *
 * เหตุผล: เซิร์ฟเวอร์มักรันเป็น UTC ถ้าใช้ Date ตรง ๆ คำว่า "วันนี้" จะเพี้ยน
 * ช่วงเที่ยงคืนถึงตี 7 ตามเวลาไทย ซึ่งเป็นช่วงที่ยอดควรจะยังเป็นของเมื่อวาน
 */

export const BANGKOK_TZ = 'Asia/Bangkok';

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

/** วันที่ปัจจุบันตามเวลาไทย */
export function todayIn(timeZone: string = BANGKOK_TZ, now: Date = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const pick = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    if (!found) throw new Error(`ไม่พบส่วน "${type}" ของวันที่จาก timezone ${timeZone}`);
    return Number.parseInt(found.value, 10);
  };

  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

/** บวก/ลบวัน โดยยืม UTC มาคำนวณเพื่อให้ข้ามเดือน-ปีถูกต้อง */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function isSameDate(a: CalendarDate, b: CalendarDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** คีย์สำหรับใช้ใน cache / เปรียบเทียบ */
export function toISODate(date: CalendarDate): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return `${date.year}-${mm}-${dd}`;
}

/**
 * ฟอร์แมตวันที่ตาม pattern ที่ Cliniter ต้องการ
 * รองรับ YYYY (ค.ศ.), BBBB (พ.ศ.), MM, DD
 */
export function formatDate(date: CalendarDate, pattern: string): string {
  const mm = String(date.month).padStart(2, '0');
  const dd = String(date.day).padStart(2, '0');
  return pattern
    .replace(/BBBB/g, String(date.year + 543))
    .replace(/YYYY/g, String(date.year))
    .replace(/MM/g, mm)
    .replace(/DD/g, dd);
}

const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

const THAI_WEEKDAYS = [
  'อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์',
] as const;

/** เช่น "วันอังคารที่ 9 กันยายน 2569" (พ.ศ.) */
export function formatThaiLongDate(date: CalendarDate): string {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const weekday = THAI_WEEKDAYS[utc.getUTCDay()] ?? '';
  const month = THAI_MONTHS[date.month - 1] ?? '';
  return `วัน${weekday}ที่ ${date.day} ${month} ${date.year + 543}`;
}

/** เวลาปัจจุบันแบบ "14:35 น." ตามเวลาไทย */
export function formatThaiTime(timeZone: string = BANGKOK_TZ, now: Date = new Date()): string {
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return `${formatted} น.`;
}
