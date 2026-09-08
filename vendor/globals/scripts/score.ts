import type { IUrsamuSDK } from "../../@types/UrsamuSDK.ts";
import {
  renderHeader,
  renderDivider,
  renderFooter,
} from "../src/renderer.ts";

/**
 * Rhost Vision: score.ts
 * Displays a formatted scorecard for the calling player.
 *
 * Commands:  score  (or whatever the engine binds this script to)
 *
 * Customisable stat block:
 *   &SCORE-EXTRA me=<any text>   — appended below the divider as a "Stats" section
 *
 * To activate:  copy this file to system/scripts/score.ts
 * To deactivate: restore system/scripts/score.ts from score.original.ts
 */

function padLabel(label: string, width: number): string {
  return label + " ".repeat(Math.max(0, width - label.length));
}

export default async (u: IUrsamuSDK) => {
  const me = u.me;
  const name      = String(me.state.moniker || me.state.name || me.name || "Unknown");
  const money     = String(me.state.money   || 0);
  const doing     = String(me.state.doing   || "Nothing.");
  const alias     = String(me.state.alias   || "");
  const shortdesc = String(me.state["short-desc"] || me.state.shortdesc || "");
  const flags     = Array.from(me.flags)
    .filter((f) => f !== "connected")
    .join(" ") || "(none)";

  const LW = 18;
  const field = (label: string, value: string) =>
    `  %ch%cw${padLabel(label, LW)}%cn ${value}`;

  const lines: string[] = [];
  lines.push(await renderHeader(`Scorecard: ${name}`));
  lines.push(field("DBRef:",  `%cy#${me.id}%cn`));
  lines.push(field("Alias:",  alias || "(none)"));
  lines.push(field("Money:",  `${money} credits`));
  lines.push(field("Flags:",  flags));
  if (shortdesc) lines.push(field("Short-Desc:", shortdesc));
  lines.push(await renderDivider(null));
  lines.push(field("Doing:", doing));

  // Optional game-specific stat block — set &SCORE-EXTRA me=<text>
  const extra = await u.attr.get(me.id, "SCORE-EXTRA");
  if (extra) {
    lines.push(await renderDivider("Stats"));
    lines.push(`  ${extra}`);
  }

  lines.push(await renderFooter());
  u.send(lines.join("\n"));

  u.ui.layout({
    components: [
      u.ui.panel({ type: "header", content: "Scorecard" }),
      u.ui.panel({
        type: "list",
        content: [
          { label: "Name",  value: name },
          { label: "Money", value: `${money} credits` },
          { label: "Doing", value: doing },
          { label: "Flags", value: flags },
          ...(alias ? [{ label: "Alias", value: alias }] : []),
        ],
      }),
      ...(extra
        ? [u.ui.panel({ type: "panel", title: "Stats", content: extra })]
        : []),
    ],
    meta: { type: "score" },
  });
};
