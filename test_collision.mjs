#!/usr/bin/env node
// Automated collision test — extracts Engine from index.html and simulates punches.
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
    spawnTime: performance.now() - 2000,
    anchorZ: -0.5,
    scaleReady: true,
  };
  engine.targets.push(t);
  return t;
}

// ── Test 1: Controller approaching target from front — per-frame distances ──
console.log('═══════════════════════════════════════════════════');
console.log('TEST 1: Controller approaches target head-on');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);

  let hitResult = null;
  e.on('hit', d => { hitResult = d; });

  const speed = 4.0; // m/s approach speed
  const dt = 1 / 72; // 72 Hz frame rate
  const stepZ = -speed * dt;

  // Controller starts behind target, moves toward it
  let cz = tz - 1.5;
  e.controllers[1].pos = [tx, ty, cz];
  e.controllers[1].prevPos = [tx, ty, cz];

  console.log(`  Target at z=${tz.toFixed(2)}, controller starts at z=${cz.toFixed(2)}`);
  console.log(`  Speed: ${speed} m/s, dt: ${(dt*1000).toFixed(1)}ms, step: ${(Math.abs(stepZ)*100).toFixed(1)}cm/frame`);
  console.log(`  HIT_DISTANCE: ${e.config.HIT_DISTANCE}m`);
  console.log('');

  for (let frame = 0; frame < 200 && !hitResult; frame++) {
    cz -= stepZ; // controller moves in -z direction toward target
    e.controllers[1].prevPos = e.controllers[1].pos.slice();
    e.controllers[1].pos = [tx, ty, cz];
    e.controllers[1].vel = [0, 0, -speed];

    // Don't let engine spawn or move targets — we control everything
    const savedTargets = e.targets.slice();
    e.updateControllerVelocities(dt);
    e.targets = savedTargets;
    for (let i = e.targets.length - 1; i >= 0; i--) {
      const t = e.targets[i];
      if (t.hit) { e.targets.splice(i, 1); continue; }
      e.processCollision(t, i);
    }

    const dist = Math.sqrt((tx - tx)**2 + (ty - ty)**2 + (cz - tz)**2);
    if (frame < 5 || dist < 0.8) {
      console.log(`  frame ${String(frame).padStart(3)}: ctrl_z=${cz.toFixed(3)}, dist=${dist.toFixed(3)}m${hitResult ? ' ← HIT' : ''}`);
    }
  }

  if (hitResult) {
    console.log('');
    console.log(`  ✓ Hit registered at distance: ${hitResult.distance.toFixed(4)}m`);
    console.log(`  ✓ Label: ${hitResult.result.label}, Score: ${hitResult.points}`);
    console.log(`  ✓ Thresholds: PERFECT<${e.config.PERFECT_THRESHOLD} GREAT<${e.config.GREAT_THRESHOLD} GOOD<${e.config.GOOD_THRESHOLD} HIT<${e.config.HIT_DISTANCE}`);
    console.log(`  → Distance ${hitResult.distance.toFixed(3)}m falls in: ${hitResult.result.label} range`);
  } else {
    console.log('  ✗ No hit registered!');
  }
}

// ── Test 2: Various approach speeds ──
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 2: Hit distance at various approach speeds');
console.log('═══════════════════════════════════════════════════');
{
  const speeds = [1.0, 2.0, 3.0, 4.0, 6.0, 8.0, 10.0];
  const fps = 72;
  const dt = 1 / fps;

  console.log(`  ${'Speed'.padEnd(10)} ${'Step/frame'.padEnd(12)} ${'Hit dist'.padEnd(10)} ${'Label'.padEnd(10)} Score`);
  console.log('  ' + '─'.repeat(55));

  for (const speed of speeds) {
    const e = makeEngine();
    const tx = 0.3, ty = 1.3, tz = -0.2;
    placeTarget(e, tx, ty, tz, 1);

    let hitResult = null;
    e.on('hit', d => { hitResult = d; });

    let cz = tz - 1.5;
    e.controllers[1].pos = [tx, ty, cz];
    e.controllers[1].prevPos = [tx, ty, cz];

    for (let frame = 0; frame < 500 && !hitResult; frame++) {
      const stepZ = speed * dt;
      cz += stepZ;
      e.controllers[1].prevPos = e.controllers[1].pos.slice();
      e.controllers[1].pos = [tx, ty, cz];
      e.controllers[1].vel = [0, 0, -speed];

      e.updateControllerVelocities(dt);
      for (let i = e.targets.length - 1; i >= 0; i--) {
        const t = e.targets[i];
        if (t.hit) { e.targets.splice(i, 1); continue; }
        e.processCollision(t, i);
      }
    }

    if (hitResult) {
      const step = (speed * dt * 100).toFixed(1);
      console.log(`  ${(speed+'m/s').padEnd(10)} ${(step+'cm').padEnd(12)} ${hitResult.distance.toFixed(4).padEnd(10)} ${hitResult.result.label.padEnd(10)} ${hitResult.points}`);
    }
  }
}

