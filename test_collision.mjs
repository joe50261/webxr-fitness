#!/usr/bin/env node
// Collision test — extracts Engine from index.html and simulates punches.
import { readFileSync } from 'fs';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const engineMatch = html.match(/^class Engine \{[\s\S]*?\n\}/m);
if (!engineMatch) { console.error('Could not extract Engine class'); process.exit(1); }

const Engine = new Function(engineMatch[0] + '\nreturn Engine;')();

// ── Helpers ──
function makeEngine() {
  const e = new Engine();
  e.calibration.done = true;
  e.calibration.left  = { x: -0.3, y: 1.3, z: -0.5 };
  e.calibration.right = { x:  0.3, y: 1.3, z: -0.5 };
  for (const pat of e.patterns) {
    for (const pos of pat.positions) {
      const cal = pos.hand === 0 ? e.calibration.left : e.calibration.right;
      pos.x = cal.x;
      pos.y = cal.y;
    }
  }
  e.state.phase = 'playing';
  e.state.sessionStart = performance.now();
  e.state.lastSpawnTime = performance.now();
  e.controllers[0].inited = true;
  e.controllers[1].inited = true;
  return e;
}

function placeTarget(engine, x, y, z, hand = 1) {
  const id = engine.state.nextTargetId++;
  const t = {
    id, x, y, z, hand,
    punchType: 'cross',
    expectedDir: [0, 0, -1],
    hit: false,
    tracking: null,
    spawnTime: performance.now() - 2000,
    anchorZ: -0.5,
    scaleReady: true,
  };
  engine.targets.push(t);
  return t;
}

function simPunch(engine, cx, cy, tz, hand, speed, fps = 72) {
  const dt = 1 / fps;
  const step = speed * dt;
  let hitResult = null;
  engine.on('hit', d => { hitResult = d; });

  // Controller starts behind target (player side, +z) and punches forward (-z)
  let cz = tz + 1.5;
  engine.controllers[hand].pos = [cx, cy, cz];
  engine.controllers[hand].prevPos = [cx, cy, cz];

  for (let frame = 0; frame < 500 && !hitResult; frame++) {
    cz -= step;
    engine.controllers[hand].prevPos = engine.controllers[hand].pos.slice();
    engine.controllers[hand].pos = [cx, cy, cz];

    engine.updateControllerVelocities(dt);
    for (let i = engine.targets.length - 1; i >= 0; i--) {
      const t = engine.targets[i];
      if (t.hit) { engine.targets.splice(i, 1); continue; }
      engine.processCollision(t, i);
    }
  }
  return hitResult;
}

let passed = 0, failed = 0;
function assert(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`); }
}

// ════════════════════════════════════════════════
// TEST 1: Head-on approach — should use closest-approach, not first-contact
// ════════════════════════════════════════════════
console.log('═══════════════════════════════════════════════════');
console.log('TEST 1: Head-on approach at 4 m/s (perfect aim)');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);
  const r = simPunch(e, tx, ty, tz, 1, 4.0);

  assert('Hit registered', !!r);
  if (r) {
    console.log(`    distance: ${r.distance.toFixed(4)}m, label: ${r.result.label}, score: ${r.points}`);
    assert('Closest approach < GREAT threshold (0.15m)', r.distance < e.config.GREAT_THRESHOLD,
      `got ${r.distance.toFixed(4)}m`);
    assert('NOT WEAK', r.result.label !== 'WEAK', `got ${r.result.label}`);
  }
}

// ════════════════════════════════════════════════
// TEST 2: Various speeds — all should score well on direct hit
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 2: Direct hits at various speeds');
console.log('═══════════════════════════════════════════════════');
{
  const speeds = [1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0];
  const fps = 72;
  const dt = 1 / fps;

  console.log(`  ${'Speed'.padEnd(10)} ${'Step/frm'.padEnd(10)} ${'MinDist'.padEnd(10)} ${'Label'.padEnd(10)} Score`);
  console.log('  ' + '─'.repeat(55));

  let allGoodOrBetter = true;
  for (const speed of speeds) {
    const e = makeEngine();
    const tx = 0.3, ty = 1.3, tz = -0.2;
    placeTarget(e, tx, ty, tz, 1);
    const r = simPunch(e, tx, ty, tz, 1, speed);

    if (r) {
      const step = (speed * dt * 100).toFixed(1);
      console.log(`  ${(speed+'m/s').padEnd(10)} ${(step+'cm').padEnd(10)} ${r.distance.toFixed(4).padEnd(10)} ${r.result.label.padEnd(10)} ${r.points}`);
      if (r.result.label === 'WEAK') allGoodOrBetter = false;
    } else {
      console.log(`  ${(speed+'m/s').padEnd(10)} — NO HIT`);
      allGoodOrBetter = false;
    }
  }
  assert('All direct hits score GOOD or better', allGoodOrBetter);
}

// ════════════════════════════════════════════════
// TEST 3: Offset hit — controller passes 10cm off center
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 3: Offset hit — 10cm off center');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);
  const offset = 0.10;
  const r = simPunch(e, tx + offset, ty, tz, 1, 4.0);

  assert('Hit registered', !!r);
  if (r) {
    console.log(`    distance: ${r.distance.toFixed(4)}m (offset=${offset}m)`);
    assert('Min distance ≈ offset', Math.abs(r.distance - offset) < 0.02,
      `expected ~${offset}, got ${r.distance.toFixed(4)}`);
    assert('Label is GREAT or GOOD', r.result.label === 'GREAT' || r.result.label === 'GOOD',
      `got ${r.result.label}`);
  }
}

// ════════════════════════════════════════════════
// TEST 4: Large offset — 25cm, should be GOOD
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 4: Offset hit — 25cm off center');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);
  const offset = 0.25;
  const r = simPunch(e, tx + offset, ty, tz, 1, 4.0);

  assert('Hit registered', !!r);
  if (r) {
    console.log(`    distance: ${r.distance.toFixed(4)}m`);
    assert('Min distance ≈ offset', Math.abs(r.distance - offset) < 0.02,
      `expected ~${offset}, got ${r.distance.toFixed(4)}`);
    assert('Label is GOOD', r.result.label === 'GOOD', `got ${r.result.label}`);
  }
}

// ════════════════════════════════════════════════
// TEST 5: Slow drift (below MIN_PUNCH_VELOCITY) — should NOT score
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 5: Slow drift through target (0.3 m/s)');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);
  const r = simPunch(e, tx, ty, tz, 1, 0.3);

  assert('No hit (drift filtered by velocity gate)', !r);
}

// ════════════════════════════════════════════════
// TEST 6: Miss — controller passes far from target
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 6: Complete miss — 1m offset');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);
  const r = simPunch(e, tx + 1.0, ty, tz, 1, 4.0);

  assert('No hit (outside HIT_DISTANCE)', !r);
}

// ════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log(`RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
