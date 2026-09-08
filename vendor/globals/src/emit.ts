import { addCmd } from "@ursamu/ursamu";
import type { IUrsamuSDK } from "@ursamu/ursamu";
import { error, usage } from "./messages.ts";

/**
 * Rhost Vision: @emit
 *
 * Staff-only room broadcast — no target required, fires into the actor's
 * current location with no name decoration.
 */

export function registerEmitCommand(): void {
  addCmd({
    name: "@emit",
    pattern: /^@emit\s+(.+)/i,
    lock: "connected",
    category: "Staff",
    help: `@emit <message>  — Broadcast to your current room.

Staff only. The message is sent verbatim to every connected
listener in your location, with no speaker prefix.

Examples:
  @emit The lights flicker.
  @emit %ch%crA cold wind blows through the room.%cn`,
    exec: (u: IUrsamuSDK) => {
      const actor = u.me;
      if (
        !actor.flags.has("admin") &&
        !actor.flags.has("wizard") &&
        !actor.flags.has("superuser")
      ) {
        u.send(error("Permission denied."));
        return;
      }

      const message = (u.cmd.args[0] ?? "").trim();
      if (!message) {
        u.send(usage("@emit <message>"));
        return;
      }

      u.here.broadcast(message);
    },
  });
}
