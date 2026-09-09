import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  addDays,
  formatDate,
  formatThaiLongDate,
  formatThaiTime,
  isSameDate,
  todayIn,
  toISODate,
} from '../src/util/datetime.ts';

describe('todayIn', () => {
  it('ใช้เวลาไทย ไม่ใช่ UTC', () => {
    // 17:30 UTC = 00:30 ของวันถัดไปตามเวลาไทย
    assert.equal(toISODate(todayIn('Asia/Bangkok', new Date('2026-09-09T17:30:00Z'))), '2026-09-10');
    assert.equal(toISODate(todayIn('UTC', new Date('2026-09-09T17:30:00Z'))), '2026-09-09');
  });
});

describe('addDays', () => {
  it('ข้ามเดือนและปีได้ถูกต้อง', () => {
    assert.equal(toISODate(addDays({ year: 2026, month: 9, day: 1 }, -1)), '2026-08-31');
    assert.equal(toISODate(addDays({ year: 2026, month: 12, day: 31 }, 1)), '2027-01-01');
    assert.equal(toISODate(addDays({ year: 2028, month: 2, day: 28 }, 1)), '2028-02-29');
  });
});

describe('formatDate', () => {
  const date = { year: 2026, month: 9, day: 5 };

  it('รองรับ pattern ที่ Cliniter อาจใช้', () => {
    assert.equal(formatDate(date, 'YYYY-MM-DD'), '2026-09-05');
    assert.equal(formatDate(date, 'DD/MM/YYYY'), '05/09/2026');
    assert.equal(formatDate(date, 'DD/MM/BBBB'), '05/09/2569');
  });
});

describe('formatThaiLongDate', () => {
  it('แสดงวันในสัปดาห์และปี พ.ศ.', () => {
    assert.equal(formatThaiLongDate({ year: 2026, month: 9, day: 9 }), 'วันพุธที่ 9 กันยายน 2569');
  });
});

describe('formatThaiTime', () => {
  it('แปลงเป็นเวลาไทยแบบ 24 ชั่วโมง', () => {
    assert.equal(formatThaiTime('Asia/Bangkok', new Date('2026-09-09T07:05:00Z')), '14:05 น.');
  });
});

describe('isSameDate', () => {
  it('เทียบวันที่แบบตรงทุกส่วน', () => {
    assert.equal(isSameDate({ year: 2026, month: 9, day: 9 }, { year: 2026, month: 9, day: 9 }), true);
    assert.equal(isSameDate({ year: 2026, month: 9, day: 9 }, { year: 2026, month: 9, day: 8 }), false);
  });
});
