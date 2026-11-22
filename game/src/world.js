// The heist rules and state, with no drawing and no browser in it: the thief, the
// patrolling guards and their vision cones, the sweeping cameras, the loot, the alarm
// meter, the three tools and the win/lose conditions. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without the world
// knowing about screens or sound.
//
// A guard sees the thief only inside its cone with a clear line of sight; being seen
// fills the alarm, hiding lets it drain. A camera works the same way but never moves.
// The night is won by taking the Grand Diamond and reaching the green EXIT; it is lost
// when the alarm hits 100, a guard touches the thief, or dawn breaks (the timer ends).

import {
  ALARM, CAMERA, CAMERA_MOUNTS, COVERS, EXIT, FIELD, GUARD, GUARD_ROUTES,
  LOOT_SPOTS, NIGHTS, START, THIEF, TOOLS, WALLS,
} from './config.js';

export const EVENT_LOOT = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_WIN = 4;
export const EVENT_TIMEUP = 8;
export const EVENT_SPOTTED = 16;

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_ALERT = 'alert';

const SOLIDS = [...WALLS, ...COVERS];

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment (x1,y1)-(x2,y2) crosses the rectangle r. */
function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

function losClear(x1, y1, x2, y2) {
  for (let i = 0; i < SOLIDS.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, SOLIDS[i])) return false;
  }
  return true;
}

/** Push a circle (x, y, radius) out of every solid it overlaps. */
function collide(circle) {
  for (let i = 0; i < SOLIDS.length; i += 1) {
    const r = SOLIDS[i];
    const nearX = Math.max(r.x, Math.min(circle.x, r.x + r.w));
    const nearY = Math.max(r.y, Math.min(circle.y, r.y + r.h));
    const dx = circle.x - nearX;
    const dy = circle.y - nearY;
    const dist = Math.hypot(dx, dy);
    if (dist >= circle.radius) continue;
    if (dist === 0) {
      circle.y = r.y - circle.radius;
      continue;
    }
    circle.x = nearX + (dx / dist) * circle.radius;
    circle.y = nearY + (dy / dist) * circle.radius;
  }
  circle.x = Math.max(16 + circle.radius, Math.min(FIELD.width - 16 - circle.radius, circle.x));
  circle.y = Math.max(76 + circle.radius, Math.min(FIELD.height - 16 - circle.radius, circle.y));
}

function pointInCone(px, py, ox, oy, angle, range, halfAngle) {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return 0;
  if (dist < 4) return 1;
  const facing = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(facing, angle)) > halfAngle) return 0;
  if (!losClear(ox, oy, px, py)) return 0;
  return 1 - dist / range;
}

