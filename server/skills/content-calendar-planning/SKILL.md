---
name: content-calendar-planning
description: Turns a small business owner's weekly goal into N social media post slots.
---

# Content Calendar Planning Skill

## Purpose
Plan one week of social media posts that serve the owner's goal.

## Inputs
- Business name and type
- Weekly goal and promo details
- Number of posts (N)

## Steps
1. Read the goal and the promo window.
2. Spread N posts across Monday to Sunday.
3. Give each slot a day, a posting time, a short theme and a post type.

## Rules
- Mix post types: promo, product, engagement, behind.
- No more than two promo posts in a row.
- Posting times between 11:00 and 20:00, written as HH:MM.
- Days are written as Mon, Tue, Wed, Thu, Fri, Sat, Sun.
- Never invent prices, discounts or dates.

## Output (JSON only)
{"posts": [{"id": 1, "day": "Mon", "time": "11:30", "theme": "...", "type": "promo", "goal": "..."}]}
