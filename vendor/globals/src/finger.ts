/**
 * Rhost Vision: +finger
 *
 * MUSH-style finger display for character RP info.
 *
 * Setting fields:
 *   +finger/set <field>=<value>   Set a finger field
 *   +finger/set <field>=          Clear a finger field
 *   +finger/set <field>=@@        Hide field from display
 *
 * Viewing:
 *   +finger                       Show your own finger
 *   +finger <name>                Show another character's finger
 */

import { addCmd, dbojs, send } from "@ursamu/ursamu";
import type { IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { header, footer, divider } from "./layout.ts";
import { error, info, success, usage } from "./messages.ts";

// Attribute name conventions:
//   * Alias is special — stored at data.alias (canonical, set by @alias).
//   * Default fields are stored as plain attributes (PRONOUNS, POSITION, …).
//   * Custom fields are namespaced under FINGER-<NAME> to avoid colliding
//     with engine attributes (LISTEN, DESC, $patterns, etc).
//   * Hide marker "@@" keeps the value but suppresses display.

const FINGER_PREFIX = "FINGER-";
const ALIAS_FIELD   = "alias";

// [display_label, normalized_field_key, attribute_name | null for special]
const DEFAULT_FIELDS: Array<[string, string, string | null]> = [
  ["Alias",           ALIAS_FIELD,        null              ], // data.alias
  ["Online Times",    "online_times",     "ONLINE-TIMES"    ],
  ["Pronouns",        "pronouns",         "PRONOUNS"        ],
  ["RP Preferences",  "rp_preferences",   "RP-PREFERENCES"  ],
  ["Character Quote", "character_quote",  "CHARACTER-QUOTE" ],
  ["Position",        "position",         "POSITION"        ],
];

const DEFAULT_KEYS = new Set(DEFAULT_FIELDS.map(([, k]) => k));

function attrFor(field: string): string {
  for (const [, key, attr] of DEFAULT_FIELDS) {
    if (key === field && attr) return attr;
  }
  return FINGER_PREFIX + field.toUpperCase().replace(/_/g, "-");
}

function readAttr(obj: IDBOBJ, name: string): string | undefined {
  const attrs = (obj.data?.attributes as Array<{ name: string; value: string }> | undefined) ?? [];
  const hit = attrs.find((a) => a.name.toUpperCase() === name.toUpperCase());
  return hit?.value;
}

function readCustomFingerAttrs(obj: IDBOBJ): Array<[string, string]> {
  const attrs = (obj.data?.attributes as Array<{ name: string; value: string }> | undefined) ?? [];
  return attrs
    .filter((a) => a.name.toUpperCase().startsWith(FINGER_PREFIX))
    .map((a) => [a.name.slice(FINGER_PREFIX.length), a.value] as [string, string]);
}

function humanize(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLON_COL = 22; // column where the colon sits in dot-leader lines

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function dotLine(label: string, value: string): string {
  const pre = ` ${label} `;
  const dotsNeeded = Math.max(1, COLON_COL - pre.length);
  const dots = ".".repeat(dotsNeeded);
  return `${pre}${dots}: ${value}`;
}

function formatIdle(lastCommand: number | undefined): string {
  if (!lastCommand) return "Offline";
  const diff = Math.floor((Date.now() - lastCommand) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function hasFlag(obj: IDBOBJ, flag: string): boolean {
  const f = obj.flags as unknown;
  if (f instanceof Set) return (f as Set<string>).has(flag);
  if (typeof f === "string") return new RegExp(`\\b${flag}\\b`, "i").test(f);
  return false;
}

function isStaff(obj: IDBOBJ): boolean {
  return hasFlag(obj, "superuser") || hasFlag(obj, "staff") || hasFlag(obj, "wizard");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// COMMAND REGISTRATION
// ============================================================================

export function registerFingerCommands() {
  // +finger [<name>] or +finger/set <field>=<value>
  addCmd({
    name: "+finger",
    pattern: /^\+finger(?:\/(\w+))?\s*(.*)/i,
    lock: "",
    exec: async (u) => {
      const sid = u.socketId || "";
      const playerObj = await dbojs.queryOne({ id: u.me.id });
      if (!playerObj) return send([sid], error("Player not found."));

      const switchArg = (u.cmd.args[0] || "").toLowerCase();
      const rawArgs = (u.cmd.args[1] || "").trim();

      if (switchArg === "set") {
        await doFingerSet(u, sid, playerObj, rawArgs);
      } else if (rawArgs) {
        await doFingerView(sid, playerObj, rawArgs);
      } else {
        await doFingerDisplay(sid, playerObj, playerObj);
      }
    },
  });
}

// ============================================================================
// +FINGER/SET <FIELD>=<VALUE>
// ============================================================================

async function doFingerSet(u: IUrsamuSDK, sid: string, playerObj: IDBOBJ, rawArgs: string) {
  if (!rawArgs) {
    return send([sid], usage("+finger/set <field>=<value>"));
  }

  const eqIdx = rawArgs.indexOf("=");

  // No = sign: show current value
  if (eqIdx === -1) {
    const field = rawArgs.toLowerCase().replace(/\s+/g, "_");
    const val = readFingerField(playerObj, field);
    if (val === undefined) return send([sid], info(`No finger field '${field}' set.`));
    if (val === "@@")      return send([sid], info(`${humanize(field)} is hidden (@@).`));
    return send([sid], info(`${humanize(field)}: ${val}`));
  }

  const field = rawArgs.slice(0, eqIdx).trim().toLowerCase().replace(/\s+/g, "_");
  const value = rawArgs.slice(eqIdx + 1).trim();

  if (!field) {
    return send([sid], usage("+finger/set <field>=<value>"));
  }

  const label   = humanize(field);
  const current = readFingerField(playerObj, field);

  // Alias is special — canonical home is data.alias (set by @alias).
  if (field === ALIAS_FIELD) {
    if (!value) {
      if (current === undefined) return send([sid], info(`${label} was not set.`));
      await dbojs.modify({ id: playerObj.id }, "$unset", { "data.alias": 1 } as unknown as Partial<IDBOBJ>);
      return send([sid], success(`${label} cleared.`));
    }
    await dbojs.modify({ id: playerObj.id }, "$set", { "data.alias": value } as Partial<IDBOBJ>);
    if (value === "@@") return send([sid], success(`${label} is now hidden from +finger.`));
    return send([sid], success(`${label} set to:`) + ` ${value}`);
  }

  const attrName = attrFor(field);

  // Clear
  if (!value) {
    if (current === undefined) return send([sid], info(`${label} was not set.`));
    await u.attr.clear(playerObj.id, attrName);
    return send([sid], success(`${label} cleared.`));
  }

  // Set (including @@ to hide)
  await u.attr.set(playerObj.id, attrName, value);

  if (value === "@@") {
    return send([sid], success(`${label} is now hidden from +finger.`));
  }
  send([sid], success(`${label} set to:`) + ` ${value}`);
}

function readFingerField(obj: IDBOBJ, field: string): string | undefined {
  if (field === ALIAS_FIELD) {
    const a = obj.data?.alias as string | undefined;
    return a == null || a === "" ? undefined : a;
  }
  return readAttr(obj, attrFor(field));
}

// ============================================================================
// +FINGER <NAME>
// ============================================================================

async function doFingerView(sid: string, caller: IDBOBJ, name: string) {
  if (name.toLowerCase() === "me") {
    return await doFingerDisplay(sid, caller, caller);
  }

  const escaped = escapeRegex(name);

  // Search by name first
  const results = await dbojs.query({ "data.name": new RegExp(`^${escaped}$`, "i") });
  let target = results.find((r: IDBOBJ) => hasFlag(r, "player"));

  // Fall back to alias search
  if (!target) {
    const allPlayers = await dbojs.query({ flags: /player/i });
    target = allPlayers.find((r: IDBOBJ) => {
      const alias = (r.data?.alias as string) || (r.data?.ALIAS as string) || "";
      return alias.toLowerCase() === name.toLowerCase();
    });
  }

  if (!target) {
    return send([sid], info(`No character found matching '${name}'.`));
  }

  await doFingerDisplay(sid, caller, target);
}

// ============================================================================
// FINGER DISPLAY
// ============================================================================

async function doFingerDisplay(sid: string, _caller: IDBOBJ, char: IDBOBJ) {
  const charName = (char.data?.name as string) || "Unknown";
  const nameColor = (char.data?.name_color as string) || "";
  // colorName is reserved for future header colouring; isStaff() retained for that path.
  void (nameColor && isStaff(char) && charName.length > 0
    ? `${nameColor}${charName[0]}%cn%ch%cw${charName.slice(1)}%cn`
    : charName);
  const lastCmd = char.data?.lastCommand as number || char.data?.LASTCOMMAND as number || undefined;
  const isConnected = hasFlag(char, "connected");

  const lines: string[] = [];

  // Header — whole title in bright teal
  const headerTitle = `%ch%cc${charName}'s +finger%cn`;
  lines.push(await header(headerTitle));

  // Full Name / Idle line — no ANSI, uses fullname from CG
  const fullName = (char.data?.fullname as string) || (char.data?.FULLNAME as string) || charName;
  const idle = isConnected ? formatIdle(lastCmd) : "Offline";
  const left = ` Full Name: ${fullName}`;
  const rightStr = `| Idle: ${idle}`;
  const padded = left.padEnd(36);
  lines.push(`${padded}${rightStr}`);

  // Divider
  lines.push(await divider(null));

  // Status line
  let status: string;
  if (isStaff(char)) {
    status = "%ch%ccStaff%cn";
  } else if (char.data?.approved || char.data?.APPROVED) {
    status = "%ch%cgApproved Player%cn";
  } else {
    status = "Unapproved";
  }
  lines.push(` Status: ${status}`);

  // Divider
  lines.push(await divider(null));
  lines.push("");

  // Default fields
  for (const [label, fkey] of DEFAULT_FIELDS) {
    const val = readFingerField(char, fkey);
    if (val === "@@") continue;
    lines.push(dotLine(label, val ?? ""));
  }

  // Custom fields (FINGER-prefixed attrs, sorted alphabetically by display name)
  const customs = readCustomFingerAttrs(char)
    .filter(([, v]) => v !== "@@")
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [key, val] of customs) {
    lines.push(dotLine(humanize(key), val));
  }
  void DEFAULT_KEYS;

  // Blank line before footer
  lines.push("");

  // Footer
  lines.push(await footer());

  send([sid], lines.join("\n"));
}
