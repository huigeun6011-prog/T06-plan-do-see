# Plan-Do-See Diary (ALEPH task 6)

Task text (verbatim): `docs/TASK.md`. It is the source of truth for the pass criteria (T06-Cxx).

## Purpose

A Plan-Do-See diary whose plan, todo, run record and retro data are linked in a server database, with no login, filled with the owner's real plans. The core is domain-neutral. The first real data is the owner's weekly MapleStory (KR) boss routine across several characters.

Why it exists beyond the checklist the owner already uses (maplechecklist.com, which resets each week and keeps no memory): it keeps the plan-versus-actual history and helps decide what to do when time is short.

## Users and use cases

- One user (the owner). The link is public; anyone with it can read and write (no login until task 7).
- Weekly: see what is left per character, tick bosses off, record how long they took; events (with their own period and missions) are tracked as separate plans.
- Daily: say how many minutes are available, get a suggested set of bosses (advisory only).
- Monthly: check whether the doping coins last until month end.

## Scope

In scope (confirmed, see STATUS decision log):
- Plans (weekly, monthly, event), todos, run records, retro per `docs/TASK.md` cards 1-5. Recurring tasks are registered with a repeat setting; non-repeating ones belong to an event.
- Characters as data (4 now, a 5th in winter). Per (character, boss) entry: clear minutes, reward (meso), party size, doping names, memo. Difficulty is part of the boss name, not a field.
- Weekly entries (reset Thursday 00:00 KST) and monthly entries (reset 1st 00:00 KST), including one account-level monthly entry with no character.
- Overview of what is left per character, with remaining minutes.
- "Today" suggestion: input minutes and party availability, get the set with the highest net meso that fits. Advisory, never enforced.
- Monthly doping-coin forecast.
- Retro improvement by an AI recap (button, server-side key, built last).

Planned later (not started): automatic clear-time measurement from a browser screen share, analysed in the browser (see STATUS decision log). Manual entry stays as the fallback.

Non-goals (explicitly out of scope):
- Letting the AI compute retro numbers or change registrations directly.
- Choosing doping for the user, simulating doping timers, damage-efficiency calculation, doping swap advice.
- Boss price or market tracking.
- Predicting whether the week can be completed.
- Reading game memory, hooking the process or intercepting game traffic.
- Scraping maple-boss.com (its terms forbid automated collection).
- Login and access control (task 7).

## Constraints

- Public, login-free link: enter only content that is fine to be public. No character nicknames or account data; job names are fine.
- Data lives in a server database, not browser storage.
- Dates use Seoul time; resets are Thursday 00:00 (weekly) and 1st 00:00 (monthly).
- No secrets in the browser, deploy files, network responses, console or Git history.
- Deadline: the human treats the 8-10 h estimate as soft; the auto-measure feature is planned for about a week.
- Stack: settled, see below.

## Stack

Next.js (React, TypeScript) on Vercel Hobby with GitHub auto-deploy, Neon Free Postgres, plain SQL (ADR 0003). AI recap through the Anthropic API (ADR 0005).

## Glossary

| Term | Meaning |
|---|---|
| 보스 / boss | Weekly or monthly boss fight; the name includes the difficulty, e.g. "노말 진힐라" |
| 클리어타임 / clear time | Minutes a boss takes for a given character; differs per character |
| 도핑 / doping | Temporary buffs with their own timers; each kind runs independently, same name does not stack |
| 시퀀스 | In-game system where the doping set is named; an unnamed doping means the default one |
| 유챔도핑 | 30-minute doping bought with Dragon Island coins |
| 드래곤 아일랜드 | Monthly account-level content that earns the doping coins |
| 보스 결정석 | Boss reward item; its sale value is the boss's reward in meso |
| 메소 / meso | In-game currency |
