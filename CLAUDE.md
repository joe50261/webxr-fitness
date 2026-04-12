# Project Instructions

## Versioning
Every commit must update the version label in `index.html` (the `#version` div near line 54).
Format: `vX.Y.Z-tag` — bump patch for fixes, minor for features, tag describes the change.

## Architecture Principles
- **Engine / Renderer separation**: computation and game state (engine) must be decoupled from Three.js visuals (renderer). Renderer reads engine data, never owns game logic.
- **Anchor-centric design**: anchors are the fixed reference frame. All accuracy is measured as offset from calibrated anchor positions.
- **Calibration-first**: no hardcoded body metrics. All spatial parameters come from the player's own calibration.
- **Fixed positions for muscle memory**: targets spawn at exact pattern coordinates, zero randomness.

## Tuning Log — Accuracy & Force
Subjective adjustments and their rationale. Update this section when tuning parameters.

### Distance thresholds (closest-approach measurement)
- `PERFECT_THRESHOLD: 0.08m` — nearly dead center, ~fist radius. Feels rewarding without being impossible.
- `GREAT_THRESHOLD: 0.15m` — one fist width. Solid hit.
- `GOOD_THRESHOLD: 0.3m` — reasonable aim, arm deviation.
- `HIT_DISTANCE: 0.6m` — entry zone that starts tracking. Not a scoring boundary.
- **Key lesson**: scoring must use closest-approach distance, NOT first-contact. First-contact always scored WEAK because the fist enters the zone at the outer edge.

### Velocity
- `MIN_PUNCH_VELOCITY: 0.8 m/s` — low bar. Filters accidental drift but allows light punches. Was 1.5, too high for casual/learning.

### Angle accuracy
- `< 0.15 dot product` → WEAK (breaks combo). Only penalizes clearly wrong direction (~81° off).
- `< 0.4 dot product` → downgrades one tier. Lenient — learning phase.
- **Note**: these will need tightening as difficulty system is added.

### Timing
- `MISS_DISTANCE: 2.0` — target flies 2m behind player before miss. Was -0.5, almost collided with ideal hit timing. Must have wide margin.
- Ideal hit Z comes from calibration (arm extension), not hardcoded.

### Visual feedback
- Ink = single line from anchor center to controller position at closest approach.
- Color = hand (left blue, right red). Opacity = precision (deep=accurate).
- Miss = no line, only floating text. No visual clutter for non-events.

## Development Process Notes
Lessons learned during development. Follow these to avoid repeated mistakes.

### File editing strategy
- **Large refactors (>200 lines changed)**: write parts to temp files, concatenate with `cat`, then verify. Do NOT use Edit tool piecemeal on a 1000+ line file — partial edits leave orphan code mixed with new code, causing cascading failures.
- **Small fixes (<50 lines)**: Edit tool is fine. Read the target lines first.
- **Always verify after edit**: `grep` for duplicate function definitions, check syntax with `node -e`, count lines with `wc -l`.

### Common logic pitfalls found in this project
- **First-contact scoring is wrong**: collision must track closest-approach distance, not the distance at entry into the hit zone. First-contact always gives worst score.
- **Miss zone must be far from ideal hit zone**: MISS_DISTANCE was -0.5 while ideal hit was -0.3, only 20cm apart. Miss must be well behind the player (z=2.0) to give the closest-approach system room to work.
- **Haptic controller mapping**: `session.inputSources[index]` order does NOT match `renderer.xr.getController(index)`. Store `inputSource` on the controller's `connected` event.
- **Ink mark position must use controller pos, not target pos**: the target is moving — the mark should show where the player's fist was at closest approach.
- **No randomness in positions**: targets and anchors use exact pattern coordinates. Randomness prevents building muscle memory.

### Architecture decisions
- Single-file `index.html` with Engine/Renderer classes (no build step, CDN imports). Chose this over multi-file because GitHub Pages serves static HTML directly.
- Engine class: pure arrays `[x,y,z]` for positions/velocities, no Three.js types. This keeps engine testable and framework-independent.
- Renderer syncs to engine via `Map<targetId, mesh>` — engine creates/removes data objects, renderer maps them to pooled Three.js meshes each frame.
- Event system (`engine.on/emit`) for one-way engine→renderer notifications (hit, miss, beat, calibration). Renderer never calls engine logic directly except `update()`.

