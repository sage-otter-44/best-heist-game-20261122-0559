// Drawing only: the world's state and the current screen in, pixels out. The 1280x800
// playfield is scaled to fit the window and centred. Everything the brief asks for is
// drawn in one frame: the thief, the guards with their vision cones, the cameras, the
// loot, the alarm meter and the HUD — plus the room names, the tools and the exit, so a
// single screenshot reads as a complete heist in progress.

import {
  CAMERA, COVERS, EXIT, FIELD, GUARD, HUD, NIGHTS, PALETTE, WALLS,
} from './config.js';
import { GUARD_ALERT, GUARD_SUSPICIOUS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const ROOMS = [
  { name: 'GALLERY', x: 224, y: 96, color: PALETTE.floorGallery },
  { name: 'GRAND HALL', x: 640, y: 96, color: PALETTE.floorHall },
  { name: 'THE VAULT', x: 1048, y: 96, color: PALETTE.floorVault },
];

function lootColor(kind) {
  if (kind === 'diamond') return PALETTE.lootDiamond;
  if (kind === 'gem') return PALETTE.lootGem;
  if (kind === 'painting') return PALETTE.lootPainting;
  if (kind === 'cash') return PALETTE.lootCash;
  return PALETTE.lootGold;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${'system-ui, -apple-system, "Segoe UI", sans-serif'}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.fillText(value, x, y);
  }

  function cone(ox, oy, angle, range, halfAngle, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.moveTo(ox, oy);
    context.arc(ox, oy, range, angle - halfAngle, angle + halfAngle);
    context.closePath();
    context.fill();
    context.strokeStyle = fill.replace(/[\d.]+\)$/, '0.55)');
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawFloor() {
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const room of ROOMS) {
      context.fillStyle = room.color;
      if (room.name === 'GALLERY') context.fillRect(16, 76, 416, 708);
      else if (room.name === 'GRAND HALL') context.fillRect(448, 76, 384, 708);
      else context.fillRect(848, 76, 416, 708);
    }
    // Floor tiles.
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 16; x < FIELD.width; x += 64) {
      context.beginPath(); context.moveTo(x, 76); context.lineTo(x, 784); context.stroke();
    }
    for (let y = 76; y < FIELD.height; y += 64) {
      context.beginPath(); context.moveTo(16, y); context.lineTo(1264, y); context.stroke();
    }
    // Room names, painted on the floor.
    context.textBaseline = 'alphabetic';
    for (const room of ROOMS) text(room.name, room.x, room.y + 26, 22, 'rgba(238,241,245,0.28)', 'center', true);
  }

  function drawWalls() {
    for (const wall of WALLS) {
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y + 4, wall.w, wall.h - 4);
    }
  }

  function drawCovers() {
    for (const cover of COVERS) {
      let fill = PALETTE.coverCrate;
      if (cover.kind === 'case') fill = PALETTE.coverCase;
      else if (cover.kind === 'sofa') fill = PALETTE.coverSofa;
      else if (cover.kind === 'statue') fill = PALETTE.coverStatue;
      else if (cover.kind === 'plant') fill = PALETTE.coverPlant;
      else if (cover.kind === 'safe') fill = PALETTE.coverSafe;
      context.fillStyle = fill;
      context.fillRect(cover.x, cover.y, cover.w, cover.h);
      context.strokeStyle = 'rgba(238,241,245,0.25)';
      context.lineWidth = 1.5;
      context.strokeRect(cover.x + 1, cover.y + 1, cover.w - 2, cover.h - 2);
      if (cover.kind === 'case') {
        context.fillStyle = 'rgba(174,243,255,0.35)';
        context.fillRect(cover.x + 8, cover.y + 8, cover.w - 16, cover.h - 16);
      }
      if (cover.kind === 'plant') {
        context.fillStyle = '#4a8a55';
        context.beginPath();
        context.arc(cover.x + cover.w / 2, cover.y + cover.h / 2, 12, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  function drawExit(world) {
    const taken = world.state.diamondTaken;
    context.fillStyle = taken ? PALETTE.exit : 'rgba(47,191,113,0.35)';
    context.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    context.strokeStyle = PALETTE.exit;
    context.lineWidth = 3;
    context.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
    text('EXIT', EXIT.x + EXIT.w / 2, EXIT.y + 34, 26, '#eef1f5', 'center', true);
    text(taken ? 'GETAWAY →' : 'NEED DIAMOND', EXIT.x + EXIT.w / 2, EXIT.y + 60, 13, '#eef1f5', 'center', true);
  }

  function drawLoot(world) {
    const t = world.state.elapsed;
    for (const item of world.loot) {
      if (item.taken) continue;
      const bob = Math.sin(t * 3 + item.bob) * 3;
      const color = lootColor(item.kind);
      const size = item.kind === 'diamond' ? 15 : 10;
      context.fillStyle = color;
      context.save();
      context.translate(item.x, item.y + bob);
      context.rotate(Math.PI / 4);
      context.fillRect(-size / 2, -size / 2, size, size);
      context.restore();
      context.strokeStyle = 'rgba(238,241,245,0.8)';
      context.lineWidth = 1.5;
      context.strokeRect(item.x - size / 2 - 4, item.y + bob - size / 2 - 4, size + 8, size + 8);
      if (item.kind === 'diamond') {
        context.fillStyle = 'rgba(174,243,255,0.18)';
        context.beginPath();
        context.arc(item.x, item.y + bob, 34, 0, Math.PI * 2);
        context.fill();
        // Below the gem: the wall stub above it would strike through a label here.
        text('GRAND DIAMOND', item.x, item.y + 48 + bob, 13, PALETTE.lootDiamond, 'center', true);
      }
    }
  }

  function drawCones(world) {
    for (const camera of world.cameras) {
      const fill = camera.disabled > 0 ? PALETTE.cameraOff : PALETTE.cameraCone;
      cone(camera.x, camera.y, camera.angle, CAMERA.range, CAMERA.halfAngle, fill);
    }
    for (const guard of world.guards) {
      const fill = guard.mode === GUARD_ALERT ? PALETTE.guardConeAlert : PALETTE.guardCone;
      cone(guard.x, guard.y, guard.facing, GUARD.range, GUARD.halfAngle, fill);
    }
  }

  function drawSmoke(world) {
    for (const smoke of world.smokes) {
      context.fillStyle = PALETTE.smoke;
      context.beginPath();
      context.arc(smoke.x, smoke.y, smoke.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(200,205,220,0.25)';
      context.beginPath();
      context.arc(smoke.x - 20, smoke.y + 10, smoke.radius * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCameras(world) {
    for (const camera of world.cameras) {
      context.fillStyle = camera.disabled > 0 ? '#5a6274' : '#e5534b';
      context.beginPath();
      context.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#eef1f5';
      context.beginPath();
      context.arc(camera.x, camera.y, 3.5, 0, Math.PI * 2);
      context.fill();
      if (camera.disabled > 0) text('OFF', camera.x, camera.y - 14, 11, '#8b93a3', 'center', true);
      else text('CAM', camera.x, camera.y - 14, 11, '#e5534b', 'center', true);
    }
  }

  function drawGuards(world) {
    for (const guard of world.guards) {
      context.fillStyle = guard.mode === GUARD_ALERT ? '#ff6b61' : PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#eef1f5';
      context.lineWidth = 2;
      context.stroke();
      // Facing tick.
      context.strokeStyle = '#eef1f5';
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * (guard.radius + 7), guard.y + Math.sin(guard.facing) * (guard.radius + 7));
      context.stroke();
      // Cap brim.
      context.fillStyle = '#7a1f1a';
      context.beginPath();
      context.arc(guard.x, guard.y - 3, 6, Math.PI, 0);
      context.fill();
      if (guard.mode === GUARD_ALERT) text('!', guard.x, guard.y - guard.radius - 8, 22, '#ff6b61', 'center', true);
      else if (guard.mode === GUARD_SUSPICIOUS) text('?', guard.x, guard.y - guard.radius - 8, 20, PALETTE.lootGold, 'center', true);
    }
  }

  function drawThief(world) {
    const thief = world.thief;
    const state = world.state;
    // Danger ring when a cone is on the thief.
    if (state.seen) {
      context.strokeStyle = '#ff6b61';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(thief.x, thief.y, thief.radius + 8, 0, Math.PI * 2);
      context.stroke();
      text('SPOTTED!', thief.x, thief.y - thief.radius - 12, 16, '#ff6b61', 'center', true);
    }
    context.fillStyle = PALETTE.thiefCoat;
    context.beginPath();
    context.arc(thief.x, thief.y, thief.radius, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = PALETTE.thief;
    context.lineWidth = 2.5;
    context.stroke();
    // Hood point in the facing direction.
    context.fillStyle = PALETTE.thief;
    context.beginPath();
    context.moveTo(thief.x + Math.cos(thief.facing) * (thief.radius + 6), thief.y + Math.sin(thief.facing) * (thief.radius + 6));
    context.lineTo(thief.x + Math.cos(thief.facing + 2.5) * thief.radius * 0.7, thief.y + Math.sin(thief.facing + 2.5) * thief.radius * 0.7);
    context.lineTo(thief.x + Math.cos(thief.facing - 2.5) * thief.radius * 0.7, thief.y + Math.sin(thief.facing - 2.5) * thief.radius * 0.7);
    context.closePath();
    context.fill();
    // Mask eyes.
    context.fillStyle = PALETTE.thiefCoat;
    context.beginPath();
    context.arc(thief.x + Math.cos(thief.facing) * 4, thief.y + Math.sin(thief.facing) * 4, 4.5, 0, Math.PI * 2);
    context.fill();
    text('THIEF', thief.x, thief.y + thief.radius + 16, 11, '#eef1f5', 'center', true);
  }

  function drawHud(world, best) {
    const state = world.state;
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, HUD.height);
    context.fillStyle = PALETTE.hudLine;
    context.fillRect(0, HUD.height, FIELD.width, 2);
    context.textBaseline = 'alphabetic';

    text('MIDNIGHT VAULT', 18, 26, 22, PALETTE.text, 'left', true);
    text(`${NIGHTS[state.night - 1].name}  ·  3 ROOMS · ${world.guards.length} GUARDS · ${state.lootTotal} LOOT · 3 TOOLS`, 18, 48, 13, PALETTE.muted, 'left');

    // Alarm meter.
    const meterX = 470;
    const meterW = 220;
    text('ALARM', meterX, 26, 14, state.alarm > 66 ? PALETTE.alarmHigh : state.alarm > 33 ? PALETTE.alarmMid : PALETTE.muted, 'left', true);
    context.fillStyle = '#0b0d12';
    context.fillRect(meterX, 32, meterW, 16);
    const alarmColor = state.alarm > 66 ? PALETTE.alarmHigh : state.alarm > 33 ? PALETTE.alarmMid : PALETTE.alarmLow;
    context.fillStyle = alarmColor;
    context.fillRect(meterX, 32, meterW * (state.alarm / 100), 16);
    context.strokeStyle = '#2a3040';
    context.lineWidth = 1.5;
    context.strokeRect(meterX, 32, meterW, 16);
    text(`${Math.round(state.alarm)}%`, meterX + meterW + 10, 46, 15, alarmColor, 'left', true);

    // Loot and score.
    text(`LOOT ${state.lootTaken}/${state.lootTotal}`, 740, 26, 16, PALETTE.lootGold, 'left', true);
    text(`SCORE $${state.score}`, 740, 48, 13, PALETTE.muted, 'left');
    text(state.diamondTaken ? '◆ DIAMOND ✓' : '◇ DIAMOND', 900, 26, 13, state.diamondTaken ? PALETTE.lootDiamond : PALETTE.muted, 'left', true);

    // Timer.
    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = Math.floor(state.timeLeft % 60);
    const timeText = `DAWN ${minutes}:${String(seconds).padStart(2, '0')}`;
    text(timeText, 900, 48, 14, state.timeLeft < 60 ? PALETTE.alarmHigh : PALETTE.text, 'left', true);

    // Tools (short, so the HUD never runs off the right edge; keys are in the footer).
    text(`SMOKE ×${state.tools.smoke}   EMP ×${state.tools.emp}   LURE ×${state.tools.lure}`, 1050, 26, 13, PALETTE.text, 'left');
    text(`BEST $${best}`, 1050, 48, 13, PALETTE.muted, 'left');
  }

  function drawFooter() {
    context.fillStyle = 'rgba(11,13,18,0.85)';
    context.fillRect(0, FIELD.height - 26, FIELD.width, 26);
    text('WASD / ARROWS move · SHIFT sprint (loud) · CLICK throw a coin lure · Q smoke · E EMP vs cameras · P pause · Grab the GRAND DIAMOND, then reach EXIT', FIELD.width / 2, FIELD.height - 8, 13, PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 120 + lines.length * 32 + 56;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11,13,18,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, width, height);
    context.strokeStyle = accent || PALETTE.gold;
    context.lineWidth = 3;
    context.strokeRect(x, y, width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 62, 44, PALETTE.text, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 112 + i * 32, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: floor, cones, loot, covers, actors, HUD, then a panel for the screen. */
  function draw(world, screen, best) {
    const state = world.state;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawFloor();
    drawCones(world);
    drawLoot(world);
    drawExit(world);
    drawWalls();
    drawCovers();
    drawSmoke(world);
    drawCameras(world);
    drawGuards(world);
    drawThief(world);
    drawHud(world, best);
    drawFooter();
    if (screen === SCREEN_TITLE) {
      drawPanel('MIDNIGHT VAULT', [
        '3 rooms · 6 guards · 4 cameras · 12 loot · 3 tools',
        'Sneak past the vision cones, pocket the GRAND DIAMOND,',
        'and reach the green EXIT before dawn — or before the alarm hits 100%.',
      ], 'Press Space or click to start the heist', PALETTE.gold);
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards are holding their patrol.'], 'Press P to keep sneaking', PALETTE.muted);
    } else if (screen === SCREEN_OVER) {
      drawPanel(state.loseReason.includes('Dawn') ? 'DAWN BROKE' : 'CAUGHT!', [
        state.loseReason,
        `Night ${state.night} · Loot ${state.lootTaken}/${state.lootTotal} · Score $${state.score}`,
        `Best $${best}`,
      ], 'Press Space or click to try again', PALETTE.alarmHigh);
    } else if (screen === SCREEN_WIN) {
      const lastNight = state.night >= NIGHTS.length;
      drawPanel(lastNight ? 'CLEAN GETAWAY!' : `NIGHT ${state.night} CLEARED!`, [
        lastNight ? 'All three nights. Every vault. No alarms that mattered.' : `${NIGHTS[state.night - 1].name.split('·')[1].trim()} is yours.`,
        `Loot ${state.lootTaken}/${state.lootTotal} · Score $${state.score} · Best $${best}`,
        lastNight ? 'The crew retires rich.' : 'The next museum is already cased.',
      ], lastNight ? 'Press Space or click to play again' : 'Press Space or click for the next night', PALETTE.exit);
    }
  }

  /** Convert a point in canvas pixels to playfield coordinates. */
  function toField(point) {
    return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField };
}
