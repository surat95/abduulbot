/**
 * แปลง HTML ของหน้า report/income-simple-daily เป็นตัวเลขยอดรวม
 *
 * เนื่องจากเราไม่ทราบโครงสร้าง HTML จริงล่วงหน้า จึงใช้หลายชั้น เรียงจากแม่นยำที่สุด:
 *   1. CSS selector ที่ผู้ใช้ตั้งเอง (CLINITER_TOTAL_SELECTOR) — แม่นที่สุด
 *   2. หาแถว/บรรทัดที่มีคำว่า "รวม"/"total" แล้วดึงตัวเลขในแถวนั้น
 *   3. รวมยอดคอลัมน์ตัวเลขคอลัมน์สุดท้ายของตารางที่ใหญ่ที่สุด
 * ถ้าชั้น 2-3 เดาผิด ให้ตั้ง selector ชั้น 1 ทับได้เลย
 */

import * as cheerio from 'cheerio';
import { parseAmount } from '../util/number.ts';
import type { IncomeBreakdownRow } from './types.ts';

export interface ParsedIncome {
  total: number;
  breakdown: IncomeBreakdownRow[];
  source: string;
}

export class IncomeParseError extends Error {}

/** คำที่บ่งบอกว่าแถวนั้นคือยอดรวม เรียงจากเจาะจงมากไปน้อย */
const TOTAL_KEYWORDS = [
  /รวมทั้งสิ้น/,
  /รวมสุทธิ/,
  /ยอดสุทธิ/,
  /ยอดรวมทั้งหมด/,
  /ยอดรวม/,
  /รวมทั้งหมด/,
  /grand\s*total/i,
  /net\s*total/i,
  /\btotal\b/i,
  /^\s*รวม\s*$/,
];

/** คำที่ไม่ใช่ยอดเงิน — กันไปหยิบ "รวมจำนวนคนไข้" มาเป็นยอด */
const NON_MONEY_HINT = /จำนวนคน|จำนวนคนไข้|จำนวนราย|คนไข้ทั้งหมด|patients?\b|visits?\b|count\b/i;

export function parseIncome(html: string, totalSelector?: string): ParsedIncome {
  const $ = cheerio.load(html);
  const breakdown = extractBreakdown($);

  if (totalSelector) {
    const total = fromSelector($, totalSelector);
    if (total === null) {
      throw new IncomeParseError(
        `CLINITER_TOTAL_SELECTOR = "${totalSelector}" หาตัวเลขไม่เจอบนหน้ารายงาน`,
      );
    }
    return { total, breakdown, source: `selector:${totalSelector}` };
  }

  const fromKeyword = findTotalByKeyword($);
  if (fromKeyword) return { ...fromKeyword, breakdown };

  const fromColumn = sumLastNumericColumn($);
  if (fromColumn) return { ...fromColumn, breakdown };

  throw new IncomeParseError(
    'อ่านยอดรวมจากหน้ารายงานไม่ได้ — รัน `npm run debug:dump` เพื่อดู HTML จริง ' +
      'แล้วตั้ง CLINITER_TOTAL_SELECTOR ให้ชี้ตรงจุด',
  );
}

function fromSelector($: cheerio.CheerioAPI, selector: string): number | null {
  const element = $(selector).first();
  if (element.length === 0) return null;
  // ถ้าเป็น input ให้อ่าน value ไม่ใช่ text
  const raw = element.is('input') ? (element.attr('value') ?? '') : element.text();
  return parseAmount(raw);
}

/** ชั้นที่ 2: หาแถวที่เขียนว่า "รวม" แล้วเอาตัวเลขในแถวนั้น */
function findTotalByKeyword($: cheerio.CheerioAPI): Omit<ParsedIncome, 'breakdown'> | null {
  for (const keyword of TOTAL_KEYWORDS) {
    const match = searchRowsFor($, keyword);
    if (match !== null) {
      return { total: match, source: `keyword:${keyword.source}` };
    }
  }
  return null;
}

