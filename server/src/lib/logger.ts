// Structured JSON logging (OBS-1: console.log SHALL NOT appear in committed code).
// Every call site that logs a game event should pass a gameId field (OBS-2) once
// game routes/sockets exist; nothing here does yet (Phase 1 has no game routes).
type LogFields = Record<string, unknown>;

function write(level: 'info' | 'warn' | 'error', msg: string, fields: LogFields = {}) {
  process.stdout.write(`${JSON.stringify({ level, msg, ...fields })}\n`);
}

export const logger = {
  info: (msg: string, fields?: LogFields) => write('info', msg, fields),
  warn: (msg: string, fields?: LogFields) => write('warn', msg, fields),
  error: (msg: string, fields?: LogFields) => write('error', msg, fields),
};
