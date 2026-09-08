// core/lookConformat.ts -- CONFORMAT matching CoFD look_format.ts.
//
// Player row (exact CoFD pads):
//   " " + name(dbref) + pad->21 + role + pad->13 + idle + pad->4 + short-desc
// short-desc is truncated so the row fits the looker's NAWS width (else 78).
// Name/role/idle are NOT clipped to column width (CoFD behavior).

import type { IUrsamuSDK, IDBObj } from "@ursamu/mush";
import { divider, dbrefWithFlags } from "@ursamu/mush";
import {
  lookerWidth,
  visualLen,
  visualTruncate,
} from "./lookWidth.ts";
import { getEqMeta } from "./eq.ts";

/** Same targets as packages/cofd look_format.ts */
const NAME_W = 21;
const ROLE_W = 13;
const IDLE_W = 4;

const SHORTDESC_PROMPT =
  "%ch%cxUse '&short-desc me=<desc>' to set.%cn";

const ROLE_TAGS = [
  { flag: "wizard", display: "(Wizard)" },
  { flag: "superuser", display: "(Root)" },
  { flag: "admin", display: "(Admin)" },
  { flag: "staff", display: "(Staff)" },
];

function showDbref(looker: IDBObj, canEdit: boolean): boolean {
  if (canEdit) return true;
  return (
    looker.flags.has("wizard") ||
    looker.flags.has("admin") ||
    looker.flags.has("superuser") ||
    looker.flags.has("staff") ||
    looker.flags.has("builder")
  );
}

function nameWithDbref(
  display: string,
  obj: IDBObj,
  looker: IDBObj,
  canEdit: boolean,
): string {
  if (!showDbref(looker, canEdit)) return display;
  return `${display}(${dbrefWithFlags(obj.id, obj.flags)})`;
}

function coloredName(
  obj: IDBObj,
  u: IUrsamuSDK,
  looker: IDBObj,
): string {
  try {
    const d = u.util.displayName(obj, looker);
    if (d?.trim()) return d;
  } catch { /* fall through */ }
  const moniker = (obj.state?.moniker as string) || "";
  if (moniker) return moniker;
  return (obj.state?.name as string) || obj.name || "Unknown";
}

function formatIdle(lastCommand: number | undefined): string {
  if (lastCommand === undefined || Number.isNaN(lastCommand)) {
    return "%ch%cx0s%cn";
  }
  const diff = Math.floor((Date.now() - lastCommand) / 1000);
  if (diff <= 0) return "%ch%cx0s%cn";
  if (diff < 60) return `%cg${diff}s%cn`;
  if (diff < 600) return `%cg${Math.floor(diff / 60)}m%cn`;
  if (diff < 3600) return `%cy${Math.floor(diff / 60)}m%cn`;
  if (diff < 86400) return `%cy${Math.floor(diff / 3600)}h%cn`;
  return `%ch%cx${Math.floor(diff / 86400)}d%cn`;
}

function getCharShortDesc(obj: IDBObj): string {
  const attrs =
    (obj.state?.attributes as {
      name?: string;
      value?: string;
    }[]) || [];
  const sd = attrs.find(
    (a) =>
      a.name?.toLowerCase() === "short-desc" ||
      a.name?.toLowerCase() === "shortdesc",
  );
  return sd?.value || "";
}

function roleTag(obj: IDBObj): string {
  if (obj.flags.has("npc")) return "(NPC)";
  for (const t of ROLE_TAGS) {
    if (obj.flags?.has(t.flag)) return t.display;
  }
  return "";
}

/** CoFD pad: at least 1 space, target column width. No clip. */
function padTo(s: string, target: number): string {
  return s + " ".repeat(Math.max(1, target - visualLen(s)));
}

function formatPlayerRow(
  u: IUrsamuSDK,
  looker: IDBObj,
  c: IDBObj,
  canEdit: boolean,
  width: number,
): string {
  const isNpc = c.flags.has("npc");
  const cName = coloredName(c, u, looker);
  const role = isNpc ? "(NPC)" : roleTag(c);
  const idle = isNpc
    ? ""
    : formatIdle(c.state?.lastCommand as number | undefined);
  const desc = getCharShortDesc(c) ||
    (isNpc ? "" : SHORTDESC_PROMPT);
  const nameWithRef = nameWithDbref(cName, c, looker, canEdit);

  // Exact CoFD look_format.ts padding (no clip on name/role/idle).
  const namePad = padTo(nameWithRef, NAME_W);
  const rolePad = padTo(role, ROLE_W);
  const idlePad = padTo(idle, IDLE_W);
  const prefix = ` ${namePad}${rolePad}${idlePad}`;
  const prefixLen = visualLen(prefix);
  if (prefixLen >= width) {
    return visualTruncate(prefix.replace(/\s+$/, ""), width);
  }
  const maxDescLen = width - prefixLen;
  const finalDesc = visualTruncate(desc, maxDescLen);
  return (prefix + finalDesc).replace(/\s+$/, "");
}

function formatThingRow(
  u: IUrsamuSDK,
  looker: IDBObj,
  obj: IDBObj,
  canEdit: boolean,
  width: number,
): string {
  let label = coloredName(obj, u, looker);
  label = nameWithDbref(label, obj, looker, canEdit);
  const meta = getEqMeta(obj);
  let tag = "";
  if (meta.wielded) tag = " (wielded)";
  else if (meta.worn) tag = " (worn)";
  if (meta.concealed) tag += " [concealed]";
  const line = `  ${label}${tag}`;
  if (visualLen(line) <= width) return line;
  return visualTruncate(line, width);
}

function pushSection(
  lines: string[],
  title: string,
  width: number,
): void {
  // divider may be multi-line (themed); keep each physical line intact.
  const block = divider(title, "-", width);
  for (const ln of String(block).split("\n")) {
    lines.push(ln);
  }
}

/** CONFORMAT -- CoFD columns; short-desc truncated to NAWS. */
export async function wodConformatHandler(
  u: IUrsamuSDK,
  target: IDBObj,
  idList: string,
): Promise<string | null> {
  const ids = idList.split(" ")
    .map((id) => id.replace("#", "").trim())
    .filter(Boolean);
  const contents = target.contents || [];
  const visible = ids
    .map((id) => contents.find((c) => c.id === id))
    .filter((o): o is IDBObj => o != null);

  const looker = u.me;
  const width = lookerWidth(looker);

  const people = visible.filter(
    (o) =>
      (o.flags.has("player") && o.flags.has("connected")) ||
      o.flags.has("npc"),
  );
  const things = visible.filter(
    (o) =>
      !o.flags.has("player") &&
      !o.flags.has("npc") &&
      !o.flags.has("exit") &&
      !o.flags.has("room"),
  );

  const lines: string[] = [];

  if (people.length > 0) {
    pushSection(lines, "Players", width);
    for (const c of people) {
      const canEdit = await u.canEdit(looker, c);
      lines.push(formatPlayerRow(u, looker, c, canEdit, width));
    }
  }

  if (things.length > 0) {
    pushSection(lines, "Contents", width);
    for (const t of things) {
      const canEdit = await u.canEdit(looker, t);
      lines.push(formatThingRow(u, looker, t, canEdit, width));
    }
  }

  if (lines.length === 0) return null;
  return lines.join("\n");
}
