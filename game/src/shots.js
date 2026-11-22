// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh night with a simple autopilot (steer at the nearest loot, but
// never step into a lit vision cone; wait out a sweeping cone rather than walk through
// it), so every frame is what a real game looks like and the same seed always gives the
// same frame. No scene is a title screen: the cover is a heist already in progress.
//
// start: night 2, a few seconds in — the thief is inside the Gallery, cones sweeping,
//   loot on the floor, alarm still low.
// play: night 2, deep in — the thief is at the Vault door with the diamond in sight,
//   a guard cone close by and the alarm half full.
// end: night 2 won — the diamond is pocketed and the thief is at the EXIT, getaway panel up.

import { COVERS, EXIT, STEP, WALLS } from './config.js';
import { EVENT_CAUGHT, EVENT_TIMEUP, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_WIN } from './render.js';

const START_SECONDS = 9;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;

/** The eight compass steers plus standing still. */
const STEERS = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 0.7071, y: 0.7071 }, { x: -0.7071, y: 0.7071 }, { x: 0.7071, y: -0.7071 }, { x: -0.7071, y: -0.7071 },
];

/** Coarse grid for pathfinding: a cell is blocked when a wall or cover is near its centre. */
const CELL = 40;
const COLS = 32;
const ROWS = 20;
const SOLIDS = [...WALLS, ...COVERS];

function cellBlocked(cx, cy) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  for (const r of SOLIDS) {
    if (x > r.x - 15 && x < r.x + r.w + 15 && y > r.y - 15 && y < r.y + r.h + 15) return true;
  }
  return false;
}

