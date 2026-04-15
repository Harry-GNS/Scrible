import { randomUUID } from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';

type LogRecord = {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
};

export function makeRequestId(): string {
  return randomUUID();
}

export function writeLog(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
  const record: LogRecord = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta
  };

  const line = JSON.stringify(record);
  if (level === 'error') {
    console.error(line);
    return;
  }

  console.log(line);
}
