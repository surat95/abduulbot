/** ประกอบข้อความภาษาไทยที่อับดุลจะตอบกลับ */

import { formatThaiLongDate, formatThaiTime, type CalendarDate } from '../util/datetime.ts';
import { formatBaht } from '../util/number.ts';
import type { IncomeReport } from '../cliniter/types.ts';

export function incomeMessage(report: IncomeReport, label: string, timezone: string): string {
  const heading =
    label === 'วันนี้'
      ? `ยอดคลินิกวันนี้ (${formatThaiLongDate(report.date)})`
      : `ยอดคลินิก ${formatThaiLongDate(report.date)}`;

  const lines = [heading, '', `💰 ${formatBaht(report.total)}`];

  const breakdown = report.breakdown.filter((row) => row.amount !== 0).slice(0, 8);
  if (breakdown.length > 0) {
    lines.push('', 'รายละเอียด:');
    for (const row of breakdown) {
      lines.push(`• ${row.label}: ${formatBaht(row.amount)}`);
    }
  }

  if (label === 'วันนี้') {
    lines.push('', `ข้อมูล ณ ${formatThaiTime(timezone, report.fetchedAt)}`);
  }

  return lines.join('\n');
}

export function helpMessage(): string {
  return [
    'สวัสดีครับ ผมอับดุล 🦷',
    '',
    'ถามยอดรายได้คลินิกได้เลยครับ เช่น',
    '• "วันนี้ยอดเท่าไหร่"',
    '• "ยอดคลินิกวันนี้กี่บาท"',
    '• "ยอดเมื่อวาน"',
    '• "ยอดวันที่ 5/9"',
  ].join('\n');
}

export function unknownMessage(): string {
  return [
    'ขอโทษครับ ผมยังไม่เข้าใจคำถามนี้',
    '',
    'ลองถามว่า "วันนี้ยอดเท่าไหร่" หรือพิมพ์ "help" เพื่อดูคำสั่งทั้งหมดครับ',
  ].join('\n');
}

export function unauthorisedMessage(): string {
  return 'ขออภัยครับ บัญชีนี้ไม่มีสิทธิ์ดูข้อมูลรายได้ของคลินิก';
}

export function authErrorMessage(): string {
  return [
    'ผมเข้าระบบ Cliniter ไม่ได้ครับ 😥',
    'รบกวนตรวจสอบชื่อผู้ใช้/รหัสผ่านที่ตั้งไว้ใน environment variable ให้หน่อยครับ',
  ].join('\n');
}

export function fetchErrorMessage(): string {
  return [
    'ตอนนี้ผมดึงยอดจาก Cliniter ไม่ได้ครับ 😥',
    'อาจเป็นเพราะระบบ Cliniter ล่มชั่วคราว ลองถามใหม่อีกครั้งในสักครู่นะครับ',
  ].join('\n');
}

export function futureDateMessage(date: CalendarDate): string {
  return `${formatThaiLongDate(date)} ยังมาไม่ถึงครับ ยังไม่มียอดให้ดู`;
}
