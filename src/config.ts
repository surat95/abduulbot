/** โหลดและตรวจสอบ environment variables ทั้งหมดที่บอทต้องใช้ */

export interface CliniterConfig {
  baseUrl: string;
  loginPath: string;
  reportPath: string;
  username: string;
  password: string;
  /** ชื่อ input ของ username — ปล่อยว่างให้ตรวจจับจากฟอร์มเอง */
  usernameField?: string;
  passwordField?: string;
  /** CSS selector ชี้ไปยังยอดรวมบนหน้ารายงาน — ปล่อยว่างให้ใช้ heuristic */
  totalSelector?: string;
  /** query string สำหรับเลือกวันที่ เช่น "date={date}" */
  reportQuery?: string;
  dateFormat: string;
}

export interface AppConfig {
  port: number;
  timezone: string;
  logLevel: string;
  cacheTtlMs: number;
  allowedUserIds: string[];
  line: { channelSecret: string; channelAccessToken: string };
  cliniter: CliniterConfig;
}

class ConfigError extends Error {}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new ConfigError(`ต้องตั้งค่า environment variable: ${name}`);
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function withDefault(name: string, fallback: string): string {
  return optional(name) ?? fallback;
}

function intWithDefault(name: string, fallback: number): number {
  const raw = optional(name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new ConfigError(`${name} ต้องเป็นตัวเลข แต่ได้ค่า "${raw}"`);
  }
  return parsed;
}

/** ตัด trailing slash ออกเพื่อให้ต่อ path ได้ปลอดภัย */
function normaliseBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, '');
  try {
    new URL(trimmed);
  } catch {
    throw new ConfigError(`CLINITER_BASE_URL ไม่ใช่ URL ที่ถูกต้อง: "${raw}"`);
  }
  return trimmed;
}

/** บังคับให้ path ขึ้นต้นด้วย "/" */
function normalisePath(raw: string): string {
  return raw.startsWith('/') ? raw : `/${raw}`;
}

/**
 * สร้าง config สำหรับส่วนที่คุยกับ Cliniter เท่านั้น
 * แยกออกมาเพื่อให้สคริปต์ debug ใช้ได้โดยไม่ต้องมี LINE credentials
 */
export function loadCliniterConfig(): CliniterConfig {
  return {
    baseUrl: normaliseBaseUrl(required('CLINITER_BASE_URL')),
    loginPath: normalisePath(withDefault('CLINITER_LOGIN_PATH', '/login')),
    reportPath: normalisePath(withDefault('CLINITER_REPORT_PATH', '/report/income-simple-daily')),
    username: required('CLINITER_USERNAME'),
    password: required('CLINITER_PASSWORD'),
    usernameField: optional('CLINITER_USERNAME_FIELD'),
    passwordField: optional('CLINITER_PASSWORD_FIELD'),
    totalSelector: optional('CLINITER_TOTAL_SELECTOR'),
    reportQuery: optional('CLINITER_REPORT_QUERY'),
    dateFormat: withDefault('CLINITER_DATE_FORMAT', 'YYYY-MM-DD'),
  };
}

export function loadConfig(): AppConfig {
  return {
    port: intWithDefault('PORT', 8080),
    timezone: withDefault('TZ', 'Asia/Bangkok'),
    logLevel: withDefault('LOG_LEVEL', 'info'),
    cacheTtlMs: intWithDefault('INCOME_CACHE_TTL_SECONDS', 60) * 1000,
    allowedUserIds: (optional('ALLOWED_LINE_USER_IDS') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    line: {
      channelSecret: required('LINE_CHANNEL_SECRET'),
      channelAccessToken: required('LINE_CHANNEL_ACCESS_TOKEN'),
    },
    cliniter: loadCliniterConfig(),
  };
}
