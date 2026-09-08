/**
 * Rhost Vision: ooc + +ooctag
 *
 * In-room out-of-character chat. The OOC tag literal (decoration + colors)
 * is owned by the admin via `theme.ooc.tag`. Individual players may override
 * with `+ooctag <literal>` to set their own per-player tag string.
 *
 * Talk:
 *   ooc <message>     <OOC> Jupiter says, "Hi everyone!"
 *   ooc :<pose>       <OOC> Jupiter waves at the room.
 *
 * Per-player tag:
 *   +ooctag                  Show effective tag + preview.
 *   +ooctag <literal>        Set a personal tag literal (e.g. [%cyOOC%cn]).
 *   +ooctag reset            Clear the per-player override.
 */

import { addCmd, dbojs, send } from "@ursamu/ursamu";
import type { IDBOBJ } from "@ursamu/ursamu";
import { error, info, success, usage } from "./messages.ts";
import { currentTheme } from "./theme.ts";

/** Substitute {tag} / {name} / {message} placeholders. */
function fmt(template: string, vars: { tag: string; name: string; message: string }): string {
  return template
    .replace(/\{tag\}/g,     vars.tag)
    .replace(/\{name\}/g,    vars.name)
    .replace(/\{message\}/g, vars.message);
}

/** Per-player override at data.ooctag, falling back to theme.ooc.tag. */
function effectiveTag(playerObj: IDBOBJ): string {
  const override = playerObj.data?.ooctag as string | undefined;
  if (override && override.trim()) return override;
  return currentTheme().ooc.tag;
}

/** Send a message to all connected players in a room. */
async function sendToRoom(location: string, message: string) {
  const roomPlayers = await dbojs.query({
    $and: [
      { location },
      { flags: /connected/i },
    ],
  });
  const ids = roomPlayers.map((p) => p.id);
  if (ids.length > 0) send(ids, message);
}

// ============================================================================
// COMMANDS
// ============================================================================

export function registerOocTalkCommands() {
  // ooc <message> or ooc :<pose>
  addCmd({
    name: "ooc",
    pattern: /^ooc(?:\s+(.*))?$/i,
    lock: "",
    help: `ooc <message>  — Speak in OOC chat to your room.

Prefix the message with a colon to pose instead of speak.

Examples:
  ooc Hi everyone!         <OOC> Jupiter says, "Hi everyone!"
  ooc :waves at the room.  <OOC> Jupiter waves at the room.`,
    exec: async (u) => {
      const sid = u.socketId || "";
      const playerObj = await dbojs.queryOne({ id: u.me.id });
      if (!playerObj) return send([sid], error("Player not found."));

      const rawArgs = (u.cmd.args[0] || "").trim();
      if (!rawArgs) {
        return send([sid], usage("ooc <message>  or  ooc :<pose>"));
      }

      const rawName   = (playerObj.data?.name as string) || "Unknown";
      const nameColor = (playerObj.data?.name_color as string) || "";
      const name = nameColor && rawName.length > 0
        ? `${nameColor}${rawName[0]}%cn%ch%cw${rawName.slice(1)}%cn`
        : rawName;

      const location = playerObj.location;
      if (!location) return send([sid], info("You have no location."));

      const tag = effectiveTag(playerObj);
      const o   = currentTheme().ooc;
      const message = rawArgs.startsWith(":")
        ? fmt(o.poseFormat, { tag, name, message: rawArgs.slice(1).trimStart() })
        : fmt(o.sayFormat,  { tag, name, message: rawArgs });

      await sendToRoom(location, message);
    },
  });

  // +ooctag [<literal> | reset | clear]
  addCmd({
    name: "+ooctag",
    pattern: /^\+ooctag(?:\s+(.*))?$/i,
    lock: "",
    help: `+ooctag [<literal>]  — Set or view your personal OOC tag.

The <literal> is the complete tag string used inside your OOC messages —
decoration and MUSH color codes included. With no argument, shows your
current effective tag. Use 'reset' or 'clear' to remove your override
and fall back to the admin's theme tag.

Examples:
  +ooctag                    Show current tag + preview.
  +ooctag [%cyOOC%cn]        Set personal tag to bright-yellow [OOC].
  +ooctag <<%crOOC%cn>>      Double-bracket variant.
  +ooctag reset              Clear override; use admin's theme tag.`,
    exec: async (u) => {
      const sid = u.socketId || "";
      const playerObj = await dbojs.queryOne({ id: u.me.id });
      if (!playerObj) return send([sid], error("Player not found."));

      const raw = (u.cmd.args[0] ?? "").trim();

      if (!raw) {
        const override = playerObj.data?.ooctag as string | undefined;
        const effective = effectiveTag(playerObj);
        const source = override && override.trim() ? "personal" : "theme default";
        return send([sid], info(`OOC tag (${source}): ${effective}`));
      }

      const lower = raw.toLowerCase();
      if (lower === "reset" || lower === "clear") {
        await dbojs.modify({ id: playerObj.id }, "$unset", { "data.ooctag": 1 } as unknown as Partial<IDBOBJ>);
        return send([sid], success(`OOC tag cleared. Now using: ${currentTheme().ooc.tag}`));
      }

      await dbojs.modify({ id: playerObj.id }, "$set", { "data.ooctag": raw } as Partial<IDBOBJ>);
      send([sid], success(`OOC tag set. Preview: ${raw}`));
    },
  });
}
