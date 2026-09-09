/**
 * ทดสอบว่าดึงยอดได้จริงไหม โดยไม่ต้องผ่าน LINE
 *
 *   npm run check:income           # วันนี้
 *   npm run check:income -- 2026-09-05
 */

import { loadCliniterConfig } from '../src/config.ts';
import { CliniterClient } from '../src/cliniter/client.ts';
import { formatThaiLongDate, todayIn, type CalendarDate } from '../src/util/datetime.ts';
import { formatBaht } from '../src/util/number.ts';
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
  const report = await client.getIncome(parseArgDate(process.argv[2], timezone));

  console.log(`\n${formatThaiLongDate(report.date)}`);
  console.log(`ยอดรวม : ${formatBaht(report.total)}`);
  console.log(`อ่านจาก : ${report.source}`);

  if (report.breakdown.length > 0) {
    console.log('\nรายการย่อยที่อ่านได้:');
    for (const row of report.breakdown) {
      console.log(`  • ${row.label}: ${formatBaht(row.amount)}`);
    }
  }

  console.log('\n⚠️  กรุณาเทียบตัวเลขนี้กับหน้าเว็บ Cliniter จริงก่อนใช้งานจริง');
}

main().catch((error: unknown) => {
  console.error(`\n❌ ล้มเหลว: ${errorMessage(error)}`);
  process.exit(1);
});
