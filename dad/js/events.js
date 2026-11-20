// Dilemmas, reactive life events, and delayed follow-ups.
// Designed around genuine multi-axis tradeoffs + grounded pediatric evidence moments.

export const COLLEGE_COST = 110000;

export function createEvents(helpers) {
  const { getS, getN, fx, layoff, money, screenLimit, ratio, toast, style } = helpers;

  const EV = {
    hyper: {
      id: 'ev_hyper',
      title: 'The cuff squeezes twice',
      tag: 'Annual physical',
      text: () => {
        const N = getN();
        return `"138 over 88. Stage 1 hypertension," your doctor says, tapping the chart. "Between work and ${N.k}, when did you last get your heart rate up on purpose?" Until your fitness climbs back above 55, you tire faster and your energy tops out lower.`;
      },
      choices: [
        {
          t: 'Commit to the garage gym or park trail.',
          sub: 'No pills yet — 30 minutes of movement most days reverses it.',
          r: 'You dust off your running shoes. Even playing catch or jogging at Maple Street Park counts.',
        },
        {
          t: 'Ask for blood pressure meds while you figure out a routine. ($400/yr)',
          sub: 'Softens the fatigue penalty immediately, costs money.',
          fx: () => { fx({ money: -400, flag: { bpMeds: 1 } }); },
          r: 'The prescription takes the edge off the fatigue, though the doctor still wants you moving.',
        },
      ],
      lit: 'ACC/AHA 2017 guideline: stage 1 hypertension is 130–139 / 80–89 mmHg. Regular aerobic activity (~150 min/week) lowers systolic blood pressure roughly 5–8 mmHg (Whelton et al., Hypertension 2018;71:e13).',
    },

    divorce: {
      id: 'ev_divorce',
      title: 'Signed in the kitchen',
      tag: 'Your marriage',
      text: () => {
        const N = getN();
        return `${N.w} is not even raising their voice anymore, which is somehow worse. "I have felt alone in this house for years." You divide the savings, set up custody exchanges, and ${N.k} learns what two bedrooms look like.`;
      },
      choices: [
        {
          t: 'Sign the papers and commit to being a steady co-parent.',
          fx: () => {
            const S = getS();
            S.money = S.money > 0 ? S.money * 0.5 : S.money;
            fx({ mind: -22, social: -8, love: -16, bond: -5 });
          },
          r: () => {
            const N = getN();
            return `The house is quieter and monthly costs jump, but ${N.k} still needs you steady.`;
          },
        },
      ],
      lit: 'Roughly two-thirds of couples see relationship satisfaction dip in the years after a first child. Shared mental load and small daily bids for connection protect it more than grand gestures (Shapiro, Gottman & Carrere, J Fam Psychol 2000;14:59).',
    },

    counsel: {
      id: 'ev_counsel',
      title: '"We are just logistics"',
      tag: 'Your marriage',
      text: () => {
        const N = getN();
        return `${N.w} closes the laptop at 10 PM. "We hand off the kid, pay the bills, and collapse. When was the last time we actually looked at each other?" They found a couples therapist with a Thursday opening.`;
      },
      choices: [
        {
          t: 'Book therapy and guard a regular date night at the Town Bistro. ($2,200)',
          sub: 'Expensive upfront, permanently boosts time together.',
          fx: () => { fx({ marriage: 22, money: -2200, flag: { counsel: 1 } }); style('presence', 2); },
          r: 'The first two sessions are stiff and uncomfortable. By the fourth, you actually hear each other again.',
        },
        {
          t: 'Skip therapy, but promise to drop overtime and spend evenings together.',
          sub: 'Free, slows career momentum slightly while rebuilding trust.',
          fx: () => { fx({ marriage: 10, careerBar: -6, load: -10 }); style('presence', 1); },
          r: () => `${getN().w} is skeptical, but notices when you actually shut the laptop before dinner.`,
        },
        {
          t: '"Every parent of a young kid is tired. We will get through it."',
          sub: 'Saves money and hours now, leaves the rift unaddressed.',
          fx: () => { fx({ marriage: -5 }); style('provider', 1); },
          r: () => `${getN().w} nods slowly and goes to bed without another word.`,
        },
      ],
      lit: 'Couples who address drift early with scheduled connection and fair workload division recover far better than those who wait until resentment hardens.',
    },

    burnout: {
      id: 'ev_burnout',
      title: 'Hands on the steering wheel',
      tag: 'Your mind',
      text: () => 'You park in the driveway and cannot make yourself turn off the engine for twenty minutes. You have been pouring from an empty cup for months, and the cup just cracked.',
      choices: [
        {
          t: 'Take a real mental health week and tell your partner honestly.',
          sub: 'Costs work standing, restores Mind cleanly.',
          fx: () => { const S = getS(); S.dad.mind = 44; fx({ careerBar: -10, marriage: 4, energy: 15 }); style('warmth', 1); },
          r: 'Admitting you hit the wall scares you, then relieves you. Sleep, park jogs, and seeing friends are not luxuries.',
        },
        {
          t: 'Book a few therapy sessions and keep working half-pace. ($800)',
          sub: 'Protects your job, costs savings.',
          fx: () => { const S = getS(); S.dad.mind = 42; fx({ money: -800, careerBar: -4 }); },
          r: 'You get tools to quiet the noise before it spills onto the kitchen table.',
        },
      ],
      lit: 'About 1 in 10 fathers experience clinical depression or severe burnout during parenthood, which strongly affects child well-being too (Paulson & Bazemore, JAMA 2010;303:1961; AAP Yogman & Garfield 2016).',
    },

    fired: {
      id: 'ev_fired',
      title: 'The calendar invite with HR',
      tag: 'Your career',
      text: () => '"We are parting ways effective today." Your desk is boxed in fifteen minutes. You can hunt from home or network at the Workplace / Town until a new offer lands.',
      choices: [{ t: 'Pack the box and start the search.' }],
    },

    debt: {
      id: 'ev_debt',
      title: 'Red ink on the statement',
      tag: 'Family finances',
      text: () => {
        const S = getS();
        return `Your balance has slipped to ${money(S.money)}. High-interest credit cards (18% APR) are eating into every paycheck, and the tension is hanging over the house.`;
      },
      choices: [
        {
          t: 'Tighten the belt: cut extras and pick up extra shifts.',
          sub: 'Lowers household costs by 10% for two years, hurts Fun & Mind.',
          fx: () => { fx({ mind: -6, fun: -10, flag: { austerity: getS().h / 24 + 2 } }); style('structure', 2); },
          r: 'No takeout, no impulse buys, lots of pasta. Stressful, but the bleeding slows.',
        },
        {
          t: 'Pull $4,000 from the 529 college fund (with penalty) to clear the debt.',
          sub: 'Immediate relief if you have funds; hurts future compounding.',
          cond: () => getS().fund >= 4500,
          fx: () => { const S = getS(); S.fund = Math.max(0, S.fund - 4500); S.money += 3800; fx({ mind: 5 }); },
          r: 'The 10% penalty stings, yet breathing room today keeps the family afloat.',
        },
        {
          t: 'Keep riding the balance and hope for a raise.',
          sub: 'Interest keeps compounding against you.',
          fx: () => { fx({ mind: -5, marriage: -4 }); },
          r: 'You close the tab and tell yourself next quarter will be better.',
        },
      ],
    },

    speech: {
      id: 'ev_speech',
      title: 'Well-child developmental screen',
      tag: () => `${getN().k} · clinic checkup`,
      text: () => {
        const S = getS(), N = getN();
        return `At the clinic, the pediatrician scores the language checklist. "${N.k} is a bit behind where we like to see ${N.him} on words and expression.${S.screenAvg > screenLimit(S.h / 24) ? ' How many hours of screens are sneaking into an average day?' : ''} I recommend early speech intervention."`;
      },
      choices: [
        {
          t: 'Start speech therapy right away and build a daily reading habit. ($650)',
          sub: 'Costs money and time, accelerates Language growth for 2.5 years.',
          g: 1,
          fx: () => { const S = getS(); S.flags.catchup = S.h / 24 + 2.5; fx({ money: -650 }); style('presence', 2); },
          r: () => `Weekly sessions plus reading every night work wonders. ${getN().k} starts stringing sentences together fast.`,
        },
        {
          t: 'Skip formal therapy for now, cut screens to zero and read twice as much.',
          sub: 'Free, modest boost if you actually follow through.',
          fx: () => { const S = getS(); S.flags.catchup = S.h / 24 + 1.1; S.tv = false; },
          r: 'You unplug the tablet and stack library books on the nightstand. Progress is slower, but real.',
        },
        {
          t: '"Late talkers catch up on their own. Let us wait a year."',
          sub: 'Saves money now; loses peak early-intervention window.',
          r: 'You wait and hope. The gap takes longer to close later.',
        },
      ],
      lit: 'Higher early screen exposure is associated with language and attention delays largely because it displaces back-and-forth talk, play, and sleep (Madigan et al., JAMA Pediatr 2019;173:244). Early intervention is most effective under age 5.',
    },
  };

  const EVENTS = [
    {
      id: 'sleep',
      age: 0.015,
      title: 'First night home',
      text: () => {
        const N = getN();
        return `9:30 PM. ${N.k} finally nods off on your chest. Every time you set ${N.him} in the bare bassinet, ${N.he} startles awake. Your mother-in-law also brought over a plush crib quilt and bumper set.`;
      },
      choices: [
        {
          t: 'Keep trying the bare, flat bassinet next to your bed — on their back.',
          sub: 'More exhausting tonight, follows safe sleep guidance.',
          g: 1,
          fx: () => { fx({ energy: -6, mind: 4, marriage: 3 }); style('structure', 2); },
          r: () => `Three false starts and a lot of shushing, then ${getN().k} sleeps grunting like a tiny walrus.`,
        },
        {
          t: 'Pull the baby into bed between you so everyone gets sleep.',
          sub: 'Tempting at 2 AM, carries real sleep-safety risk.',
          fx: () => { fx({ energy: -10, mind: -6 }); },
          r: 'You stay half-awake all night rigid as a board, terrified of rolling over.',
        },
        {
          t: 'Use the plush quilt and crib bumpers so the bassinet feels cozy.',
          sub: 'Soft bedding increases suffocation risk.',
          fx: () => { fx({ marriage: -5, mind: -4 }); },
          r: () => `${getN().w} checks the discharge pamphlet at 1 AM and strips the crib bare. Tense silence.`,
        },
      ],
      lit: 'AAP 2022 safe sleep policy: back to sleep, firm flat surface, empty crib/bassinet, room-sharing without bed-sharing for at least the first 6 months (Moon et al., Pediatrics 2022;150:e2022057990).',
    },

    {
      id: 'fever',
      age: 0.12,
      title: '3 AM, six weeks old',
      text: () => {
        const N = getN();
        return `${N.k} feels warm. The rectal thermometer reads 100.6°F. ${N.He} is fussy, still taking a bottle, and you have a huge morning at work in four hours.`;
      },
      choices: [
        {
          t: 'Call the pediatrician on-call line immediately.',
          sub: 'Means an ER trip tonight and a brutal tomorrow.',
          g: 1,
          fx: () => { fx({ energy: -14, money: -450, bond: 4, careerBar: -2 }); style('presence', 2); },
          r: 'The nurse sends you straight to the ER. Five hours of waiting and clean labs — the best $450 boredom of your life.',
        },
        {
          t: 'Give a tiny dose of infant Tylenol and recheck at 7 AM.',
          sub: 'Masks symptoms in a newborn under 8 weeks.',
          fx: () => { fx({ mind: -10, money: -450, careerBar: -4 }); },
          r: 'The morning nurse is alarmed you medicated a six-week-old before evaluation. You end up in the ER anyway.',
        },
        {
          t: 'Unwrap a layer and go back to sleep — 100.6 is barely a fever.',
          sub: 'Dangerous wait under 60 days old.',
          fx: () => { fx({ mind: -14, marriage: -5, money: -450 }); },
          r: 'By sunrise it is 101.6 and your pulse is racing. Everything turns out okay this time.',
        },
      ],
      lit: 'Any temperature of 100.4°F (38.0°C) or higher in an infant under ~2 months requires immediate medical evaluation, even if the baby looks well (Pantell et al., AAP, Pediatrics 2021;148:e2021052228).',
    },

    {
      id: 'cry',
      age: 0.21,
      title: 'The witching hour',
      text: () => {
        const N = getN();
        return `Two straight hours of screaming. Fed, dry, burped, rocked, white noise maxed out. ${N.w} is finally asleep after the last shift. Your jaw is clenched and your hands are trembling.`;
      },
      choices: [
        {
          t: () => `Set ${getN().k} safely on their back in the crib, close the door, breathe for 10 minutes.`,
          sub: 'Recommended reset when you are at your limit.',
          g: 1,
          fx: () => { fx({ mind: 5, energy: -3 }); style('structure', 1); },
          r: 'Ten minutes on the porch in cool air resets your nervous system. Nobody is harmed by ten minutes in a safe crib.',
        },
        {
          t: () => `Wake ${getN().w} and tap out cleanly.`,
          sub: 'Protects your sanity, shifts load onto your partner.',
          g: 1,
          fx: () => { fx({ mind: 6, load: 9, marriage: -1 }); style('warmth', 1); },
          r: 'That is what teammates are for. You owe them a sleep-in on Sunday.',
        },
        {
          t: 'White-knuckle it. Keep pacing until it stops.',
          sub: 'Drains your Mind and risks snapping.',
          fx: () => { fx({ mind: -12, energy: -8 }); },
          r: 'You make it through, barely — closer to the edge than you ever want to be again.',
        },
      ],
      lit: 'Infant crying peaks around 5–6 weeks at over two hours a day (Wolke et al., J Pediatr 2017). Putting a crying baby in a safe crib and stepping away is the safest move when overwhelmed.',
    },

    {
      id: 'care',
      age: 0.27,
      title: 'Parental leave ends Monday',
      text: () => {
        const N = getN();
        return `${N.w}'s leave is over. Someone has to care for ${N.k} from 8 AM to 4 PM until kindergarten. Every option reshapes the next five years.`;
      },
      choices: [
        {
          t: 'Enroll in licensed daycare. ($13,000/yr)',
          sub: 'Frees both workdays and builds early socialization (you can switch/cancel anytime in Tab).',
          fx: () => { fx({ flag: { care: 'daycare' }, skills: { social: 0.5 } }); style('provider', 2); },
          r: () => `Drop-off tears last a week. By month two, ${getN().k} reaches for the teachers and you have your workday back.`,
        },
        {
          t: () => `${getN().w} pauses work to stay home until kindergarten. ($20,000/yr net income offset)`,
          sub: 'Tight budget & heavy daytime load on your spouse; warm 1-on-1 days.',
          fx: () => { fx({ flag: { care: 'home' }, bond: 3, love: 8 }); style('warmth', 2); },
          r: () => `${getN().w} loves the mornings with ${getN().k} — and is completely fried by 5 PM. Your evenings belong to tag-team duty.`,
        },
        {
          t: 'Juggle remote/flexible shifts at home with no daycare. ($0)',
          sub: 'Saves a fortune, chaotic days and slower career progress.',
          fx: () => { fx({ flag: { care: 'juggle' }, mind: -6 }); style('presence', 2); },
          r: () => `Your coworkers learn ${getN().k}'s nap schedule by heart. You save tens of thousands, paid in gray hair.`,
        },
      ],
      lit: 'The NICHD Study of Early Child Care found that care quality and responsive parenting at home matter far more for long-term development than daycare vs. stay-at-home care (NICHD ECCRN, Am Psychol 2006;61:99).',
    },

    {
      id: 'peanut',
      age: 0.52,
      title: 'First real spoonful',
      text: () => {
        const N = getN();
        return `${N.k} is sitting up and lunging at your toast. Your parents swear you should keep peanuts away until age three, while your pediatrician handed you a newer handout.`;
      },
      choices: [
        {
          t: 'Mix thinned peanut butter into oatmeal this week and keep it in rotation.',
          sub: 'Follows modern early-introduction guidance.',
          g: 1,
          fx: () => { fx({ mind: 3 }); style('structure', 1); },
          r: () => `${getN().k} wears half the bowl in their eyebrows. Zero reaction.`,
        },
        {
          t: 'Play it safe and avoid peanuts until age three.',
          sub: 'Old advice — actually raises allergy odds.',
          fx: () => { fx({ flag: { peanutLate: 1 } }); },
          r: 'It feels cautious in the moment. Years later you find out the evidence flipped.',
        },
      ],
      lit: 'The LEAP trial showed early, regular peanut introduction reduced peanut allergy by ~80% in high-risk infants (Du Toit et al., NEJM 2015;372:803).',
    },

    {
      id: 'proof',
      age: 0.78,
      title: 'Fast on all fours',
      text: () => {
        const N = getN();
        return `${N.k} just learned to crawl at alarming speed — straight for outlets, dog bowls, and the tall bookcase.`;
      },
      choices: [
        {
          t: 'Full weekend childproofing: anchor dressers, latches, gates. ($250)',
          sub: 'Costs cash and energy now, prevents a scary ER trip later.',
          g: 1,
          fx: () => { fx({ money: -250, energy: -8, flag: { proofed: 1 } }); style('structure', 2); },
          r: 'You install twelve magnetic cabinet locks and immediately lock yourself out of the coffee filters.',
        },
        {
          t: 'Skip the hardware — just watch closely and say "no."',
          sub: 'Saves money/time, relies on never blinking.',
          r: 'It works right up until the phone rings while pasta water boils.',
        },
      ],
      lit: 'Unintentional injury is a leading cause of harm after infancy; anchoring furniture/TVs and locking hazards before mobility prevents most home ER visits (AAP, Pediatrics 2007).',
    },

    {
      id: 'mload',
      age: 1.35,
      title: 'The invisible calendar',
      text: () => {
        const N = getN();
        return `11 PM. ${N.w} is filling out medical forms, ordering next-size shoes, and texting grandparents. "You always help when I ask," they say softly. "I am exhausted from being the manager who has to ask."`;
      },
      choices: [
        {
          t: 'Own entire domains permanently: medical visits, groceries, family calendar.',
          sub: 'Costs you a bit of Mind, permanently cuts spouse load by 22%.',
          fx: () => { fx({ marriage: 9, mind: -4, load: -12, flag: { mload: 1 } }); style('presence', 2); },
          r: 'You memorize the pediatrician’s portal login and the shoe size. The whole tone of the house softens.',
        },
        {
          t: 'Hire a bi-weekly house cleaner to take chores off both plates. ($3,600/yr)',
          sub: 'Costs ongoing money, reduces mess & spouse stress automatically.',
          fx: () => { fx({ marriage: 6, load: -10, flag: { cleaner: 1 } }); style('provider', 2); },
          r: 'Spending money to buy back Saturday mornings turns out to be the smartest line item in the budget.',
        },
        {
          t: '"Just make me a checklist every week and I will knock it out."',
          sub: 'Keeps the planning burden on your spouse.',
          fx: () => { fx({ marriage: -6, load: 5 }); },
          r: () => `${getN().w} closes the laptop. "Making the list is the job I was talking about."`,
        },
      ],
      lit: 'Cognitive labor — anticipating, researching, and tracking family needs — disproportionately erodes marital satisfaction even when physical chores look split (Daminger, Am Sociol Rev 2019;84:609).',
    },

    {
      id: 'restaurant',
      age: 1.75,
      title: 'Booth by the window',
      text: () => {
        const N = getN();
        return `First sit-down dinner at the Town Bistro in months. Before the bread arrives, ${N.k} arches their back and starts wailing. Your phone — loaded with cartoons — is two inches away.`;
      },
      choices: [
        {
          t: 'Tag-team: walk outside to look at streetlamps, bring crayons, eat in shifts.',
          sub: 'Tiring and your pasta gets lukewarm; builds self-regulation and bond.',
          fx: () => { fx({ energy: -6, bond: 4, marriage: 3, skills: { social: 0.4 } }); style('presence', 2); },
          r: 'You eat half your dinner standing up with a toddler on your hip, laughing with your partner across the table.',
        },
        {
          t: 'Hand over the phone with a cartoon so you and your spouse can actually talk.',
          sub: 'Instant peace & Marriage boost tonight, creates a screen-calming habit.',
          fx: () => { fx({ marriage: 6, mind: 4, fun: 12, flag: { habit: 1 } }); style('warmth', 1); },
          r: () => `You finish a whole hot meal in silence — and ${getN().k} now asks for your phone at every red light.`,
        },
        {
          t: 'Ask for to-go boxes and bail early.',
          sub: 'No screen habit, cuts date mood short.',
          fx: () => { fx({ marriage: -2, energy: -2 }); },
          r: 'You eat warm pasta on the couch after bedtime. Not glamorous, completely sane.',
        },
      ],
      lit: 'Using mobile devices as the default calming tool for toddlers is linked to lower emotional self-regulation over time (Radesky et al., JAMA Pediatr 2023;177:62). Still, every parent weighs occasional survival against daily habits.',
    },

    {
      id: 'tantrum',
      age: 2.35,
      title: 'Aisle 7 meltdown',
      text: () => {
        const N = getN();
        return `At the Corner Market, ${N.k} demands the neon marshmallow cereal. You said no. ${N.He} drops flat on the linoleum screaming at 95 decibels. Three shoppers stop and stare.`;
      },
      choices: [
        {
          t: 'Crouch down, stay calm, hold the line: "You are mad. We are still leaving the cereal."',
          sub: 'Four excruciating public minutes; builds boundaries + trust.',
          fx: () => { fx({ bond: 5, mind: -4, skills: { social: 0.5 } }); style('structure', 2); style('warmth', 1); },
          r: 'Your ears burn for four minutes straight, then the storm passes. Next week in Aisle 7 is dramatically calmer.',
        },
        {
          t: 'Toss the box in the cart and get to checkout fast.',
          sub: 'Protects your sanity today, reinforces tantrums.',
          fx: () => { fx({ fun: 10, mind: 3, money: -6 }); style('warmth', 1); },
          r: () => `Blessed silence. ${getN().k} has also filed away an extremely effective negotiating tactic.`,
        },
        {
          t: 'Pick them up briskly, leave the cart, and talk in the car.',
          sub: 'Firm reset without giving in; costs time/energy.',
          fx: () => { fx({ energy: -5, bond: 2, skills: { social: 0.3 } }); style('structure', 2); },
          r: 'You abandon half your groceries, cool off by the car, and both of you survive with dignity intact.',
        },
      ],
      lit: 'Calm, predictable limits without harsh punishment teach emotional regulation better than either giving in or escalating (Sege & Siegel, AAP, Pediatrics 2018;142:e20183112).',
    },

    {
      id: 'potty',
      age: 2.75,
      title: 'Out of diapers',
      text: () => {
        const N = getN();
        return `${N.k} is staying dry for hours and curious about the bathroom. Half the neighborhood dads swear by an intense 3-day boot camp; the other half say wait for readiness.`;
      },
      choices: [
        {
          t: 'Low-pressure, child-led routine with lots of praise and spare pants.',
          sub: 'Messier few weeks, reliable by ~age 3.',
          fx: () => { fx({ flag: { pottyAge: 2.95 }, bond: 3 }); style('warmth', 2); },
          r: 'Two ruined rugs, a sticker chart, and one proud afternoon where it just clicks.',
        },
        {
          t: 'Structured 3-day weekend blitz (stay home, timers every 30 min).',
          sub: 'Drains weekend energy; fast if kid is ready, risky if pushed too hard.',
          fx: () => { fx({ energy: -12, mind: -5, flag: { pottyAge: 2.85 } }); style('structure', 2); },
          r: 'You spend 72 hours watching a toddler like a hawk, and somehow walk out on Monday mostly diaper-free.',
        },
        {
          t: 'Wait another six months — no rush.',
          sub: 'Easy now, more months of diapers.',
          fx: () => { fx({ mind: 4, flag: { pottyAge: 3.55 } }); },
          r: 'Zero drama this month, though you buy a lot more diaper boxes.',
        },
      ],
      lit: 'Most children show readiness between 18 and 30 months. Child-led readiness and positive reinforcement avoid power struggles and withholding (Brazelton 1962; AAP).',
    },

    {
      id: 'preschool',
      age: 3.25,
      title: 'Two preschools, one budget',
      text: () => {
        const N = getN();
        return `Time to pick ${N.k}'s pre-K focus for the next two years. Every parent at Maple Street Park has a strong opinion.`;
      },
      choices: [
        {
          t: 'Outdoor play-based co-op. ($2,400, requires parent volunteer hours)',
          sub: 'Huge Motor & Social growth; modest cost + your involvement.',
          fx: () => { fx({ money: -2400, bond: 4, skills: { motor: 1.4, social: 1.4 } }); style('presence', 2); },
          r: () => `${getN().k} comes home muddy every single day and makes three best friends.`,
        },
        {
          t: 'Structured early-academics academy. ($6,200)',
          sub: 'Expensive; accelerates Thinking & Language early.',
          fx: () => { fx({ money: -6200, skills: { cognitive: 1.8, language: 1.2 } }); style('structure', 2); },
          r: () => `${getN().k} knows phonics by four, though you definitely feel the tuition bill.`,
        },
        {
          t: 'Keep it simple: neighborhood library storytimes & park mornings. ($0)',
          sub: 'Protects your 529 & savings; relies on your home/park time.',
          fx: () => { fx({ bond: 3, skills: { language: 0.6 } }); style('provider', 1); },
          r: 'No waitlist, no tuition, and the librarian knows you both by name.',
        },
      ],
    },

    {
      id: 'swim',
      age: 3.65,
      title: 'Backyard pool invite',
      text: () => 'Summer arrives. Neighbors down the street put in an in-ground pool and wave you over every weekend.',
      choices: [
        {
          t: 'Sign up for swim lessons and enforce arm’s-reach supervision. ($350)',
          sub: 'Costs money and Saturday mornings; builds motor skill and safety.',
          g: 1,
          fx: () => { fx({ money: -350, flag: { swim: 1 }, skills: { motor: 0.9 } }); style('structure', 2); },
          r: () => `${getN().k} learns to float on their back, and you trade grill tips with three other swim dads.`,
        },
        {
          t: 'Use inflatable arm floaties and watch from the patio.',
          sub: 'False sense of security around water.',
          r: 'It feels relaxed — right up until you glance down at a text message.',
        },
      ],
      lit: 'Drowning is the leading cause of death for ages 1–4. The AAP recommends swim lessons starting as early as age 1, four-sided pool fencing, and touch supervision (Denny et al., Pediatrics 2019;143:e20190850).',
    },

    {
      id: 'spouse_promo',
      age: 4.4,
      cond: () => !getS().divorced,
      title: () => `${getN().w}'s big break`,
      text: () => {
        const N = getN();
        return `${N.w} comes home glowing — offered a senior role with +$12,000/yr after-tax pay, but it means late meetings twice a week and you carrying more dinner and bedtime shifts.`;
      },
      choices: [
        {
          t: '"Take it. I have got evenings covered."',
          sub: '+$12k/yr net household buffer, big Marriage boost; your career/energy feel the squeeze.',
          fx: () => { fx({ marriage: 12, careerBar: -6, load: -12, flag: { spousePromo: 1 } }); style('presence', 2); },
          r: () => `${getN().w} hugs you so tight it knocks the wind out of you. Household cash flow breathes easier, and weeknights are officially your arena.`,
        },
        {
          t: 'Celebrate it, and hire an after-school sitter two nights a week. ($4,200/yr)',
          sub: 'Net +$7.8k/yr household boost, protects both careers and sanity (cancelable in Tab).',
          fx: () => { fx({ marriage: 8, load: -8, flag: { spousePromo: 1, sitterHelp: 1 } }); style('provider', 2); },
          r: 'You split the difference smartly — both careers keep climbing and dinner stays sane.',
        },
        {
          t: 'Ask them to wait a couple years while your career is peaking.',
          sub: 'Protects your work hours, stings the marriage.',
          fx: () => { fx({ marriage: -10, careerBar: 6 }); style('provider', 1); },
          r: () => `${getN().w} turns down the offer politely. You both pretend it didn't leave a bruise.`,
        },
      ],
    },

    {
      id: 'coach',
      age: 5.5,
      title: 'T-ball needs a coach',
      text: () => {
        const N = getN();
        return `The park rec league emails: ${N.k}'s team folds unless a parent volunteers to coach Tuesdays and Saturdays.`;
      },
      choices: [
        {
          t: 'Step up and coach the team.',
          sub: 'Big Bond, Social, Fitness & Motor gains; drains Energy and Work hours.',
          fx: () => { fx({ bond: 10, social: 14, fitness: 6, energy: -10, careerBar: -4, skills: { motor: 1.3, social: 0.9 } }); style('presence', 3); },
          r: 'Twelve five-year-olds chasing butterflies in right field. Best Saturdays of your life.',
        },
        {
          t: 'Register as a spectator parent and bring orange slices.',
          sub: 'Balanced — saves your weeknights while still showing up.',
          fx: () => { fx({ bond: 4, skills: { motor: 0.7, social: 0.4 } }); style('warmth', 1); },
          r: 'You cheer loudly from the folding chair and keep your Tuesday evenings intact.',
        },
        {
          t: 'Skip organized sports this year and just toss a ball at the park.',
          sub: 'Zero schedule stress, less team socialization.',
          fx: () => { fx({ mind: 4, bond: 2 }); },
          r: 'Unscheduled Saturdays feel surprisingly good.',
        },
      ],
    },

    {
      id: 'travelJob',
      age: 6.3,
      cond: () => getS().employed,
      title: 'The corner-office offer',
      text: () => {
        const N = getN();
        return `At work, leadership slides an offer across the desk: 18% raise and a faster promotion track — in exchange for higher weekly expectations and occasional travel. ${N.k} just started first grade.`;
      },
      choices: [
        {
          t: 'Take the step up. (+18% salary, faster career decay if you slack)',
          sub: 'Supercharges savings & 529, demands more hours at the Workplace.',
          fx: () => { const S = getS(); S.salary *= 1.18; S.decayMul *= 1.22; fx({ careerBar: 10, marriage: -3 }); style('provider', 3); },
          r: 'The paycheck jumps immediately — and so does the weight of your inbox.',
        },
        {
          t: 'Counter-offer: smaller 6% raise, keep your current hours.',
          sub: 'Modest raise without blowing up family dinners.',
          fx: () => { const S = getS(); S.salary *= 1.06; fx({ careerBar: 3, bond: 3 }); style('structure', 2); },
          r: 'They respect the boundary more than you expected. You make it home for bedtime.',
        },
        {
          t: 'Decline cleanly. "Not this season."',
          sub: 'Protects Marriage, Bond, and Mind.',
          fx: () => { fx({ bond: 5, marriage: 4, mind: 4 }); style('presence', 2); },
          r: () => `Your boss blinks like you refused free money. Thursday night you are front row at ${getN().k}'s recital.`,
        },
      ],
    },

    {
      id: 'chores',
      age: 6.9,
      title: 'Allowance negotiations',
      text: () => {
        const N = getN();
        return `${N.k} wants $10 a week for Lego sets. Meanwhile the dishwasher has never once unloaded itself.`;
      },
      choices: [
        {
          t: 'Everyone who lives here contributes — chores are part of family, allowance is separate.',
          sub: 'Cuts house mess permanently from age 7+, builds competence.',
          fx: () => { fx({ flag: { chores: 1 }, skills: { social: 0.7, cognitive: 0.6 }, money: -400 }); style('structure', 2); },
          r: 'It takes twice as long to supervise for a year, then suddenly the kitchen stays cleaner all by itself.',
        },
        {
          t: 'Commission system: pay per chore completed.',
          sub: 'Teaches hustle & money math; occasional bargaining over every sock.',
          fx: () => { fx({ flag: { chores: 1 }, skills: { cognitive: 1.0 }, money: -600 }); style('provider', 2); },
          r: () => `${getN().k} starts invoicing you for sweeping the porch. Future entrepreneur.`,
        },
        {
          t: 'Let them focus on being a kid and school.',
          sub: 'Higher Fun now, chores stay on your plate.',
          fx: () => { fx({ fun: 8, bond: 2 }); style('warmth', 1); },
          r: 'More playtime after school — and the laundry mountain remains yours.',
        },
      ],
      lit: 'Kids who start household chores early show stronger self-competence, prosocial habits, and academic follow-through later in elementary school (White et al., J Dev Behav Pediatr 2019).',
    },

    {
      id: 'bully',
      age: 7.7,
      title: 'Stomachaches on school mornings',
      text: () => {
        const N = getN();
        return `Third stomachache this week, plus a "lost" hoodie. Over pancakes, ${N.k} finally whispers that an older kid named Tyler corners them on the bus every day.`;
      },
      choices: [
        {
          t: 'Listen without interrupting, reassure them, and meet the teacher & principal tomorrow.',
          sub: 'Takes time off work, resolves it safely and builds deep trust.',
          g: 1,
          fx: () => { fx({ bond: 7, love: 12, careerBar: -3 }); style('presence', 2); },
          r: 'One firm meeting with the school, assigned bus seating, and the morning stomachaches vanish.',
        },
        {
          t: 'Enroll them in martial arts for confidence AND notify the school. ($900)',
          sub: 'Costs money, boosts Motor, Social, and Bond.',
          g: 1,
          fx: () => { fx({ money: -900, bond: 8, love: 10, skills: { motor: 1.1, social: 0.8 } }); style('structure', 2); },
          r: () => `${getN().k} walks taller within a month, and the school handles Tyler.`,
        },
        {
          t: '"Kids are tough. Ignore him or stand up for yourself."',
          sub: 'Leaves your kid carrying it alone.',
          fx: () => { fx({ bond: -7, love: -14 }); },
          r: () => `${getN().k} goes quiet and stops telling you how school went.`,
        },
      ],
      lit: 'Bullied children experience roughly double the rate of somatic symptoms like stomachaches and sleep issues; supportive adult listening plus school intervention is what actually stops it (Gini & Pozzoli, Pediatrics 2009).',
    },

    {
      id: 'ai',
      age: 9.05,
      tag: 'Mid-career inflection',
      title: () => (getS().career === 'blue' ? 'The data-center boom' : 'Mandatory All-Hands, 10 AM'),
      text: () => {
        const S = getS(), N = getN();
        if (S.career === 'blue') {
          return 'Three giant AI data centers broke ground across the county and every electrical contractor is desperate. Language models write slide decks — they cannot pull 480-volt conduit. You have three paths.';
        }
        return `"We are restructuring into an AI-native workforce." Your badge stops working at noon. Severance lands in your account: ${money(S.salary * (S.career === 'tech' ? 0.35 : 0.22))}. You have to decide what comes next.`;
      },
      choices: () => {
        const S = getS(), N = getN();
        if (S.career === 'blue') {
          return [
            {
              t: 'Take the Lead Foreman slot. (+12% pay, higher weekly expectations)',
              sub: 'Strong income surge for college savings, tougher schedule.',
              fx: () => { S.salary *= 1.12; S.decayMul *= 1.15; fx({ careerBar: 8 }); style('provider', 3); },
              r: 'Your crew respects you and the checks are huge while the boom rolls.',
            },
            {
              t: 'Launch a small side-contracting LLC on weekends. (-$4k startup, +20% pay)',
              sub: 'Upfront risk & energy hit, big long-term upside.',
              fx: () => { S.money -= 4000; S.salary *= 1.20; fx({ energy: -10, mind: -5 }); style('provider', 3); },
              r: 'Your garage smells like copper wire and invoices, and your 529 fund accelerates fast.',
            },
            {
              t: `Keep your current shift. ${N.k} is nine years old once.`,
              sub: 'Steady pay, protects your body and evenings.',
              fx: () => { fx({ mind: 7, bond: 5, marriage: 4 }); style('presence', 2); },
              r: 'The foreman shrugs. Plenty of overtime if you ever want it — tonight you are at the park.',
            },
          ];
        }
        const sev = S.salary * (S.career === 'tech' ? 0.35 : 0.22);
        return [
          {
            t: 'Search for the same role elsewhere. (Faster search, ~18% pay cut, disruption risk remains)',
            sub: 'Gets cash flowing fastest; could get hit again at year 14.',
            fx: () => { S.money += sev; layoff(5.5, 0.82, true); style('provider', 1); },
            r: 'Head to your Home Desk or Workplace network to grind out applications.',
          },
          {
            t: 'Retrain into AI-resilient systems & leadership. (-$6,000, longer search, 95% pay & stable)',
            sub: 'Heavier short-term savings burn, protects your late career.',
            fx: () => { S.money += sev - 6000; layoff(9.5, 0.95, false); style('structure', 2); },
            r: 'Late nights studying and reinventing yourself — hard now, rock-solid later.',
          },
          {
            t: 'Take consulting gigs right away while rebuilding. (Medium search, 88% pay, +$12k gig cash)',
            sub: 'Softens the cash crunch, drains energy.',
            fx: () => { S.money += sev + 12000; layoff(7.5, 0.88, false); fx({ energy: -10, mind: -6 }); style('provider', 2); },
            r: 'You hustle freelance projects between interviews. Exhausting, and the mortgage stays paid.',
          },
        ];
      },
    },

    {
      id: 'phone',
      age: 10.1,
      title: '"Literally everyone has one"',
      text: () => {
        const N = getN();
        return `${N.k}'s tenth birthday wish is a smartphone. "I am the only kid in fifth grade without the group chat."`;
      },
      choices: [
        {
          t: 'Smartphone with a signed family media plan: kitchen charger at night, app limits.',
          sub: 'Balanced social inclusion + protected sleep & focus.',
          g: 1,
          fx: () => { fx({ flag: { phone: 'limits' }, money: -450 }); style('structure', 2); },
          r: () => `${getN().k} negotiates every clause like a corporate attorney, then mostly respects the deal.`,
        },
        {
          t: 'Basic call/text flip phone until high school.',
          sub: 'Lowest screen time, temporary social friction with kid.',
          g: 1,
          fx: () => { fx({ flag: { phone: 'none' }, bond: -3, fun: -8, money: -120 }); style('structure', 3); },
          r: () => `${getN().k} sulks for a month, then goes back to riding bikes at the park.`,
        },
        {
          t: 'Full smartphone, trust them to self-regulate.',
          sub: 'Instant happiness now; higher daily screen hours & later bedtimes.',
          fx: () => { fx({ flag: { phone: 'free' }, fun: 12, bond: 2, money: -650 }); style('warmth', 2); },
          r: () => `Glowing screen under the doorframe at midnight becomes your new normal.`,
        },
      ],
      lit: 'For school-age kids, the AAP recommends a shared Family Media Plan: screen-free meals and bedrooms, predictable limits, and guarding sleep and physical play (AAP 2016; US Surgeon General 2023).',
    },

    {
      id: 'talk',
      age: 11.2,
      title: 'Over morning pancakes',
      text: () => {
        const N = getN();
        return `${N.k} casually drops a question about bodies and relationships that makes you nearly inhale your coffee. Health class started yesterday, and the group chat is faster than the textbook.`;
      },
      choices: [
        {
          t: 'Answer calmly, honestly, at their age level — and leave the door wide open.',
          sub: 'Slightly awkward for five minutes; builds lifelong trust.',
          g: 1,
          fx: () => { fx({ bond: 6, love: 8, skills: { social: 0.5 } }); style('presence', 2); style('warmth', 1); },
          r: 'You answer straight without making it weird. The real win is that they came to you first.',
        },
        {
          t: 'Buy a great age-appropriate book together and read/discuss it this weekend.',
          sub: 'Thoughtful structure if talking off-the-cuff feels hard.',
          g: 1,
          fx: () => { fx({ bond: 5, love: 6, money: -25 }); style('structure', 2); },
          r: 'Having good illustrations and plain language on the table makes it ten times easier.',
        },
        {
          t: '"Let us have a big formal talk next weekend" (or punt to your spouse).',
          sub: 'Avoids awkwardness now, closes the casual channel.',
          fx: () => { fx({ load: 6, bond: -3 }); },
          r: 'The moment passes. Next time they ask the internet instead.',
        },
      ],
      lit: 'Ongoing, matter-of-fact conversations starting in late elementary school are linked to healthier boundaries and lower risk-taking in adolescence (Breuner & Mattson, AAP, Pediatrics 2016).',
    },

    {
      id: 'sport',
      age: 12.2,
      title: 'The travel-team pitch',
      text: () => {
        const N = getN();
        return `A club coach pulls you aside at the park: ${N.k} has real athletic spark, and wants them on a year-round travel squad — $5,500 a year, out-of-state hotels most weekends.`;
      },
      choices: [
        {
          t: 'Go all-in on the travel team. ($5,500/yr)',
          sub: 'Big Motor growth & grit, expensive, risks overuse injury & family burnout.',
          fx: () => { fx({ flag: { travel: 1 }, skills: { motor: 2.2 }, fun: 5, marriage: -4 }); style('provider', 2); },
          r: 'Your trunk smells like cleats and hotel chlorine for the next three years.',
        },
        {
          t: 'Keep playing multiple rec/school sports for fun. ($400)',
          sub: 'Lower injury risk, strong social & motor balance, protects weekends.',
          g: 1,
          fx: () => { fx({ money: -400, fun: 9, bond: 4, skills: { motor: 1.2, social: 0.9 } }); style('warmth', 2); },
          r: () => `${getN().k} plays soccer in fall, hoops in winter, and still has energy to hang out.`,
        },
        {
          t: 'Explore robotics / music camp instead — follow their curiosity. ($900)',
          sub: 'Boosts Thinking & Language, lighter weekend load.',
          fx: () => { fx({ money: -900, fun: 8, skills: { cognitive: 1.8, language: 0.7 } }); style('presence', 1); },
          r: () => `${getN().k} discovers a whole new crowd of creative friends.`,
        },
      ],
      lit: 'Single-sport specialization before age 15 increases overuse injuries and burnout; sampling multiple activities builds broader athleticism and lasting enjoyment (Brenner, AAP, Pediatrics 2016).',
    },

    {
      id: 'failure',
      age: 13.3,
      title: 'Cut from the roster',
      text: () => {
        const N = getN();
        return `${N.k} worked hard all spring and still did not make the varsity/honors cut. They come home eyes red, tossing their gear in the hallway. You know the coordinator personally.`;
      },
      choices: [
        {
          t: 'Sit with them, let it sting, and help build a training plan for next year.',
          sub: 'Hard to watch them hurt; builds real resilience & Bond.',
          fx: () => { fx({ bond: 7, love: 6, skills: { cognitive: 0.9, social: 0.8 } }); style('presence', 2); style('structure', 1); },
          r: 'No speeches at first — just ice cream at the Town Bistro, then a quiet plan to come back stronger.',
        },
        {
          t: 'Make a quiet call to the coordinator to ask for a second look.',
          sub: 'Softens the blow right now; undercuts ownership.',
          fx: () => { fx({ fun: 8, bond: -2, skills: { social: -0.4 } }); style('warmth', 1); },
          r: () => `They land an alternate spot — and ${getN().k} wonders if they earned it on their own.`,
        },
        {
          t: 'Tell them to toughen up — life is full of rejections.',
          sub: 'Teaches grit poorly when delivered cold.',
          fx: () => { fx({ bond: -5, love: -8 }); style('structure', 1); },
          r: 'The bedroom door clicks shut for the rest of the evening.',
        },
      ],
    },

    {
      id: 'mh',
      age: 14.3,
      title: 'The locked bedroom door',
      text: () => {
        const N = getN();
        return `Three weeks of closed blinds. ${N.k} quit hanging out with friends, grades dipped, and every check-in gets a flat "I am fine." Your gut says something heavier is going on.`;
      },
      choices: [
        {
          t: 'Knock, sit on the floor, ask directly how dark it feels, and book a clinic screening. ($350)',
          sub: 'Scary conversation; opens real support and deepens trust.',
          g: 1,
          fx: () => { fx({ bond: 9, love: 15, money: -350, mind: -3, skills: { social: 0.6 } }); style('presence', 3); },
          r: 'Silence for a full minute, then tears. Asking directly did not plant anything — it unlocked the door. Counseling starts next week.',
        },
        {
          t: 'Take away the phone and require dinner at the table until mood improves.',
          sub: 'Treats depression like defiance; cuts off peer support.',
          fx: () => { fx({ bond: -8, love: -14 }); },
          r: 'The silence in the house gets colder and deeper.',
        },
        {
          t: 'Give them space — teenagers are moody.',
          sub: 'Misses a crucial window.',
          fx: () => { fx({ bond: -5, love: -10 }); },
          r: 'Sometimes it is a phase. Three weeks of withdrawal is worth more than hoping.',
        },
      ],
      lit: 'Roughly 1 in 5 adolescents experience depression by 18. The AAP/USPSTF recommend routine screening from age 12; asking directly about self-harm does not increase risk and connects teens to help (Zuckerbrot et al., Pediatrics 2018).',
    },

    {
      id: 'ai2',
      age: 14.8,
      tag: 'Your career',
      cond: () => getS().flags.sameField && getS().employed,
      title: 'The sequel slide deck',
      text: () => 'New logo, same 10 AM calendar invite. The automated tool that reshaped your last company just got an upgrade.',
      choices: [
        {
          t: 'Take the severance and pivot for good.',
          fx: () => { const S = getS(); S.money += S.salary * 0.18; layoff(5.5, 0.9, false); },
          r: 'Back to the job hunt — wiser this time.',
        },
      ],
    },

    {
      id: 'vape',
      age: 15.3,
      title: 'Clink in the washing machine',
      text: () => {
        const N = getN();
        return `Unloading laundry, a mango vape tumbles out of ${N.k}'s hoodie pocket.`;
      },
      choices: [
        {
          t: 'Cool off first, then talk plainly: ask why, set clear rules, agree on fair consequences.',
          sub: 'Authoritative balance — warmth plus firm boundaries.',
          g: 1,
          fx: () => { fx({ bond: 5, love: 5, skills: { social: 0.4 } }); style('structure', 2); style('warmth', 1); },
          r: 'Eye-rolls at first, then an honest talk about stress at school. They actually hear you.',
        },
        {
          t: 'Ground them for the whole semester and search their room.',
          sub: 'Satisfying anger now, drives behavior underground.',
          fx: () => { fx({ bond: -7, love: -10 }); style('structure', 1); },
          r: () => `${getN().k} does not stop — they just get ten times better at hiding things.`,
        },
        {
          t: 'Shrug it off — "I did worse at fifteen."',
          sub: 'Feels cool, leaves zero boundary against nicotine.',
          fx: () => { fx({ fun: 6, bond: 1 }); style('warmth', 1); },
          r: 'They relax, and the habit sticks around much longer.',
        },
      ],
      lit: 'Warmth paired with clear expectations and monitoring consistently predicts lower teen substance use than either authoritarian blowups or permissive supply (Steinberg 2001; Mattick et al., Lancet Public Health 2018).',
    },

    {
      id: 'drive',
      age: 16.05,
      title: 'Learner’s permit',
      text: () => {
        const N = getN();
        return `${N.k} holds up the fresh permit with a huge grin. Your passenger-side floorboard is about to get a workout.`;
      },
      choices: [
        {
          t: 'Log 50+ supervised hours together + sign a safe-driving agreement (no phone, gradual night/passenger limits).',
          sub: 'Costs Energy & time, safest launch and unforgettable car talks.',
          g: 1,
          fx: () => { fx({ bond: 8, love: 8, energy: -10, flag: { drive: 'safe' }, skills: { motor: 0.6 } }); style('presence', 2); style('structure', 2); },
          r: 'You stomp an imaginary brake fifty times — and have some of the deepest conversations of their teenage years at 30 mph.',
        },
        {
          t: 'Pay for a private driving school + hand over the keys once they pass. ($750)',
          sub: 'Saves your nerves and hours, less supervised habit-building.',
          fx: () => { fx({ money: -750, fun: 8, flag: { drive: 'keys' } }); style('provider', 2); },
          r: 'Instant independence for both of you, with higher solo rookie risk.',
        },
        {
          t: 'Hold off on driving until eighteen.',
          sub: 'Safest short-term, delays learning until they are unsupervised.',
          fx: () => { fx({ bond: -5, fun: -9 }); },
          r: 'Two more years of playing chauffeur, and they will learn at 18 without you in the passenger seat.',
        },
      ],
      lit: 'Crash risk is highest in the first 6 months of solo teen driving, especially at night or with teen passengers. Graduated licensing and parent-teen agreements cut crash risk substantially (Alderman & Johnston, AAP 2018).',
    },

    {
      id: 'college_talk',
      age: 17.25,
      title: 'Acceptance letters on the table',
      text: () => {
        const S = getS(), N = getN();
        return `Four envelopes spread across the kitchen table. Your 529 holds ${money(S.fund)} toward roughly ${money(COLLEGE_COST)} for four years in-state. ${N.k} looks across at you: "What can we actually afford?"`;
      },
      choices: [
        {
          t: 'Open the real spreadsheet together: compare net cost, aid, and monthly loan payments.',
          sub: 'Honest financial mentorship — lowers loan shock and builds adult judgment.',
          g: 1,
          fx: () => { fx({ bond: 6, skills: { cognitive: 0.9 } }); style('structure', 2); style('presence', 1); },
          r: () => `${getN().k} gets quiet, runs the numbers on their phone, and picks smartly. That is an adult sitting across from you.`,
        },
        {
          t: 'Encourage them to start with 2 years local / scholarships to graduate debt-free.',
          sub: 'Cuts college cost gap by $22,000, minor ego bruise at first.',
          fx: () => { fx({ flag: { smartCollege: 1 }, bond: 2, fun: -4, skills: { cognitive: 0.7 } }); style('provider', 2); },
          r: 'A tough week of pride, followed by the relief of zero crushing monthly payments at 22.',
        },
        {
          t: '"Pick your dream campus — we will figure out the loans later."',
          sub: 'Big smile today; heavier debt shadow at graduation.',
          fx: () => { fx({ fun: 8, love: 5 }); style('warmth', 2); },
          r: 'A generous instinct that shifts the weight onto their twenties.',
        },
      ],
      lit: 'Compound growth in a 529 over 18 years roughly triples early dollars — and open family money conversations teach teens to weigh ROI before signing promissory notes.',
    },
  ].sort((a, b) => a.age - b.age);

  const FOLLOW = [
    {
      id: 'f_er',
      age: 1.15,
      cond: () => !getS().flags.proofed,
      run: () => {
        const N = getN();
        fx({ money: -1800, mind: -8 });
        toast(`🚑 ${N.k} pulled an unanchored drawer down. ER bill: $1,800. ${N.He} is fine; your nerves are not.`, 'warn');
      },
    },
    {
      id: 'f_pb',
      age: 3.1,
      cond: () => getS().flags.peanutLate,
      run: () => {
        const N = getN();
        fx({ money: -1400, mind: -8 });
        toast(`🥜 First peanut cookie at a birthday party -> hives & ER EpiPens ($1,400).`, 'warn');
      },
    },
    {
      id: 'f_swim',
      age: 4.3,
      cond: () => !getS().flags.swim,
      run: () => {
        const N = getN();
        fx({ mind: -10 });
        toast(`🏊 Scare at the neighbor's pool while glancing at your phone. Another dad pulled ${N.k} up coughing. Never again.`, 'warn');
      },
    },
    {
      id: 'f_sport',
      age: 13.7,
      cond: () => getS().flags.travel,
      run: () => {
        const N = getN();
        fx({ fun: -14, money: -950 });
        toast(`🩹 Overuse knee injury from year-round travel ball. Six weeks of PT ($950).`, 'warn');
      },
    },
    {
      id: 'f_car',
      age: 16.65,
      cond: () => getS().flags.drive === 'keys',
      run: () => {
        const N = getN();
        fx({ money: -2600, mind: -6 });
        toast(`🚗 ${N.k} fender-bender while glancing at a playlist. Nobody hurt — $2,600 deductible.`, 'warn');
      },
    },
    ...[2, 3, 5].map(y => ({
      id: 'f_well' + y,
      age: y + 0.03,
      run: () => {
        const S = getS(), N = getN();
        if (ratio('language') < 0.78 && !S.flags.catchup) {
          S.queue.push(EV.speech);
        } else {
          const onTrack = Math.min(...Object.keys(S.kid.skills).map(ratio)) >= 0.88;
          toast(
            `🩺 Well-child checkup: ${N.k} is ${onTrack ? 'right on track' : 'growing steadily, a bit behind in one area'}.${S.screenAvg > screenLimit(S.h / 24) + 0.35 ? ' Doctor notes screen hours are creeping up.' : ''}`,
            onTrack ? 'good' : 'dim'
          );
        }
      },
    })),
    {
      id: 'f_well9',
      age: 9.5,
      run: () => {
        const S = getS(), N = getN();
        if (S.screenAvg > screenLimit(9) + 0.5) {
          fx({ skills: { cognitive: -0.5 } });
          toast(`🏫 Teacher conference: ${N.k} struggles to focus after late screen nights.`, 'warn');
        } else {
          toast(`🏫 Teacher conference: "${N.k} is curious, kind, and a joy in class."`, 'good');
        }
      },
    },
  ];

  return { EV, EVENTS, FOLLOW };
}
