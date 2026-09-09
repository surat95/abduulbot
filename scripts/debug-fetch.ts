/**
 * ดัมพ์ HTML จริงของหน้ารายงานออกมาเป็นไฟล์ เพื่อหา CSS selector ของยอดรวม
 *
 *   npm run debug:dump             # วันนี้
 *   npm run debug:dump -- 2026-09-05
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { loadCliniterConfig } from '../src/config.ts';
import { CliniterClient } from '../src/cliniter/client.ts';
import { todayIn, toISODate, type CalendarDate } from '../src/util/datetime.ts';
import { errorMessage } from '../src/util/logger.ts';

function parseArgDate(raw: string | undefined, timezone: string): CalendarDate {
  if (!raw) return todayIn(timezone);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) throw new Error(`รูปแบบวันที่ต้องเป็น YYYY-MM-DD แต่ได้ "${raw}"`);
  return {
    year: Number.parseInt(match[1]!, 10),
    month: Number.parseInt(match[2]!, 10),
    day: Number.parseInt(match[3]!, 10),
  };
}

async function main(): Promise<void> {
  const timezone = process.env.TZ ?? 'Asia/Bangkok';
  const config = loadCliniterConfig();
  const client = new CliniterClient(config, 0, timezone);
  const date = parseArgDate(process.argv[2], timezone);

  console.log(`กำลังล็อกอินและดึงหน้ารายงานของวันที่ ${toISODate(date)} ...`);
  const { url, html } = await client.fetchRawReport(date);

  await mkdir('debug-output', { recursive: true });
  const file = `debug-output/report-${toISODate(date)}.html`;
  await writeFile(file, html, 'utf8');

  console.log(`\n✅ สำเร็จ`);
  console.log(`   URL ที่ดึง : ${url}`);
  console.log(`   ขนาด      : ${html.length.toLocaleString()} ตัวอักษร`);
  console.log(`   บันทึกที่  : ${file}`);
  console.log(`\nเปิดไฟล์นี้ในเบราว์เซอร์ หา "ยอดรวม" แล้วดูว่าอยู่ใน element ไหน`);
  console.log(`จากนั้นตั้ง CLINITER_TOTAL_SELECTOR ให้ชี้ไปที่ element นั้น`);
}

main().catch((error: unknown) => {
  console.error(`\n❌ ล้มเหลว: ${errorMessage(error)}`);
  process.exit(1);
});
