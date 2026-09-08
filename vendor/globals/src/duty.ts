/**
 * +duty — staff on/off-duty toggle.
 *
 * Off-duty staff are hidden from the +staff online roster but stay
 * connected. Stored at `data.offduty` (boolean).
 */

import { addCmd, dbojs, send } from "@ursamu/ursamu";
import type { IDBOBJ, IUrsamuSDK } from "@ursamu/ursamu";
import { error, info, success } from "./messages.ts";

function isStaff(obj: IDBOBJ): boolean {
  const f = obj.flags as unknown;
  if (!(f instanceof Set)) return false;
  return f.has("admin") || f.has("wizard") || f.has("superuser") || f.has("staff");
}

export async function execDuty(u: IUrsamuSDK): Promise<void> {
  const sid = u.socketId || "";
  const playerObj = await dbojs.queryOne({ id: u.me.id });
  if (!playerObj) return send([sid], error("Player not found."));
  if (!isStaff(playerObj)) return send([sid], error("Only staff may use +duty."));

  const off = !!playerObj.data?.offduty;
  if (off) {
    await dbojs.modify({ id: playerObj.id }, "$unset", { "data.offduty": 1 } as unknown as Partial<IDBOBJ>);
    send([sid], success("You are now on-duty."));
    return;
  }
  await dbojs.modify({ id: playerObj.id }, "$set", { "data.offduty": true } as Partial<IDBOBJ>);
  send([sid], info("You are now off-duty. You won't appear in the +staff online roster."));
}

export function registerDutyCommand(): void {
  addCmd({
    name: "+duty",
    pattern: /^\+duty$/i,
    lock: "connected",
    category: "Staff",
    help: `+duty  — Toggle your staff on/off-duty status.

Off-duty staff stay connected but don't appear in the +staff online
roster. Use this when you want to hang out without looking like
you're available for tickets.

Examples:
  +duty            Toggle current status.`,
    exec: execDuty,
  });
}
