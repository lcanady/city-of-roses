import type { IUrsamuSDK, IDBObj } from "../../@types/UrsamuSDK.ts";
import {
  renderHeader,
  renderDivider,
  renderFooter,
} from "../src/renderer.ts";

/**
 * Rhost Vision: who.ts
 * Rhost-style WHO list with On For, Idle, and Doing columns.
 */
export default async (u: IUrsamuSDK) => {
  const players = (await u.db.search({ flags: /connected/i })).filter(
    (p: IDBObj) => p.flags.has("player") && !p.flags.has("dark"),
  );

  const getLoginTime = (p: IDBObj): unknown => {
    return p.state.lastLogin || p.state.LASTLOGIN || null;
  };

  const formatOnFor = (lastLogin: unknown): string => {
    if (typeof lastLogin !== "number") return "   ??:??";
    const secs = Math.floor((Date.now() - lastLogin) / 1000);
    const days = Math.floor(secs / 86400);
    const hrs = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const hm = `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    if (days > 0) return `${String(days).padStart(2)}d ${hm}`;
    return `   ${hm}`;
  };

  const formatIdle = (lastCmd: unknown): string => {
    if (typeof lastCmd !== "number") return "---";
    const secs = Math.floor((Date.now() - lastCmd) / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const coloredName = (p: IDBObj): string => {
    const rn = (p.state.moniker as string) || (p.state.name as string) || p.name || "Unknown";
    const nc = (p.state.name_color as string) || "";
    if (nc && rn.length > 0) return `${nc}${rn[0]}%cn%ch%cw${rn.slice(1)}%cn`;
    return rn;
  };

  const rawName = (p: IDBObj): string => {
    return (p.state.moniker as string) || (p.state.name as string) || p.name || "Unknown";
  };

  // Sort by login time (most recent last)
  players.sort((a: IDBObj, b: IDBObj) => {
    const aLogin = (a.state.lastLogin as number) || 0;
    const bLogin = (b.state.lastLogin as number) || 0;
    return bLogin - aLogin;
  });

  const renderRow = (p: IDBObj): string => {
    const pRaw = rawName(p);
    const pColored = coloredName(p);
    const onFor = formatOnFor(getLoginTime(p));
    const idlePadded = formatIdle(p.state.lastCommand).padStart(4);
    const doing = (p.state.doing as string) || "";
    const pad = " ".repeat(Math.max(1, 21 - pRaw.length));
    return `${pColored}${pad}${onFor.padStart(8)}  ${idlePadded}  ${doing}`;
  };

  // Per-row — WHOROWFORMAT (%0 = default rendered row)
  const rows: string[] = [];
  for (const p of players) {
    const defaultRow = renderRow(p);
    const rowOverride = await u.util.resolveGlobalFormat?.("WHOROWFORMAT", defaultRow);
    rows.push(rowOverride != null ? rowOverride : defaultRow);
  }

  // Default block — both fallback output and %0 for WHOFORMAT
  const lines: string[] = [];
  lines.push(await renderHeader("Who's Online"));
  lines.push(
    `${"Player Name".padEnd(21)}${"On For".padStart(8)}  ${"Idle".padStart(4)}  Doing`,
  );
  lines.push(await renderDivider(null));
  for (const r of rows) lines.push(r);
  lines.push(await renderDivider(null));
  lines.push(
    `  ${players.length} Player${players.length === 1 ? "" : "s"} logged in.`,
  );
  lines.push(await renderFooter());
  const defaultBlock = lines.join("\n");

  const blockOverride = await u.util.resolveGlobalFormat?.("WHOFORMAT", defaultBlock);
  u.send(blockOverride != null ? blockOverride : defaultBlock);

  // Web UI
  u.ui.layout({
    components: [
      u.ui.panel({ type: "header", content: "Who's Online" }),
      u.ui.panel({
        type: "table",
        content: [
          ["Player", "On For", "Idle", "Doing"],
          ...players.map((p: IDBObj) => [
            (p.state.moniker as string) || (p.state.name as string) || p.name || "Unknown",
            formatOnFor(p.state.lastLogin),
            formatIdle(p.state.lastCommand),
            (p.state.doing as string) || "",
          ]),
        ],
      }),
      u.ui.panel({ content: `${players.length} online.` }),
    ],
    meta: { type: "who" },
  });
};
