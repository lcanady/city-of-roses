+WHERE

See where connected players are located, grouped by grid area.

SYNTAX
  +where
  where

EXAMPLES
  +where              List all online players by area.

NOTES
  78-col bordered display. Columns: Player | Type | Idle | Location.
  Players are grouped under area headers ("---< Area >---") taken from
  each room's grid_area attribute. Areas sort alphabetically; "OOC"
  always renders last. Within an area, players sort alphabetically.

  The Type column reads "Staff" for wizard/admin/superuser; blank
  otherwise. Idle is color-coded (green recent, yellow hours, dim days).

  Players in rooms flagged dark or unfindable list under an
  "Unfindable:" section without a location — staff bypass this and see
  everyone. Dark players are hidden from non-staff entirely. Footer
  shows the total visible count.

SEE ALSO: help who, help +staff, help +finger
