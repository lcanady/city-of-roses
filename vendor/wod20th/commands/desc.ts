// commands/desc.ts -- @desc[/<plane>] <target>=<value>
// Sets a description on any target the actor can edit. Without a switch,
// writes state.description (default). With /<plane>, writes state.<plane>Description
// (e.g. /penumbra -> state.penumbraDescription) -- sgp's look reads this when
// a viewer in <plane> looks at the target.
//
// Targets:  "me"  | "here"  | any name resolvable via u.util.target
// Clear:    empty value (after `=`) deletes the field.
import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";

const PLANE_RX = /^[a-z][a-z0-9-]*$/;
const MAX_DESC = 4096;

addCmd({
  name: "@desc",
  pattern: /^@desc(?:\/(\S+))?\s+(.+?)\s*=\s*(.*)$/i,
  lock: "connected",
  category: "Building",
  help: `@desc[/<plane>] <target>=<value>  -- Set a description.

  Without a switch, writes the default description. With /<plane>, writes
  a plane-specific description shown when a viewer in that reality looks
  at the target. Empty value clears the field.

SYNTAX
  @desc <target>=<value>
  @desc/<plane> <target>=<value>
  @desc[/<plane>] <target>=         (clear)

SWITCHES
  /<plane>  Lower-case slug of a reality plane (e.g. /penumbra,
            /deep-umbra, /astral, /shadowlands).

TARGETS
  me, here, or any name you can edit.

EXAMPLES
  @desc here=A still pool that mirrors the moon...
  @desc/penumbra here=The pool is a portal of liquid silver...
  @desc me=A tall figure in a worn leather jacket.
  @desc/penumbra me=A wolf-shape woven of moonlight.
  @desc/penumbra Strongbox=         (clear the penumbra desc)

SEE ALSO: +help look, +help stepside, +help wod20th`,

  exec: async (u: IUrsamuSDK) => {
    const switchArg = (u.cmd.args[0] ?? "").toLowerCase().trim();
    const targetArg = u.util.stripSubs(u.cmd.args[1] ?? "").trim();
    const value     = (u.cmd.args[2] ?? "").trim();

    if (!targetArg) { u.send("Usage: @desc[/<plane>] <target>=<value>"); return; }

    // -- resolve target ----------------------------------------------------
    const tArgLower = targetArg.toLowerCase();
    let target;
    if (tArgLower === "me")        target = u.me;
    else if (tArgLower === "here") target = u.here;
    else                            target = await u.util.target(u.me, targetArg, true);

    if (!target) { u.send(`Target not found: ${targetArg}`); return; }
    if (!(await u.canEdit(u.me, target))) { u.send("Permission denied."); return; }

    // -- determine field key ----------------------------------------------
    let fieldKey: string;
    let label: string;
    if (!switchArg) {
      fieldKey = "state.description";
      label = "description";
    } else {
      if (!PLANE_RX.test(switchArg)) {
        u.send(`Invalid plane: %ch${switchArg}%cn. Use lower-case kebab-case (e.g. /penumbra).`);
        return;
      }
      fieldKey = `state.${switchArg}Description`;
      label = `${switchArg} description`;
    }

    if (value.length > MAX_DESC) {
      u.send(`Descriptions are limited to ${MAX_DESC} characters.`);
      return;
    }

    // -- write or clear ---------------------------------------------------
    if (value === "") {
      await u.db.modify(target.id, "$unset", { [fieldKey]: "" });
      u.send(`%cy${u.util.displayName(target, u.me)}'s ${label} cleared.%cn`);
      return;
    }

    await u.db.modify(target.id, "$set", { [fieldKey]: value });
    u.send(`%cg${u.util.displayName(target, u.me)}'s ${label} set (${value.length} chars).%cn`);
  },
});
