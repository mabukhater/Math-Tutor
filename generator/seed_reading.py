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
import sys

try:
    from supabase import create_client
    from dotenv import load_dotenv
except ImportError as e:
    sys.exit(f"Missing dependency ({e}). Run: pip install -r generator/requirements.txt")

load_dotenv()

# grade, level_order, title, [paragraphs], [questions]
PASSAGES = [
    (2, 1, "The Lost Kite",
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
    (3, 1, "The Classroom Garden",
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
    (3, 2, "The Brave Little Boat",
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
]


def main() -> None:
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    made_p = made_q = 0
    for grade, order, title, paras, questions in PASSAGES:
        existing = sb.table("passages").select("id").eq("grade", grade).eq("title", title).execute().data
        if existing:
            print(f"  exists: G{grade} L{order} — {title}")
            continue
        paragraphs = [{"n": i + 1, "text": t} for i, t in enumerate(paras)]
        wc = sum(len(t.split()) for t in paras)
        pid = (
            sb.table("passages")
            .insert({
                "grade": grade, "level_order": order, "title": title,
                "paragraphs": paragraphs, "word_count": wc, "status": "published",
            })
            .execute()
            .data[0]["id"]
        )
        made_p += 1
        rows = []
        for qtype, stem, options, ci, expl, locator in questions:
            rows.append({
                "passage_id": pid, "stem": stem, "options": options, "correct_index": ci,
                "explanation": expl, "locator": locator, "qtype": qtype, "status": "vetted",
            })
        sb.table("reading_questions").insert(rows).execute()
        made_q += len(rows)
        print(f"  + G{grade} L{order} — {title} ({len(rows)} questions)")

    print(f"\nseeded {made_p} passages, {made_q} questions")


if __name__ == "__main__":
    main()
