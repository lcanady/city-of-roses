/**
 * +uptime — themed server-stats panel.
 *
 * Reads `u.sys.uptime()` (seconds since the engine booted) and renders
 * a small themed panel through the layout helpers.
 */

import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { header, footer } from "./layout.ts";
import { currentTheme }   from "./theme.ts";

function fmtDuration(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

export async function execUptime(u: IUrsamuSDK): Promise<void> {
  const t = currentTheme();
  const upSecs = await u.sys.uptime();
  const now = new Date();
  const boot = new Date(now.getTime() - upSecs * 1000);

  const lines: string[] = [];
  lines.push(await header("Server Uptime", t));
  lines.push(`  ${t.colors.label}Booted at  :${t.colors.reset} ${boot.toUTCString()}`);
  lines.push(`  ${t.colors.label}Current    :${t.colors.reset} ${now.toUTCString()}`);
  lines.push(`  ${t.colors.label}In operation${t.colors.reset}: ${fmtDuration(upSecs)}`);
  lines.push(await footer(t));
  u.send(lines.join("\n"));
}

export function registerUptimeCommand(): void {
  addCmd({
    name: "+uptime",
    pattern: /^\+uptime$/i,
    lock: "connected",
    category: "Info",
    help: `+uptime  — Show server boot time and how long it has been running.

Examples:
  +uptime          Display the uptime panel.`,
    exec: execUptime,
  });
}
