/**
 * ตีความข้อความภาษาไทยที่ผู้ใช้พิมพ์มาหาอับดุล
 *
 * ตั้งใจใช้ regex ตรง ๆ ไม่ต้องพึ่ง NLU เพราะขอบเขตคำถามแคบมาก
 * (ถามยอดรายวัน) และแบบนี้ตอบเร็ว ไม่มีค่าใช้จ่ายต่อข้อความ
 */

import { addDays, todayIn, type CalendarDate } from '../util/datetime.ts';

export type Intent =
  | { kind: 'income'; date: CalendarDate; label: 'วันนี้' | 'เมื่อวาน' | 'วันที่ระบุ' }
  | { kind: 'help' }
  | { kind: 'unknown' };

const INCOME_HINT =
  /ยอด|รายได้|รายรับ|เงิน|กี่บาท|ได้เท่าไหร่|ได้เท่าไร|เท่าไหร่แล้ว|income|revenue|sales?\b/i;
const CLINIC_HINT = /คลินิก|clinic|วันนี้|เมื่อวาน|วันที่/i;
const YESTERDAY_HINT = /เมื่อวาน|เมื่อวานนี้|yesterday/i;
const TODAY_HINT = /วันนี้|ตอนนี้|today|วันนี้แล้ว/i;
const HELP_HINT = /^\s*(help|ช่วย|ช่วยเหลือ|วิธีใช้|ทำอะไรได้บ้าง|คำสั่ง|เมนู|\?|help me)\s*$/i;

/** เช่น "ยอดวันที่ 5" หรือ "ยอด 5/9" หรือ "ยอด 5/9/2569" */
const EXPLICIT_DATE =
  /(?:วันที่\s*)?(\d{1,2})\s*[/\-.]\s*(\d{1,2})(?:\s*[/\-.]\s*(\d{2,4}))?|วันที่\s*(\d{1,2})(?!\s*[/\-.])/;

export function detectIntent(
  text: string,
  timezone = 'Asia/Bangkok',
  now: Date = new Date(),
): Intent {
  const message = text.trim();
  if (!message) return { kind: 'unknown' };

  if (HELP_HINT.test(message)) return { kind: 'help' };

  const asksAboutIncome = INCOME_HINT.test(message) || CLINIC_HINT.test(message);
  if (!asksAboutIncome) return { kind: 'unknown' };

  const today = todayIn(timezone, now);

  if (YESTERDAY_HINT.test(message)) {
    return { kind: 'income', date: addDays(today, -1), label: 'เมื่อวาน' };
  }

  const explicit = parseExplicitDate(message, today);
  if (explicit) return { kind: 'income', date: explicit, label: 'วันที่ระบุ' };

  // ไม่ระบุวัน หรือระบุว่า "วันนี้" ก็ตอบยอดวันนี้
  if (TODAY_HINT.test(message) || INCOME_HINT.test(message)) {
    return { kind: 'income', date: today, label: 'วันนี้' };
  }

  return { kind: 'unknown' };
}

function parseExplicitDate(message: string, today: CalendarDate): CalendarDate | null {
  const match = EXPLICIT_DATE.exec(message);
  if (!match) return null;

  // รูปแบบ "วันที่ 5" — วัน อย่างเดียว ใช้เดือน/ปีปัจจุบัน
  if (match[4]) {
    const day = Number.parseInt(match[4], 10);
    return isValidDate(today.year, today.month, day)
      ? { year: today.year, month: today.month, day }
      : null;
  }

  if (!match[1] || !match[2]) return null;

  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = match[3] ? normaliseYear(Number.parseInt(match[3], 10), today.year) : today.year;

  return isValidDate(year, month, day) ? { year, month, day } : null;
}

/** รับได้ทั้ง ค.ศ. 4 หลัก, พ.ศ. 4 หลัก และปี 2 หลัก */
function normaliseYear(value: number, currentYear: number): number {
  if (value > 2400) return value - 543; // พ.ศ. -> ค.ศ.
  if (value >= 1900) return value;
  if (value < 100) {
    // "68" = พ.ศ. 2568, "25" = ค.ศ. 2025
    const asBuddhist = 2500 + value - 543;
    const asGregorian = 2000 + value;
    return Math.abs(asBuddhist - currentYear) <= Math.abs(asGregorian - currentYear)
      ? asBuddhist
      : asGregorian;
  }
  return value;
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}
