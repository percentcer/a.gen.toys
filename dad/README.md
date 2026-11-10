# dad simulator

A first-person life sim: raise one kid from the drive home from the hospital to
college drop-off, and keep yourself, your marriage and your job alive while you
do it. One run takes 20 to 30 minutes.

**Controls:** `W A S D` walk, mouse to look (arrow keys also work), `E` start or
stop the highlighted activity, `1`-`3` answer a dilemma or pick a second option,
`Tab` finances and the college fund, `P` pause, `M` mute.

## How it plays

- **One day is one year.** Each in-game day (60 seconds awake, 10 asleep) stands
  for a year of the kid's life. The sun tracks across the house, the kid grows,
  the furniture changes (crib to bed, changing table to homework desk), and at
  6 AM on day nineteen you drive to the dorm.
- **Sims-style needs.** Dad has Energy, Fitness, Mind and Social. The kid has
  Food, Sleep, Diaper (until potty trained), Fun, Love and, from age six,
  School. Above those sit three slow bars: Fatherhood, Marriage and Career.
- **Everything is a place in the house.** Bed, desk (or workbench), garage gym,
  couch, TV, play mat, kitchen table, sink, crib, reading chair, back yard,
  front door. Walk up, press `E`, stay as long as you want. Icons pulse when
  something needs you.
- **Your spouse is a person, not a meter.** They work 8 to 4, sleep at night and
  pick up whatever the kid needs that you are not handling. That builds their
  load; a spouse who carries too much, in a messy house, with no time together,
  leaves.
- **The kid develops.** Motor, Language, Social and Thinking grow with age,
  faster when needs are met and you read, play, go outside, help with homework
  and eat together. The bars show progress against "on track for this age".
  Milestones (first smile, first steps, rides a bike, driving test) fire when
  the kid is old enough *and* developed enough.
- **Dilemmas.** About 27 decision cards arrive at the age they happen in real
  life (safe sleep, a fever at six weeks, daycare, peanuts, tantrums, the first
  phone, vaping, car keys). After you choose, the card tells you what the
  pediatric literature says. Some choices come back later.
- **XP.** Life-satisfaction XP accrues from balance: it is the average of all
  your bars, scaled down by your worst one. Levels unlock dad perks.

### Careers

| | Pay | Catch |
|---|---|---|
| Blue collar | $74k, hourly, overtime paid | Tiring. Keeps you fit, low stress, immune to the AI layoff. |
| White collar | $96k salaried | Laid off by AI around year 9. |
| Tech bro | $150k salaried | High cost of living, high stress, needs more hours, laid off by AI around year 9. |

### What your friend asked for, and where it is

| Request | In the game |
|---|---|
| Neglect your marriage, get divorced | Marriage at 0 triggers divorce: savings halved, costs up, spouse gone from the house. Counseling is offered once on the way down. |
| Don't work out, hypertension | A two-year average of Fitness below ~35 gets a stage 1 diagnosis at the annual physical: faster energy drain and a lower cap until you get fit again. |
| Don't sleep, lose mental health | Low Energy drains Mind; at zero Mind you burn out and lose ground at work and home. |
| Invest in college early or loans | A 529 in the `Tab` panel compounds at 6% a year. $250 a month from birth covers most of the $110k bill; the same amount started at ten covers under a third. The shortfall is student loans on the end screen. |
| Laid off by AI mid-game | White collar and tech are laid off around year 9 and must job hunt. Blue collar gets a raise offer instead. |
| Too much screen time | See the note below. |

**One deliberate change.** The brief said too much screen time gives the kid a
developmental disability. The literature does not support that. What it shows is
an association between heavy early screen use and developmental *delays*, mainly
in language and attention, largely because screens displace talk, play and
sleep. So the game models exactly that: screen hours above the age guideline
slow Language, Social and Thinking growth, the pediatrician flags a speech delay
at the 2, 3 or 5-year visit, and early intervention plus reading catches the kid
back up.

## The model, and where the numbers come from

Rates are per game hour. These are the ones grounded in guidance; the rest are
tuned for play.

- **Kid sleep need** by age (14 h infants, 12.5 h toddlers, 11.5 h preschool,
  10.5 h school age, 9 h teens) from the AASM consensus [1]. Bedtimes drift
  later in the teens [2]; an unrestricted phone pushes bedtime almost two hours
  later.
- **Night wakings**: two a night under six months, one until twelve months,
  tapering through age four.
- **Bedtime routine** (bath, book, bed) gives a sleep bonus [3].
- **Screen guideline**: none under 2, one hour for ages 2-5 [4]. The AAP gives
  no hour limit for older kids, only a family media plan [5]; the game uses 2 h
  (6-12) and 3 h (13+) as a stand-in, after the 2-hour recreational limit
  studied in [6]. Penalty grows with hours over the line [7][8].
- **Development boosts**: reading aloud for language [9], play for social and
  executive skills [10], outdoor play for motor [11], family dinner for language
  and connection [12], and father involvement generally [13].
