# dad simulator

A first-person life sim: raise one kid from the first night home to college
drop-off across four walkable locations, while keeping yourself, your marriage,
your career, and your savings alive. One run takes 20 to 30 minutes.

**Controls:** `W A S D` walk, mouse to look (or arrow keys), `E` / `1`–`2` choose
how to interact with the highlighted station, `T` drive / Town Map (or walk up to
your car), `Tab` finances, 529 & home upgrades, `P` pause, `M` mute sound.

## What's in the game

- **One day is one year.** Each in-game day (~65s awake, ~9s asleep) represents a
  year of your kid's life. Seasons shift across the 18 years, the sun and starry
  sky track across the neighborhood, your kid grows, furniture and wall photos
  evolve, and household clutter visibly builds up until you clean.
- **Four walkable locations:**
  - **Home & Neighborhood** — Craftsman home with kitchen, bedroom, evolving kid's
    room, home office/workshop, garage gym, stone backyard patio, driveway with
    your family car, and neighboring houses.
  - **Maple Street Park** — Playground, half-court hoops, jogging trail, duck pond,
    picnic lawn, and neighbor dads. Great for Motor, Fitness, Social, and Bond.
  - **Workplace** — Adapts to your career (*Job Site & Shop* for Blue Collar,
    *Downtown Office* for White Collar, *Startup Loft* for Tech). Commuting yields
    higher career impact, overtime options, and breakroom networking compared to
    working from home.
  - **Main Street Plaza** — Walkable small-town square with **Main Street Bistro**
    (in-world candlelit Date Nights with your spouse), **Corner Market** (stock up
    on fresh groceries & family gifts), **O'Malley's Pub** (in-world nights out
    with friends), and **Maple Clinic** (wellness checkups & workshops).
- **Meaningful choices & activity stances:**
  - Stations offer genuine daily tradeoffs: cook a fresh meal vs. quick takeout,
    steady shift vs. overtime crunch, full bedtime routine vs. quick lights-out,
    family movie night vs. solo screen time, WFH vs. commuting.
  - Dilemmas mix multi-axis parenting tradeoffs (shaping your **Parenting Style**:
    *Presence*, *Warmth*, *Structure*, *Provider*) with pediatric evidence moments
    grounded in AAP & CDC guidance.
- **Finances, 529 & Home Upgrades (`Tab`):**
  - After-tax income, household costs, 18% APR credit-card interest if you run
    negative, a 529 college fund compounding at 6%/yr toward the ~$110k bill, plus
    6 physical home upgrades (Espresso Machine, Robot Vacuum, Backyard Hoop,
    Pro Desk/Tool Chest, Garage Power Rack, Trusted Sitter Network) that appear in
    the 3D world and improve your routines.

## Tech

Zero build step. Static `index.html` + modular ES modules (`js/sim.js`,
`js/events.js`, `js/world.js`, `js/ui.js`, `js/audio.js`, `js/main.js`) +
`css/style.css`, loading Three.js r170 via import map. Procedural PBR textures,
synthesized Web Audio SFX & location ambience, wall-occluded interaction
targeting, and a clean pointer-lock state machine.

For balance testing, the console exposes a headless bot:

```js
__dad.run('good', 'white', { contrib: 250, walk: 0.25 }) // 'good' | 'work' | 'lazy', 'blue' | 'white' | 'tech'
```
