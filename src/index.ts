/** จุดเริ่มของบอทอับดุล: Express + LINE webhook */

import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { middleware, messagingApi, SignatureValidationFailed } from '@line/bot-sdk';
import type { WebhookEvent } from '@line/bot-sdk';
import { loadConfig } from './config.ts';
import { CliniterClient } from './cliniter/client.ts';
import { EventHandler } from './line/handler.ts';
import { errorMessage, logger } from './util/logger.ts';

function main(): void {
  const config = loadConfig();

  if (config.allowedUserIds.length === 0) {
    logger.warn(
      'ALLOWED_LINE_USER_IDS ว่าง — ใครที่เพิ่มเพื่อนกับ OA นี้ก็ดูยอดคลินิกได้ ' +
        'แนะนำให้ตั้งค่าเป็น userId ของคุณ',
    );
  }

  const cliniter = new CliniterClient(config.cliniter, config.cacheTtlMs, config.timezone);
  const lineClient = new messagingApi.MessagingApiClient({
    channelAccessToken: config.line.channelAccessToken,
  });
  const handler = new EventHandler(config, cliniter, lineClient);

  const app = express();
  app.disable('x-powered-by');

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // middleware ของ LINE ตรวจลายเซ็น X-Line-Signature ให้ — ต้องมาก่อน body parser
  app.post(
    '/webhook',
    middleware({ channelSecret: config.line.channelSecret }),
    (req, res) => {
      const events = (req.body as { events?: WebhookEvent[] }).events ?? [];

      // ตอบ 200 ทันที แล้วค่อยประมวลผลเบื้องหลัง
      // LINE จะ retry ถ้าเรารอนานเกิน ซึ่งจะทำให้ตอบซ้ำ
      res.status(200).end();

      for (const event of events) {
        handler.handle(event).catch((error: unknown) => {
          logger.error('จัดการ event ไม่สำเร็จ', { error: errorMessage(error) });
        });
      }
    },
  );

  // ลายเซ็นไม่ผ่าน = ไม่ได้มาจาก LINE ตอบ 401 ไปเงียบ ๆ ไม่ต้องโชว์ stack trace
  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    if (error instanceof SignatureValidationFailed) {
      logger.warn('ลายเซ็น webhook ไม่ถูกต้อง ปฏิเสธ request');
      res.status(401).json({ error: 'invalid signature' });
      return;
    }
    if (res.headersSent) {
      next(error);
      return;
    }
    logger.error('request ล้มเหลว', { error: errorMessage(error) });
    res.status(500).json({ error: 'internal error' });
  });

  app.listen(config.port, () => {
    logger.info('อับดุลพร้อมทำงานแล้ว', {
      port: config.port,
      timezone: config.timezone,
      cliniter: config.cliniter.baseUrl,
      allowlist: config.allowedUserIds.length,
    });
  });
}

try {
  main();
} catch (error) {
  logger.error('เริ่มระบบไม่สำเร็จ', { error: errorMessage(error) });
  process.exit(1);
}