// ── Test 3: Perfect alignment — controller placed exactly on target ──
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 3: Controller teleported to target center');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);

  let hitResult = null;
  e.on('hit', d => { hitResult = d; });

  e.controllers[1].pos = [tx, ty, tz - 1.0];
  e.controllers[1].prevPos = [tx, ty, tz - 1.0];
  e.controllers[1].vel = [0, 0, -3];
  e.updateControllerVelocities(1/72);

  // Teleport to exact target center
  e.controllers[1].prevPos = [tx, ty, tz - 0.05];
  e.controllers[1].pos = [tx, ty, tz];
  e.controllers[1].vel = [0, 0, -3];

  for (let i = e.targets.length - 1; i >= 0; i--) {
    const t = e.targets[i];
    if (t.hit) { e.targets.splice(i, 1); continue; }
    e.processCollision(t, i);
  }

  if (hitResult) {
    console.log(`  Distance: ${hitResult.distance.toFixed(4)}m → ${hitResult.result.label} (${hitResult.points}pts)`);
  } else {
    console.log('  ✗ No hit');
  }
}

// ── Test 4: Step-through problem — controller jumps past target ──
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('TEST 4: Tunneling — fast controller skips past target');
console.log('═══════════════════════════════════════════════════');
{
  const e = makeEngine();
  const tx = 0.3, ty = 1.3, tz = -0.2;
  placeTarget(e, tx, ty, tz, 1);

  let hitResult = null;
  e.on('hit', d => { hitResult = d; });

  // Simulate very fast punch: 15 m/s at 72fps = 20.8cm/frame
  // HIT_DISTANCE = 0.6m = 60cm. Still within range, should hit.
  // But at 30m/s: 41.6cm/frame — could skip from outside to past center
  const speed = 30;
  const dt = 1/72;
  const step = speed * dt;

  e.controllers[1].pos = [tx, ty, tz - 0.7]; // just outside HIT_DISTANCE
  e.controllers[1].prevPos = [tx, ty, tz - 0.7 - step];
  e.controllers[1].vel = [0, 0, -speed];

  // One frame later: jumped past
  e.controllers[1].prevPos = e.controllers[1].pos.slice();
  e.controllers[1].pos = [tx, ty, tz - 0.7 + step]; // now past target
  e.controllers[1].vel = [0, 0, -speed];

  for (let i = e.targets.length - 1; i >= 0; i--) {
    const t = e.targets[i];
    if (t.hit) { e.targets.splice(i, 1); continue; }
    e.processCollision(t, i);
  }

  console.log(`  Speed: ${speed}m/s, step: ${(step*100).toFixed(1)}cm/frame`);
  console.log(`  Controller jumped from z=${(tz-0.7).toFixed(2)} to z=${(tz-0.7+step).toFixed(2)}`);
  if (hitResult) {
    console.log(`  Hit: ${hitResult.distance.toFixed(3)}m → ${hitResult.result.label}`);
  } else {
    console.log('  ✗ MISS — tunneled through! (discrete check only sees one frame)');
  }
}

console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('DIAGNOSIS');
console.log('═══════════════════════════════════════════════════');
console.log('Discrete sphere-in-sphere fires on FIRST contact at the');
console.log('sphere boundary (~0.6m). The fist never gets scored at');
console.log('closer distances because the hit triggers immediately.');
console.log('Result: everything is WEAK unless teleported to center.');
