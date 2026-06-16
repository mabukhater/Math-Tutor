export interface Article {
  slug: string;
  title: string;
  category: string;
  readMinutes: number;
  date: string; // ISO date, used for display + ordering
  excerpt: string;
  body: string; // markdown (## / ### headings, paragraphs, "- " bullets)
}

export const ARTICLES: Article[] = [
  {
    slug: "common-core-uk-national-curriculum-singapore-math-difference",
    title: "US Common Core, UK National Curriculum, and Singapore Math: What's the Difference?",
    category: "Curricula",
    readMinutes: 5,
    date: "2026-06-16",
    excerpt:
      "A clear, fair look at how three respected math systems structure learning, label grade levels, and shape the way kids think about numbers.",
    body: `If you've ever compared math worksheets from different countries, you've probably noticed they don't quite line up. The US, the UK, and Singapore each have their own approach to teaching math, and understanding the differences can help you support your child no matter which one their school follows.

## Three Systems, Three Philosophies

The US Common Core State Standards focus on depth over breadth. The goal is for kids to understand why math works, not just how to get the answer, with a strong emphasis on reasoning and explaining their thinking.

The UK National Curriculum sets out clear year-by-year expectations and prizes fluency. British primary math leans toward solid arithmetic foundations and confident recall of number facts, alongside problem solving.

Singapore Math, used in Singapore's national syllabus, is built around mastery. Topics are taught in a deliberate sequence, with children moving from hands-on materials to pictures to symbols before a topic is considered learned.

## How the Grade Labels Compare

The biggest source of confusion is naming. Each system counts school years differently, but the levels line up more closely than the labels suggest:

- The US uses Grades (Kindergarten, then Grade 1 upward)
- The UK uses Years (Reception, then Year 1 upward)
- Singapore uses Primary levels (Primary 1 upward)

Because UK children typically start formal schooling a year earlier, a rough equivalence is: US Grade 4 ≈ UK Year 5 ≈ Singapore Primary 4. So if you find a UK Year 5 resource and your child is in US Grade 4, the content should be broadly appropriate.

## Pacing and Structure

Common Core spreads fewer topics across each year so classes can dig deeper into each one. The UK curriculum moves briskly through clearly defined objectives, expecting strong arithmetic by the end of primary school. Singapore Math moves carefully and insists that each concept is genuinely mastered before the next begins, which is why its sequence can feel slower at the start but cumulative and sturdy over time.

## What This Means for Your Child

The encouraging news is that grades 3 to 5 cover much the same core ideas everywhere: place value, multiplication and division, fractions, and early problem solving. The differences are mostly in pacing and presentation, not in the underlying math. Whichever system your child's school uses, mixing in high-quality practice from another tradition, such as Singapore-style word problems, can strengthen understanding rather than confuse it.`,
  },
  {
    slug: "why-an-early-start-in-math-pays-off-for-life",
    title: "Why an Early Start in Math Pays Off for Life",
    category: "Early Learning",
    readMinutes: 4,
    date: "2026-06-15",
    excerpt:
      "Building math skills early gives kids confidence and number sense that compound for years — and helps close small gaps before they grow.",
    body: `When parents picture the payoff of math, they often think of test scores or future careers. Those matter — but the deepest benefits of an early start in math show up much sooner, and they last a lifetime.

## Confidence Comes First

Before a child can love math, they have to believe they're capable of it. Early wins — counting collections, splitting a snack fairly, spotting a pattern — teach a child that math is something they can do, not something done to them.

That belief is fragile in the early years and powerful once it takes hold. A confident young learner raises their hand, tries the harder problem, and treats mistakes as part of the work rather than proof they "aren't a math person." Confidence built early becomes the engine for everything that follows.

## Number Sense Is the Real Foundation

Underneath every worksheet is a quieter skill called number sense — an intuitive feel for how numbers work, how they break apart and fit back together, and whether an answer is reasonable.

A child with strong number sense knows that 19 + 6 is "almost 20, then a little more." They can estimate, check their own work, and bend numbers flexibly instead of memorizing in the dark. This foundation supports everything from fractions to algebra, and it's most naturally built in the early grades through play, conversation, and hands-on practice.

## Small Skills Compound Over Time

Math is unusually cumulative. Today's understanding becomes tomorrow's starting point, so steady early practice quietly compounds — much like savings earning interest.

- A child fluent with addition meets multiplication ready, not rattled.
- Comfort with place value makes decimals and money feel familiar.
- Confidence with one topic lowers the fear of attempting the next.

A few focused minutes a day, repeated over months, adds up to far more than the occasional cram session.

## Why Early Gaps Tend to Widen

The flip side of compounding is that small gaps rarely stay small. When a foundational idea — say, what multiplication really means — doesn't fully click, every later topic that leans on it becomes harder than it should be.

The child isn't struggling because they "can't do math." They're missing one supporting brick, and the wobble spreads upward. Caught early, these gaps are usually quick to repair. Left alone, they compound in the wrong direction and can quietly shape how a child sees themselves.

That's the real case for starting early: not to rush childhood, but to give your child a sturdy foundation, a little daily momentum, and the chance to grow up believing math is something they're good at.`,
  },
  {
    slug: "what-singapore-math-actually-is",
    title: "What “Singapore Math” Actually Is",
    category: "Curricula",
    readMinutes: 4,
    date: "2026-06-14",
    excerpt:
      "A plain-language guide to the Singapore approach, from hands-on blocks to bar models to true mastery, that you can use at home.",
    body: `"Singapore Math" gets mentioned a lot, often as if it's a secret formula for raising math whizzes. In reality, it's a thoughtful, well-tested approach to teaching math that grew out of Singapore's national curriculum. The good news for parents is that its core ideas are simple to understand and genuinely useful at home.

## Concrete, Pictorial, Abstract

The heart of Singapore Math is a three-step progression that takes children from the real world to symbols gradually.

- Concrete: kids handle physical objects, such as blocks, counters, or coins, to act out a math idea
- Pictorial: they draw or look at pictures that represent those same objects
- Abstract: only then do they work with numbers and symbols on their own

This sequence matters because it builds genuine understanding. A child who has physically grouped ten blocks before writing "10" knows what that number truly means, rather than just memorizing a symbol.

## The Bar Model Method

One of Singapore Math's signature tools is the bar model, sometimes called the model method. Instead of jumping straight to an equation, children draw simple rectangles to represent quantities and the relationships between them.

If a word problem says one ribbon is 3 times as long as another, a child draws one short bar and one bar that is three of those lengths. Suddenly the problem becomes visual, and it's clear whether to add, subtract, multiply, or divide. Bar models turn confusing word problems into pictures kids can reason about, and they quietly prepare children for the thinking they'll later use in algebra.

## Mastery Before Moving On

Singapore Math insists that children truly master a topic before the class moves forward. Rather than racing through many topics and circling back later, it spends focused time on each idea until it's secure.

This is why the approach can feel slower at first. But because nothing is half-learned, later topics rest on solid ground. Multiplication makes sense because place value was mastered first; fractions make sense because division was mastered first.

## How to Use This at Home

You don't need special materials to borrow these ideas:

- Reach for real objects when a concept is new, whether that's pasta pieces, coins, or buttons
- Encourage your child to draw a problem before solving it
- Resist the urge to rush; let a tricky idea settle before moving on
- Ask "can you show me why?" rather than only checking the answer

The spirit of Singapore Math is patience and understanding over speed. Whatever curriculum your child's school follows, these habits, hands-on first, pictures next, symbols last, and mastery before moving on, will help math make lasting sense.`,
  },
  {
    slug: "science-of-spaced-repetition-math-daily-beats-cramming",
    title: "The Science of Spaced Repetition (and Why a Little Math Daily Beats Cramming)",
    category: "Learning Science",
    readMinutes: 4,
    date: "2026-06-13",
    excerpt:
      "Why ten minutes of math today and tomorrow teaches your child more than an hour-long session once a week.",
    body: `If your child has ever crammed for a test, aced it, then forgotten everything a week later, you have already seen the limits of cramming. The good news is that learning science points to a gentler, more effective approach, and it fits neatly into a busy family's day.

## The Forgetting Curve Is Normal

Long ago, researchers noticed something every parent recognizes: we forget most new information surprisingly fast. After we learn something, our memory of it fades over the following hours and days unless we revisit it. This steady fading is often called the forgetting curve.

Forgetting is not a sign that your child is struggling or not trying. It is simply how human memory works. The key insight is what happens when we bump into the same idea again before it disappears completely.

## Spaced Repetition Fights the Fade

Each time your child recalls a fact or skill just as it is starting to slip, the memory gets stronger and lasts longer before fading again. Reviewing material in short sessions spread across days, rather than all at once, is called spaced repetition.

Picture two children learning the 7 × 8 fact. One drills it twenty times in a single evening. The other meets it a few times today, again tomorrow, and again later in the week. The second child almost always remembers it longer, because each spaced encounter tells the brain, this is worth keeping.

## Why Daily Math Wins

This is exactly why a little math every day beats an occasional marathon session. Short daily practice naturally spaces out review, so facts and skills get revisited again and again over time.

- Math builds in layers, so today's fluency with addition makes tomorrow's multiplication easier.
- Quick recall of basic facts frees up mental energy for harder problem solving.
- Daily reps keep skills warm, so your child spends less time relearning old ground.

A long, infrequent session might feel productive, but much of it leaks away before the next one. Steady daily contact keeps the memory alive.

## What This Looks Like at Home

You do not need flashcards or a complicated system. A few minutes of focused practice most days does the heavy lifting on its own.

Aim for short and consistent rather than long and occasional. Mixing in a few older topics alongside new ones gives those earlier skills the spaced review they need to stick. Over weeks, these small daily deposits compound into real, durable understanding, and far less last-minute stress for everyone.`,
  },
  {
    slug: "moving-abroad-with-school-age-kids-keeping-math-on-track",
    title: "Moving Abroad With School-Age Kids: Keeping Math on Track",
    category: "Global",
    readMinutes: 5,
    date: "2026-06-12",
    excerpt:
      "Relocating overseas with kids? Here is how to navigate curriculum differences and keep their math learning steady through the move.",
    body: `An international move is exciting and exhausting in equal measure, and somewhere between the visas and the moving boxes, your child's schooling needs a plan. Math is one subject where mismatches between school systems can quietly create problems, but a little foresight goes a long way toward keeping things on track.

## Why Math Gaps and Repeats Happen

Different countries introduce math topics in different grades and in a different order. One system might teach long division or fractions a full year earlier than another, or cover geometry before a topic that elsewhere comes first. When a child moves between systems, two things can happen:

- Gaps, where the new school assumes knowledge your child has not been taught yet
- Repeats, where your child sits through material they already mastered and grows bored

Neither is anyone's fault. It is simply what happens when two curricula, designed independently, meet in the middle of a school year.

## Map Both Curricula Before You Move

The best time to compare systems is before the first day at the new school. A few steps make a real difference:

- Find the math scope-and-sequence or curriculum outline for both your current and destination systems
- Note which topics your child has covered and which the new grade level expects
- Flag any topic the destination school assumes but your child has not yet seen

Even an hour spent comparing the two outlines can reveal exactly where attention is needed, long before a teacher does.

## Close Gaps With Steady, Targeted Practice

Once you know where the mismatches are, you can address them calmly rather than in a panic. Aim for short, regular sessions on the specific topics that need bridging, rather than a frantic catch-up before the move. A few focused minutes a day on, say, multiplication facts or fractions can close a gap within weeks. The goal is steady confidence, not cramming.

If your child is ahead in some areas, that is a gift. Let those topics stay fresh with light review while you concentrate energy on the genuine gaps.

## Stay Aligned to Both Systems

During a transition, it helps to keep one foot in each world for a while. Maintain a daily practice routine that does not depend on any single school's pace, so learning continues smoothly no matter what the timetable looks like. Keep open communication with teachers in the new school, share what your child has already covered, and ask what is coming next.

Children are remarkably adaptable, and math, more than most subjects, follows a universal logic from one country to the next. With a clear map of both curricula and a steady practice habit, your family can turn a disruptive move into a smooth handoff, and your child can land in the new classroom feeling ready rather than lost.`,
  },
  {
    slug: "building-a-daily-math-habit-that-sticks",
    title: "Building a Daily Math Habit That Actually Sticks",
    category: "Habits",
    readMinutes: 4,
    date: "2026-06-11",
    excerpt:
      "Practical, low-pressure ways to turn a few minutes of daily math into a routine your child actually keeps.",
    body: `Most parents know daily practice helps. The hard part is making it happen without nagging, tears, or a daily battle. The secret is to make the habit small, predictable, and genuinely kind.

## Anchor It to Something You Already Do

Habits stick best when they ride along with an existing routine. Instead of hoping to find a free moment, attach math to a fixed anchor in your day.

- Right after breakfast, before screens come on.
- At the kitchen table while dinner is cooking.
- As part of the wind-down before bedtime reading.

Pick one anchor and keep it consistent. When practice happens at the same time and place each day, your child stops negotiating and the routine starts to run itself.

## Keep It Short and Low Pressure

A few focused minutes is plenty. Short sessions feel doable, which means your child is far more likely to show up tomorrow. A pleasant five minutes beats a dreaded thirty every time.

Protect the calm. Avoid hovering over every answer or turning practice into a quiz with a frown attached. If a session goes sideways, it is fine to stop early and try again tomorrow. Consistency matters far more than any single day.

## Celebrate Effort, Not Just Right Answers

What you praise is what your child repeats. Notice the trying, the focus, and the willingness to tackle a tricky problem, rather than only the correct results.

- Name the effort: I saw you stick with that hard one.
- Treat mistakes as normal steps in learning, not failures.
- Let your child see their own progress over time.

This builds a mindset where math feels safe to attempt, which keeps your child coming back.

## Use Streaks Gently

Streaks can be wonderfully motivating because they make consistency visible and a little bit fun. A simple calendar with a checkmark or sticker for each day can give your child a satisfying sense of momentum.

Hold streaks loosely, though. The goal is encouragement, not pressure. If a day gets missed, simply start again rather than treating it as a broken promise. A streak is a cheerful nudge, never a source of guilt.

## Remove the Friction

The easier practice is to start, the more reliably it happens. Have everything ready so there is nothing to set up and no excuse to delay.

Keep the device charged and the app open, or the worksheet and pencil already on the table. Decide the time in advance so it is never up for debate. When starting takes zero effort, the habit quietly becomes just another part of the day, the same way brushing teeth does.`,
  },
  {
    slug: "math-anxiety-is-real-heres-how-to-help-your-child-beat-it",
    title: "Math Anxiety Is Real — Here's How to Help Your Child Beat It",
    category: "Mindset",
    readMinutes: 5,
    date: "2026-06-10",
    excerpt:
      "Math anxiety can shrink a child's working memory in the moment — here's where it comes from and how parents can gently help.",
    body: `If your child freezes, melts down, or insists "I'm just bad at math" the moment numbers appear, you may be seeing more than frustration. Math anxiety is a real, well-documented response — and the good news is that parents are uniquely placed to help.

## What Math Anxiety Actually Is

Math anxiety is a feeling of tension, worry, or dread that shows up around math specifically. It isn't the same as not understanding the material. A child can know how to solve a problem and still seize up when asked to do it.

There's a physical side, too. When anxiety spikes, it crowds out working memory — the mental scratchpad we use to hold numbers and steps in mind. That's why an anxious child can blank on facts they knew perfectly well the night before. The fear, not the ability, is getting in the way.

## Where It Comes From

Math anxiety rarely has a single cause. Common contributors include:

- Timed tests and being put on the spot to answer quickly.
- Absorbing the message that people are either "math people" or not.
- A focus on right answers over thinking, so mistakes feel shameful.
- Overhearing the adults they love say "I was never good at math either."

That last one matters more than many parents realize. Children pick up our attitudes about math long before they form their own.

## How You Can Help

You don't need to be a math whiz to make a real difference. A few steady habits go a long way:

- Watch your own words. Replace "I'm bad at math" with "math takes practice, and we can figure this out."
- Praise effort and strategy, not just speed or correct answers. "I like how you checked that" beats "you're so smart."
- Treat mistakes as information. Ask "what was the tricky part?" instead of reacting with alarm.
- Take the clock away at home. Let your child think without a timer whenever you can.
- Bring math into everyday life — cooking, shopping, scores in a game — where it feels low-stakes and useful.

## Keep the Long View

Beating math anxiety is rarely instant. It grows from many small, calm moments where your child experiences math as safe and doable.

Stay patient, keep practice short and positive, and celebrate persistence over perfection. With your steady support, the child who once dreaded math can come to meet it with curiosity — and a quiet confidence that it's something they can handle.`,
  },
  {
    slug: "where-math-takes-you-careers-built-on-numbers",
    title: "Where Math Takes You: Careers Built on Numbers",
    category: "Careers",
    readMinutes: 4,
    date: "2026-06-09",
    excerpt:
      "From game designers to nurses to electricians, math quietly powers a huge range of careers your child might love one day.",
    body: `When kids ask "When will I ever use this?", the honest answer is: more often than they imagine, and in more places than most of us realize. Math is not a single subject leading to a single job. It is a flexible tool that opens doors across nearly every field, including many that have nothing to do with sitting at a desk solving equations.

## More Than Just "Math Jobs"

It is easy to picture the obvious paths: accountants, engineers, scientists. Those are real and rewarding. But the reach of numbers goes much further:

- Technology: app developers and game designers use logic, geometry, and patterns every day.
- Medicine: nurses and pharmacists calculate doses; doctors weigh probabilities and read data.
- Design and the arts: architects, animators, and musicians rely on ratios, proportion, and timing.
- Trades: electricians, carpenters, and chefs measure, scale, and convert constantly.
- Data and finance: analysts and planners turn numbers into decisions people trust.

The point is not that your child must choose one of these. It is that strong math keeps many doors open at once.

## Why This Matters for Your Child

Employers across industries value people who can reason clearly, spot patterns, and stay comfortable with numbers under pressure. These habits start early. A third grader practicing multiplication is also building persistence and logical thinking, the same muscles a future engineer or entrepreneur will lean on.

Math also tends to be a gateway subject. Many well-paying, future-focused careers require comfort with numbers as a starting point. Keeping that comfort alive in the early grades quietly protects your child's options for years to come.

## How Parents Can Help

You do not need to be a math person yourself. What helps most is showing that numbers are normal, useful, and even interesting:

- Talk about the math in everyday life: cooking, budgeting, travel times, sports scores.
- Connect interests to numbers. A child who loves animals can explore measurement at the vet; a builder-at-heart can measure a project together.
- Praise effort and strategy, not just right answers, so challenge feels safe.

## The Bigger Picture

The goal is not to push every child toward a math-heavy career. It is to make sure that when they discover what they love, math is a bridge rather than a barrier. Daily practice in grades 3 through 5 is less about memorizing facts and more about building quiet confidence, the kind that lets a child say "I can figure this out" no matter where their curiosity leads them.`,
  },
  {
    slug: "why-some-countries-top-global-math-rankings",
    title: "Why Some Countries Top the Global Math Rankings",
    category: "Global",
    readMinutes: 4,
    date: "2026-06-08",
    excerpt:
      "A look at what international math tests reveal about top-performing countries, and the habits any family can borrow at home.",
    body: `If you follow education news, you have probably seen headlines about how students in some countries outperform others in math. These stories usually draw on two large international assessments. Understanding what they measure, and why certain systems do well, can help you make sense of the noise and focus on what actually matters for your child.

## What TIMSS and PISA Actually Measure

Two studies come up again and again. TIMSS, the Trends in International Mathematics and Science Study, tests students on the kind of math content found in school curricula, such as numbers, geometry, and algebra. PISA, the Programme for International Student Assessment, takes a different angle and looks at how well 15-year-olds apply math to real-world problems and reasoning.

Because they measure slightly different things, the two can tell complementary stories. Neither is a perfect ranking of "the best" students, and results shift over time. They are best read as broad signals, not scoreboards.

## Why East Asian Systems Often Lead

Year after year, systems in places like Singapore, Japan, and South Korea cluster near the top of both assessments. There is no single secret, but researchers point to some shared patterns:

- A focus on mastery, where students fully understand one concept before moving to the next
- Carefully sequenced curricula that build steadily rather than racing through topics
- An emphasis on deep practice and problem-solving, not just memorizing procedures
- A widely shared cultural belief that math ability grows with effort, not just talent

These systems tend to treat struggle as a normal, productive part of learning rather than a sign that a child "isn't a math person."

## What Any Family Can Borrow

You do not need to relocate or overhaul your routine to benefit from these ideas. The most transferable habits are surprisingly simple:

- Favor mastery over speed. Make sure a concept is solid before piling on the next one.
- Practice a little every day. Short, consistent sessions beat occasional cramming.
- Hold high, warm expectations. Believe your child can do hard math, and say so.
- Normalize mistakes. Treat wrong answers as information, not failure.

## The Takeaway

The countries at the top of international assessments are not working magic. They are applying steady, well-understood principles: clear sequencing, real mastery, consistent practice, and high expectations held with encouragement. Those same principles fit neatly into a few focused minutes at your kitchen table. A daily habit of thoughtful practice, paired with patience and belief in your child, is something every family can offer, no matter where you live.`,
  },
  {
    slug: "mental-math-vs-calculator-why-number-sense-matters",
    title: "Mental Math vs. the Calculator: Why Number Sense Still Matters",
    category: "Learning Science",
    readMinutes: 4,
    date: "2026-06-07",
    excerpt:
      "Calculators are everywhere, so why bother with mental math? Because number sense builds the deeper understanding devices can't.",
    body: `In a world where every phone has a calculator, it is fair to ask whether mental math still matters. The answer is a confident yes. Quick calculation is only part of the story. The real prize is number sense, the deep, flexible understanding of how numbers work, and that is something no device can hand your child.

## What Number Sense Really Is

Number sense is the intuition behind the numbers. A child with strong number sense knows that 7 × 8 is close to 7 × 10, that 198 plus 205 is "about 400," and that a sale price of 90 percent off should feel surprisingly small. They are not just pushing buttons; they understand what the answer should look like before they ever calculate it.

This intuition is what lets kids catch mistakes, make smart estimates, and reason through unfamiliar problems. It is the foundation that later math, including algebra and beyond, is built on.

## The Calculator Trap

A calculator is a wonderful tool, but it only answers the exact question it is given. It will not notice if a decimal point lands in the wrong place or if the wrong numbers were typed in. A child who relies on the device without understanding can confidently report an answer that is wildly wrong and never know it.

Mental math acts as a built-in alarm system. When kids can estimate, they instantly sense when a result does not make sense. That habit of checking, of asking "Does this seem right?", serves them far beyond the math classroom.

## Estimation: The Everyday Superpower

Most real-life math is not exact. We estimate constantly:

- Is there enough money for everything in the cart?
- Will we make it to practice on time?
- Roughly how much paint covers this wall?

These quick judgments lean on mental math, not precise calculation. Children who practice estimation grow into adults who navigate daily decisions with ease and confidence.

## How to Build It at Home

Mental math grows through low-pressure, everyday practice:

- Play with friendly numbers: round prices while shopping and add them up together.
- Ask "about how many?" before reaching for exact answers.
- Encourage strategies over memorization, like breaking 6 × 7 into 6 × 5 plus 6 × 2.
- Keep it light. Quick number games in the car beat long drills at the table.

Calculators are not the enemy, and your child should learn to use them well. But they work best in the hands of someone who already understands the numbers. By keeping mental math alive in grades 3 through 5, you give your child both the tool and the wisdom to use it.`,
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
