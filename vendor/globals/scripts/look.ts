import type { IUrsamuSDK, IDBObj } from "../../@types/UrsamuSDK.ts";
import { renderHeader, renderDivider, renderFooter } from "../src/renderer.ts";

/**
 * Rhost Vision: look.ts
 * Rhost-style room display with bordered headers, sectioned exits,
 * player idle times, and short descriptions.
 *
 * To activate: copy this file to system/scripts/look.ts
 * To deactivate: restore system/scripts/look.ts from look.original.ts
 */

const WIDTH = 78;
const CARDINAL = new Set([
  "n", "s", "e", "w", "ne", "nw", "se", "sw",
  "north", "south", "east", "west",
  "northeast", "northwest", "southeast", "southwest",
  "up", "down", "u", "d",
]);

// Borders/titles route through the globals renderer so look uses the same
// themed template (headerfmt / dividerfmt / footerfmt) as every other
// command in the package.
function headerLine(text: string): Promise<string> {
  return renderHeader(text, WIDTH);
}

function sectionLine(text: string): Promise<string> {
  return renderDivider(text, WIDTH);
}

function footerLine(): Promise<string> {
  return renderFooter(WIDTH);
}

/** Measure visual width, stripping color codes (MUSH %c* and inline <#rrggbb>). */
function visualLen(s: string): number {
  return s
    .replace(/<#[0-9a-fA-F]{6}>/g, "")
    .replace(/%c[rRgGyYbBmMcCwWxXnh]|%cn|%ch|%ct/g, "")
    .length;
}

/**
 * Word-wrap text to fit within a given width.
 * Preserves leading whitespace/tabs for indented paragraphs.
 * Counts tab characters as 8 spaces for width measurement.
 */
function wordWrap(text: string, width: number) {
  var resultLines = [];
  var paragraphs = text.split("\n");

  for (var p = 0; p < paragraphs.length; p++) {
    var paragraph = paragraphs[p];
    if (paragraph.trim() === "") {
      resultLines.push("");
      continue;
    }

    // Measure indent
    var indentLen = 0;
    while (indentLen < paragraph.length && (paragraph[indentLen] === " " || paragraph[indentLen] === "\t")) {
      indentLen++;
    }
    var indent = paragraph.substring(0, indentLen);
    var indentWidth = visualLen(indent);

    if (visualLen(paragraph) <= width) {
      resultLines.push(paragraph);
      continue;
    }

    // Split into words
    var content = paragraph.substring(indentLen);
    var words = content.split(" ");
    var currentLine = indent + words[0];
    var currentLen = indentWidth + visualLen(words[0]);

    for (var w = 1; w < words.length; w++) {
      var word = words[w];
      var wordLen = visualLen(word);
      // +1 for the space between words
      if (currentLen + 1 + wordLen > width) {
        resultLines.push(currentLine);
        currentLine = word;
        currentLen = wordLen;
      } else {
        currentLine = currentLine + " " + word;
        currentLen = currentLen + 1 + wordLen;
      }
    }
    if (currentLine.length > 0) {
      resultLines.push(currentLine);
    }
  }

  return resultLines.join("\n");
}

function coloredName(obj: IDBObj): string {
  // @moniker wins — render it verbatim so its embedded color codes survive.
  const moniker = (obj.state?.moniker as string) || "";
  if (moniker) return moniker;

  const rawName = (obj.state?.name as string) || obj.name || "Unknown";
  const nameColor = (obj.state?.name_color as string) || "";
  if (nameColor && rawName.length > 0) {
    return `${nameColor}${rawName[0]}%cn%ch%cw${rawName.slice(1)}%cn`;
  }
  return rawName;
}

function formatIdle(lastCommand: number | undefined): string {
  if (!lastCommand) return "%ch%cx0s%cn";
  const diff = Math.floor((Date.now() - lastCommand) / 1000);
  if (diff === 0) return "%ch%cx0s%cn";
  if (diff < 60) return `%cg${diff}s%cn`;
  if (diff < 600) return `%cg${Math.floor(diff / 60)}m%cn`;
  if (diff < 3600) return `%cy${Math.floor(diff / 60)}m%cn`;
  if (diff < 86400) return `%cy${Math.floor(diff / 3600)}h%cn`;
  return `%ch%cx${Math.floor(diff / 86400)}d%cn`;
}

const SHORTDESC_PROMPT = "%ch%cxUse '&short-desc me=<desc>' to set.%cn";
const NO_DESCRIPTION   = "You don't see anything special.";

interface IAttr {
  name?: string;
  value?: string;
}

function getShortDesc(obj: IDBObj): string {
  const attrs = (obj.state?.attributes as IAttr[]) || [];
  const sd = attrs.find(
    (a: IAttr) =>
      a.name?.toLowerCase() === "short-desc" ||
      a.name?.toLowerCase() === "shortdesc",
  );
  return sd?.value || "";
}

function getExitInfo(
  exit: IDBObj,
): { name: string; alias: string; isDirection: boolean } {
  const raw = (exit.state?.name as string) || exit.name || "";
  const parts = raw
    .split(";")
    .map((p: string) => p.trim())
    .filter(Boolean);
  const name = parts[0] || "???";
  const aliases = parts.slice(1);

  const isDirection = parts.some((p: string) =>
    CARDINAL.has(p.toLowerCase()),
  );

  // Show the first declared alias (alias[0]) — not the shortest. If the
  // exit name itself is a cardinal direction, no extra alias prefix.
  const displayAlias = aliases[0] || "";

  return { name, alias: displayAlias, isDirection };
}

/**
 * Resolve an exit's section type (highest precedence first):
 *   1. TYPE attribute    — `&type <exit>=<value>`  (or `@exittype <exit>=<value>`)
 *   2. state.exit_type   — legacy state field
 *   3. cardinal name     — auto-classified as "direction"
 *   4. default "exit"
 * Result is lowercased and trimmed.
 */
function getExitType(exit: IDBObj): string {
  const attrs = (exit.state?.attributes as IAttr[] | undefined) ?? [];
  const typeAttr = attrs.find((a: IAttr) => a.name?.toUpperCase() === "TYPE");
  if (typeAttr?.value) return String(typeAttr.value).toLowerCase().trim();

  const legacy = exit.state?.exit_type as string | undefined;
  if (legacy) return legacy.toLowerCase().trim();

  const raw = (exit.state?.name as string) || exit.name || "";
  const isCardinal = raw.split(";").some(
    (p: string) => CARDINAL.has(p.trim().toLowerCase()),
  );
  if (isCardinal) return "direction";

  return "exit";
}

/** Format a raw type token as a section title — humanized + pluralized. */
function sectionTitle(type: string): string {
  const cap = type.toLowerCase().replace(/[_-]/g, " ").trim()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  return cap.endsWith("s") ? cap : cap + "s";
}

function formatExitEntry(info: { name: string; alias: string }): string {
  if (info.alias && info.alias.toLowerCase() !== info.name.toLowerCase()) {
    return `<%cc${castAlias(info.alias)}%cn> ${info.name}`;
  }
  return info.name;
}

// Replaced at install time from theme.look.roleTags. Order = priority.
const ROLE_TAGS: Array<{ flag: string; display: string }> = /* {{ROLE_TAGS}} */ [
  { flag: "wizard",    display: "(Wizard)" },
  { flag: "superuser", display: "(Root)"   },
  { flag: "admin",     display: "(Admin)"  },
  { flag: "staff",     display: "(Staff)"  },
];

// Replaced at install time from theme.look.{showIdle,showShortDesc,aliasCase}.
const SHOW_IDLE      = /* {{SHOW_IDLE}} */      true;
const SHOW_SHORTDESC = /* {{SHOW_SHORTDESC}} */ true;
const ALIAS_CASE: "upper" | "lower" | "preserve" = /* {{ALIAS_CASE}} */ "preserve";

function castAlias(alias: string): string {
  if (ALIAS_CASE === "upper") return alias.toUpperCase();
  if (ALIAS_CASE === "lower") return alias.toLowerCase();
  return alias;
}

function roleTag(obj: IDBObj): string {
  for (const t of ROLE_TAGS) if (obj.flags.has(t.flag)) return t.display;
  return "";
}

// Show non-concealed wielded weapons next to a player's name in the room view.
// Items live in the player's contents; concealed items are hidden from passive
// view (active +spot is the discovery path). No effect when nothing wielded.
function visibleEqTag(p: IDBObj): string {
  const carried = (p.contents ?? []) as IDBObj[];
  const wielded = carried.filter((o) =>
    o?.state?.kind === "weapon" &&
    o?.state?.wielded === true &&
    o?.state?.concealed !== true
  );
  if (wielded.length === 0) return "";
  const names = wielded.map((w) => (w.state?.name as string) || w.name || "(unknown)");
  return ` %cy[wielding: ${names.join(", ")}]%cn`;
}

// Reality-plane filter. Each player/thing may carry a string `state.reality`
// tag (e.g. "material", "penumbra", "deep-umbra"). Occupants are visible to
// each other only when their tags match; absent defaults to "material" so
// non-supernatural games see zero behavior change.
function reality(obj: IDBObj): string {
  return (obj?.state?.reality as string) || "material";
}
function sameReality(a: IDBObj, b: IDBObj): boolean {
  return reality(a) === reality(b);
}

// Plane-aware description lookup: rooms, players, things, and exits may all
// carry per-plane descriptions. Resolution order, highest-priority first:
//   1. state.descriptions[<plane>]    -- map form
//   2. state[`${plane}Description`]   -- shorthand
//   3. state.description              -- legacy default
function planeDesc(target: IDBObj, plane: string, fallback: string): string {
  const map = (target.state?.descriptions as Record<string, string> | undefined) ?? {};
  const shorthand = (target.state?.[`${plane}Description`] as string | undefined) ?? "";
  return map[plane] || shorthand || (target.state?.description as string | undefined) || fallback;
}

// ─── Single-target renderers ─────────────────────────────────────────────────

async function renderPlayer(p: IDBObj, u: IUrsamuSDK): Promise<string> {
  const lookerPlane = reality(u.me as IDBObj);
  const baseDisplay = coloredName(p);
  const display = (await u.util.resolveFormat?.(p, "NAMEFORMAT", baseDisplay)) ?? baseDisplay;
  const role    = roleTag(p);
  const titleParts = [display];
  if (role) titleParts.push(role);
  const title = titleParts.join(" ");

  const lines: string[] = [];
  lines.push(await headerLine(title));
  lines.push("");

  const desc = planeDesc(p, lookerPlane, NO_DESCRIPTION);
  for (const l of wordWrap(desc, WIDTH - 1).split("\n")) lines.push(` ${l}`);

  // Held contents — skip dark/opaque to honor privacy. Split into held
  // players vs carried things; the things section uses the "Carrying" label.
  const visible = (p.contents ?? []).filter(
    (o: IDBObj) => !o.flags.has("dark") && !o.flags.has("opaque"),
  );
  const heldPlayers = visible.filter((o: IDBObj) => o.flags.has("player"));
  const heldThings  = visible.filter((o: IDBObj) => !o.flags.has("player") && !o.flags.has("exit"));

  if (heldPlayers.length > 0) {
    lines.push("");
    lines.push(await sectionLine("Players"));
    for (const c of heldPlayers) {
      const cName = coloredName(c);
      const role  = roleTag(c);
      lines.push(role ? ` ${cName} ${role}` : ` ${cName}`);
    }
  }

  if (heldThings.length > 0) {
    lines.push("");
    lines.push(await sectionLine("Carrying"));
    const names = heldThings.map((o: IDBObj) => (o.state?.name as string) || o.name || "(unknown)");
    const shown = names.slice(0, 5);
    if (names.length > 5) shown.push(`... and ${names.length - 5} more`);
    lines.push(` ${shown.join(", ")}`);
  }
  lines.push("");
  lines.push(await footerLine());
  return lines.join("\n");
}

async function renderExit(e: IDBObj, canEdit: boolean, u: IUrsamuSDK): Promise<string> {
  const info  = getExitInfo(e);
  const baseTitle = info.alias && info.alias.toLowerCase() !== info.name.toLowerCase()
    ? `${info.name} <%cc${castAlias(info.alias)}%cn>`
    : info.name;
  const title = (await u.util.resolveFormat?.(e, "NAMEFORMAT", baseTitle)) ?? baseTitle;

  const lines: string[] = [];
  lines.push(await headerLine(title));
  lines.push("");

  const desc = planeDesc(e, reality(u.me as IDBObj), NO_DESCRIPTION);
  for (const l of wordWrap(desc, WIDTH - 1).split("\n")) lines.push(` ${l}`);

  // Show destination to anyone who can edit the exit (typically staff or owner).
  if (canEdit && e.state?.destination) {
    lines.push("");
    lines.push(` Destination: ${String(e.state.destination)}`);
  }
  lines.push("");
  lines.push(await footerLine());
  return lines.join("\n");
}

async function renderObject(o: IDBObj, showContents: boolean, u: IUrsamuSDK): Promise<string> {
  const baseTitle = (o.state?.name as string) || o.name || "Unknown";
  const title = (await u.util.resolveFormat?.(o, "NAMEFORMAT", baseTitle)) ?? baseTitle;
  const lines: string[] = [];
  lines.push(await headerLine(title));
  lines.push("");

  const desc = planeDesc(o, reality(u.me as IDBObj), NO_DESCRIPTION);
  for (const l of wordWrap(desc, WIDTH - 1).split("\n")) lines.push(` ${l}`);

  if (showContents && o.contents && o.contents.length > 0) {
    const heldPlayers = o.contents.filter((c: IDBObj) => c.flags.has("player"));
    const heldThings  = o.contents.filter((c: IDBObj) => !c.flags.has("player") && !c.flags.has("exit"));

    if (heldPlayers.length > 0) {
      lines.push("");
      lines.push(await sectionLine("Players"));
      for (const c of heldPlayers) {
        const cName = coloredName(c);
        const role  = roleTag(c);
        lines.push(role ? ` ${cName} ${role}` : ` ${cName}`);
      }
    }

    if (heldThings.length > 0) {
      lines.push("");
      lines.push(await sectionLine("Contents"));
      for (const c of heldThings) {
        lines.push(` ${(c.state?.name as string) || c.name || "(unknown)"}`);
      }
    }
  }
  lines.push("");
  lines.push(await footerLine());
  return lines.join("\n");
}

function nColumn(items: string[], n: number): string {
  const inner   = WIDTH - 1;                       // account for leading space
  const colW    = Math.floor(inner / n);           // visible width per cell
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += n) {
    const row = items.slice(i, i + n);
    const cells = row.map((cell, j) => {
      if (j === row.length - 1) return cell;       // last cell: no padding
      const pad = Math.max(1, colW - visualLen(cell));
      return cell + " ".repeat(pad);
    });
    lines.push(" " + cells.join(""));
  }
  return lines.join("\n");
}

