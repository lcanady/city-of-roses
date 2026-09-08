/**
 * messages.ts — themable message templates.
 *
 * All system messages from native commands flow through these helpers so the
 * prefix and per-level colors can be retuned via theme.messages without code
 * changes. Use highlight() inline for emphasis.
 */

import { currentTheme } from "./theme.ts";

const reset = "%cn";

function fmt(level: keyof ReturnType<typeof currentTheme>["messages"], body: string): string {
  const m = currentTheme().messages;
  if (level === "prefix" || level === "highlight") return body;
  const color = m[level];
  return `${m.prefix} ${color}${body}${reset}`;
}

/** Plain status line: prefix + neutral body. */
export function info(body: string): string {
  const m = currentTheme().messages;
  return `${m.prefix} ${m.info}${body}${reset}`;
}

/** Green-tinted confirmation. */
export function success(body: string): string {
  return fmt("success", body);
}

/** Yellow-tinted warning. */
export function warn(body: string): string {
  return fmt("warning", body);
}

/** Red-tinted refusal / failure. */
export function error(body: string): string {
  return fmt("error", body);
}

/** Usage/help line: prefix + literal "Usage:" + highlighted syntax. */
export function usage(syntax: string): string {
  const m = currentTheme().messages;
  return `${m.prefix} Usage: ${m.highlight}${syntax}${reset}`;
}

/** Inline emphasis (e.g. wrap a label inside an info() body). */
export function highlight(body: string): string {
  return `${currentTheme().messages.highlight}${body}${reset}`;
}

/** Join multiple lines into one message payload. */
export function lines(...rows: string[]): string {
  return rows.join("\n");
}
