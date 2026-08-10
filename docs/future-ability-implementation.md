# Future ability implementation

The current calculator models one authored primary damage packet per cast. The
following Set 17 abilities need engine-level state or multi-target support before
they can be represented accurately:

- **Teemo**: passive attack poison stacks and temporary attack-speed active.
- **Corki**: attack-triggered missile volleys, Meep cooldown reduction, and
  conditional proc damage.
- **Miss Fortune**: damage varies by the current Arsenal tier and is a cone
  channel rather than a single packet.
- **Mordekaiser**: repeated shield pulses and adjacent damage over the cast
  duration (the primary pulse is covered separately where possible).
- **Nami, Sona, and Vex**: repeated projectiles/strikes and bounce or debris
  targeting need packet timelines and target selection.
- **Morgana**: simultaneous damage, healing, health gain, and target-count
  dependent effects.
- **Zed**: clone/state transformation changes attack and mana behavior rather
  than dealing a direct cast packet.

These cases should be implemented after the combat model supports cast-local
state, multiple targets, and scheduled damage events. Until then, the calculator
must report the omitted effects as explicit unsupported assumptions rather than
silently treating them as a complete cast.
