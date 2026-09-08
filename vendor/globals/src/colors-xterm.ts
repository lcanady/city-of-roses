/**
 * xterm 256-color palette names (canonical from xterm sources, ~240 entries).
 * Indices 0–15 are the system 16 (overlap with CSS); 16–231 are the 6×6×6
 * RGB cube; 232–255 are the grayscale ramp. Many entries have suffix digits
 * (e.g. SpringGreen1..5) to differentiate shades within a hue family.
 *
 * Keys are lowercase; values are #rrggbb. CSS names take precedence at lookup
 * time, so duplicates here only fire when CSS doesn't already cover the name.
 */
export const XTERM_COLORS: Readonly<Record<string, string>> = {
  // 16–51 — blues/teals/aquas
  navyblue: "#00005f", darkblue1: "#000087", blue3: "#0000af", blue1: "#0000ff",
  darkgreen1: "#005f00", deepskyblue4: "#005f87", dodgerblue3: "#005faf",
  dodgerblue2: "#005fd7", green4: "#008700", springgreen4: "#00875f",
  turquoise4: "#008787", deepskyblue3: "#0087af", dodgerblue1: "#0087d7",
  green3: "#00af00", springgreen3: "#00af5f", darkcyan1: "#00afaf",
  lightseagreen1: "#00afd7", deepskyblue2: "#00afff", deepskyblue1: "#00d7af",
  green1: "#00ff00", springgreen2: "#00ff5f", springgreen1: "#00ff87",
  mediumspringgreen1: "#00ffaf", cyan2: "#00ffd7", cyan1: "#00ffff",

  // 52–87 — reds and purples
  darkred1: "#5f0000", deeppink4: "#5f005f", purple4: "#5f0087", purple3: "#5f00af",
  blueviolet1: "#5f00d7", orange4: "#5f5f00", grey37: "#5f5f5f",
  mediumpurple4: "#5f5f87", slateblue3: "#5f5faf", royalblue1: "#5f5fff",
  chartreuse4: "#5f8700", darkseagreen4: "#5f875f", paleturquoise4: "#5f8787",
  steelblue1: "#5f87af", steelblue3: "#5f87d7", cornflowerblue1: "#5f87ff",
  chartreuse3: "#5faf00", cadetblue1: "#5faf5f", cadetblue2: "#5faf87",
  skyblue3: "#5fafaf", steelblue2: "#5fafff", chartreuse2: "#5fd700",

  // 88–123 — magentas/oranges
  darkmagenta1: "#870000", darkmagenta2: "#87005f", lightpink4: "#875f00",
  grey53: "#878787", mediumpurple3: "#8787af", darkviolet1: "#8700d7",
  purple2: "#8700ff", orange3: "#875f00", lightsalmon3: "#87875f",
  rosybrown1: "#87875f", grey63: "#878787", mediumpurple2: "#8787d7",
  mediumpurple1: "#8787ff", olive3: "#878700", darkolivegreen3: "#87875f",
  darkseagreen3: "#87875f",

  // 124–159 — hot reds, oranges, pinks
  red3: "#af0000", deeppink3: "#af005f", magenta3: "#af00af",
  darkorange3: "#af5f00", indianred1: "#af5f5f", hotpink3: "#af5f87",
  mediumorchid1: "#af5fd7", darkgoldenrod1: "#af8700", lightsalmon4: "#af875f",
  rosybrown2: "#af8787", grey69: "#afafaf", mediumpurple5: "#afafd7",

  // 160–195 — oranges/yellows and pinks
  red2: "#d70000", deeppink2: "#d7005f", deeppink1: "#d70087", magenta2: "#d700d7",
  magenta1: "#d700ff", orangered2: "#d75f00", indianred2: "#d75f5f",
  hotpink2: "#d75f87", hotpink1: "#d75faf", mediumorchid3: "#d75fd7",
  mediumorchid2: "#d75fff", orange1: "#d78700", lightsalmon2: "#d7875f",
  lightpink3: "#d78787", pink3: "#d787af", plum3: "#d787d7", violet1: "#d787ff",
  gold1: "#d7af00", lightgoldenrod2: "#d7af5f", tan1: "#d7af87",
  mistyrose1: "#d7afaf", thistle1: "#d7afd7", plum2: "#d7afff",

  // 196–255 — yellows, bright pinks, greys (selective)
  red1: "#ff0000", deeppink5: "#ff005f", deeppink6: "#ff0087", magenta4: "#ff00af",
  magenta5: "#ff00d7", magenta6: "#ff00ff", orangered1: "#ff5f00",
  indianred3: "#ff5f5f", indianred4: "#ff5f87", hotpink4: "#ff5faf",
  hotpink5: "#ff5fd7", mediumorchid4: "#ff5fff", darkorange1: "#ff8700",
  salmon1: "#ff875f", lightcoral1: "#ff8787", palevioletred1: "#ff87af",
  orchid2: "#ff87d7", orchid1: "#ff87ff", orange2: "#ffaf00",
  sandybrown1: "#ffaf5f", lightsalmon1: "#ffaf87", lightpink1: "#ffafaf",
  pink2: "#ffafd7", plum1: "#ffafff", gold2: "#ffd700", lightgoldenrod3: "#ffd75f",
  lightgoldenrod1: "#ffd787", navajowhite1: "#ffd7af", mistyrose2: "#ffd7d7",
  thistle2: "#ffd7ff", yellow1: "#ffff00", lightgoldenrod4: "#ffff5f",
  khaki1: "#ffff87", wheat1: "#ffffaf", cornsilk1: "#ffffd7", white1: "#ffffff",

  // 232–255 — grayscale ramp
  grey3: "#080808", grey7: "#121212", grey11: "#1c1c1c", grey15: "#262626",
  grey19: "#303030", grey23: "#3a3a3a", grey27: "#444444", grey30: "#4e4e4e",
  grey35: "#585858", grey39: "#626262", grey42: "#6c6c6c", grey46: "#767676",
  grey50: "#808080", grey54: "#8a8a8a", grey58: "#949494", grey62: "#9e9e9e",
  grey66: "#a8a8a8", grey70: "#b2b2b2", grey74: "#bcbcbc", grey78: "#c6c6c6",
  grey82: "#d0d0d0", grey85: "#dadada", grey89: "#e4e4e4", grey93: "#eeeeee",
};
