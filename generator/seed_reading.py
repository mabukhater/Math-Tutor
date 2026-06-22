#!/usr/bin/env python3
"""Seed hand-written, leveled reading passages + comprehension questions with
paragraph locators (no API). Demonstrates the reading path end to end:
Grade 2 (1 passage) and Grade 3 (2 passages of increasing difficulty).

Usage:
    export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
    python generator/seed_reading.py
"""
from __future__ import annotations

import os
import random
import sys

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

# grade, level_order, title, [paragraphs], [questions]
PASSAGES = [
    (2, 1, 1, "The Lost Kite",
     [
        "Mia loved her red kite more than any other toy. Every Saturday she flew it in the park near her house.",
        "One windy morning, Mia looked out her window and saw that her kite was gone! The wind had pulled it off the porch. She grabbed her shoes and ran straight to the park.",
        "At the park, the kite was stuck high in an oak tree. A kind man with a ladder helped her bring it down.",
        "Mia thanked the man. After that, she always kept her kite safe inside when the wind blew hard.",
     ],
     [
        ("main_idea", "What is this story mostly about?",
         ["A girl learns to swim", "A girl finds her lost kite", "A man builds a ladder", "A dog runs to the park"], 1,
         "The whole story is about Mia losing her kite and getting it back.",
         {"paragraph": 2, "hint": "¶2 and ¶3 show Mia losing her kite and then getting it back."}),
        ("detail", "Why did Mia run to the park?",
         ["To fly a different kite with friends", "Because a man asked her to", "Her kite had blown away and she went to find it", "To climb the oak tree"], 2,
         "The wind pulled her kite off the porch, so she ran to the park to find it.",
         {"paragraph": 2, "hint": "¶2 says the wind pulled her kite off the porch and she ran straight to the park."}),
        ("detail", "Where was the kite stuck?",
         ["Under a car", "High in an oak tree", "In the river", "On the porch"], 1,
         "The kite was stuck high in an oak tree at the park.",
         {"paragraph": 3, "hint": "¶3 tells you exactly where the kite was stuck."}),
        ("inference", "Why did Mia keep her kite inside on windy days after that?",
         ["She didn’t like the park anymore", "So the wind wouldn’t take it again", "Because the man told her to", "She got a brand-new kite"], 1,
         "The wind took her kite once, so she kept it safe inside to stop that happening again.",
         {"paragraph": 4, "hint": "¶4 says she kept it safe inside when the wind blew hard — think about what the wind did earlier."}),
        ("vocab", "In ¶2, “the wind had pulled it off the porch” mostly means—",
         ["The wind moved the kite away", "Mia threw the kite", "The kite was too heavy", "The porch broke"], 0,
         "Pulled it off the porch means the wind moved the kite away from where it was.",
         {"paragraph": 2, "hint": "Re-read ¶2 — the wind pulled the kite off the porch, so it moved away."}),
     ]),
    (3, 1, 1, "The Classroom Garden",
     [
        "Mr. Lee’s class started a garden behind the school. Each student chose one vegetable to grow.",
        "Sam picked carrots because they were his favorite. He planted the tiny seeds in a straight row and watered them every day.",
        "For two whole weeks, nothing happened. Sam began to worry that his carrots would never grow.",
        "Then one morning, small green leaves poked up from the soil. By the end of spring, the class shared a big salad made from everything they had grown.",
     ],
     [
        ("main_idea", "What is this passage mostly about?",
         ["A boy goes to the beach", "A class grows a garden together", "A teacher buys vegetables", "Sam loses his seeds"], 1,
         "The passage follows the class planting a garden and finally sharing what they grew.",
         {"paragraph": 1, "hint": "¶1 and ¶4 show the class planting and then sharing what they grew."}),
        ("detail", "Which vegetable did Sam choose to grow?",
         ["Tomatoes", "Carrots", "Beans", "Corn"], 1,
         "Sam picked carrots because they were his favorite.",
         {"paragraph": 2, "hint": "¶2 says which vegetable Sam picked and why."}),
        ("inference", "Why did Sam begin to worry in ¶3?",
         ["His seeds were stolen", "Nothing had grown after two weeks", "He lost his watering can", "The garden flooded"], 1,
         "Two weeks passed with nothing growing, so Sam worried his carrots never would.",
         {"paragraph": 3, "hint": "¶3 says what had — or hadn’t — happened for two whole weeks."}),
        ("sequence", "What happened right after the green leaves appeared?",
         ["Sam planted the seeds", "By spring’s end the class shared a big salad", "Sam picked carrots", "Nothing happened for two weeks"], 1,
         "After the leaves appeared, the class later shared a salad from their garden.",
         {"paragraph": 4, "hint": "¶4 tells you what came after the green leaves poked up."}),
        ("vocab", "In ¶2, planting seeds in “a straight row” means Sam planted them—",
         ["in a circle", "in a line", "in a pile", "in a pot"], 1,
         "A straight row means the seeds were planted in a line.",
         {"paragraph": 2, "hint": "Re-read ¶2 — a straight row is a line."}),
     ]),
    (3, 1, 2, "The Brave Little Boat",
     [
        "The old fishing boat named Pearl had sailed the bay for thirty years. Her blue paint was faded, but Captain Rosa loved her dearly.",
        "One stormy night, a young sailor’s boat lost its engine far from shore. He waved a flashlight into the dark, hoping someone would see him.",
        "Captain Rosa spotted the tiny light from her window. Without waiting, she started Pearl’s engine and headed into the rough waves.",
        "Pearl rocked hard, but she reached the stranded sailor and towed him safely back. The next day, the whole town called Pearl a hero.",
     ],
     [
        ("main_idea", "What is this passage mostly about?",
         ["An old boat helps rescue a sailor", "A captain paints her boat", "A storm destroys a town", "A sailor goes fishing"], 0,
         "Pearl and Captain Rosa go out in the storm to rescue a stranded sailor.",
         {"paragraph": 3, "hint": "¶3 and ¶4 show Pearl going out to rescue the sailor."}),
        ("detail", "How long had Pearl sailed the bay?",
         ["Ten years", "Thirty years", "One year", "Fifty years"], 1,
         "Pearl had sailed the bay for thirty years.",
         {"paragraph": 1, "hint": "¶1 tells you exactly how many years Pearl had sailed."}),
        ("inference", "Why did the young sailor wave a flashlight?",
         ["To read a map", "To get someone’s attention for help", "To fix his engine", "To scare the fish away"], 1,
         "His engine died far from shore, so he waved the light hoping someone would come help.",
         {"paragraph": 2, "hint": "¶2 says his engine was lost and he hoped someone would see him — what did he need?"}),
        ("detail", "Who spotted the sailor’s light?",
         ["A lighthouse keeper", "Captain Rosa", "Another fishing boat", "The sailor’s father"], 1,
         "Captain Rosa spotted the tiny light from her window.",
         {"paragraph": 3, "hint": "¶3 says who saw the light and from where."}),
        ("inference", "Why did the town call Pearl a hero?",
         ["She was the oldest boat", "She helped rescue the stranded sailor", "She had pretty blue paint", "She won a boat race"], 1,
         "Pearl went into the storm and towed the sailor safely back, so the town called her a hero.",
         {"paragraph": 4, "hint": "¶4 says what Pearl did just before the town called her a hero."}),
     ]),
    (3, 1, 3, "Recess Rescue",
     [
        "At recess, Tariq saw a first grader named Lily sitting alone by the fence. She was crying because she had dropped her snack in a puddle.",
        "Tariq remembered he still had half of his granola bar in his pocket. He walked over and offered it to her with a smile.",
        "Lily wiped her eyes and grinned. The two of them spent the rest of recess playing tag with the other kids.",
        "Walking back to class, Tariq felt proud. Sometimes the smallest kindness makes the biggest difference.",
     ],
     [
        ("inference", "Why was Lily crying at the start?",
         ["She lost a game of tag", "Her snack fell in a puddle", "She missed the bus", "She forgot her homework"], 1,
         "¶1 says Lily dropped her snack in a puddle, which is why she was upset.",
         {"paragraph": 1, "hint": "¶1 tells you what happened to Lily’s snack."}),
        ("detail", "What did Tariq give Lily?",
         ["A juice box", "Half of his granola bar", "A new toy", "His lunch money"], 1,
         "¶2 says Tariq offered her half of his granola bar.",
         {"paragraph": 2, "hint": "¶2 says exactly what Tariq took out of his pocket."}),
        ("sequence", "What did they do after Tariq shared his snack?",
         ["Went straight to class", "Played tag with other kids", "Looked for the lost snack", "Called a teacher"], 1,
         "¶3 says they spent the rest of recess playing tag.",
         {"paragraph": 3, "hint": "¶3 tells you what they did for the rest of recess."}),
        ("main_idea", "What is the main lesson of this story?",
         ["Always bring two snacks", "Small kindness makes a big difference", "Recess is too short", "Never play near puddles"], 1,
         "¶4 states the lesson directly: small kindness matters.",
         {"paragraph": 4, "hint": "¶4 says the lesson in the very last sentence."}),
        ("vocab", "In ¶2, “offered” most nearly means—",
         ["took away", "held out to give", "ate quickly", "threw at"], 1,
         "Offered means he held it out to give it to her.",
         {"paragraph": 2, "hint": "Re-read ¶2 — Tariq gave the bar to Lily."}),
     ]),
    (3, 2, 4, "The Science Fair Volcano",
     [
        "Maria had two weeks to build her science fair project, and she chose to make an erupting volcano. She read that mixing baking soda and vinegar makes a fizzy, bubbling reaction.",
        "Her first try was a disaster. She used too little vinegar, and the volcano barely bubbled. Maria wrote down what went wrong instead of giving up.",
        "On her second try, she added red food coloring and much more vinegar. The volcano erupted in a frothy red flow that spilled down the sides.",
        "At the fair, the judges were impressed — not just by the eruption, but by Maria’s notebook showing how she fixed her mistakes. She won second place.",
     ],
     [
        ("detail", "What two things did Maria mix to make the eruption?",
         ["Sugar and water", "Baking soda and vinegar", "Salt and oil", "Flour and milk"], 1,
         "¶1 says she mixed baking soda and vinegar.",
         {"paragraph": 1, "hint": "¶1 names the two ingredients of the reaction."}),
        ("inference", "Why did the first try barely bubble?",
         ["She used too little vinegar", "The baking soda was old", "She forgot the food coloring", "It was too cold"], 0,
         "¶2 says she used too little vinegar, so it barely bubbled.",
         {"paragraph": 2, "hint": "¶2 explains what was wrong with the first try."}),
        ("inference", "What does Maria writing down what went wrong show about her?",
         ["She gives up easily", "She learns from mistakes", "She dislikes science", "She copied a friend"], 1,
         "Instead of quitting, she recorded the problem to fix it — she learns from mistakes.",
         {"paragraph": 2, "hint": "¶2 shows what Maria did instead of giving up."}),
        ("detail", "What did she change on the second try?",
         ["Less vinegar and no color", "More vinegar and red food coloring", "A bigger volcano shape", "A different table"], 1,
         "¶3 says she added red food coloring and much more vinegar.",
         {"paragraph": 3, "hint": "¶3 lists exactly what she changed."}),
        ("main_idea", "Why were the judges most impressed?",
         ["The volcano was the biggest", "Her notebook showed how she fixed mistakes", "She finished first", "It used real lava"], 1,
         "¶4 says the judges liked that her notebook showed how she fixed her mistakes.",
         {"paragraph": 4, "hint": "¶4 says what impressed the judges beyond the eruption."}),
     ]),
    (3, 2, 5, "A Letter to Grandma",
     [
        "Dear Grandma, I wanted to tell you about our class trip to the apple orchard last Friday. It was the best field trip all year!",
        "First, a farmer showed us how apples grow on tall trees and which ones are ready to pick. Then each of us filled a small basket with red and green apples.",
        "After picking, we drank fresh apple cider and learned how it is pressed from apples. I saved one perfect apple to bring home for you.",
        "I can’t wait to see you next month so we can bake a pie together. Love, Sofia.",
     ],
     [
        ("main_idea", "What is this letter mostly about?",
         ["A birthday party", "A class trip to an apple orchard", "A trip to the zoo", "A baking contest"], 1,
         "The whole letter describes Sofia’s class trip to the apple orchard.",
         {"paragraph": 1, "hint": "¶1 tells you what the letter is about."}),
        ("sequence", "What did the students do FIRST at the orchard?",
         ["Drank cider", "Learned how apples grow and picked them", "Baked a pie", "Went home"], 1,
         "¶2 says first the farmer showed how apples grow, then they picked apples.",
         {"paragraph": 2, "hint": "¶2 begins with the word ‘First’."}),
        ("detail", "What did Sofia save to bring home?",
         ["A basket", "One perfect apple", "A bottle of cider", "A leaf"], 1,
         "¶3 says she saved one perfect apple for Grandma.",
         {"paragraph": 3, "hint": "¶3 says what Sofia kept to bring home."}),
        ("inference", "Why is Sofia excited to see Grandma next month?",
         ["To go to the orchard again", "To bake a pie together", "To pick more apples", "To write another letter"], 1,
         "¶4 says she wants to bake a pie with Grandma.",
         {"paragraph": 4, "hint": "¶4 says what they will do together next month."}),
        ("vocab", "In ¶3, “pressed” means the cider was—",
         ["squeezed out of apples", "frozen into ice", "poured from a bottle", "baked in an oven"], 0,
         "Pressed means the juice was squeezed out of the apples.",
         {"paragraph": 3, "hint": "Re-read ¶3 — cider is made by squeezing apples."}),
     ]),
    (3, 3, 6, "The Mystery of the Missing Cookies",
     [
        "Grandpa baked a dozen oatmeal cookies and left them to cool on the kitchen counter. When he came back, three were gone.",
        "He noticed a trail of tiny crumbs leading from the counter to the back door. The door was open just a crack.",
        "Outside, his dog Biscuit was lying in the grass with a guilty look and a few crumbs stuck to his nose.",
        "Grandpa laughed. He couldn’t stay angry — but he did decide to keep the cookie jar on a higher shelf from now on.",
     ],
     [
        ("inference", "Who most likely took the cookies?",
         ["Grandpa", "Biscuit the dog", "A neighbor", "The mail carrier"], 1,
         "The crumbs on Biscuit’s nose and his guilty look point to the dog.",
         {"paragraph": 3, "hint": "¶3 describes who was outside and what was on his nose."}),
        ("detail", "How many cookies were missing?",
         ["One", "Two", "Three", "A dozen"], 2,
         "¶1 says three cookies were gone.",
         {"paragraph": 1, "hint": "¶1 tells you how many disappeared."}),
        ("detail", "What clue led Grandpa to the back door?",
         ["A trail of crumbs", "Muddy footprints", "An open window", "A barking sound"], 0,
         "¶2 says a trail of crumbs led to the back door.",
         {"paragraph": 2, "hint": "¶2 names the clue on the floor."}),
        ("inference", "Why did Grandpa decide to move the cookie jar higher?",
         ["The counter was dirty", "So Biscuit couldn’t reach the cookies", "He wanted more space", "The shelf was broken"], 1,
         "He moved it so the dog couldn’t take cookies again.",
         {"paragraph": 4, "hint": "¶4 hints at what he wanted to stop from happening again."}),
        ("main_idea", "This passage is mostly a—",
         ["recipe for cookies", "little mystery that gets solved", "lesson about baking", "story about a long trip"], 1,
         "It’s a small mystery: who took the cookies, solved by clues.",
         {"paragraph": 2, "hint": "Think about the clues in ¶2 and ¶3 and how they solve the puzzle."}),
     ]),
    (3, 3, 7, "How Bees Make Honey",
     [
        "Honey starts with a flower. A worker bee lands on a blossom and sips a sweet liquid called nectar, storing it in a special honey stomach.",
        "Back at the hive, the bee passes the nectar to other bees. They chew it and pass it along, which slowly changes the nectar into honey.",
        "The bees spread the honey into wax cells and fan it with their wings. The fanning dries the honey so it becomes thick and sticky.",
        "Finally, the bees seal each full cell with a wax cap. The honey can be stored this way for a very long time without spoiling.",
     ],
     [
        ("detail", "What do bees collect from flowers?",
         ["Pollen dust", "Nectar", "Water", "Seeds"], 1,
         "¶1 says bees sip nectar from flowers.",
         {"paragraph": 1, "hint": "¶1 names the sweet liquid bees collect."}),
        ("sequence", "What happens right after a bee brings nectar back to the hive?",
         ["It seals the cells", "Bees chew and pass it along", "It is capped with wax", "It is eaten right away"], 1,
         "¶2 says back at the hive bees chew the nectar and pass it along.",
         {"paragraph": 2, "hint": "¶2 describes what bees do once back at the hive."}),
        ("detail", "Why do bees fan the honey with their wings?",
         ["To cool the hive", "To dry it and make it thick", "To call other bees", "To clean the cells"], 1,
         "¶3 says fanning dries the honey so it becomes thick.",
         {"paragraph": 3, "hint": "¶3 explains what the fanning does to the honey."}),
        ("vocab", "In ¶3, honey that is “thick and sticky” is the opposite of—",
         ["watery and thin", "sweet", "golden", "warm"], 0,
         "Thick and sticky is the opposite of watery and thin.",
         {"paragraph": 3, "hint": "Re-read ¶3 — picture how the honey changes from the runny nectar."}),
        ("main_idea", "This passage mainly explains—",
         ["why bees sting", "how bees turn nectar into honey", "where bees sleep", "how to start a hive"], 1,
         "The whole passage walks through how bees make honey.",
         {"paragraph": 1, "hint": "Look at how each paragraph follows one process from start to finish."}),
     ]),
    (3, 3, 8, "The Big Race",
     [
        "Diego had practiced all month for the school relay race. His team needed him to run the final leg and bring home the baton.",
        "When the race began, Diego’s team fell behind. By the time the baton reached him, his team was in last place.",
        "Diego took a deep breath and ran as fast as he ever had. One by one, he passed the other runners, his heart pounding.",
        "He crossed the finish line first by a single step. His teammates lifted him onto their shoulders, cheering his name.",
     ],
     [
        ("detail", "Which part of the race did Diego run?",
         ["The first leg", "The final leg", "He was the referee", "He didn’t run"], 1,
         "¶1 says Diego ran the final leg.",
         {"paragraph": 1, "hint": "¶1 says which leg of the relay Diego ran."}),
        ("detail", "What place was Diego’s team in when he got the baton?",
         ["First", "Second", "Last", "They had quit"], 2,
         "¶2 says the team was in last place when the baton reached him.",
         {"paragraph": 2, "hint": "¶2 tells you the team’s position at that moment."}),
        ("inference", "How did Diego feel as he passed the other runners?",
         ["Bored", "Determined and excited", "Sleepy", "Afraid of winning"], 1,
         "Running his hardest with a pounding heart shows he was determined and excited.",
         {"paragraph": 3, "hint": "¶3 describes his effort and his pounding heart — what does that suggest?"}),
        ("sequence", "What happened right after Diego crossed the finish line?",
         ["The race restarted", "His teammates lifted him up", "He sat down to rest", "He dropped the baton"], 1,
         "¶4 says his teammates lifted him onto their shoulders.",
         {"paragraph": 4, "hint": "¶4 tells you what his teammates did at the end."}),
        ("main_idea", "What is the main message of this story?",
         ["Always run slowly", "Hard work can turn things around", "Relay races are boring", "Never join a team"], 1,
         "Diego practiced and pushed hard, turning last place into a win.",
         {"paragraph": 1, "hint": "Think about Diego’s month of practice and how the race ended."}),
     ]),
]


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    made_p = made_q = 0
    for grade, week, order, title, paras, questions in PASSAGES:
        existing = sb.table("passages").select("id").eq("grade", grade).eq("title", title).execute().data
        if existing:
            print(f"  exists: G{grade} W{week} L{order} — {title}")
            continue
        paragraphs = [{"n": i + 1, "text": t} for i, t in enumerate(paras)]
        wc = sum(len(t.split()) for t in paras)
        pid = (
            sb.table("passages")
            .insert({
                "grade": grade, "week": week, "level_order": order, "title": title,
                "paragraphs": paragraphs, "word_count": wc, "status": "published",
            })
            .execute()
            .data[0]["id"]
        )
        made_p += 1
        rows = []
        for qtype, stem, options, ci, expl, locator in questions:
            shuffled = options[:]
            random.shuffle(shuffled)  # don't let the correct answer sit in one spot
            new_ci = shuffled.index(options[ci])
            qdiff = {"detail": 1, "main_idea": 2, "sequence": 2, "vocab": 3, "inference": 4}
            difficulty = max(1, min(5, qdiff.get(qtype, 2) + (1 if grade >= 5 else 0)))
            rows.append({
                "passage_id": pid, "stem": stem, "options": shuffled, "correct_index": new_ci,
                "explanation": expl, "locator": locator, "qtype": qtype,
                "difficulty": difficulty, "status": "vetted",
            })
        sb.table("reading_questions").insert(rows).execute()
        made_q += len(rows)
        print(f"  + G{grade} L{order} — {title} ({len(rows)} questions)")

    print(f"\nseeded {made_p} passages, {made_q} questions")


if __name__ == "__main__":
    main()
