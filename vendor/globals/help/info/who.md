WHO

List all connected (non-dark) players in Rhost-style columns.

SYNTAX
  who

EXAMPLES
  who                 List everyone online.

NOTES
  Columns: Player Name | On For | Idle | Doing. Sorted by most recent
  login first. @moniker is rendered verbatim if set; otherwise the
  first letter is colored from &name_color (staff color), rest in
  bright white.

  On For shows HH:MM, or "Xd HH:MM" past 24 hours. Idle uses s/m/h/d.
  Doing is the player's @doing message.

  Dark players are hidden. Footer shows the total count.

SEE ALSO: help +where, help +staff, help +finger
