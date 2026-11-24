// One JSON line per event on stdout (stderr for errors); no dependency (ARCHITECTURE §10.15).
// Never pass headers, cookies, tokens or personal data in `fields`.

type Level = "info" | "warn" | "error";

function write(level: Level, event: string, fields?: Record<string, unknown>): void {
  const line = JSON.stringify({ ...fields, time: new Date().toISOString(), level, event });
  (level === "error" ? process.stderr : process.stdout).write(`${line}\n`);
}

export const log = {
  info: (event: string, fields?: Record<string, unknown>) => write("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => write("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => write("error", event, fields),
};
