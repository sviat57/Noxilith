# MindGarden — Obsidian-like notes app for Svat (DM request)

Requirements (from Svat, in Russian):
- Notes/thoughts writing like Obsidian
- Easy browsing of all notes
- Beautiful links between notes (wikilinks + graph view like Obsidian)
- Timer function
- Task calendar
- Creation date stored per note + marked on calendar
- No database for now → localStorage only
- Other features: my choice; beautiful & usable
- UI language: Russian

## Plan
- [x] init_app_project (mindgarden)
- [x] Add deps: marked, dompurify, d3-force
- [x] src/lib/vault.tsx — types, localStorage store, React context, seed notes (RU)
- [x] src/lib/markdown.ts — wikilink/tag extraction + rendering
- [x] Theme: dark Obsidian-like (purple accent) in index.css, APP_NAME
- [x] Notes view: list + markdown editor (edit/preview) + right panel (backlinks, meta)
- [x] Graph view: force-directed canvas graph, click → open note
- [x] Calendar view: month grid, notes by creation date, tasks by due date
- [x] Tasks: add/complete/delete, due dates
- [x] Timer: pomodoro (focus/break), persistent across views
- [x] Extras: search, tags, pin, export/import JSON, stats
- [x] App.tsx routes (no convex auth in front; platform viktor_auth protects)
- [x] bun run sync:build, fix errors
- [x] e2e test (create note, link, backlink, task, calendar, timer)
- [x] Screenshots
- [x] Deploy preview, Slack message w/ screenshots + URL + prod approval buttons
- [ ] Wait approval → deploy production

Status: preview deployed (https://preview-mindgarden-504f6f4e.viktor.space), waiting for Svat approval to deploy production.
