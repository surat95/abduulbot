/** logger เล็ก ๆ แบบ JSON บรรทัดเดียว อ่านง่ายบน Cloud Run / Railway */

const LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LEVELS)[number];

function threshold(): number {
  const configured = (process.env.LOG_LEVEL ?? 'info').toLowerCase() as LogLevel;
  const index = LEVELS.indexOf(configured);
  return index === -1 ? LEVELS.indexOf('info') : index;
}

function emit(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
  if (LEVELS.indexOf(level) < threshold()) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => emit('debug', message, fields),
  info: (message: string, fields?: Record<string, unknown>) => emit('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => emit('warn', message, fields),
  error: (message: string, fields?: Record<string, unknown>) => emit('error', message, fields),
};

/** ดึงข้อความ error ออกมาแบบปลอดภัย ไม่ให้ stack หลุดไปหาผู้ใช้ */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
