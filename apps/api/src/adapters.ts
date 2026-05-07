import type { AuditEntry, AuditPort, LoggerPort } from "@lab/core";

export class ConsoleLogger implements LoggerPort {
  info(message: string, meta?: Record<string, unknown>): void {
    console.info(JSON.stringify({ level: "info", message, meta }));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: "warn", message, meta }));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: "error", message, meta }));
  }
}

export class ConsoleAuditAdapter implements AuditPort {
  async record(entry: AuditEntry): Promise<void> {
    console.info(JSON.stringify({ level: "audit", ...entry }));
  }
}
