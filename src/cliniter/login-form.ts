/**
 * ตรวจจับฟอร์มล็อกอินจาก HTML โดยอัตโนมัติ
 *
 * เขียนแบบนี้เพราะเราไม่ทราบชื่อ field จริงของ Cliniter ล่วงหน้า และระบบส่วนใหญ่
 * (Laravel/CodeIgniter) ยังมี CSRF token ซ่อนอยู่ซึ่งต้องส่งกลับไปด้วย
 * ถ้าเดาผิด ตั้ง CLINITER_USERNAME_FIELD / CLINITER_PASSWORD_FIELD ทับได้
 */

import * as cheerio from 'cheerio';

export interface DetectedLoginForm {
  /** URL ปลายทางที่ต้อง POST */
  action: string;
  method: 'GET' | 'POST';
  /** ทุก field ที่เบราว์เซอร์จะส่ง รวม hidden/CSRF token */
  fields: Record<string, string>;
  usernameField: string;
  passwordField: string;
}

export interface DetectOptions {
  usernameField?: string;
  passwordField?: string;
}

const USERNAME_NAME_HINT = /user|email|login|account|uname|staff|member|phone|tel/i;

export function detectLoginForm(
  html: string,
  pageUrl: string,
  options: DetectOptions = {},
): DetectedLoginForm {
  const $ = cheerio.load(html);

  // ฟอร์มล็อกอินคือฟอร์มที่มีช่อง password
  const passwordInput = $('form input[type="password"]').first();
  if (passwordInput.length === 0) {
    throw new Error(
      'หาฟอร์มล็อกอินไม่เจอ (ไม่พบ input[type=password] ในหน้า) ' +
        '— ลองตรวจ CLINITER_LOGIN_PATH ว่าชี้ถูกหน้าหรือไม่',
    );
  }

  const form = passwordInput.closest('form');
  const fields: Record<string, string> = {};

  form.find('input').each((_, element) => {
    const input = $(element);
    const name = input.attr('name');
    if (!name) return;

    const type = (input.attr('type') ?? 'text').toLowerCase();
    if (type === 'button' || type === 'reset' || type === 'file' || type === 'image') return;
    // เบราว์เซอร์ส่ง checkbox/radio เฉพาะที่ถูกติ๊กไว้
    if ((type === 'checkbox' || type === 'radio') && input.attr('checked') === undefined) return;

    fields[name] = input.attr('value') ?? '';
  });

  form.find('select').each((_, element) => {
    const select = $(element);
    const name = select.attr('name');
    if (!name) return;
    const selected = select.find('option[selected]').first();
    const option = selected.length > 0 ? selected : select.find('option').first();
    fields[name] = option.attr('value') ?? option.text().trim();
  });

  form.find('textarea').each((_, element) => {
    const name = $(element).attr('name');
    if (name) fields[name] = $(element).text();
  });

  const passwordField = options.passwordField ?? passwordInput.attr('name');
  if (!passwordField) {
    throw new Error(
      'ช่อง password ในฟอร์มไม่มี attribute name — ตั้ง CLINITER_PASSWORD_FIELD เองครับ',
    );
  }

  const usernameField = options.usernameField ?? findUsernameField($, form, passwordField);
  if (!usernameField) {
    throw new Error(
      'เดาช่อง username ไม่ได้ — ตั้ง CLINITER_USERNAME_FIELD เองครับ ' +
        `(field ที่เจอในฟอร์ม: ${Object.keys(fields).join(', ') || 'ไม่มีเลย'})`,
    );
  }

  // ให้แน่ใจว่าสองช่องนี้มีอยู่เสมอ แม้ auto-detect จะไม่เจอใน HTML
  fields[usernameField] ??= '';
  fields[passwordField] ??= '';

  const rawAction = form.attr('action')?.trim();
  const action = rawAction ? new URL(rawAction, pageUrl).toString() : pageUrl;
  const method = (form.attr('method') ?? 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST';

  return { action, method, fields, usernameField, passwordField };
}

function findUsernameField(
  $: cheerio.CheerioAPI,
  form: cheerio.Cheerio<any>,
  passwordField: string,
): string | undefined {
  const candidates: string[] = [];

  form.find('input').each((_, element) => {
    const input = $(element);
    const name = input.attr('name');
    if (!name || name === passwordField) return;
    const type = (input.attr('type') ?? 'text').toLowerCase();
    if (!['text', 'email', 'tel', 'search', ''].includes(type)) return;
    candidates.push(name);
  });

  // เลือกช่องที่ชื่อบ่งบอกว่าเป็น username ก่อน ถ้าไม่มีค่อยเอาช่องข้อความช่องแรก
  return candidates.find((name) => USERNAME_NAME_HINT.test(name)) ?? candidates[0];
}

/** หน้าที่ยังมีช่อง password = ยังไม่ได้ล็อกอิน (หรือ session หมดอายุ) */
export function looksLikeLoginPage(html: string): boolean {
  return /<input[^>]+type=["']?password/i.test(html);
}
