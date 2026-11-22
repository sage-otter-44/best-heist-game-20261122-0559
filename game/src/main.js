// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between five screens: title, play, paused, caught and getaway.
// A click on the floor throws a coin lure there; the same click also starts the game
// from a panel, so a lure is never wasted on a panel.
//
// ?seed=N fixes the night's patrols and loot sparkle. ?shot=start|play|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot. ?selftest=1 runs the shot autopilot headlessly
// through night 1 and writes the result into #selftest-result.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CAUGHT, EVENT_LOOT, EVENT_TIMEUP, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_EMP, ACTION_LURE_KEY, ACTION_PAUSE, ACTION_SMOKE, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { autopilot, stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const selftest = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // One-shot tool presses read this frame, consumed by the next step.
  let pendingTool = null;
  let pendingLureKey = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    pendingTool = null;
    screen = SCREEN_PLAY;
    announce('Playing. Grab the Grand Diamond, then reach the green EXIT.');
  }

  function endNight(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won
      ? `Getaway! Score ${world.state.score}. Best ${best}.`
      : `${world.state.loseReason} Score ${world.state.score}.`);
  }

  /** Read this frame's one-shot presses and clicks; panels consume them, play keeps them. */
  function handleActions() {
    const actions = input.takeActions();
    const lurePoint = input.takeLurePoint();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) {
        if (world.nextNight()) {
          screen = SCREEN_PLAY;
          announce(`Night ${world.state.night}. Harder patrols, more loot.`);
        } else {
          startGame();
        }
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return;
    }
    if (actions & ACTION_SMOKE) pendingTool = 'smoke';
    else if (actions & ACTION_EMP) pendingTool = 'emp';
    if (actions & ACTION_LURE_KEY) pendingLureKey = true;
    if (lurePoint) world.throwLure(renderer.toField(lurePoint));
  }

  function step() {
    if (screen === SCREEN_TITLE) return;
    const lure = pendingLureKey
      ? { x: world.thief.x + Math.cos(world.thief.facing) * 130, y: world.thief.y + Math.sin(world.thief.facing) * 130 }
      : null;
    const tool = pendingTool;
    pendingTool = null;
    pendingLureKey = false;
    const events = world.step(STEP, input.steer(), input.sprinting(), tool, lure);
    if (events & EVENT_WIN) endNight(true);
    else if (events & (EVENT_CAUGHT | EVENT_TIMEUP)) endNight(false);
    else if (events & EVENT_LOOT) announce(`Loot ${world.state.lootTaken}/${world.state.lootTotal}. Score $${world.state.score}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for play-testing from the console or a driver script.
  window.__game = { world, get screen() { return screen; } };

  announce('Midnight Vault. Press Space or click to start the heist.');
  requestAnimationFrame(frame);
}

function runSelftest() {
  // Headless: drive night 1 with the same autopilot the shots use, then report.
  const result = document.getElementById('selftest-result');
  world.reset();
  let events = 0;
  let steps = 0;
  for (steps = 0; steps < 60 * 300; steps += 1) {
    const { steer, sprint, tool } = autopilot(world);
    events = world.step(STEP, steer, sprint, tool, null);
    if (events & (EVENT_WIN | EVENT_CAUGHT | EVENT_TIMEUP)) break;
  }
  const state = world.state;
  result.textContent = JSON.stringify({
    seed, steps, events,
    won: state.won, lost: state.lost, loseReason: state.loseReason,
    lootTaken: state.lootTaken, lootTotal: state.lootTotal,
    diamondTaken: state.diamondTaken, score: state.score,
    alarm: Math.round(state.alarm), timeLeft: Math.round(state.timeLeft),
  });
  window.__shotReady = true;
}

if (shot) runShot(shot);
else if (selftest) runSelftest();
else runGame();
