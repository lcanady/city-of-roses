/**
 * src/commands.ts
 *
 * Barrel that wires every native command into the engine at *module load*.
 * `src/index.ts` imports this file once, before `init()` runs, so all
 * `addCmd()` calls fire during Phase 1 of the plugin lifecycle.
 *
 * The script overrides (look, who, where, mail, page, score, examine,
 * inventory) are NOT registered here — they're file-copied into
 * `system/scripts/` from `init()`. See `src/index.ts`.
 */

import { registerFingerCommands }    from "./finger.ts";
import { registerOocTalkCommands }   from "./ooc.ts";
import { registerGNameCommand }      from "./gname.ts";
import { registerStaffCommands }     from "./staff.ts";
import { registerEmitCommand }       from "./emit.ts";
import { registerExitTypeCommand }   from "./exittype.ts";
import { registerDutyCommand }       from "./duty.ts";
import { registerGlanceCommand }     from "./glance.ts";
import { registerUptimeCommand }     from "./uptime.ts";
import { registerMotdCommand }       from "./motd.ts";
import { registerTeleportCommands }  from "./teleport.ts";
import { registerPlusInvCommand }    from "./inv.ts";

registerFingerCommands();
registerOocTalkCommands();
registerGNameCommand();
registerStaffCommands();
registerEmitCommand();
registerExitTypeCommand();
registerDutyCommand();
registerGlanceCommand();
registerUptimeCommand();
registerMotdCommand();
registerTeleportCommands();
registerPlusInvCommand();