- **Milestone ages** follow the 2022 CDC/AAP checklists [14].
- **Dad**: 7+ hours of sleep [15]; about half an hour of exercise a day holds
  Fitness level, in line with 150 min/week [11]; hypertension thresholds from
  [16]; paternal depression from [17].
- **Money**: about $15-17k a year to raise a child [18]; ~$110k for four years
  of in-state public college including room and board.

### Simplifications worth knowing about

- One day per year means the kid's "typical day" is all you see. No siblings, no
  summers, no weekends.
- The spouse is competent and tireless up to a point. Real co-parenting is
  messier.
- Dilemma outcomes are deterministic and mild. The real risks behind several of
  them (unsafe sleep, drowning, an untreated newborn fever) are far worse than a
  lost Mind point; the game stops at a scare.
- It is a game, not medical advice.

## References

Citations were written from memory of the literature and have not been
re-checked against the journals. Verify before quoting them anywhere that
matters.

1. Paruthi S, et al. Recommended amount of sleep for pediatric populations: a consensus statement of the American Academy of Sleep Medicine. *J Clin Sleep Med* 2016;12(6):785-6.
2. AAP Adolescent Sleep Working Group. School start times for adolescents. *Pediatrics* 2014;134(3):642-9.
3. Mindell JA, et al. A nightly bedtime routine: impact on sleep in young children and maternal mood. *Sleep* 2009;32(5):599-606.
4. AAP Council on Communications and Media. Media and young minds. *Pediatrics* 2016;138(5):e20162591.
5. AAP Council on Communications and Media. Media use in school-aged children and adolescents. *Pediatrics* 2016;138(5):e20162592.
6. Walsh JJ, et al. Associations between 24 hour movement behaviours and global cognition in US children. *Lancet Child Adolesc Health* 2018;2(11):783-91.
7. Madigan S, et al. Association between screen time and children's performance on a developmental screening test. *JAMA Pediatr* 2019;173(3):244-50.
8. Radesky JS, et al. Longitudinal associations between use of mobile devices for calming and emotional reactivity and executive functioning in children aged 3 to 5 years. *JAMA Pediatr* 2023;177(1):62-70.
9. AAP Council on Early Childhood. Literacy promotion: an essential component of primary care pediatric practice. *Pediatrics* 2014;134(2):404-9.
10. Yogman M, et al. The power of play: a pediatric role in enhancing development in young children. *Pediatrics* 2018;142(3):e20182058.
11. US Department of Health and Human Services. *Physical Activity Guidelines for Americans*, 2nd ed. 2018.
12. Hammons AJ, Fiese BH. Is frequency of shared family meals related to the nutritional health of children and adolescents? *Pediatrics* 2011;127(6):e1565-74.
13. Yogman M, Garfield CF; AAP Committee on Psychosocial Aspects of Child and Family Health. Fathers' roles in the care and development of their children. *Pediatrics* 2016;138(1):e20161128.
14. Zubler JM, et al. Evidence-informed milestones for developmental surveillance tools. *Pediatrics* 2022;149(3):e2021052138.
15. Watson NF, et al. Recommended amount of sleep for a healthy adult. *Sleep* 2015;38(6):843-4.
16. Whelton PK, et al. 2017 ACC/AHA guideline for the prevention, detection, evaluation, and management of high blood pressure in adults. *Hypertension* 2018;71(6):e13-e115.
17. Paulson JF, Bazemore SD. Prenatal and postpartum depression in fathers and its association with maternal depression. *JAMA* 2010;303(19):1961-9.
18. Lino M, et al. *Expenditures on Children by Families, 2015.* USDA, 2017.

Dilemma cards cite their own sources in-game: Moon et al. 2022 (safe sleep),
Pantell et al. 2021 (febrile infants), Wolke et al. 2017 (crying), NICHD ECCRN
2006 (child care), Du Toit et al. 2015 (peanut), AAP 2007 (injury prevention),
CDC/ACIP (vaccines), Daminger 2019 (cognitive labor), Sege & Siegel 2018
(discipline), Brazelton 1962 (toilet training), Denny et al. 2019 (drowning),
Galloway et al. 2006 and Wardle et al. 2003 (feeding), White et al. 2019
(chores), Gini & Pozzoli 2009 (bullying), Breuner & Mattson 2016 (sex ed),
Brenner 2016 (sports specialization), Zuckerbrot et al. 2018 (teen depression),
Mattick et al. 2018 and Steinberg 2001 (alcohol, parenting style), Alderman &
Johnston 2018 (teen driving), Shapiro, Gottman & Carrère 2000 (marriage after a
baby).

## Tech

One static `index.html`. three.js (r170) is loaded from jsDelivr through an
import map, so it needs a network connection the first time; no build step.
PBR materials, a shadow-casting sun that follows the clock, warm interior
lamps at night, ACES tone mapping. Furniture and people are built from
primitives in code; there are no asset files.

For balancing, the console exposes a headless bot:

```js
__dad.run('good', 'white', {contrib: 250, walk: .35})  // or 'work' / 'lazy', 'blue' / 'tech'
```

It plays all 18 years in a few hundred milliseconds and returns the ending.
