/** รับ event จาก LINE แล้วตอบกลับ */

import type { messagingApi, WebhookEvent } from '@line/bot-sdk';
import type { AppConfig } from '../config.ts';
import { CliniterAuthError, type CliniterClient } from '../cliniter/client.ts';
import { IncomeParseError } from '../cliniter/parse.ts';
import { todayIn } from '../util/datetime.ts';
import { errorMessage, logger } from '../util/logger.ts';
import { detectIntent } from './intent.ts';
import {
  authErrorMessage,
  fetchErrorMessage,
  futureDateMessage,
  helpMessage,
  incomeMessage,
  unauthorisedMessage,
  unknownMessage,
} from './messages.ts';

export class EventHandler {
  private readonly config: AppConfig;
  private readonly cliniter: CliniterClient;
  private readonly line: messagingApi.MessagingApiClient;

  constructor(
    config: AppConfig,
    cliniter: CliniterClient,
    line: messagingApi.MessagingApiClient,
  ) {
    this.config = config;
    this.cliniter = cliniter;
    this.line = line;
  }

  async handle(event: WebhookEvent): Promise<void> {
    if (event.type === 'follow') {
      await this.reply(event.replyToken, helpMessage());
      return;
    }

    if (event.type !== 'message' || event.message.type !== 'text') return;

    const userId = event.source.userId;
    if (!this.isAllowed(userId)) {
      logger.warn('unauthorized user', { userId: userId ?? 'unknown' });
      await this.reply(event.replyToken, unauthorisedMessage());
      return;
    }

    const text = event.message.text;
    const intent = detectIntent(text, this.config.timezone);
    logger.info('ได้รับข้อความ', { userId, intent: intent.kind, text });

    await this.reply(event.replyToken, await this.respondTo(intent));
  }

  private async respondTo(intent: ReturnType<typeof detectIntent>): Promise<string> {
    if (intent.kind === 'help') return helpMessage();
    if (intent.kind === 'unknown') return unknownMessage();

    const today = todayIn(this.config.timezone);
    const isFuture =
      new Date(Date.UTC(intent.date.year, intent.date.month - 1, intent.date.day)).getTime() >
      new Date(Date.UTC(today.year, today.month - 1, today.day)).getTime();
    if (isFuture) return futureDateMessage(intent.date);

    try {
      const report = await this.cliniter.getIncome(intent.date);
      return incomeMessage(report, intent.label, this.config.timezone);
    } catch (error) {
      if (error instanceof CliniterAuthError) {
        logger.error('ล็อกอิน Cliniter ไม่สำเร็จ', { error: errorMessage(error) });
        return authErrorMessage();
      }
      if (error instanceof IncomeParseError) {
        logger.error('parse ยอดไม่สำเร็จ', { error: errorMessage(error) });
        return fetchErrorMessage();
      }
      logger.error('ดึงยอดไม่สำเร็จ', { error: errorMessage(error) });
      return fetchErrorMessage();
    }
  }

  /** ปล่อยว่าง = ไม่จำกัดสิทธิ์ (มี warning ตอน start) */
  private isAllowed(userId: string | undefined): boolean {
    if (this.config.allowedUserIds.length === 0) return true;
    return userId !== undefined && this.config.allowedUserIds.includes(userId);
  }

  private async reply(replyToken: string, text: string): Promise<void> {
    try {
      await this.line.replyMessage({
        replyToken,
        messages: [{ type: 'text', text }],
      });
    } catch (error) {
      logger.error('ตอบกลับ LINE ไม่สำเร็จ', { error: errorMessage(error) });
    }
  }
}