export function createWorld(random) {
  const thief = {
    x: START.x, y: START.y, radius: THIEF.radius,
    facing: -Math.PI / 2, moving: false, sprinting: false, inSmoke: false,
  };
  const guards = [];
  const cameras = [];
  const loot = [];
  const smokes = [];
  const state = {
    night: 1, score: 0, lootTaken: 0, lootTotal: 0, diamondTaken: false,
    alarm: 0, timeLeft: 0, elapsed: 0, seen: false, spotted: false,
    tools: { smoke: TOOLS.smoke, emp: TOOLS.emp, lure: TOOLS.lure },
    won: false, lost: false, loseReason: '',
  };

  function buildNight(nightIndex) {
    const night = NIGHTS[nightIndex];
    state.night = nightIndex + 1;
    state.timeLeft = night.seconds;
    state.elapsed = 0;
    state.alarm = 0;
    state.score = 0;
    state.lootTaken = 0;
    state.diamondTaken = false;
    state.won = false;
    state.lost = false;
    state.loseReason = '';
    state.tools = { smoke: TOOLS.smoke, emp: TOOLS.emp, lure: TOOLS.lure };
    thief.x = START.x;
    thief.y = START.y;
    thief.facing = -Math.PI / 2;
    smokes.length = 0;

    guards.length = 0;
    for (let i = 0; i < night.guards; i += 1) {
      const route = GUARD_ROUTES[i];
      // Never spawn a guard on top of the thief's entry point.
      let start = route[0];
      for (let tries = 0; tries < route.length; tries += 1) {
        const candidate = route[Math.floor(random() * route.length)];
        if (Math.hypot(candidate[0] - START.x, candidate[1] - START.y) > 90) {
          start = candidate;
          break;
        }
        start = candidate;
      }
      guards.push({
        x: start[0], y: start[1], radius: GUARD.radius,
        route, waypoint: 0, facing: 0, pause: 0,
        mode: GUARD_PATROL, lastSeen: null, lookTimer: 0, loseTimer: 0,
        id: i,
      });
    }
    cameras.length = 0;
    for (let i = 0; i < night.cameras; i += 1) {
      const mount = CAMERA_MOUNTS[i];
      cameras.push({ ...mount, angle: mount.base, disabled: 0, phase: random() * Math.PI * 2 });
    }
    loot.length = 0;
    const spots = [LOOT_SPOTS[0], ...LOOT_SPOTS.slice(1, night.loot)];
    for (const spot of spots) {
      loot.push({ ...spot, taken: false, bob: random() * Math.PI * 2 });
    }
    state.lootTotal = loot.length;
  }

  function reset() {
    buildNight(0);
  }

  function nextNight() {
    if (state.night >= NIGHTS.length) return false;
    buildNight(state.night);
    return true;
  }

  function throwLure(point) {
    if (state.tools.lure <= 0 || !point) return false;
    state.tools.lure -= 1;
    let best = null;
    let bestDist = Infinity;
    for (const guard of guards) {
      const d = Math.hypot(guard.x - point.x, guard.y - point.y);
      if (d < 340 && d < bestDist) { best = guard; bestDist = d; }
    }
    if (best) {
      best.mode = GUARD_SUSPICIOUS;
      best.lastSeen = { x: point.x, y: point.y };
      best.lookTimer = 0;
    }
    return true;
  }

  function dropSmoke() {
    if (state.tools.smoke <= 0) return false;
    state.tools.smoke -= 1;
    smokes.push({ x: thief.x, y: thief.y, radius: TOOLS.smokeRadius, left: TOOLS.smokeSeconds });
    return true;
  }

  function fireEmp() {
    if (state.tools.emp <= 0) return false;
    state.tools.emp -= 1;
    for (const camera of cameras) {
      if (Math.hypot(camera.x - thief.x, camera.y - thief.y) < TOOLS.empRadius) {
        camera.disabled = TOOLS.empSeconds;
      }
    }
    return true;
  }

  function thiefInSmoke() {
    for (const smoke of smokes) {
      if (Math.hypot(thief.x - smoke.x, thief.y - smoke.y) < smoke.radius) return true;
    }
    return false;
  }

  /** True when a circle at (x, y) with radius r overlaps a wall or cover. */
  function blockedAt(x, y, r) {
    for (const solid of SOLIDS) {
      const nearX = Math.max(solid.x, Math.min(x, solid.x + solid.w));
      const nearY = Math.max(solid.y, Math.min(y, solid.y + solid.h));
      if (Math.hypot(x - nearX, y - nearY) < r) return true;
    }
    return false;
  }

  /** 0..1 how exposed (x, y) is to any cone right now; used by the shot autopilot. */
  function exposureAt(x, y) {
    let worst = 0;
    for (const guard of guards) {
      worst = Math.max(worst, pointInCone(x, y, guard.x, guard.y, guard.facing, GUARD.range, GUARD.halfAngle));
    }
    for (const camera of cameras) {
      if (camera.disabled > 0) continue;
      worst = Math.max(worst, pointInCone(x, y, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle));
    }
    return worst;
  }

  function stepGuard(guard, dt) {
    if (guard.mode === GUARD_ALERT) {
      const target = guard.lastSeen;
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      guard.facing = Math.atan2(dy, dx);
      if (dist > 6) {
        guard.x += (dx / dist) * GUARD.chaseSpeed * dt;
        guard.y += (dy / dist) * GUARD.chaseSpeed * dt;
        collide(guard);
      }
      guard.loseTimer -= dt;
      if (guard.loseTimer <= 0) {
        guard.mode = GUARD_PATROL;
        guard.lastSeen = null;
      }
      return;
    }
    if (guard.mode === GUARD_SUSPICIOUS) {
      const target = guard.lastSeen;
      const dx = target.x - guard.x;
      const dy = target.y - guard.y;
      const dist = Math.hypot(dx, dy);
      guard.facing = Math.atan2(dy, dx);
      if (dist > 8) {
        guard.x += (dx / dist) * GUARD.patrolSpeed * dt;
        guard.y += (dy / dist) * GUARD.patrolSpeed * dt;
        collide(guard);
      } else {
        guard.lookTimer += dt;
        guard.facing += dt * 1.6;
        if (guard.lookTimer > 2.2) {
          guard.mode = GUARD_PATROL;
          guard.lastSeen = null;
        }
      }
      return;
    }
    // Patrol: walk the loop, pausing at each waypoint to look around.
    if (guard.pause > 0) {
      guard.pause -= dt;
      guard.facing += dt * 0.9;
      return;
    }
    const target = guard.route[guard.waypoint];
    const dx = target[0] - guard.x;
    const dy = target[1] - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 6) {
      guard.waypoint = (guard.waypoint + 1) % guard.route.length;
      guard.pause = GUARD.pauseAtWaypoint;
      return;
    }
    guard.facing = Math.atan2(dy, dx);
    guard.x += (dx / dist) * GUARD.patrolSpeed * dt;
    guard.y += (dy / dist) * GUARD.patrolSpeed * dt;
    collide(guard);
  }

  /**
   * One fixed step. `steer` is a normalised {x, y}; `sprint` doubles speed but is loud.
   * `tool` is 'smoke' | 'emp' | null, `lurePoint` a floor point or null. Returns event flags.
   */
  function step(dt, steer, sprint, tool, lurePoint) {
    let events = 0;
    if (state.won || state.lost) return events;
    state.elapsed += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.lost = true;
      state.loseReason = 'Dawn broke — the museum opened with you still inside.';
      return EVENT_TIMEUP;
    }
    if (tool === 'smoke') dropSmoke();
    else if (tool === 'emp') fireEmp();
    if (lurePoint) throwLure(lurePoint);

    for (let i = smokes.length - 1; i >= 0; i -= 1) {
      smokes[i].left -= dt;
      if (smokes[i].left <= 0) smokes.splice(i, 1);
    }

    const speed = sprint ? THIEF.sprint : THIEF.walk;
    thief.moving = steer.x !== 0 || steer.y !== 0;
    thief.sprinting = sprint && thief.moving;
    if (thief.moving) {
      thief.x += steer.x * speed * dt;
      thief.y += steer.y * speed * dt;
      thief.facing = Math.atan2(steer.y, steer.x);
      collide(thief);
    }
    thief.inSmoke = thiefInSmoke();

    // Sprinting is loud: a nearby patrolling guard turns to investigate the noise.
    if (thief.sprinting) {
      for (const guard of guards) {
        if (guard.mode === GUARD_PATROL && Math.hypot(guard.x - thief.x, guard.y - thief.y) < GUARD.hearRadius) {
          guard.mode = GUARD_SUSPICIOUS;
          guard.lastSeen = { x: thief.x, y: thief.y };
          guard.lookTimer = 0;
        }
      }
    }

    for (const camera of cameras) {
      if (camera.disabled > 0) camera.disabled -= dt;
      else camera.angle = camera.base + Math.sin(state.elapsed * (Math.PI * 2 / camera.period) + camera.phase) * camera.sweep;
    }

    // Vision: guards and cameras fill the alarm while the thief is exposed.
    let seen = false;
    let seenByGuard = false;
    if (!thief.inSmoke) {
      for (const guard of guards) {
        const exposure = pointInCone(thief.x, thief.y, guard.x, guard.y, guard.facing, GUARD.range, GUARD.halfAngle);
        if (exposure > 0) {
          seen = true;
          seenByGuard = true;
          state.alarm += GUARD.spotRate * (0.5 + exposure) * dt;
          guard.mode = GUARD_ALERT;
          guard.lastSeen = { x: thief.x, y: thief.y };
          guard.loseTimer = 2.5;
        }
      }
      for (const camera of cameras) {
        if (camera.disabled > 0) continue;
        const exposure = pointInCone(thief.x, thief.y, camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle);
        if (exposure > 0) {
          seen = true;
          state.alarm += CAMERA.spotRate * (0.5 + exposure) * dt;
        }
      }
    }
    if (!seen) state.alarm = Math.max(0, state.alarm - ALARM.decay * dt);
    if (seen && !state.seen) events |= EVENT_SPOTTED;
    state.seen = seen;

    for (const guard of guards) stepGuard(guard, dt);

    // A guard that touches the thief ends the night on the spot.
    for (const guard of guards) {
      if (Math.hypot(guard.x - thief.x, guard.y - thief.y) < guard.radius + thief.radius - 2) {
        state.lost = true;
        state.loseReason = 'A guard grabbed you in the Grand Hall.';
        return EVENT_CAUGHT;
      }
    }
    if (state.alarm >= ALARM.max) {
      state.alarm = ALARM.max;
      state.lost = true;
      state.loseReason = 'The alarm hit 100% — the vault sealed and security swarmed in.';
      return EVENT_CAUGHT;
    }

    // Loot: walk over it to pocket it.
    for (const item of loot) {
      if (item.taken) continue;
      if (Math.hypot(item.x - thief.x, item.y - thief.y) < thief.radius + 16) {
        item.taken = true;
        state.lootTaken += 1;
        state.score += item.value;
        if (item.kind === 'diamond') state.diamondTaken = true;
        events |= EVENT_LOOT;
      }
    }

    // Win: diamond in hand, reach the green EXIT.
    if (state.diamondTaken && thief.x > EXIT.x && thief.x < EXIT.x + EXIT.w && thief.y > EXIT.y && thief.y < EXIT.y + EXIT.h) {
      state.won = true;
      state.score += Math.round(state.timeLeft) * 2;
      return EVENT_WIN;
    }
    return events;
  }

  reset();
  return {
    state, thief, guards, cameras, loot, smokes,
    reset, nextNight, step, exposureAt, blockedAt, throwLure, dropSmoke, fireEmp,
  };
}
