# Gate E — Public-Release Quality: Progress & Validation

_Spec: GDD §6 (scaling), §12 (performance targets), §13 (saves), §14 Gate E, §15 definition of done._

**Gate E pass criteria (GDD §14):** UX on landscape phones and web; export/import cross-platform; performance scaling, audio, tutorial, device QA, original/licensed art. **Pass:** complete core loop with no critical data loss or unavoidable progression blocker.

| Roadmap step | Status |
|---|---|
| 5.1 Battle scaling: active-unit cap with reserves, stress test, measured costs | ✅ 0.29.0 |
| 5.2 Landscape UX pass (the phone-size notes from Gate D; touch targets; dev buttons out of release builds) | ⬜ |
| 5.3 Settings and audio (battle size, volume, sound effects) | ⬜ |
| 5.4 Tutorial and help | ⬜ |
| 5.5 Save safety and cross-platform export/import QA | ⬜ |
| 5.6 Asset provenance (original or licensed art, GDD §11) | ⬜ |
| 5.7 Device QA and Gate E acceptance | ⬜ |

---

## Slice 1 — 0.29.0: Battle scaling (2026-11-17)

### What's in (GDD §6 "Scaling: initially profile 20 active units, then 30, then 40. If a battle has 60 total troops, reserve stacks enter as others fall"; §12 "battle wave cap configurable … use proximity grid, simple steering and staggered targeting")
- **Battle size (active-unit cap):**
  - At most 40 units fight at once by default: the hero, Mara, soldiers and enemies together. The size can be set to 20 or 30 for slower phones. For now it's in the Debug panel, and only for the session; it moves to Settings, saved, in 5.3.
  - Each side's share is fixed when the battle starts. The enemies get room for their biggest wave, up to half the field (at least 6). The company gets the rest.
- **Reserves:**
  - Anyone beyond their side's share waits in reserve and steps in as others fall, a stack of three at a time (or the last few). An announcement says how many joined and how many still wait, and the HUD shows "Reserves yours/theirs".
  - Your reinforcements are real roster soldiers: they earn XP and can be wounded like anyone deployed.
  - Soldiers beyond their formation slots (more than 12 infantry, 8 archers or 6 riders) now fight as reserves instead of sitting the battle out.
- **Waves** still come in order as authored. Each wave can hold some of its troops back as reserves.
- **GDD §15 edge case "battle ends during reinforcement spawn":** a battle is won only when the last wave and its reserves are spent. It is lost only when the hero, the field and the company's reserves are all down. "Win now" credits the enemies still waiting.
- **Unchanged at the default size:** a full company of 20 against an 8-man wave fits on the field, so nobody waits.
- **Stress test** (Debug panel → "Battle size & stress test"):
  - A practice battle of 20, 30, 40 or 60 units on the courtyard map: half yours, half Reavers, mixed infantry, archers and riders.
  - The result screen reports the average fps, the most units on the field, the simulation and drawing time per frame, and the slowest frame.
  - It changes nothing in the campaign and saves nothing.
- **Frame timing:** the diagnostics panel (Logs · F3) now shows smoothed simulation and drawing milliseconds per frame, plus the battle size.
- **Fix:** when a fought battle ended, the HUD still showed the counts from the frame before the last blow ("Enemies 1" on a victory). It now shows the final tally.

### Measurements
**Simulation, headless** (`npm run bench`, `scripts/bench-battle.js`): real battles at a fixed 60 Hz step, mean per-frame cost over 20 s on a desktop CPU.

| Units in the battle | Grass field | Forest clearing | Greywall courtyard | p95, worst map |
|---|---|---|---|---|
| 20 | 0.09 ms | 0.09 ms | 0.10 ms | 0.29 ms |
| 30 | 0.08 ms | 0.24 ms | 0.14 ms | 0.42 ms |
| 40 | 0.21 ms | 0.20 ms | 0.20 ms | 0.54 ms |
| 60 (40 on the field, 20 in reserve) | 0.16 ms | 0.22 ms | 0.26 ms | 0.58 ms |

Before the cap, a 60-unit battle put 54 on the field at up to 0.44 ms per frame.

**In the browser** (desktop, the Claude preview pane): the 40-unit stress test took 0.1 ms simulation and 0.5 ms drawing per frame; the 20-size battle with 60 units took 0.1 ms and 0.4 ms. The pane reported 30 fps, but a bare animation loop there also runs at 31 fps because the pane was in the background, so that is the pane's cap, not the game's.

**Conclusions:**
- At 40 units the game uses well under 1 ms of the 16.7 ms frame budget on desktop. Even a phone 10–20× slower would have plenty of room, but only a real phone can show that (GDD §12: "after actual device tests").
- **No proximity grid yet.** Targeting is already staggered (each unit re-picks a target every 0.17–0.41 s, not every frame), and nothing does per-frame all-pairs searches except swing hit checks against a few dozen opponents. The measurements show no need for a grid at MVP scale; it stays the first lever if a device test shows the simulation costing too much.
- The GDD's fallback order holds: lower the battle size, or stagger reinforcements, before simplifying AI.

### Checks
- `tests/scaling.test.js` (8 tests) covers:
  - today's battles fitting at size 40
  - a size-20 battle holding the field at 20, with reserves stepping in three at a time (real roster soldiers)
  - formation overflow fighting as reserves
  - a big wave holding some back, and the battle not ending until its reserves are spent
  - the company not being beaten while its reserves wait
  - waves in order with their own reserves
  - "Win now" crediting waiting enemies, and only the offered sizes being accepted
  - the stress test leaving the campaign and the save untouched
- 288 tests pass; lint clean.
- Browser, with real clicks:
  - Stress 40 at size 40: 40 on the field, won, and the result screen showed the numbers above.
  - Stress 60 at size 20: the field held at 20 (hero, 9 soldiers, 10 Reavers), with "Enemy wave 1/1 · 20 more waiting" and "Reserves 20/20" on the HUD. Six reinforcement stacks arrived during the fight, and the field stayed at exactly 20.
  - The preview save was byte-identical after both stress battles. No console errors.

### For the owner to try on a phone
- [ ] Debug → Battle size & stress test → **Stress 40** at size 40. Write down the fps, simulation ms and drawing ms on the result screen.
- [ ] If it's under about 30 fps, try **Stress 40** at size 30 and at size 20, and note which size feels smooth. That size becomes the default for phones in 5.3.
