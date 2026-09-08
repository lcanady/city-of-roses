import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK, IDBObj } from "@ursamu/ursamu";
import { header, footer, divider, padLeft, padRight } from "./layout.ts";
import { defaultTheme, customTheme } from "./theme.ts";

/**
 * Rhost Vision: staff.ts
 * Registers the +staff command.
 *
 * +staff   — list all online, non-dark staff (admin / wizard / superuser)
 *            with On For, Idle, and Doing columns.
 *
 * Call registerStaffCommands() once during plugin init.
 */

const t = customTheme
  ? {
      ...defaultTheme,
      ...customTheme,
      colors: { ...defaultTheme.colors, ...(customTheme.colors ?? {}) },
      look:   { ...defaultTheme.look,   ...(customTheme.look   ?? {}) },
      who:    { ...defaultTheme.who,    ...(customTheme.who    ?? {}) },
    }
  : defaultTheme;

const c = t.colors;

// ── Time helpers ──────────────────────────────────────────────────────────────

function fmtOnFor(lastLogin: unknown): string {
  if (typeof lastLogin !== "number") return "??:??";
  const s  = Math.floor((Date.now() - lastLogin) / 1000);
  const d  = Math.floor(s / 86400);
  const h  = Math.floor((s % 86400) / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hm}` : hm;
}

function fmtIdle(lastCmd: unknown): string {
  if (typeof lastCmd !== "number") return "---";
  const s = Math.floor((Date.now() - lastCmd) / 1000);
  if (s  <  60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m  <  60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h  <  24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function idleColor(lastCmd: unknown): string {
  if (typeof lastCmd !== "number") return c.reset;
  const secs = Math.floor((Date.now() - lastCmd) / 1000);
  if (secs < 300) return c.idleFresh;
  if (secs < 900) return c.idleAway;
  return c.idleAFK;
}

function displayName(p: IDBObj): string {
  return String(p.state.moniker || p.state.name || p.name || "Unknown");
}

// ── Command registration ──────────────────────────────────────────────────────

export function registerStaffCommands(): void {
  addCmd({
    name: "+staff",
    pattern: /^\+staff$/i,
    lock: "connected",
    category: "Social",
    help: "+staff — show all staff (admin/wizard/superuser) currently online.",

    exec: async (u: IUrsamuSDK) => {
      const staff = (await u.db.search({ flags: /connected/i })).filter(
        (p) =>
          p.flags.has("player") &&
          !p.flags.has("dark") &&
          !(p as unknown as { data?: { offduty?: boolean } }).data?.offduty &&
          (p.flags.has("admin") || p.flags.has("wizard") || p.flags.has("superuser")),
      );

      staff.sort(
        (a, b) => ((b.state.lastLogin as number || 0) - (a.state.lastLogin as number || 0)),
      );

      const NW     = t.who.nameWidth;
      const OW     = t.who.onForWidth;
      const IW     = t.who.idleWidth;
      const doingW = t.width - NW - OW - IW - 8;

      const lines: string[] = [];
      lines.push(await header("Staff Online", t));
      lines.push(
        padLeft(c.label + "Player Name" + c.reset, NW) + "  " +
        padRight(c.label + "On For" + c.reset, OW)    + "  " +
        padRight(c.label + "Idle"   + c.reset, IW)    + "  " +
        c.label + "Doing" + c.reset,
      );
      lines.push(await divider(null, t));

      if (staff.length === 0) {
        lines.push("  No staff are currently online.");
      } else {
        for (const p of staff) {
          const name  = padLeft(c.header + displayName(p) + c.reset, NW);
          const onFor = padRight(fmtOnFor(p.state.lastLogin), OW);
          const idle  = idleColor(p.state.lastCommand) +
                        padRight(fmtIdle(p.state.lastCommand), IW) +
                        c.reset;
          const doing = String(p.state.doing || "").slice(0, doingW);
          lines.push(`${name}  ${onFor}  ${idle}  ${doing}`);
        }
      }

      lines.push(await divider(null, t));
      lines.push(`  ${staff.length} staff member${staff.length === 1 ? "" : "s"} online.`);
      lines.push(await footer(t));
      u.send(lines.join("\n"));

      u.ui.layout({
        components: [
          u.ui.panel({ type: "header", content: "Staff Online" }),
          u.ui.panel({
            type: "table",
            content: [
              ["Name", "On For", "Idle", "Doing"],
              ...staff.map((p) => [
                displayName(p),
                fmtOnFor(p.state.lastLogin),
                fmtIdle(p.state.lastCommand),
                String(p.state.doing || ""),
              ]),
            ],
          }),
          u.ui.panel({ content: `${staff.length} staff online.` }),
        ],
        meta: { type: "staff" },
      });
    },
  });
}
