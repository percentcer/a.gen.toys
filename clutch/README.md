# clutch

A sandbox for learning to drive stick. Four panels, one screen: a cutaway of
the clutch and gearbox, a top-down road view, the pedals, and the shifter.
Steering is on rails — the only job is working the clutch without stalling,
lurching, or grinding gears.

**Controls:** `Q` clutch, `W` brake, `E` gas (hold to press; the clutch comes
up slowly so tapping `Q` feathers it). Arrow keys move the shifter through the
H-pattern. Pedals can also be dragged with the mouse or a finger (multi-touch
works); the shift knob can be dragged, or click a gear number. `R` restarts,
`1`–`6` pick a scenario, `M` mutes.

**Scenarios:** Launch (pull away, stop at the line), Parallel (stop in each
green box; the chevrons say which way to go next), 3-Point, Merge (be at 50
mph by the end of the on-ramp), Exit (slow to the 45 mph ramp curve, stop at
the sign), and Free (an endless loop). Faults are counted up top.

## The model

- **Engine:** torque curve × throttle minus friction, flywheel inertia, an
  idle controller that holds ~820 rpm and fights bogging. Below ~380 rpm it
  stalls. With the clutch in (or in neutral) it cranks itself back to life;
  coasting in gear with the clutch out will bump-start it.
- **Clutch:** clamp load vs. pedal travel has free play at the top, a
  progressive bite zone, and full release near the floor (the wedge beside
  the clutch pedal draws it). It's a stick–slip friction coupling: slipping
  transmits its rated torque toward the slower side; once the speeds meet it
  locks and the engine and car share inertia until the torque demand exceeds
  the clamp capacity again. Slip heats the friction faces (they glow).
- **Car:** 1300 kg, five gears + reverse, rolling and aero drag, brakes as
  Coulomb friction that can hold the car still. The tachometer has two
  needles — engine and gearbox input — so you can watch slip close up.
- **Shifting** into gear needs the clutch released from the flywheel (or rpm
  already matched within ~250); reverse needs the car stopped. Otherwise it
  grinds.
- **Jerk** is the low-passed rate of change of drivetrain force; a spike past
  ~16 m/s³ counts as a lurch.

Everything is one static `index.html` — canvas and WebAudio, no libraries, no
build, runs from `file://`.
