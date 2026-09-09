import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detectIntent } from '../src/line/intent.ts';
import { toISODate } from '../src/util/datetime.ts';

// 2026-09-09 07:00 UTC = 2026-09-09 14:00 ตามเวลาไทย
const NOW = new Date('2026-09-09T07:00:00Z');
const TZ = 'Asia/Bangkok';

function income(text: string) {
  const intent = detectIntent(text, TZ, NOW);
  assert.equal(intent.kind, 'income', `คาดว่าเป็น income แต่ได้ ${intent.kind} จาก "${text}"`);
  return intent as Extract<ReturnType<typeof detectIntent>, { kind: 'income' }>;
}

describe('detectIntent', () => {
  it('เข้าใจคำถามยอดวันนี้หลายรูปแบบ', () => {
    for (const text of [
      'วันนี้ยอดคลินิกของฉันกี่บาทแล้ว',
      'วันนี้ยอดเท่าไหร่',
      'ยอดวันนี้',
      'ยอดคลินิกวันนี้กี่บาท',
      'รายได้วันนี้ได้เท่าไร',
      'income today',
    ]) {
      const intent = income(text);
      assert.equal(toISODate(intent.date), '2026-09-09', text);
      assert.equal(intent.label, 'วันนี้', text);
    }
  });

  it('เข้าใจคำถามยอดเมื่อวาน', () => {
    const intent = income('ยอดเมื่อวานเท่าไหร่');
    assert.equal(toISODate(intent.date), '2026-09-08');
    assert.equal(intent.label, 'เมื่อวาน');
  });

  it('เข้าใจวันที่ที่ระบุแบบ วัน/เดือน', () => {
    const intent = income('ยอดวันที่ 5/9');
    assert.equal(toISODate(intent.date), '2026-09-05');
    assert.equal(intent.label, 'วันที่ระบุ');
  });

  it('เข้าใจวันที่แบบระบุวันอย่างเดียว', () => {
    assert.equal(toISODate(income('ยอดวันที่ 3').date), '2026-09-03');
  });

  it('แปลงปี พ.ศ. เป็น ค.ศ. ให้ถูกต้อง', () => {
    assert.equal(toISODate(income('ยอด 5/9/2569').date), '2026-09-05');
    assert.equal(toISODate(income('ยอด 5/9/2026').date), '2026-09-05');
  });

  it('ใช้เวลาไทยตัดสินว่าวันไหนคือวันนี้ ไม่ใช่ UTC', () => {
    // 2026-09-09 18:30 UTC = 2026-09-10 01:30 ตามเวลาไทย -> ต้องเป็นวันที่ 10
    const lateNight = new Date('2026-09-09T18:30:00Z');
    const intent = detectIntent('ยอดวันนี้', TZ, lateNight);
    assert.equal(intent.kind, 'income');
    assert.equal(toISODate((intent as any).date), '2026-09-10');
  });

  it('ตอบ help เมื่อผู้ใช้ขอความช่วยเหลือ', () => {
    assert.equal(detectIntent('help', TZ, NOW).kind, 'help');
    assert.equal(detectIntent('ทำอะไรได้บ้าง', TZ, NOW).kind, 'help');
  });

  it('ตอบ unknown เมื่อไม่เกี่ยวกับยอด', () => {
    assert.equal(detectIntent('สวัสดีครับ', TZ, NOW).kind, 'unknown');
    assert.equal(detectIntent('', TZ, NOW).kind, 'unknown');
  });
});
