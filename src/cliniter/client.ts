/**
 * ตัวคุยกับระบบ Cliniter: ล็อกอิน เก็บ session แล้วดึงยอดรายวัน
 *
 * จัดการ session ให้เอง — ถ้าโดนเด้งกลับหน้า login ระหว่างดึงรายงาน
 * จะล็อกอินใหม่แล้วลองอีกครั้งโดยอัตโนมัติหนึ่งรอบ
 */

import type { CliniterConfig } from '../config.ts';
import { formatDate, isSameDate, todayIn, toISODate, type CalendarDate } from '../util/datetime.ts';
import { logger } from '../util/logger.ts';
import { CookieJar, request } from './http.ts';
import { detectLoginForm, looksLikeLoginPage } from './login-form.ts';
import { parseIncome } from './parse.ts';
import type { IncomeReport } from './types.ts';

export class CliniterAuthError extends Error {}

interface CacheEntry {
  report: IncomeReport;
  expiresAt: number;
}

export class CliniterClient {
  private readonly jar = new CookieJar();
  private loggedIn = false;
  /** กันไม่ให้ล็อกอินซ้อนกันหลายเส้นพร้อมกัน */
  private loginInFlight: Promise<void> | null = null;
  private readonly cache = new Map<string, CacheEntry>();

  private readonly config: CliniterConfig;
  private readonly cacheTtlMs: number;
  private readonly timezone: string;

  constructor(config: CliniterConfig, cacheTtlMs = 60_000, timezone = 'Asia/Bangkok') {
    this.config = config;
    this.cacheTtlMs = cacheTtlMs;
    this.timezone = timezone;
  }

  private url(path: string): string {
    return `${this.config.baseUrl}${path}`;
  }

  /** ล็อกอิน โดยอ่านฟอร์มจากหน้า login จริงเพื่อเก็บ CSRF token ไปด้วย */
  async login(): Promise<void> {
    // ถ้ามีคนกำลังล็อกอินอยู่ ให้รอเส้นนั้นแทนที่จะยิงซ้ำ
    if (this.loginInFlight) return this.loginInFlight;

    this.loginInFlight = this.performLogin().finally(() => {
      this.loginInFlight = null;
    });
    return this.loginInFlight;
  }

  private async performLogin(): Promise<void> {
    const loginUrl = this.url(this.config.loginPath);
    this.jar.clear();

    const page = await request(loginUrl, this.jar);
    if (page.status >= 400) {
      throw new CliniterAuthError(`เปิดหน้า login ไม่ได้ (HTTP ${page.status}) ที่ ${loginUrl}`);
    }

    const form = detectLoginForm(page.body, page.url, {
      usernameField: this.config.usernameField,
      passwordField: this.config.passwordField,
    });

    const payload = new URLSearchParams(form.fields);
    payload.set(form.usernameField, this.config.username);
    payload.set(form.passwordField, this.config.password);

    logger.debug('กำลังส่งฟอร์มล็อกอิน Cliniter', {
      action: form.action,
      usernameField: form.usernameField,
      passwordField: form.passwordField,
      // ไม่ log ค่า เพราะมีรหัสผ่านอยู่ log แค่ชื่อ field
      fields: Object.keys(form.fields),
    });

    const result = await request(form.action, this.jar, {
      method: form.method,
      body: payload.toString(),
      referer: page.url,
    });

    if (result.status >= 400) {
      throw new CliniterAuthError(
        `ล็อกอิน Cliniter ไม่สำเร็จ (HTTP ${result.status}) — ตรวจ CLINITER_USERNAME / CLINITER_PASSWORD`,
      );
    }

    // ยังเห็นช่อง password อยู่ = ยังไม่ผ่าน (รหัสผิด หรือ CSRF ไม่ผ่าน)
    if (looksLikeLoginPage(result.body)) {
      throw new CliniterAuthError(
        'ล็อกอิน Cliniter ไม่สำเร็จ — ระบบยังส่งหน้า login กลับมา ' +
          '(น่าจะรหัสผ่านไม่ถูก หรือชื่อ field ที่เดามาไม่ตรง)',
      );
    }

    if (this.jar.size === 0) {
      throw new CliniterAuthError('ล็อกอินแล้วแต่ไม่ได้รับ session cookie จาก Cliniter');
    }

    this.loggedIn = true;
    logger.info('ล็อกอิน Cliniter สำเร็จ');
  }

  /** ประกอบ URL ของหน้ารายงานสำหรับวันที่ที่ต้องการ */
  private reportUrl(date: CalendarDate): string {
    const base = this.url(this.config.reportPath);
    const isToday = isSameDate(date, todayIn(this.timezone));

    // หน้ารายงานเปล่า ๆ ปกติแสดงของวันนี้อยู่แล้ว จึงไม่ต้องใส่ query
    if (isToday && !this.config.reportQuery) return base;

    const template = this.config.reportQuery ?? 'date={date}';
    const query = template.replace(/\{date\}/g, formatDate(date, this.config.dateFormat));
    return `${base}${base.includes('?') ? '&' : '?'}${query}`;
  }

  private async fetchReportHtml(date: CalendarDate): Promise<string> {
    if (!this.loggedIn) await this.login();

    const url = this.reportUrl(date);
    let response = await request(url, this.jar, { referer: this.config.baseUrl });

    // session หมดอายุระหว่างทาง — ล็อกอินใหม่แล้วลองอีกรอบเดียว
    if (response.status === 401 || response.status === 403 || looksLikeLoginPage(response.body)) {
      logger.info('session Cliniter หมดอายุ กำลังล็อกอินใหม่');
      this.loggedIn = false;
      await this.login();
      response = await request(url, this.jar, { referer: this.config.baseUrl });
    }

    if (response.status >= 400) {
      throw new Error(`ดึงหน้ารายงานไม่สำเร็จ (HTTP ${response.status}) ที่ ${url}`);
    }
    if (looksLikeLoginPage(response.body)) {
      throw new CliniterAuthError('ล็อกอินใหม่แล้วยังเข้าหน้ารายงานไม่ได้');
    }

    return response.body;
  }

  /** ใช้ตอน debug: เอา HTML ดิบของหน้ารายงานมาดู */
  async fetchRawReport(date: CalendarDate = todayIn(this.timezone)): Promise<{ url: string; html: string }> {
    const html = await this.fetchReportHtml(date);
    return { url: this.reportUrl(date), html };
  }

  /** ยอดของวันที่ระบุ (ค่าเริ่มต้น = วันนี้ตามเวลาไทย) พร้อม cache สั้น ๆ */
  async getIncome(date: CalendarDate = todayIn(this.timezone)): Promise<IncomeReport> {
    const key = toISODate(date);
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('ตอบจาก cache', { date: key });
      return cached.report;
    }

    const html = await this.fetchReportHtml(date);
    const parsed = parseIncome(html, this.config.totalSelector);

    const report: IncomeReport = {
      date,
      total: parsed.total,
      breakdown: parsed.breakdown,
      source: parsed.source,
      fetchedAt: new Date(),
    };

    this.cache.set(key, { report, expiresAt: Date.now() + this.cacheTtlMs });
    logger.info('ดึงยอดสำเร็จ', { date: key, total: parsed.total, source: parsed.source });

    return report;
  }
}
