+MOTD

Game-wide Message of the Day. Two scopes: **general** (visible to all)
and **wizard** (staff-only). Both are ordered lists.

SYNTAX
  +motd                          View the panel.
  +motd/set <scope>=<text>       Append an entry. (admin+)
  +motd/del <scope>=<n>          Remove entry #n in <scope>. (admin+)
  +motd/list                     Same as bare +motd.
  +motd/reset <scope>            Wipe all entries in <scope>. (admin+)

EXAMPLES
  +motd/set general=Server reboot Sunday at 02:00 UTC.
  +motd/set wizard=Watch new player Alice (#42) for cheating.
  +motd/del general=2
  +motd/reset wizard
