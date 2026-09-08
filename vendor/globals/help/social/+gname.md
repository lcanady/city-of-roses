+GNAME

Blend a list of color stops across the letters of your name (HSL,
shortest-arc hue) and store the result as your @moniker. Whitespace
in the name stays uncolored.

SYNTAX
  +gname <color1> <color2> [<color3> ...]   Set gradient moniker.
  +gname                                    Show current setting.
  +gname reset                              Clear (restore plain name).

COLORS
  hr hg hy hb hm hc hw          Bright ANSI shorthand.
  r  g  y  b  m  c  w           Dark ANSI shorthand.
  gold crimson skyblue ...      CSS named (147 entries).
  DodgerBlue1 Salmon1 Grey50    xterm 256-color names.
  #ff5500 / ff5500              Hex literal.

EXAMPLES
  +gname gold red               Two-stop yellow-to-red.
  +gname red blue green         Three-stop rainbow-ish.
  +gname #ff00aa #00ffff        Hex stops.
  +gname reset                  Back to plain.

SEE ALSO: +finger
