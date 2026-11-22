// MIDNIGHT VAULT — tuning, palette and the museum floor plan.
// The playfield is a fixed 1280x800 logical area; the top 60 px are the HUD bar and the
// rest is one museum floor: GALLERY (left), GRAND HALL (middle) and VAULT (right), joined
// by two doorways. Walls and cover both block movement and line of sight.

export const FIELD = { width: 1280, height: 800 };
export const HUD = { height: 60 };
export const STEP = 1 / 60;

export const THIEF = { radius: 13, walk: 178, sprint: 285 };
export const GUARD = {
  radius: 13,
  patrolSpeed: 72,
  chaseSpeed: 118,
  range: 215,
  halfAngle: 0.62,
  spotRate: 24,
  hearRadius: 150,
  pauseAtWaypoint: 0.9,
};
export const CAMERA = { range: 245, halfAngle: 0.5, spotRate: 20 };
export const ALARM = { decay: 8, max: 100 };
export const TOOLS = {
  smoke: 3, emp: 2, lure: 5,
  smokeSeconds: 4, smokeRadius: 78,
  empSeconds: 6, empRadius: 280,
};

/** Three nights, escalating: more guards, more cameras, more loot, less time. */
export const NIGHTS = [
  { name: 'NIGHT 1 · THE GALLERY', guards: 4, cameras: 3, loot: 8, seconds: 300 },
  { name: 'NIGHT 2 · THE GRAND HALL', guards: 6, cameras: 4, loot: 12, seconds: 270 },
  { name: 'NIGHT 3 · THE CASINO VAULT', guards: 8, cameras: 5, loot: 16, seconds: 240 },
];

/** Walls: {x, y, w, h}. The two dividers leave one doorway each. */
export const WALLS = [
  { x: 0, y: 60, w: 1280, h: 16 },
  { x: 0, y: 784, w: 1280, h: 16 },
  { x: 0, y: 60, w: 16, h: 740 },
  { x: 1264, y: 60, w: 16, h: 740 },
  { x: 432, y: 60, w: 16, h: 240 },
  { x: 432, y: 380, w: 16, h: 404 },
  { x: 832, y: 60, w: 16, h: 360 },
  { x: 832, y: 500, w: 16, h: 284 },
  { x: 16, y: 420, w: 280, h: 16 },
  { x: 1000, y: 180, w: 180, h: 16 },
];

/** Cover: display cases, crates, sofas, statues. Blocks movement and sight, like a wall.
 *  Every piece sits clear of the guard patrol lines (routes in GUARD_ROUTES). */
export const COVERS = [
  { x: 120, y: 140, w: 90, h: 50, kind: 'case' },
  { x: 250, y: 150, w: 80, h: 40, kind: 'case' },
  { x: 120, y: 560, w: 140, h: 60, kind: 'sofa' },
  { x: 200, y: 640, w: 40, h: 40, kind: 'plant' },
  { x: 290, y: 540, w: 50, h: 50, kind: 'crate' },
  { x: 520, y: 180, w: 120, h: 50, kind: 'table' },
  { x: 620, y: 540, w: 50, h: 50, kind: 'statue' },
  { x: 500, y: 610, w: 60, h: 60, kind: 'crate' },
  { x: 690, y: 620, w: 80, h: 50, kind: 'crate' },
  { x: 560, y: 740, w: 40, h: 40, kind: 'plant' },
  { x: 900, y: 140, w: 80, h: 50, kind: 'case' },
  { x: 900, y: 640, w: 80, h: 50, kind: 'case' },
  { x: 1080, y: 640, w: 90, h: 60, kind: 'safe' },
  { x: 1000, y: 600, w: 40, h: 40, kind: 'plant' },
];

