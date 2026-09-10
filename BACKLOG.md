# Kickoff Punch List

## Queued

- [ ] Add **Smart Display / Wake Lock** behavior: keep the KTC display awake while games are live (optionally shortly before kickoff), then release the browser wake lock after the final game so Android's normal timeout can turn the screen off.
- [ ] Add an **NFL Playoff Picture Rail** to the Conferences view, separating clinched/locked seeds, current provisional seeds, in-the-hunt teams, and eliminated teams as standings change. (A mock 2025 preview already exists on Season Schedule as a placeholder — this item is the real, live-data version.)

## Completed

- [x] Add a **Division Match** mini-game (reachable via a button on each Conferences page): drag team logos onto their real conference/division, or tap a team then tap its home as a touch-reliable fallback (also gives free keyboard support). NFL groups by division (8 targets), NCAA by conference (its in-conference "divisions" are stylized, not something worth quizzing). Rounds are a random Quick(8)/Standard(12)/Full-board draw from the same static alignment data the Conferences page already uses, replayable via New Round. Drag uses Pointer Events + `elementFromPoint` hit-testing at release, not native HTML5 drag-and-drop (poor touch support). Hold a team for 3 seconds to reveal its correct conference/division (same "hold to peek" language as the muted-score reveal elsewhere) — highlights the target box and labels the tile in place.
- [x] Show which teams are **on a bye** at the bottom of each week on the season-by-week schedule (both Week by Week and Full Season views). The "full roster" a bye is computed against is every team that appears anywhere in that league's season schedule, not every team the API knows about, so the list isn't swamped by teams never actually scheduled. Hidden entirely for weeks where nobody's out.
- [x] Add a reusable **Find Games** filter panel to Day, Week, Season Schedule, and Game Day Central's "other games" list, alongside the existing one-tap **My Games** chip. Combines league, conference/division (real teams matched against the Conferences page's alignment data — coverage is only as complete as that data, so most FCS/small-school games have no conference), ranked vs. ranked / any Top 25 team (NCAA only), in-conference-or-division matchups (the closest proxy available without a real rivalry list), kickoff-at-or-after time, hide completed (optionally keeping favorites/circled), elite (.750+) and undefeated records, and hide-FCS-opponent. Playoff-impact filtering is deliberately left out for now — it needs real standings/tiebreaker math, not just a checkbox.
- [x] Add a **Find Teams** filter panel to the Conferences pages (NFL & NCAA) — search by name, Favorites/Interest, ranked-only (NCAA), and a minimum-record ladder (.500+/.750+/undefeated). No FCS toggle: the Conferences page's alignment data is FBS-only, so there'd be nothing to hide.
- [x] Compact the NCAA/NFL **Conference header** into a KTC-friendly control band while retaining the league switch, title/context, marker legend, and touch-sized color controls.
- [x] Add persistent **Teams of Interest**, separate from Favorites, for rivals and other opponents worth monitoring. Interest teams use a teal diamond and restrained team-level highlighting, appear on My Teams and the Watch rail, and intentionally do not enter the My Games favorites filter.
- [x] Add a global **Wipe** control for the touchscreen. It locks every app interaction for 10 seconds, shows the remaining time in the header button and a clear on-screen countdown, then restores controls automatically.
- [x] Add an **NCAA Top 25 Ranking Rail** to the Conferences and NCAA season views. The hideable left rail has live records, favorite controls, dark touch scrolling, and archived AP snapshots for the selected week. Once committee rankings begin it becomes a CFP-first comparison list with both CFP and AP positions; unpublished future weeks are clearly labeled with the latest available poll.
- [x] Improve **touchscreen segmented controls** without changing their pill-style visual language. League, schedule-view, and conference-color switches now use larger coarse-pointer targets, immediate manipulation taps, press feedback, and keyboard-visible focus.
- [x] Add **Stale Game Detection / Recovery**. A live game's timestamp now advances only when its scoreboard actually changes; after 10 unchanged minutes, a throttled recovery pass checks ESPN's per-game summary and propagates any corrected terminal status through the shared database record.

## Saved Team Indicator Treatments

Keep these available for KTC A25Q5 touchscreen trials. The active treatment is **C**.

- **A — Current glow:** muted rounded outline and low glow.
- **B — Soft emboss:** faint top highlight and inset lower shadow.
- **C — Low drop shadow (active):** quiet elevation without a visible outline; currently using the extra-dim variant.
- **D — Tint + edge rail:** low-opacity directional wash with a short colored rail.
- **E — Grounded underline:** short, low-opacity line beneath the team identity.
- **F — Corner ticks:** refined 6px opposing corner marks with a tight blue/white glow.
- **G — Micro status pip:** tiny colored dot with almost no surrounding treatment.
