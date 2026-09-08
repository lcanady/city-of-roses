/**
 * coloredName — render an object's display name with its @moniker if set.
 *
 * Other plugins import this via `import { coloredName } from "@ursamu/globals"`
 * to get the same name-rendering behavior the look/who scripts use:
 *
 *   - If the object has @moniker (`data.moniker`), return it verbatim so any
 *     embedded MUSH color codes survive intact (this is how +gname stores its
 *     gradient output).
 *   - Otherwise return the plain name in bright white with a trailing reset.
 *
 * The previous +namecolor command is gone — gradient @moniker via +gname
 * replaces it.
 */

import type { IDBOBJ } from "@ursamu/ursamu";

export function coloredName(playerObj: IDBOBJ): string {
  const moniker = (playerObj.data?.moniker as string) || "";
  if (moniker) return moniker;
  const name = (playerObj.data?.name as string) || "Unknown";
  return `%ch%cw${name}%cn`;
}
