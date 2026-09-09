import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import type { WebhookEvent } from '@line/bot-sdk';
import type { AppConfig } from '../src/config.ts';
import { EventHandler } from '../src/line/handler.ts';
import { CliniterAuthError } from '../src/cliniter/client.ts';
import type { IncomeReport } from '../src/cliniter/types.ts';

/** เก็บข้อความที่บอทจะส่ง แทนที่จะยิงไป LINE จริง */
function stubLine() {
  const sent: string[] = [];
  const client = {
    replyMessage: async ({ messages }: { messages: Array<{ text: string }> }) => {
      for (const message of messages) sent.push(message.text);
      return {};
    },
  };
  return { sent, client: client as never };
}

function stubCliniter(report: IncomeReport | Error) {
  return {
    getIncome: async () => {
      if (report instanceof Error) throw report;
      return report;
    },
  } as never;
}

const CONFIG: AppConfig = {
  port: 8080,
  timezone: 'Asia/Bangkok',
  logLevel: 'error',
  cacheTtlMs: 0,
  allowedUserIds: ['Uowner'],
  line: { channelSecret: 's', channelAccessToken: 't' },
  cliniter: {
    baseUrl: 'https://example.test',
    loginPath: '/login',
    reportPath: '/report/income-simple-daily',
    username: 'u',
    password: 'p',
    dateFormat: 'YYYY-MM-DD',
  },
};

const REPORT: IncomeReport = {
  date: { year: 2026, month: 9, day: 9 },
  total: 52550,
  breakdown: [
    { label: 'เงินสด', amount: 18400 },
    { label: 'โอน/QR', amount: 25150 },
  ],
  source: 'keyword:รวมทั้งสิ้น',
  fetchedAt: new Date('2026-09-09T07:05:00Z'),
};

function textEvent(text: string, userId = 'Uowner'): WebhookEvent {
  return {
    type: 'message',
    mode: 'active',
    timestamp: Date.now(),
    source: { type: 'user', userId },
    webhookEventId: 'evt',
    deliveryContext: { isRedelivery: false },
    replyToken: 'token',
    message: { id: '1', type: 'text', quoteToken: 'q', text },
  } as WebhookEvent;
}

describe('EventHandler', () => {
  it('ตอบยอดวันนี้พร้อมรายการย่อยและเวลาที่ดึงข้อมูล', async () => {
    const line = stubLine();
    await new EventHandler(CONFIG, stubCliniter(REPORT), line.client).handle(
      textEvent('วันนี้ยอดคลินิกของฉันกี่บาทแล้ว'),
    );

    assert.equal(line.sent.length, 1);
    const reply = line.sent[0]!;
    assert.match(reply, /52,550\.00 บาท/);
    assert.match(reply, /วันพุธที่ 9 กันยายน 2569/);
    assert.match(reply, /เงินสด: 18,400\.00 บาท/);
    assert.match(reply, /ข้อมูล ณ 14:05 น\./);
  });

  it('ปฏิเสธผู้ใช้ที่ไม่อยู่ใน allowlist และไม่แตะข้อมูลรายได้เลย', async () => {
    const line = stubLine();
    const cliniter = {
      getIncome: async () => {
        throw new Error('ไม่ควรถูกเรียกสำหรับผู้ใช้ที่ไม่มีสิทธิ์');
      },
    } as never;

    await new EventHandler(CONFIG, cliniter, line.client).handle(
      textEvent('ยอดวันนี้', 'Ustranger'),
    );

    assert.equal(line.sent.length, 1);
    assert.match(line.sent[0]!, /ไม่มีสิทธิ์/);
    assert.doesNotMatch(line.sent[0]!, /บาท/);
  });

  it('อนุญาตทุกคนเมื่อ allowlist ว่าง', async () => {
    const line = stubLine();
    const open = { ...CONFIG, allowedUserIds: [] };
    await new EventHandler(open, stubCliniter(REPORT), line.client).handle(
      textEvent('ยอดวันนี้', 'Uanyone'),
    );
    assert.match(line.sent[0]!, /52,550\.00 บาท/);
  });

  it('บอกว่าเข้าระบบไม่ได้ เมื่อล็อกอิน Cliniter ล้มเหลว', async () => {
    const line = stubLine();
    await new EventHandler(
      CONFIG,
      stubCliniter(new CliniterAuthError('รหัสผิด')),
      line.client,
    ).handle(textEvent('ยอดวันนี้'));

    assert.match(line.sent[0]!, /เข้าระบบ Cliniter ไม่ได้/);
    // ห้ามให้รายละเอียด error หลุดไปหาผู้ใช้ปลายทาง
    assert.doesNotMatch(line.sent[0]!, /รหัสผิด/);
  });

  it('บอกให้ลองใหม่ เมื่อดึงข้อมูลล้มเหลวชั่วคราว', async () => {
    const line = stubLine();
    await new EventHandler(CONFIG, stubCliniter(new Error('ECONNRESET')), line.client).handle(
      textEvent('ยอดวันนี้'),
    );
    assert.match(line.sent[0]!, /ลองถามใหม่/);
    assert.doesNotMatch(line.sent[0]!, /ECONNRESET/);
  });

  it('ไม่ดึงข้อมูลของวันในอนาคต', async () => {
    const line = stubLine();
    const cliniter = {
      getIncome: async () => {
        throw new Error('ไม่ควรถูกเรียกสำหรับวันในอนาคต');
      },
    } as never;

    // ปีหน้า — อยู่ในอนาคตแน่นอน
    const nextYear = new Date().getUTCFullYear() + 1;
    await new EventHandler(CONFIG, cliniter, line.client).handle(
      textEvent(`ยอดวันที่ 5/9/${nextYear}`),
    );
    assert.match(line.sent[0]!, /ยังมาไม่ถึง/);
  });

  it('ทักทายพร้อมวิธีใช้เมื่อมีคนเพิ่มเพื่อน', async () => {
    const line = stubLine();
    const follow = {
      type: 'follow',
      mode: 'active',
      timestamp: Date.now(),
      source: { type: 'user', userId: 'Uowner' },
      webhookEventId: 'evt',
      deliveryContext: { isRedelivery: false },
      replyToken: 'token',
    } as WebhookEvent;

    await new EventHandler(CONFIG, stubCliniter(REPORT), line.client).handle(follow);
    assert.match(line.sent[0]!, /ผมอับดุล/);
  });

  it('ไม่ตอบอะไรกับ event ที่ไม่ใช่ข้อความ', async () => {
    const line = stubLine();
    const sticker = {
      type: 'message',
      mode: 'active',
      timestamp: Date.now(),
      source: { type: 'user', userId: 'Uowner' },
      webhookEventId: 'evt',
      deliveryContext: { isRedelivery: false },
      replyToken: 'token',
      message: { id: '1', type: 'sticker', packageId: '1', stickerId: '1' },
    } as WebhookEvent;

    await new EventHandler(CONFIG, stubCliniter(REPORT), line.client).handle(sticker);
    assert.equal(line.sent.length, 0);
  });
});
