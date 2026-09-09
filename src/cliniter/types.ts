import type { CalendarDate } from '../util/datetime.ts';

export interface IncomeBreakdownRow {
  label: string;
  amount: number;
}

export interface IncomeReport {
  date: CalendarDate;
  /** ยอดรวมทั้งวัน (บาท) */
  total: number;
  /** รายการย่อย เช่น แยกตามช่องทางชำระเงิน — อาจว่างถ้าอ่านไม่ได้ */
  breakdown: IncomeBreakdownRow[];
  /** อธิบายว่าตัวเลขนี้มาจากวิธีไหน ใช้ตอน debug */
  source: string;
  fetchedAt: Date;
}
