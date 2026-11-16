# Gate A — Combat Feel: Validation (Build 0.4.0)

_2026-11-16. Spec: GDD §6 (combat) and §14 Gate A. Earlier behavior: `docs/BASELINE.md` (0.3.0)._

**Gate A pass criteria (GDD §14):** no unfair hit directions; readable input; smooth on a phone.

| Criterion | Status |
|---|---|
| No unfair hit directions | **Pass (automated + desktop browser).** Hits need a 90° frontal arc. Enemy swings are telegraphed and turn toward their target at windup. Blocks cover a 120° front, so flank and rear hits always land. |
| Readable input | **Pass (desktop browser).** Windup, active and recovery each look different. The shield shows as a frontal arc. A 100 ms input buffer catches early taps. |
| Smooth on a phone | **Not yet verified.** Needs a real mid-range Android phone and an iPhone. See the checklist below. |

---

## What changed from 0.3.0

### Attack lifecycle (GDD §6)
- Swings now have phases: **windup 0.16 s → active 0.12 s → recovery 0.24 s** (0.52 s total; the hero's cooldown is now 0.52 s, was 0.49 s). Damage lands only in the active window.
- **Arc narrowed from ~135° to 90°.** Reach is unchanged (hero 67 px, soldiers 48 px). The GDD's 24 px reach assumes 16×24 sprites, while ours are drawn about 3× larger, so we follow the GDD's own guidance to favor readability.
- **One swing can hit several targets, each at most once** (GDD: "a single target may be hit once per swing"). 0.3.0 stopped after the first target. ⚠️ This makes the hero stronger against crowds, so it's a balance item for playtesting.
- **Facing locks during windup and active.** You can still move, but the swing direction is fixed once it starts.
- **Input buffer:** an attack pressed up to 100 ms before recovery ends starts the next swing straight away. Earlier presses are dropped. Holding the attack button still auto-repeats.
- AI soldiers turn toward their target when they start a swing. In 0.3.0 an AI swing could whiff because the unit was facing the wrong way.
- Archers are unchanged: 1.2 s cooldown, instant release, 245 px range. Ranged rules move to Phase 2.

### Block (GDD §6)
- **120° frontal arc** (0.3.0 was ~135°). Hits from the sides and behind land.
- **Block can't interrupt a committed swing.** Holding block during windup or active has no effect until recovery starts, and it then takes effect automatically.
- While guarding: movement ×0.65 and no attacking (unchanged). Arrows from the front are still blocked. The GDD only says "melee", but a shield stopping frontal arrows seems more intuitive; revisit in Phase 2 if needed.

### Feedback
- **Swing telegraph:** a dashed arc grows during windup (red and stronger for enemies, since it's the cue to block), a bright slash shows during the active window, and a fading arc during recovery.
- **Shield:** a 120° arc in front of the guarding unit, replacing 0.3.0's full circle.
- **Knockback:** each landed hit pushes the target 6 px.
- **Downed units** stay on the field lying down and faded instead of disappearing (enemy bodies are cleared when the next wave spawns).
- **Archer release flash.**

### Lifecycle and touch
- **Auto-pause** when the tab is hidden (`visibilitychange` / `pagehide`). All held inputs are released, and the game never resumes by itself.
- **Portrait prompt:** on touch devices held upright, a "Rotate your device" overlay appears and any battle is paused.
- The joystick also resets when the browser takes the touch away (`lostpointercapture`), so the hero can't keep walking after an interrupted touch.
- **Touch targets:** the Pause, Logs, Orders-panel and menu buttons are now at least 44 px, or 48 px on touch devices.
- **Safe-area insets** keep the game clear of the notch and home bar.
- **Orders panel moved** to sit above the Attack/Block buttons (GDD §11: "Orders above"). It no longer covers the Block button or the middle of the field (GDD edge case: "tap commands overlap the attack button"). The selected group and its current order are highlighted.

---

## Verification done

- **Automated:** `npm test` → 41/41.
  - New tests cover:
    - the 90° and 120° arcs
    - the three swing phases and their timing
    - one hit per target per swing, with several targets per swing allowed
    - facing locking during a swing
    - block not interrupting a swing
    - no attacking while guarding
    - the 100 ms buffer, both accepting and dropping a press
    - AI aiming at the start of a swing
    - knockback
    - a lethal hit cancelling the target's swing
  - The 0.3.0 tests for waves, deployment, casualties, rewards and saves still pass.
- **Desktop browser (Claude's in-app browser):**
  - A full scripted battle through both waves ended in victory with no errors and all 53 sprites loaded.
  - Screenshots confirmed the windup, active and shield arcs and the downed bodies.
  - A hidden tab paused the game and cleared inputs.
  - The portrait prompt appeared at 375×812.
  - At an 812×375 landscape viewport, the Orders panel didn't overlap the Attack, Block, Orders, Pause or Logs buttons.

## Still to check on a real phone (owner playtest)

- [ ] 60 fps in a full wave 2 fight (12 infantry + 8 archers + 8 enemies) on a mid-range Android phone, in Chrome.
- [ ] The same on iPhone Safari, including the home-bar safe area.
- [ ] Enemy windup telegraphs are readable in time to block. If not, lengthen the enemy windup rather than the hero's.
- [ ] Tapping Attack feels responsive (buffered taps aren't lost; no double swings).
- [ ] Block plus joystick at the same time: two-thumb play works with no stuck inputs.
- [ ] Rotating mid-battle → prompt + pause; rotating back → tap Resume to continue.
- [ ] Switching apps or locking the screen mid-battle → paused on return.
- [ ] The Orders panel can be used with a thumb while the joystick is held.
- [ ] Balance check: is the hero too strong with multi-target swings, and are waves still a threat?

Record the results here (device, browser, fps, notes) to close Gate A.
