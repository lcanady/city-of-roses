// core/format.ts -- wod20th display chrome.
//
// Synchronous 78-column layout helpers. The @ursamu/globals renderer is
// async (it evaluates softcode theme templates), which does not fit the
// plugin's sync report call sites -- so wod20th renders the same chrome
// locally with the default theme's separators.

const WIDTH = 78;
const MAJ = "=";
const MIN = "-";

function center(text: string, pad: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const total = width - text.length;
  const left = Math.floor(total / 2);
  const right = total - left;
  return pad.repeat(left) + text + pad.repeat(right);
}

/** Full-width header bar with a centered title. */
export function header(title: string): string {
  const t = title.trim();
  if (!t) return MAJ.repeat(WIDTH);
  return center(` ${t} `, MAJ, WIDTH);
}

/** Full-width section divider with an optional centered label. */
export function divider(label: string | null): string {
  if (!label) return MIN.repeat(WIDTH);
  return center(` ${label.trim()} `, MIN, WIDTH);
}

/** Full-width footer bar. */
export function footer(): string {
  return MAJ.repeat(WIDTH);
}

/**
 * Framed panel: header(title), one line per body entry, footer.
 * Body lines render verbatim (callers pre-indent and pre-color).
 */
export function frame(
  title: string,
  body: readonly string[],
): string {
  return [
    header(title),
    ...body,
    footer(),
  ].join("%r");
}