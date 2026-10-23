# clutch

A sandbox for learning to drive stick. Four panels, one screen: a cutaway of
the clutch and gearbox, a top-down road view, the pedals, and the shifter.
Steering is on rails — the only job is working the clutch without stalling,
lurching, or grinding gears.

**Controls:** `Q` clutch, `W` brake, `E` gas (hold to press; the clutch comes
up slowly so tapping `Q` feathers it). Arrow keys move the shifter through the
H-pattern; hold ↑/↓ to carry on through neutral (1→2, 3→4). Pedals can also be dragged with the mouse or a finger (multi-touch
works); the shift knob can be dragged, or click a gear number. `R` restarts,
`1`–`6` pick a scenario, `M` mutes, `S` (or the Synchro button) toggles
synchromesh off for a "crash box" where you have to double-declutch.

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
- **Car:** a 2008–12 US Honda Accord 2.4 manual. Gear ratios (3.267 /
  1.778 / 1.154 / 0.870 / 0.647) and the 4.389 final drive are Honda's 88E5
  gearbox; the engine curve is fitted to the K24Z2's 161 lb·ft @ 4300 and
  177 hp @ 6500. Mass (~1465 kg), tire (215/60R16), drag and the reverse
  ratio are approximate. Rolling and aero drag, brakes as Coulomb friction
  that can hold the car still. Top speed falls out of the drag balance
  (~140 mph; the real car is limited lower).
- **Gearbox:** drawn as a two-shaft transaxle — input-shaft gears drive
  free-wheeling output-shaft gears, synchro sleeves lock one to the shaft,
  and the output pinion turns the differential's ring gear, which turns the
  wheel. The tachometer has two needles — engine and gearbox input — and in
  neutral, dashed ghost needles mark the speed each gear in the shifter's
  column needs.
- **Shifting:** the dog teeth only mesh if the gearbox input already turns
  at the gear's speed (within ~240 rpm). With the clutch out that input is
  the engine, so a rev-matched clutchless shift works and anything else
  grinds. With the clutch in, a synchro cone drags the input to speed and the
  gear goes in a moment later; in crash-box mode there's no cone, so you wait
  for it to spin down (upshift) or double-declutch to spin it up
  (downshift). Reverse needs the car stopped.
- **Jerk** is the low-passed rate of change of drivetrain force; a spike past
  ~16 m/s³ counts as a lurch.

Everything is one static `index.html` — canvas and WebAudio, no libraries, no
build, runs from `file://`.
