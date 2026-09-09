import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { detectLoginForm, looksLikeLoginPage } from '../src/cliniter/login-form.ts';
import { CookieJar } from '../src/cliniter/http.ts';

const PAGE_URL = 'https://example.test/login';

describe('detectLoginForm', () => {
  it('อ่านฟอร์มแบบ Laravel พร้อม CSRF token', () => {
    const html = `
      <form method="POST" action="/login">
        <input type="hidden" name="_token" value="abc123">
        <input type="text" name="username" value="">
        <input type="password" name="password">
        <input type="checkbox" name="remember">
        <button type="submit">เข้าสู่ระบบ</button>
      </form>`;

    const form = detectLoginForm(html, PAGE_URL);
    assert.equal(form.action, 'https://example.test/login');
    assert.equal(form.method, 'POST');
    assert.equal(form.usernameField, 'username');
    assert.equal(form.passwordField, 'password');
    assert.equal(form.fields._token, 'abc123');
    // checkbox ที่ไม่ได้ติ๊กไว้ต้องไม่ถูกส่ง เหมือนที่เบราว์เซอร์ทำ
    assert.equal('remember' in form.fields, false);
  });

  it('ส่ง checkbox ที่ถูกติ๊กไว้ล่วงหน้า', () => {
    const html = `
      <form action="/auth"><input type="password" name="pw">
      <input type="text" name="user"><input type="checkbox" name="remember" value="1" checked></form>`;
    assert.equal(detectLoginForm(html, PAGE_URL).fields.remember, '1');
  });

  it('เดาช่อง username จากชื่อที่สื่อความหมาย ไม่ใช่ช่องแรกเสมอไป', () => {
    const html = `
      <form action="/auth">
        <input type="text" name="clinic_code">
        <input type="email" name="user_email">
        <input type="password" name="pass">
      </form>`;
    assert.equal(detectLoginForm(html, PAGE_URL).usernameField, 'user_email');
  });

  it('ให้ค่าที่ตั้งเองใน env ชนะการเดา', () => {
    const html = `<form action="/auth"><input type="text" name="a"><input type="password" name="b"></form>`;
    const form = detectLoginForm(html, PAGE_URL, {
      usernameField: 'login_id',
      passwordField: 'secret',
    });
    assert.equal(form.usernameField, 'login_id');
    assert.equal(form.passwordField, 'secret');
    // field ที่ตั้งเองต้องมีอยู่ใน payload เสมอ
    assert.equal(form.fields.login_id, '');
    assert.equal(form.fields.secret, '');
  });

  it('ใช้ URL ของหน้าเองเมื่อฟอร์มไม่ระบุ action', () => {
    const html = `<form><input type="text" name="u"><input type="password" name="p"></form>`;
    assert.equal(detectLoginForm(html, PAGE_URL).action, PAGE_URL);
  });

  it('โยน error ที่อธิบายได้เมื่อไม่พบฟอร์มล็อกอิน', () => {
    assert.throws(() => detectLoginForm('<p>ไม่มีฟอร์ม</p>', PAGE_URL), /หาฟอร์มล็อกอินไม่เจอ/);
  });
});

describe('looksLikeLoginPage', () => {
  it('ตรวจเจอหน้า login จากช่อง password', () => {
    assert.equal(looksLikeLoginPage('<input type="password" name="p">'), true);
    assert.equal(looksLikeLoginPage("<input type=password>"), true);
    assert.equal(looksLikeLoginPage('<table><tr><td>ยอดรวม</td></tr></table>'), false);
  });
});

describe('CookieJar', () => {
  function headersWith(...cookies: string[]): Headers {
    const headers = new Headers();
    for (const cookie of cookies) headers.append('set-cookie', cookie);
    return headers;
  }

  it('เก็บ cookie จาก Set-Cookie แล้วประกอบเป็น header เดียว', () => {
    const jar = new CookieJar();
    jar.absorb(headersWith('session=abc; Path=/; HttpOnly', 'XSRF-TOKEN=xyz; Path=/'));
    assert.equal(jar.get('session'), 'abc');
    assert.equal(jar.header(), 'session=abc; XSRF-TOKEN=xyz');
  });

  it('เขียนทับ cookie ชื่อเดิมด้วยค่าใหม่', () => {
    const jar = new CookieJar();
    jar.absorb(headersWith('session=old; Path=/'));
    jar.absorb(headersWith('session=new; Path=/'));
    assert.equal(jar.get('session'), 'new');
  });

  it('ลบ cookie เมื่อเซิร์ฟเวอร์ส่งค่าว่างกลับมา', () => {
    const jar = new CookieJar();
    jar.absorb(headersWith('session=abc'));
    jar.absorb(headersWith('session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT'));
    assert.equal(jar.get('session'), undefined);
    assert.equal(jar.header(), undefined);
  });

  it('คืน undefined เมื่อยังไม่มี cookie', () => {
    assert.equal(new CookieJar().header(), undefined);
  });
});