/** Loot spots. The diamond is always included; a night takes it plus the next N-1. */
export const LOOT_SPOTS = [
  { kind: 'diamond', x: 1150, y: 230, value: 500, label: 'GRAND DIAMOND' },
  { kind: 'gold', x: 200, y: 110, value: 100, label: 'GOLD BAR' },
  { kind: 'painting', x: 380, y: 200, value: 150, label: 'PAINTING' },
  { kind: 'cash', x: 150, y: 480, value: 50, label: 'CASH' },
  { kind: 'gem', x: 330, y: 700, value: 200, label: 'RUBY' },
  { kind: 'gold', x: 560, y: 120, value: 100, label: 'GOLD BAR' },
  { kind: 'painting', x: 780, y: 220, value: 150, label: 'PAINTING' },
  { kind: 'gem', x: 500, y: 700, value: 200, label: 'SAPPHIRE' },
  { kind: 'cash', x: 760, y: 560, value: 50, label: 'CASH' },
  { kind: 'gold', x: 900, y: 110, value: 100, label: 'GOLD BAR' },
  { kind: 'painting', x: 1000, y: 300, value: 150, label: 'PAINTING' },
  { kind: 'gem', x: 900, y: 560, value: 200, label: 'EMERALD' },
  { kind: 'cash', x: 250, y: 300, value: 50, label: 'CASH' },
  { kind: 'gem', x: 640, y: 330, value: 200, label: 'TOPAZ' },
  { kind: 'gold', x: 1120, y: 420, value: 100, label: 'GOLD BAR' },
  { kind: 'painting', x: 700, y: 120, value: 150, label: 'PAINTING' },
];

/** Guard patrol loops. A night takes the first N routes. Every segment keeps at
 *  least a guard's radius clear of walls and cover, and the two rovers cross the
 *  dividers through the doorways, never through the walls themselves. */
export const GUARD_ROUTES = [
  [[90, 110], [360, 110], [360, 280], [90, 280]],
  [[480, 120], [800, 120], [800, 300], [480, 300]],
  [[880, 120], [1220, 120], [1220, 320], [880, 320]],
  [[200, 300], [400, 300], [400, 360], [200, 360]],
  [[90, 500], [360, 500], [360, 700], [90, 700]],
  [[480, 500], [800, 500], [800, 720], [480, 720]],
  [[880, 520], [1220, 520], [1220, 720], [880, 720]],
  [[500, 450], [780, 450], [780, 480], [500, 480]],
];

/** Cameras: wall mount, base facing angle (radians), sweep amplitude and period. */
export const CAMERA_MOUNTS = [
  { x: 440, y: 78, base: Math.PI / 2, sweep: 0.8, period: 4.2 },
  { x: 840, y: 782, base: -Math.PI / 2, sweep: 0.8, period: 5.1 },
  { x: 1262, y: 300, base: Math.PI, sweep: 0.6, period: 3.8 },
  { x: 18, y: 420, base: 0, sweep: 0.7, period: 4.6 },
  { x: 640, y: 78, base: Math.PI / 2, sweep: 0.9, period: 3.4 },
];

export const START = { x: 60, y: 760 };
export const EXIT = { x: 1150, y: 700, w: 114, h: 84 };

export const PALETTE = {
  backdrop: '#0b0d12',
  hud: '#141824',
  hudLine: '#2a3040',
  floorGallery: '#232838',
  floorHall: '#1f2433',
  floorVault: '#2a2438',
  floorLine: '#31364a',
  wall: '#4a5068',
  wallTop: '#6a7192',
  coverCase: '#3a4a6b',
  coverCrate: '#5a4632',
  coverSofa: '#5b2f3a',
  coverStatue: '#7a7f8f',
  coverPlant: '#2f5b3a',
  coverSafe: '#3f4a5a',
  thief: '#e8e8f0',
  thiefCoat: '#232338',
  guard: '#e5534b',
  guardCone: 'rgba(242, 201, 76, 0.20)',
  guardConeAlert: 'rgba(229, 83, 75, 0.32)',
  cameraCone: 'rgba(229, 83, 75, 0.16)',
  cameraOff: 'rgba(120, 130, 150, 0.10)',
  lootGold: '#f2c94c',
  lootGem: '#4fc3f7',
  lootPainting: '#c98bf2',
  lootCash: '#7ddc8a',
  lootDiamond: '#aef3ff',
  exit: '#2fbf71',
  smoke: 'rgba(200, 205, 220, 0.45)',
  text: '#eef1f5',
  muted: '#8b93a3',
  alarmLow: '#7ddc8a',
  alarmMid: '#f2c94c',
  alarmHigh: '#e5534b',
  panel: '#1a1f2e',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'midnight-vault.best';
