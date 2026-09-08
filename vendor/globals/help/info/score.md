SCORE

View your character scorecard.

SYNTAX
  score

EXAMPLES
  score                See your stats.

NOTES
  78-col bordered output. Fields shown: DBRef, Alias, Money (credits),
  Flags (sans "connected"), and &short-desc (if set), then a divider,
  then your Doing message.

  If &SCORE-EXTRA is set on you, its contents render below a "Stats"
  section divider — useful for game-specific stat blocks rendered via
  softcode.

PLAYER ATTRIBUTES
  &score-extra me=<text>     Extra block appended under "Stats".
  &short-desc me=<text>      Short description shown on score/look.

SEE ALSO: help look, help inventory, help +finger
