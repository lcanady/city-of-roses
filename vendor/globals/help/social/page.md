PAGE

Send a private message to another connected player.

SYNTAX
  page <player>=<message>     Send a normal page.
  page <player>=:<pose>       Send a pose page.

EXAMPLES
  page Bob=Are you busy?
  page Bob=:waves hello.

NOTES
  Output uses Rhost styling:

    Jupiter(J) pages: Hello there!
    You paged Jupiter with 'Hello there!'.

  Pose form:

    From afar, Jupiter(J) waves.
    Long distance to Jupiter: Jupiter waves.

  Sender's &alias appears in parens after their name. @moniker is
  rendered verbatim if set; otherwise &name_color colors the first
  letter. Target must be connected and not dark.

SEE ALSO: help +finger, help ooc