function searchRowsFor($: cheerio.CheerioAPI, keyword: RegExp): number | null {
  const rows = $('tr').toArray();

  // ไล่จากแถวล่างขึ้นบน เพราะยอดรวมมักอยู่ท้ายตาราง
  for (const row of rows.reverse()) {
    const cells = $(row).find('td, th').toArray();
    if (cells.length < 2) continue;

    const rowText = collapse($(row).text());
    if (!keyword.test(rowText)) continue;
    if (NON_MONEY_HINT.test(rowText)) continue;

    // เอาตัวเลขตัวขวาสุดของแถว ซึ่งปกติคือยอดเงิน
    for (const cell of cells.reverse()) {
      const amount = parseAmount($(cell).text());
      if (amount !== null) return amount;
    }
  }

  // ไม่ได้อยู่ในตาราง — ลองหาในบล็อกทั่วไป เช่น การ์ดสรุปยอด
  const blocks = $('div, section, p, li, h1, h2, h3, h4, span').toArray();
  for (const block of blocks.reverse()) {
    const element = $(block);
    // ดูเฉพาะบล็อกใบสุดท้าย ไม่งั้นจะจับ <body> ทั้งก้อน
    if (element.children().length > 3) continue;

    const text = collapse(element.text());
    if (!text || text.length > 120) continue;
    if (!keyword.test(text)) continue;
    if (NON_MONEY_HINT.test(text)) continue;

    const amount = parseAmount(stripLabel(text, keyword));
    if (amount !== null) return amount;
  }

  return null;
}

/** ตัดคำว่า "ยอดรวม" ทิ้งก่อน parse เพื่อไม่ให้ตัวเลขในป้ายกำกับปนมา */
function stripLabel(text: string, keyword: RegExp): string {
  return text.replace(keyword, ' ');
}

/** ชั้นที่ 3: บวกคอลัมน์ตัวเลขคอลัมน์สุดท้ายของตารางที่มีแถวมากที่สุด */
function sumLastNumericColumn($: cheerio.CheerioAPI): Omit<ParsedIncome, 'breakdown'> | null {
  let bestTable: cheerio.Cheerio<any> | null = null;
  let bestRowCount = 0;

  $('table').each((_, table) => {
    const rowCount = $(table).find('tr').length;
    if (rowCount > bestRowCount) {
      bestRowCount = rowCount;
      bestTable = $(table);
    }
  });

  if (!bestTable || bestRowCount < 2) return null;

  const amounts: number[] = [];
  (bestTable as cheerio.Cheerio<any>).find('tbody tr, tr').each((_, row) => {
    const cells = $(row).find('td').toArray();
    if (cells.length === 0) return;
    for (const cell of cells.reverse()) {
      const amount = parseAmount($(cell).text());
      if (amount !== null) {
        amounts.push(amount);
        return;
      }
    }
  });

  if (amounts.length === 0) return null;

  const total = amounts.reduce((sum, value) => sum + value, 0);
  return { total, source: `sum-column:${amounts.length}rows` };
}

/**
 * ดึงรายการย่อยเพื่อแสดงในข้อความตอบกลับ
 * เป็นของแถม — ถ้าอ่านไม่ได้ก็แค่ไม่แสดง ไม่ทำให้ทั้งคำตอบพัง
 */
function extractBreakdown($: cheerio.CheerioAPI): IncomeBreakdownRow[] {
  const rows: IncomeBreakdownRow[] = [];

  $('table tr').each((_, row) => {
    const cells = $(row).find('td').toArray();
    if (cells.length < 2) return;

    const label = collapse($(cells[0]!).text());
    if (!label || label.length > 60) return;
    if (TOTAL_KEYWORDS.some((keyword) => keyword.test(label))) return;
    // ตัดแถวที่ไม่ใช่จำนวนเงินออก เช่น "รวมจำนวนคนไข้" จะได้ไม่โชว์เป็น "23.00 บาท"
    if (NON_MONEY_HINT.test(label)) return;

    let amount: number | null = null;
    for (const cell of [...cells].reverse()) {
      amount = parseAmount($(cell).text());
      if (amount !== null) break;
    }
    if (amount === null) return;

    rows.push({ label, amount });
  });

  return rows.slice(0, 12);
}

function collapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
