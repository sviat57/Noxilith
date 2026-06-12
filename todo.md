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
- [ ] Add deps: marked, dompurify, d3-force
- [ ] src/lib/vault.tsx — types, localStorage store, React context, seed notes (RU)
- [ ] src/lib/markdown.ts — wikilink/tag extraction + rendering
- [ ] Theme: dark Obsidian-like (purple accent) in index.css, APP_NAME
- [ ] Notes view: list + markdown editor (edit/preview) + right panel (backlinks, meta)
- [ ] Graph view: force-directed canvas graph, click → open note
- [ ] Calendar view: month grid, notes by creation date, tasks by due date
- [ ] Tasks: add/complete/delete, due dates
- [ ] Timer: pomodoro (focus/break), persistent across views
- [ ] Extras: search, tags, pin, export/import JSON, stats
- [ ] App.tsx routes (no convex auth in front; platform viktor_auth protects)
- [ ] bun run sync:build, fix errors
- [ ] e2e test (create note, link, backlink, task, calendar, timer)
- [ ] Screenshots
- [ ] Deploy preview, Slack message w/ screenshots + URL + prod approval buttons
- [ ] Wait approval → deploy production
