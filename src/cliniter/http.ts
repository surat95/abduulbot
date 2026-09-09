/**
 * HTTP client เล็ก ๆ ที่เก็บ cookie เองและตาม redirect เอง
 *
 * ทำไมไม่ใช้ fetch เฉย ๆ: การล็อกอินต้องเห็น 302 และต้องส่ง session cookie
 * ต่อไปทุก request ซึ่ง fetch มาตรฐานไม่ทำให้ (ไม่มี cookie jar)
 */

export interface HttpResponse {
  status: number;
  url: string;
  headers: Headers;
  body: string;
}

/** cookie jar แบบง่าย ใช้กับโดเมนเดียว (Cliniter) เท่านั้น */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  /** อ่าน Set-Cookie จาก response แล้วเก็บไว้ */
  absorb(headers: Headers): void {
    for (const raw of readSetCookies(headers)) {
      const [pair] = raw.split(';');
      if (!pair) continue;
      const separator = pair.indexOf('=');
      if (separator <= 0) continue;
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      if (!name) continue;
      // ค่าว่างจากเซิร์ฟเวอร์ = สั่งลบ cookie
      if (value === '' || value === 'deleted') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  get size(): number {
    return this.cookies.size;
  }

  clear(): void {
    this.cookies.clear();
  }
}

/** Node 20+ มี getSetCookie(); เผื่อ runtime เก่าไว้ด้วย */
function readSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    return withGetter.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: string;
  contentType?: string;
  referer?: string;
  timeoutMs?: number;
  maxRedirects?: number;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * ยิง request หนึ่งครั้ง พร้อมตาม redirect เอง (เพื่อให้เก็บ cookie ได้ทุกฮอป)
 * คืน response สุดท้ายหลังตาม redirect เสร็จ
 */
export async function request(
  url: string,
  jar: CookieJar,
  options: RequestOptions = {},
): Promise<HttpResponse> {
  const {
    method = 'GET',
    body,
    contentType,
    referer,
    timeoutMs = 20_000,
    maxRedirects = 5,
  } = options;

  let currentUrl = url;
  let currentMethod: 'GET' | 'POST' = method;
  let currentBody: string | undefined = body;
  let currentReferer = referer;

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'th,en;q=0.9',
    };

    const cookieHeader = jar.header();
    if (cookieHeader) headers.cookie = cookieHeader;
    if (currentReferer) headers.referer = currentReferer;
    if (currentMethod === 'POST' && currentBody !== undefined) {
      headers['content-type'] = contentType ?? 'application/x-www-form-urlencoded';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: currentMethod,
        headers,
        body: currentMethod === 'POST' ? currentBody : undefined,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error(`เชื่อมต่อ ${currentUrl} ไม่สำเร็จ: หมดเวลา ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }

    jar.absorb(response.headers);

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (!isRedirect) {
      return {
        status: response.status,
        url: currentUrl,
        headers: response.headers,
        body: await response.text(),
      };
    }

    // ปล่อย body ทิ้งเพื่อไม่ให้ connection ค้าง
    await response.arrayBuffer().catch(() => undefined);

    currentReferer = currentUrl;
    currentUrl = new URL(location, currentUrl).toString();
    // 303 และ 302 หลัง POST ให้เปลี่ยนเป็น GET ตามที่เบราว์เซอร์ทำ
    if (response.status === 303 || (response.status === 302 && currentMethod === 'POST')) {
      currentMethod = 'GET';
      currentBody = undefined;
    }
  }

  throw new Error(`ตาม redirect เกิน ${maxRedirects} ครั้งจาก ${url}`);
}