function cellOf(x, y) {
  return {
    cx: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    cy: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

/** Breadth-first route from (fx, fy) to (tx, ty) as a list of floor points. */
function findPath(fx, fy, tx, ty) {
  const from = cellOf(fx, fy);
  const to = cellOf(tx, ty);
  const key = (cx, cy) => cy * COLS + cx;
  const parent = new Map();
  const queue = [from];
  parent.set(key(from.cx, from.cy), null);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const cell = queue.shift();
    if (cell.cx === to.cx && cell.cy === to.cy) {
      const points = [];
      let cur = cell;
      while (cur) {
        points.push({ x: cur.cx * CELL + CELL / 2, y: cur.cy * CELL + CELL / 2 });
        cur = parent.get(key(cur.cx, cur.cy));
      }
      points.reverse();
      // The first point is the cell the thief already stands in: drop it, and drop
      // any point a body cannot stand on, so the pilot never chases an unreachable node.
      return points.slice(1).filter((p) => {
        for (const r of SOLIDS) {
          const nearX = Math.max(r.x, Math.min(p.x, r.x + r.w));
          const nearY = Math.max(r.y, Math.min(p.y, r.y + r.h));
          if (Math.hypot(p.x - nearX, p.y - nearY) < 13) return false;
        }
        return true;
      });
    }
    for (const [dx, dy] of DIRS) {
      const nx = cell.cx + dx;
      const ny = cell.cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (parent.has(key(nx, ny)) || cellBlocked(nx, ny)) continue;
      parent.set(key(nx, ny), cell);
      queue.push({ cx: nx, cy: ny });
    }
  }
  return [{ x: tx, y: ty }];
}

/**
 * Pick a steer: follow the path to the goal (nearest loot, then the diamond, then
 * the EXIT), but a step that lands inside a lit cone costs far more than the ground
 * it gains, and a step toward a close guard costs too. Standing still is free when
 * every way is lit — the cones sweep on, so the wait always ends.
 *
 * When a guard is on alert and closing in, forget the goal and run: drop smoke if
 * there is any left, then sprint straight away from the guard until it loses the
 * trail. A step into a wall counts against a steer, so a flee never runs into a
 * pocket. And a thief that has waited more than four seconds for a cone to clear
 * takes a calculated risk and crosses the cone's edge — a brief glimpse costs
 * alarm the decay can repay, and waiting forever costs the night.
 */
export function autopilot(world) {
  const thief = world.thief;
  const state = world.state;

  // Flee: an alert guard within 260 px is an active chase.
  let chaser = null;
  let chaserDist = Infinity;
  for (const guard of world.guards) {
    if (guard.mode !== 'alert') continue;
    const d = Math.hypot(guard.x - thief.x, guard.y - thief.y);
    if (d < chaserDist) { chaserDist = d; chaser = guard; }
  }
  if (chaser && chaserDist < 260) {
    let bestSteer = STEERS[0];
    let bestScore = -Infinity;
    for (const steer of STEERS) {
      const nx = thief.x + steer.x * 285 * SAMPLE * 6;
      const ny = thief.y + steer.y * 285 * SAMPLE * 6;
      const exposure = world.exposureAt(nx, ny);
      const blocked = world.blockedAt(nx, ny, thief.radius) ? 1 : 0;
      const away = Math.hypot(nx - chaser.x, ny - chaser.y);
      const score = away * 2 - exposure * 900 - blocked * 1000 + (steer.x === 0 && steer.y === 0 ? -6 : 0);
      if (score > bestScore) { bestScore = score; bestSteer = steer; }
    }
    const tool = chaserDist < 150 && state.tools.smoke > 0 && !thief.inSmoke ? 'smoke' : null;
    return { steer: bestSteer, sprint: true, tool };
  }

  // The win needs the diamond, so the diamond comes first: loot on the way is
  // pocketed as the thief passes it. Once it is in hand, the exit is the goal —
  // a human can linger for the rest of the loot, the pilot plays it safe.
  let goal = null;
  if (!state.diamondTaken) {
    goal = world.loot.find((item) => item.kind === 'diamond');
  } else {
    goal = { x: EXIT.x + EXIT.w / 2, y: EXIT.y + EXIT.h / 2 };
  }
  if (!goal) return { steer: { x: 0, y: 0 }, sprint: false, tool: null };

  // Re-path when the goal moved, the old path ran out, the thief fled away from it,
  // or it is older than two seconds: a stale path can strand the thief behind cover
  // its first node no longer reaches.
  const goalKey = `${goal.x},${goal.y}`;
  const currentNode = world.__path && world.__pathIndex < world.__path.length
    ? world.__path[world.__pathIndex]
    : null;
  const stale = !world.__path || world.__pathIndex >= world.__path.length
    || (currentNode && Math.hypot(currentNode.x - thief.x, currentNode.y - thief.y) > 90)
    || (world.__pathAge || 0) > 120;
  if (world.__pathGoal !== goalKey || stale) {
    world.__path = findPath(thief.x, thief.y, goal.x, goal.y);
    world.__pathIndex = 0;
    world.__pathGoal = goalKey;
    world.__pathAge = 0;
  }
  world.__pathAge = (world.__pathAge || 0) + 1;
  const path = world.__path;
  while (world.__pathIndex < path.length) {
    const node = path[world.__pathIndex];
    if (Math.hypot(node.x - thief.x, node.y - thief.y) < 16) world.__pathIndex += 1;
    else break;
  }
  const target = world.__pathIndex < path.length ? path[world.__pathIndex] : goal;

  let bestSteer = STEERS[0];
  let bestScore = -Infinity;
  // Crossing a cone briefly costs a little alarm and the decay repays it; standing
  // in one is what ends a night. So the exposure weight is small enough to cross,
  // and once the thief is already lit, it commits through — retreating only keeps
  // it in the cone longer. Inside smoke it cannot be seen, so cones stop mattering
  // and it sprints.
  const currentExposure = thief.inSmoke ? 0 : world.exposureAt(thief.x, thief.y);
  const exposureWeight = thief.inSmoke || currentExposure > 0.15 ? 0 : (world.__waitTime || 0) > 4 ? 100 : 250;
  for (const steer of STEERS) {
    const nx = thief.x + steer.x * 178 * SAMPLE * 6;
    const ny = thief.y + steer.y * 178 * SAMPLE * 6;
    const exposure = thief.inSmoke ? 0 : world.exposureAt(nx, ny);
    const blocked = world.blockedAt(nx, ny, thief.radius) ? 1 : 0;
    const dist = Math.hypot(target.x - nx, target.y - ny);
    let guardNear = 0;
    for (const guard of world.guards) {
      const d = Math.hypot(guard.x - nx, guard.y - ny);
      if (d < 100) guardNear += (100 - d) / 100;
    }
    const score = -dist - exposure * exposureWeight - guardNear * 300 - blocked * 1000 + (steer.x === 0 && steer.y === 0 ? -6 : 0);
    if (score > bestScore) { bestScore = score; bestSteer = steer; }
  }

  // After three seconds of waiting at a lit crossing, pop smoke and push through
  // while hidden. Waiting accumulates across re-paths, so a stall always fires this.
  let tool = null;
  if (bestSteer.x === 0 && bestSteer.y === 0) {
    world.__waitTime = (world.__waitTime || 0) + STEP;
    if ((world.__waitTime || 0) > 3 && state.tools.smoke > 0 && !thief.inSmoke) {
      tool = 'smoke';
      world.__waitTime = 0;
    }
  } else {
    world.__waitTime = 0;
  }
  return { steer: bestSteer, sprint: thief.inSmoke, tool };
}

function playForward(world, seconds) {
  let events = 0;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const { steer, sprint, tool } = autopilot(world);
    events = world.step(STEP, steer, sprint, tool, null);
    if (events & (EVENT_WIN | EVENT_CAUGHT | EVENT_TIMEUP)) break;
  }
  return events;
}

function forceWin(world) {
  const state = world.state;
  for (const item of world.loot) {
    if (!item.taken) {
      item.taken = true;
      state.lootTaken += 1;
      state.score += item.value;
      if (item.kind === 'diamond') state.diamondTaken = true;
    }
  }
  world.thief.x = EXIT.x + EXIT.w / 2;
  world.thief.y = EXIT.y + EXIT.h / 2;
  state.won = true;
}

/** Set `world` to the named scene and return the screen to draw over it. */
export function stageShot(name, world) {
  // Shots always stage night 2: the full crew, the full loot, the full alarm story.
  world.reset();
  world.nextNight();
  if (name === 'play') {
    playForward(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    const events = playForward(world, END_LIMIT_SECONDS);
    if (!(events & EVENT_WIN)) forceWin(world);
    return { screen: SCREEN_WIN, best: world.state.score };
  }
  playForward(world, START_SECONDS);
  return { screen: SCREEN_PLAY, best: 0 };
}
