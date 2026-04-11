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