export default async (u: IUrsamuSDK) => {
  const actor = u.me;
  const target = u.target || u.here;

  if (!target) {
    u.send("I can't find that here.");
    return;
  }

  if (actor.flags.has("blind")) {
    u.send("You can't see anything!");
    return;
  }

  const canEditTarget = await u.canEdit(actor, target);
  const isOpaque = target.flags.has("opaque");
  const showContents = !isOpaque || canEditTarget;
  const isRoom   = target.flags.has("room");
  const isPlayer = target.flags.has("player");
  const isExit   = target.flags.has("exit");

  // ---- Player look ----
  if (isPlayer) {
    u.send(await renderPlayer(target, u));
    return;
  }

  // ---- Exit look ----
  if (isExit) {
    u.send(await renderExit(target, canEditTarget, u));
    return;
  }

  // ---- Object look (anything that isn't a room/player/exit) ----
  if (!isRoom) {
    u.send(await renderObject(target, showContents, u));
    return;
  }

  // ---- Room display: Rhost Vision ----
  const description = planeDesc(target, reality(actor), "You see nothing special.");

  const characters = (target.contents || []).filter(
    (obj: IDBObj) =>
      obj.flags.has("player") &&
      obj.flags.has("connected") &&
      sameReality(obj, actor),
  );

  const objects = (target.contents || []).filter(
    (obj: IDBObj) =>
      !obj.flags.has("player") &&
      !obj.flags.has("exit") &&
      !obj.flags.has("room") &&
      sameReality(obj, actor),
  );

  const exits = (target.contents || []).filter((obj: IDBObj) =>
    obj.flags.has("exit"),
  );

  // Strip dbref from room name for display (e.g., "OOC Polis #1" → "OOC Polis")
  const rawRoomName = u.util.displayName(target, actor);
  const roomName = rawRoomName.replace(/\s*#\d+$/, "");
  const lines: string[] = [];

  // Header — NAMEFORMAT (%0 = default header line)
  const gridArea = (target.state?.grid_area as string) || "";
  const headerText = gridArea
    ? `${roomName} - %cc${gridArea}%cn`
    : roomName;
  const defaultHeader = await headerLine(headerText);
  const nameOverride = await u.util.resolveFormat?.(target, "NAMEFORMAT", defaultHeader);
  lines.push(nameOverride != null ? nameOverride : defaultHeader);
  lines.push("");

  // Description — DESCFORMAT (%0 = trimmed description text)
  const descTrimmed = description.replace(/^\n+/, "");
  const descOverride = await u.util.resolveFormat?.(target, "DESCFORMAT", descTrimmed);
  lines.push(descOverride != null ? descOverride : wordWrap(descTrimmed, WIDTH));
  lines.push("");

  // Players + Contents — CONFORMAT (%0 = space-joined #ids of both)
  let conOverride: string | null | undefined;
  if (showContents) {
    const visible = [...characters, ...objects];
    if (visible.length > 0) {
      const idList = visible.map((o: IDBObj) => `#${o.id}`).join(" ");
      conOverride = await u.util.resolveFormat?.(target, "CONFORMAT", idList);
    }
  }

  if (conOverride != null) {
    lines.push(conOverride);
  } else {
    // Players —  <name 20>  <role 9>  <idle 6>  <shortdesc>
    if (showContents && characters.length > 0) {
      lines.push(await sectionLine("Players"));
      for (const c of characters) {
        const cName   = coloredName(c);
        const idle    = SHOW_IDLE      ? formatIdle(c.state?.lastCommand as number) : "";
        const role    = roleTag(c);
        const desc    = SHOW_SHORTDESC ? (getShortDesc(c) || SHORTDESC_PROMPT) : "";

        // Pad by *visible* width so monikers with embedded color codes line up.
        const namePad = " ".repeat(Math.max(1, 21 - visualLen(cName)));
        const rolePad = " ".repeat(Math.max(1, 13 - visualLen(role)));
        const idlePad = SHOW_IDLE ? " ".repeat(Math.max(1, 4 - visualLen(idle))) : "";

        const eqTag = visibleEqTag(c);
        lines.push(` ${cName}${namePad}${role}${rolePad}${idle}${idlePad}${desc}${eqTag}`.replace(/\s+$/, ""));
      }
    }

    // Contents (non-player, non-exit objects)
    if (showContents && objects.length > 0) {
      lines.push(await sectionLine("Contents"));
      for (const o of objects) {
        lines.push(` ${o.name || u.util.displayName(o, actor)}`);
      }
    }
  }

  // Exits — EXITFORMAT (%0 = space-joined #ids). Default: grouped by TYPE
  // attribute (or legacy state.exit_type, or cardinal auto-detect).
  if (exits.length > 0) {
    const idList = exits.map((e: IDBObj) => `#${e.id}`).join(" ");
    const exitOverride = await u.util.resolveFormat?.(target, "EXITFORMAT", idList);
    if (exitOverride != null) {
      lines.push(exitOverride);
    } else {
      const byType = new Map<string, { name: string; alias: string }[]>();
      for (const exit of exits) {
        const type = getExitType(exit);
        let bucket = byType.get(type);
        if (!bucket) { bucket = []; byType.set(type, bucket); }
        bucket.push(getExitInfo(exit));
      }
      const sortedTypes = [...byType.keys()].sort();
      for (const type of sortedTypes) {
        lines.push(await sectionLine(sectionTitle(type)));
        lines.push(nColumn(byType.get(type)!.map(formatExitEntry), 3));
      }
    }
  }

  // Footer
  lines.push(await footerLine());

  u.send(lines.join("\n"));

  // Phase 2: Web UI Output
  const components: unknown[] = [];
  components.push(
    u.ui.panel({
      type: "header",
      content: roomName,
      style: "bold centered",
    }),
  );
  components.push(u.ui.panel({ type: "panel", content: description }));

  if (showContents && characters.length > 0) {
    components.push(
      u.ui.panel({
        type: "list",
        title: "Players",
        content: characters.map((c: IDBObj) => ({
          name: u.util.displayName(c, actor),
          desc: getShortDesc(c),
        })),
      }),
    );
  }

  if (showContents && objects.length > 0) {
    components.push(
      u.ui.panel({
        type: "grid",
        title: "Contents",
        content: objects.map((o: IDBObj) => ({ name: o.name, id: o.id })),
      }),
    );
  }

  if (exits.length > 0) {
    components.push(
      u.ui.panel({
        type: "grid",
        title: "Exits",
        content: exits.map((e: IDBObj) => {
          const parts = ((e.state.name as string) || e.name || "").split(";");
          return { name: parts[0], alias: parts[1] || parts[0] };
        }),
      }),
    );
  }

  const mapData = u.util.getMapData
    ? u.util.getMapData(target.id, 2)
    : null;
  u.ui.layout({
    components,
    meta: { targetId: target.id, type: "look", map: mapData },
  });
};
