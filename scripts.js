// ============================================================
//  WATER WALK  –  charity:water Educational Side-Scroller
// ============================================================
//  CONTROLS:
//    Jump   →  W / ArrowUp / Space
//    Duck   →  S / ArrowDown
//    Pause  →  P / Escape / click pause button
//    Mobile →  Swipe Up = Jump, Swipe Down = Duck
// ============================================================


// ============================================================
// [CANVAS SETUP]
// ============================================================
var canvas = document.getElementById("game");
var ctx    = canvas.getContext("2d");

// Fixed internal resolution — CSS handles responsive scaling
var W = 960;
var H = 540;
canvas.width  = W;
canvas.height = H;


// ============================================================
// [BRAND COLORS]
// ============================================================
var COLORS = {
  yellow:    "#ffcb3d",
  blue:      "#0090d9",
  darkBlue:  "#1e3a5f",
  waterBlue: "#4db8e8",
  white:     "#ffffff",
  black:     "#000000"
};


// ============================================================
// [GAME CONSTANTS]
// ============================================================
var GROUND_Y       = H - 60;
var GROUND_HEIGHT  = 60;
var PLAYER_X       = 100;
var PLAYER_W       = 50;
var PLAYER_H       = 64;
var DUCK_H         = 36;
var JUMP_VELOCITY  = -10;
var GRAVITY        = 0.65;
var DUCK_DURATION  = 30;
var START_WATER    = 20;
var MAX_WATER      = 100;
var DROP_VALUE     = 1;
var WIN_WATER      = 80;
var DAMAGE_ZONE_1  = 5;
var DAMAGE_ZONE_2  = 10;
var DAMAGE_ZONE_3  = 15;
var TOTAL_TIME     = 90;
var TOTAL_DISTANCE = 6;
var BASE_SPEED     = 7;
var MAX_SPEED      = 13;
var INVULN_FRAMES  = 60;
var DROP_W         = 22;
var DROP_H         = 28;
var ROCK_W         = 36;
var ROCK_H         = 36;
var CLUSTER_W      = 100;
var CLUSTER_H      = 40;
var WIND_W         = 100;
var WIND_H         = 60;
var WIND_BOTTOM_GAP = 40;
var PAUSE_BTN_X    = W - 55;
var PAUSE_BTN_Y    = 12;
var PAUSE_BTN_SIZE = 36;
var GROUND_SURFACE = GROUND_Y + 10;
var PLAYER_DRAW_Y_OFFSET = GROUND_SURFACE - GROUND_Y;


// ============================================================
// [GAME STATE]
// ============================================================
var state  = "start";
var paused = false;

var player = {};
var drops  = [];
var obstacles = [];
var particles = [];

var water       = 0;
var distance    = 0;
var elapsed     = 0;
var scrollSpeed = 0;
var frameCount  = 0;

var countdownTimer = 0;
var countdownNum   = 3;

var endResult = "";

var infiniteUnlocked = false;
var infiniteMode     = false;
var infiniteDistance  = 0;
var infiniteHighScore = 0;

var nextDropSpawn     = 0;
var nextObstacleSpawn = 0;

var hillOffset = 0;

// ---- Cutscene state ----
// Phases: "decel" → "walkCenter" → "spriteSwap" → "panSun" → "whiteout" → done (→ "end")
var cutscenePhase     = "";
var cutsceneTimer     = 0;
var cutsceneSpeedSnap = 0;    // scroll speed when cutscene began
var cutscenePlayerStart = 0;  // player X when walk-to-center begins
var cutsceneCamY      = 0;    // camera vertical offset (pan up)
var cutsceneSunScale  = 1;    // sun radius multiplier
var cutsceneRayAngle  = 0;    // rotating sun rays angle
var cutsceneWhiteout  = 0;    // 0→1 alpha for final whiteout

// Back 3/4 sprite sizing (viewBox 548.78 × 869.04)
var BACK34_ASPECT = 869.04 / 548.78;  // ≈ 1.583
var SPRITE_BACK34_W = PLAYER_W;       // same width as standing
var SPRITE_BACK34_H = Math.round(PLAYER_W * BACK34_ASPECT);  // ≈ 79

// Cutscene timing (frames at 60fps)
var DECEL_FRAMES      = 90;   // 1.5s scroll deceleration
var WALK_CENTER_SPEED = 2.5;  // px/frame walk speed to center
var SPRITE_SWAP_PAUSE = 50;   // ~0.8s pause after swap
var PAN_SUN_FRAMES    = 300;  // 5s camera pan + sun growth
var WHITEOUT_FRAMES   = 80;   // ~1.3s final white fade
var POST_WHITE_PAUSE  = 60;   // 1s hold on white before end screen


// ============================================================
// [INPUT HANDLING]
// ============================================================
var keys = {};

function togglePause() {
  if (state === "playing" || state === "infinite") {
    paused = !paused;
  }
}

document.addEventListener("keydown", function(e) {
  keys[e.key] = true;
  if (e.key === "p" || e.key === "P" || e.key === "Escape") {
    togglePause();
    return;
  }
  if (state === "start" && (e.key === " " || e.key === "Enter")) {
    startCountdown();
  }
  if (state === "end") {
    if (e.key === "r" || e.key === "R") resetAndPlay();
    if ((e.key === "i" || e.key === "I") && infiniteUnlocked) startInfinite();
  }
});

document.addEventListener("keyup", function(e) {
  keys[e.key] = false;
});

// Touch / swipe for mobile
var touchStartY = 0;
var touchStartX = 0;

canvas.addEventListener("touchstart", function(e) {
  e.preventDefault();
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;

  var rect = canvas.getBoundingClientRect();
  var scaleX = W / rect.width;
  var scaleY = H / rect.height;
  var tx = (e.touches[0].clientX - rect.left) * scaleX;
  var ty = (e.touches[0].clientY - rect.top) * scaleY;

  if (tx > PAUSE_BTN_X && tx < PAUSE_BTN_X + PAUSE_BTN_SIZE &&
      ty > PAUSE_BTN_Y && ty < PAUSE_BTN_Y + PAUSE_BTN_SIZE) {
    togglePause();
    return;
  }

  if (state === "start") startCountdown();

  if (paused) {
    if (tx > W/2 - 100 && tx < W/2 + 100 && ty > H/2 + 20 && ty < H/2 + 70) {
      paused = false;
    }
  }
}, { passive: false });

canvas.addEventListener("touchend", function(e) {
  e.preventDefault();
  var touchEndY = e.changedTouches[0].clientY;
  var diff = touchStartY - touchEndY;

  if ((state === "playing" || state === "infinite") && !paused) {
    if (diff > 30) tryJump();
    if (diff < -30) tryDuck();
  }
}, { passive: false });

// Mouse click on buttons
canvas.addEventListener("click", function(e) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = W / rect.width;
  var scaleY = H / rect.height;
  var mx = (e.clientX - rect.left) * scaleX;
  var my = (e.clientY - rect.top) * scaleY;

  if ((state === "playing" || state === "infinite") &&
      mx > PAUSE_BTN_X && mx < PAUSE_BTN_X + PAUSE_BTN_SIZE &&
      my > PAUSE_BTN_Y && my < PAUSE_BTN_Y + PAUSE_BTN_SIZE) {
    togglePause();
    return;
  }

  if (paused && mx > W/2 - 100 && mx < W/2 + 100 &&
      my > H/2 + 20 && my < H/2 + 70) {
    paused = false;
    return;
  }

  if (state === "start") {
    if (mx > W/2 - 100 && mx < W/2 + 100 && my > 340 && my < 390) {
      startCountdown();
    }
  }

  if (state === "end") {
    if (mx > W/2 - 200 && mx < W/2 - 10 && my > 400 && my < 450) {
      resetAndPlay();
    }
    if (infiniteUnlocked && mx > W/2 + 10 && mx < W/2 + 200 && my > 400 && my < 450) {
      startInfinite();
    }
  }
});

function tryJump() {
  if (!paused && player.onGround && !player.ducking) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
}

function tryDuck() {
  if (!paused && player.onGround && !player.ducking) {
    player.ducking = true;
    player.duckTimer = DUCK_DURATION;
  }
}


// ============================================================
// [SUNRISE SYSTEM]
// ============================================================
var skyTopPalette = [
  { km: 0, rgb: [30, 30, 65] },
  { km: 1, rgb: [42, 48, 85] },
  { km: 3, rgb: [80, 100, 155] },
  { km: 5, rgb: [130, 195, 230] },
  { km: 6, rgb: [190, 220, 250] }
];
var skyBotPalette = [
  { km: 0, rgb: [55, 55, 85] },
  { km: 1, rgb: [195, 125, 80] },
  { km: 3, rgb: [230, 155, 85] },
  { km: 5, rgb: [250, 210, 100] },
  { km: 6, rgb: [255, 240, 210] }
];
var hillPalette = [
  { km: 0, rgb: [18, 22, 45] },
  { km: 1, rgb: [25, 40, 70] },
  { km: 3, rgb: [40, 70, 105] },
  { km: 5, rgb: [65, 110, 155] },
  { km: 6, rgb: [120, 190, 220] }
];
var sunPalette = [
  { km: 0, rgb: [220, 150, 80] },
  { km: 1.5, rgb: [240, 185, 100] },
  { km: 3, rgb: [255, 225, 140] },
  { km: 5, rgb: [255, 245, 210] },
  { km: 6, rgb: [255, 252, 235] }
];
var sunRingPalette = [
  { km: 0, rgb: [210, 130, 60] },
  { km: 1.5, rgb: [225, 155, 55] },
  { km: 3, rgb: [245, 185, 55] },
  { km: 5, rgb: [255, 203, 61] },
  { km: 6, rgb: [255, 203, 61] }
];
var sunCenterPalette = [
  { km: 0, rgb: [255, 255, 230] },
  { km: 3, rgb: [255, 255, 240] },
  { km: 6, rgb: [255, 255, 250] }
];
var sunPositions = [
  { km: 0, y: GROUND_Y - 10, r: 30 },
  { km: 1, y: GROUND_Y - 50, r: 45 },
  { km: 3, y: GROUND_Y - 120, r: 60 },
  { km: 5, y: GROUND_Y - 200, r: 75 },
  { km: 6, y: GROUND_Y - 240, r: 85 }
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function blendPalette(palette, km) {
  var lo = palette[0];
  var hi = palette[palette.length - 1];
  for (var i = 0; i < palette.length - 1; i++) {
    if (km >= palette[i].km && km <= palette[i + 1].km) {
      lo = palette[i];
      hi = palette[i + 1];
      break;
    }
  }
  var range = hi.km - lo.km;
  var t = range > 0 ? clamp((km - lo.km) / range, 0, 1) : 0;
  return [
    Math.round(lerp(lo.rgb[0], hi.rgb[0], t)),
    Math.round(lerp(lo.rgb[1], hi.rgb[1], t)),
    Math.round(lerp(lo.rgb[2], hi.rgb[2], t))
  ];
}

function lerpKeyframes(kf, km, prop) {
  var lo = kf[0];
  var hi = kf[kf.length - 1];
  for (var i = 0; i < kf.length - 1; i++) {
    if (km >= kf[i].km && km <= kf[i + 1].km) {
      lo = kf[i];
      hi = kf[i + 1];
      break;
    }
  }
  var range = hi.km - lo.km;
  var t = range > 0 ? clamp((km - lo.km) / range, 0, 1) : 0;
  return lerp(lo[prop], hi[prop], t);
}

function rgb(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }


// ============================================================
// [DRAWING HELPERS]
// ============================================================
function drawSky(km) {
  var top = blendPalette(skyTopPalette, km);
  var bot = blendPalette(skyBotPalette, km);
  var grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, rgb(top));
  grad.addColorStop(1, rgb(bot));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawSun(km) {
  var sunX = W * 0.58;
  var sunY = lerpKeyframes(sunPositions, km, "y");
  var radius = lerpKeyframes(sunPositions, km, "r");
  var col = blendPalette(sunPalette, km);
  var ringCol = blendPalette(sunRingPalette, km);
  var centerCol = blendPalette(sunCenterPalette, km);
  var alpha = clamp(km / 1.5, 0.35, 1.0);

  var glow = ctx.createRadialGradient(sunX, sunY, radius * 0.5, sunX, sunY, radius * 2.5);
  glow.addColorStop(0, rgba(col, alpha * 0.3));
  glow.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.beginPath();
  ctx.arc(sunX, sunY, radius + 14, 0, Math.PI * 2);
  ctx.fillStyle = rgba(ringCol, alpha * 0.65);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fillStyle = rgba(col, alpha);
  ctx.fill();

  var inner = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius * 0.7);
  inner.addColorStop(0, rgba(centerCol, alpha * 0.6));
  inner.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawHills(km) {
  var col = blendPalette(hillPalette, km);
  var scroll = hillOffset * 0.3;
  var heightMult;
  if (km <= 5.5) {
    heightMult = 1.0 + clamp(km / 5.5, 0, 1) * 1.0;
  } else {
    var fadeT = clamp((km - 5.5) / 0.5, 0, 1);
    heightMult = lerp(2.0, 0.8, fadeT);
  }

  var backCol = [
    Math.min(255, col[0] + 25),
    Math.min(255, col[1] + 25),
    Math.min(255, col[2] + 25)
  ];
  ctx.fillStyle = rgb(backCol);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (var x = -50; x <= W + 50; x += 4) {
    var y = GROUND_Y - 60 * heightMult
          + Math.sin((x + scroll * 0.4) * 0.0035) * 80 * heightMult
          + Math.sin((x + scroll * 0.4) * 0.007) * 30 * heightMult;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 50, H);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = rgb(col);
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (var x = -50; x <= W + 50; x += 4) {
    var y = GROUND_Y - 20 * heightMult
          + Math.sin((x + scroll) * 0.005) * 55 * heightMult
          + Math.sin((x + scroll) * 0.009) * 25 * heightMult;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W + 50, H);
  ctx.closePath();
  ctx.fill();
}

function drawGround(km) {
  var col = blendPalette(hillPalette, km);
  var dark = [Math.max(0, col[0] - 15), Math.max(0, col[1] - 15), Math.max(0, col[2] - 10)];
  ctx.fillStyle = rgb(dark);
  ctx.fillRect(0, GROUND_SURFACE, W, H - GROUND_SURFACE);

  ctx.strokeStyle = rgba([77, 184, 232], 0.3);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_SURFACE + 2);
  ctx.lineTo(W, GROUND_SURFACE + 2);
  ctx.stroke();
}


// ============================================================
// [SVG SPRITE SYSTEM]
// ============================================================
var SPRITE_FILES = {
  walkContact1: "Jerry Sprites/charity-water-1_WALK-CONTACT1.svg",
  walkPassing:  "Jerry Sprites/charity-water-1_WALK-PASSING.svg",
  walkContact2: "Jerry Sprites/charity-water-1_WALK-CONTACT-2.svg",
  walkHit:      "Jerry Sprites/charity-water-1_WALK-OBSTACLE-HIT.svg",
  duckNormal:   "Jerry Sprites/charity-water-1_DUCK NORMAL.svg",
  duckHit:      "Jerry Sprites/charity-water-1_DUCK-OBSTACLE-HIT.svg",
  lose:         "Jerry Sprites/charity-water-1_LOSE.svg",
  back34:       "Jerry Sprites/charity-water-1_BACK 3-4 VIEW.svg"
};

var sprites = {};
var spritesLoaded = false;

function loadSprites(callback) {
  var spriteKeys = Object.keys(SPRITE_FILES);
  var remaining = spriteKeys.length;

  spriteKeys.forEach(function(key) {
    var img = new Image();
    img._loaded = false;
    img.onload = function() {
      img._loaded = true;
      remaining--;
      if (remaining <= 0) { spritesLoaded = true; if (callback) callback(); }
    };
    img.onerror = function() {
      console.warn("Failed to load sprite: " + SPRITE_FILES[key]);
      img._loaded = false;
      remaining--;
      if (remaining <= 0) { spritesLoaded = true; if (callback) callback(); }
    };
    img.src = SPRITE_FILES[key];
    sprites[key] = img;
  });
}

var walkFrames = ["walkContact1", "walkPassing", "walkContact2", "walkPassing"];
var walkFrameIndex = 0;
var walkFrameTimer = 0;
var WALK_FRAME_DURATION = 8;

var WALK_ASPECT  = 791 / 458;
var DUCK_ASPECT  = 426 / 458;
var LOSE_ASPECT  = 627 / 833;
var HIT_ASPECT   = 829 / 833;

var SPRITE_STAND_W = PLAYER_W;
var SPRITE_STAND_H = Math.round(PLAYER_W * WALK_ASPECT);
var SPRITE_DUCK_W  = PLAYER_W;
var SPRITE_DUCK_H  = Math.round(PLAYER_W * DUCK_ASPECT);
var SPRITE_HIT_W   = Math.round(PLAYER_W * (833 / 458));
var SPRITE_HIT_H   = Math.round(SPRITE_HIT_W * HIT_ASPECT);
var SPRITE_LOSE_W  = 80;
var SPRITE_LOSE_H  = Math.round(80 * LOSE_ASPECT);

var LOSE_ANIM_DURATION = 90;


// ============================================================
// [JERRY CAN CHARACTER]
// ============================================================
function drawJerryCan() {
  var p = player;

  if (state === "dying") { drawDyingAnimation(); return; }

  if (p.invulnTimer > 0 && Math.floor(p.invulnTimer / 4) % 2 === 0) return;

  if (!spritesLoaded) return;

  ctx.save();

  if (p.stumbleTimer > 0) {
    var shake = Math.sin(p.stumbleTimer * 0.8) * 3;
    ctx.translate(shake, 0);
  }

  var spriteKey, drawW, drawH, drawX, drawY;

  if (p.ducking) {
    spriteKey = (p.invulnTimer > 0 && p.invulnTimer > INVULN_FRAMES - 20) ? "duckHit" : "duckNormal";
    drawW = SPRITE_DUCK_W;
    drawH = SPRITE_DUCK_H;
    drawX = p.x + (PLAYER_W - drawW) / 2;
    drawY = p.y - drawH + PLAYER_DRAW_Y_OFFSET;
  } else {
    if (p.invulnTimer > 0 && p.invulnTimer > INVULN_FRAMES - 20) {
      spriteKey = "walkHit";
      drawW = SPRITE_HIT_W;
      drawH = SPRITE_HIT_H;
    } else if (p.onGround) {
      spriteKey = walkFrames[walkFrameIndex];
      drawW = SPRITE_STAND_W;
      drawH = SPRITE_STAND_H;
    } else {
      spriteKey = "walkPassing";
      drawW = SPRITE_STAND_W;
      drawH = SPRITE_STAND_H;
    }
    drawX = p.x + (PLAYER_W - drawW) / 2;
    drawY = p.y - drawH + PLAYER_DRAW_Y_OFFSET;
  }

  var img = sprites[spriteKey];
  if (img && img._loaded) {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    // Fallback rectangle
    ctx.fillStyle = COLORS.yellow;
    var fbH = p.ducking ? DUCK_H : PLAYER_H;
    ctx.fillRect(p.x, p.y - fbH + PLAYER_DRAW_Y_OFFSET, PLAYER_W, fbH);
    ctx.strokeStyle = "#d4a830";
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x, p.y - fbH + PLAYER_DRAW_Y_OFFSET, PLAYER_W, fbH);
  }

  ctx.restore();
}

function updateWalkCycle() {
  if (player.onGround && !player.ducking && !paused) {
    walkFrameTimer++;
    if (walkFrameTimer >= WALK_FRAME_DURATION) {
      walkFrameTimer = 0;
      walkFrameIndex = (walkFrameIndex + 1) % walkFrames.length;
    }
  } else if (!player.onGround) {
    walkFrameTimer = 0;
  }
}

// Dying animation
var dyingTimer = 0;
var dyingWasDucking = false;

function startDyingAnimation(wasDucking) {
  state = "dying";
  dyingTimer = 0;
  dyingWasDucking = wasDucking;
}

function drawDyingAnimation() {
  if (!spritesLoaded) return;

  dyingTimer++;
  var t = Math.min(dyingTimer / LOSE_ANIM_DURATION, 1);

  ctx.save();

  if (t < 0.4) {
    var shake = Math.sin(dyingTimer * 1.5) * (4 - t * 8);
    ctx.translate(shake, 0);

    var spriteKey = dyingWasDucking ? "duckHit" : "walkHit";
    var img = sprites[spriteKey];
    var drawH, drawW, drawX, drawY;

    if (dyingWasDucking) {
      drawW = SPRITE_DUCK_W; drawH = SPRITE_DUCK_H;
      drawX = player.x + (PLAYER_W - drawW) / 2;
      drawY = player.y - drawH + PLAYER_DRAW_Y_OFFSET;
    } else {
      drawW = SPRITE_HIT_W; drawH = SPRITE_HIT_H;
      drawX = player.x + (PLAYER_W - drawW) / 2;
      drawY = player.y - drawH + PLAYER_DRAW_Y_OFFSET;
    }

    if (img && img._loaded) {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }
  } else {
    var loseT = (t - 0.4) / 0.6;
    var eased = loseT * loseT;

    var startX = player.x;
    var endX = player.x + 25;
    var startY = player.y - SPRITE_STAND_H + PLAYER_DRAW_Y_OFFSET;
    var endY = player.y - SPRITE_LOSE_H + PLAYER_DRAW_Y_OFFSET;

    var curX = lerp(startX, endX, eased);
    var curY = lerp(startY, endY, eased);

    var rotation = eased * 0.15;
    ctx.translate(curX + SPRITE_LOSE_W / 2, curY + SPRITE_LOSE_H / 2);
    ctx.rotate(rotation);
    ctx.translate(-(curX + SPRITE_LOSE_W / 2), -(curY + SPRITE_LOSE_H / 2));

    var img = sprites["lose"];
    if (img && img._loaded) {
      ctx.drawImage(img, curX, curY, SPRITE_LOSE_W, SPRITE_LOSE_H);
    }
  }

  ctx.restore();

  if (dyingTimer >= LOSE_ANIM_DURATION) {
    if (!endResult) endResult = "loss";
    state = "end";
  }
}


// ============================================================
// [WATER DROPS]
// ============================================================
function drawDrop(drop) {
  var x = drop.x + DROP_W / 2;
  var bob = Math.sin(elapsed * 2.5 + drop.x * 0.02) * 3;
  var y = drop.y + bob;

  ctx.fillStyle = COLORS.waterBlue;
  ctx.beginPath();
  ctx.moveTo(x, y - DROP_H / 2);
  ctx.quadraticCurveTo(x + DROP_W / 2, y, x + DROP_W / 2, y + DROP_H / 4);
  ctx.arc(x, y + DROP_H / 4, DROP_W / 2, 0, Math.PI, false);
  ctx.quadraticCurveTo(x - DROP_W / 2, y, x, y - DROP_H / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(x - 3, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

function getDropBox(drop) {
  var bob = Math.sin(elapsed * 2.5 + drop.x * 0.02) * 3;
  return { x: drop.x, y: drop.y + bob - DROP_H / 2, w: DROP_W, h: DROP_H };
}


// ============================================================
// [OBSTACLES]
// ============================================================
function drawObstacle(obs) {
  if (obs.type === "rock")    drawRock(obs);
  if (obs.type === "cluster") drawCluster(obs);
  if (obs.type === "wind")    drawWind(obs);
}

function drawRock(obs) {
  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.moveTo(obs.x + ROCK_W / 2, obs.y - ROCK_H);
  ctx.lineTo(obs.x + ROCK_W, obs.y);
  ctx.lineTo(obs.x, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6d4a";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCluster(obs) {
  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.moveTo(obs.x + 18, obs.y - CLUSTER_H + 8);
  ctx.lineTo(obs.x + 36, obs.y);
  ctx.lineTo(obs.x, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6d4a";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#a3845e";
  ctx.beginPath();
  ctx.moveTo(obs.x + 50, obs.y - CLUSTER_H);
  ctx.lineTo(obs.x + 72, obs.y);
  ctx.lineTo(obs.x + 28, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.moveTo(obs.x + 82, obs.y - CLUSTER_H + 12);
  ctx.lineTo(obs.x + CLUSTER_W, obs.y);
  ctx.lineTo(obs.x + 65, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawWind(obs) {
  if (obs.phase === undefined) obs.phase = 0;
  obs.phase += 0.08;

  var w = WIND_W;
  var h = WIND_H;

  ctx.lineCap = "round";

  for (var i = 0; i < 5; i++) {
    var yy = obs.y + 4 + i * (h / 5);
    var shift = Math.sin(obs.phase + i * 1.2) * 8;

    ctx.beginPath();
    ctx.moveTo(obs.x + shift, yy);
    for (var px = 0; px <= w; px += 4) {
      var wave = Math.sin((px * 0.06) + obs.phase + i) * 5;
      ctx.lineTo(obs.x + px + shift, yy + wave);
    }

    ctx.strokeStyle = "rgba(60, 60, 70, 0.5)";
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.strokeStyle = "rgba(225, 225, 240, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }
}

function getObsBox(obs) {
  if (obs.type === "rock") {
    return { x: obs.x + 6, y: obs.y - ROCK_H + 6, w: ROCK_W - 12, h: ROCK_H - 6 };
  }
  if (obs.type === "cluster") {
    return { x: obs.x + 5, y: obs.y - CLUSTER_H + 4, w: CLUSTER_W - 10, h: CLUSTER_H - 4 };
  }
  if (obs.type === "wind") {
    return { x: obs.x + 5, y: obs.y + 2, w: WIND_W - 10, h: WIND_H - 4 };
  }
}


// ============================================================
// [SPAWNING SYSTEM]
// ============================================================
function dropOverlapsObstacle(dx, dy) {
  var MARGIN = 20;
  var dropBox = {
    x: dx - MARGIN,
    y: dy - DROP_H / 2 - MARGIN,
    w: DROP_W + MARGIN * 2,
    h: DROP_H + MARGIN * 2
  };
  for (var i = 0; i < obstacles.length; i++) {
    var oBox = getObsBox(obstacles[i]);
    if (boxOverlap(dropBox, oBox)) return true;
  }
  return false;
}

function spawnDropGroup() {
  var count = 1 + Math.floor(Math.random() * 4);
  var level = Math.random();
  var baseY;

  if (level < 0.4) baseY = GROUND_Y - 20;
  else if (level < 0.75) baseY = GROUND_Y - PLAYER_H - 5;
  else baseY = GROUND_Y - PLAYER_H - 40;

  for (var i = 0; i < count; i++) {
    var dropX = W + i * 40;
    if (!dropOverlapsObstacle(dropX, baseY)) {
      drops.push({ x: dropX, y: baseY });
    }
  }
}

function spawnObstacle() {
  var types = ["rock", "cluster", "wind"];
  var type = types[Math.floor(Math.random() * types.length)];
  var obs = { type: type, x: W + 20 };

  if (type === "rock")         obs.y = GROUND_SURFACE;
  else if (type === "cluster") obs.y = GROUND_SURFACE;
  else if (type === "wind")    obs.y = GROUND_Y - WIND_BOTTOM_GAP - WIND_H;

  obstacles.push(obs);
}

function updateSpawning() {
  frameCount++;

  var dropInterval, obsInterval;
  if (distance < 1)      { dropInterval = 50; obsInterval = 80; }
  else if (distance < 2) { dropInterval = 45; obsInterval = 60; }
  else if (distance < 4) { dropInterval = 40; obsInterval = 45; }
  else                   { dropInterval = 35; obsInterval = 35; }

  nextDropSpawn--;
  nextObstacleSpawn--;

  if (nextDropSpawn <= 0) {
    spawnDropGroup();
    nextDropSpawn = dropInterval + Math.floor(Math.random() * 15);
  }

  if (nextObstacleSpawn <= 0 && frameCount > 180) {
    spawnObstacle();
    nextObstacleSpawn = obsInterval + Math.floor(Math.random() * 15);

    if (Math.random() < 0.35) {
      var lastObs = obstacles[obstacles.length - 1];
      var riskY;
      var riskX = lastObs.x - 65;

      if (lastObs.type === "wind") riskY = GROUND_Y - 20;
      else riskY = GROUND_Y - PLAYER_H + 5;

      if (!dropOverlapsObstacle(riskX, riskY)) {
        drops.push({ x: riskX, y: riskY });
      }
      if (!dropOverlapsObstacle(riskX + 35, riskY)) {
        drops.push({ x: riskX + 35, y: riskY });
      }
    }
  }
}


// ============================================================
// [COLLISION DETECTION]
// ============================================================
function boxOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

function getPlayerBox() {
  var h = player.ducking ? DUCK_H : PLAYER_H;
  return { x: player.x + 6, y: player.y - h + 4, w: PLAYER_W - 12, h: h - 8 };
}


// ============================================================
// [PARTICLES]
// ============================================================
function spawnParticles(x, y, color, count) {
  for (var i = 0; i < count; i++) {
    particles.push({
      x: x, y: y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6 - 2,
      life: 20 + Math.random() * 15,
      color: color,
      size: 2 + Math.random() * 4
    });
  }
}

function updateAndDrawParticles() {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life--;

    var alpha = p.life / 30;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (p.life <= 0) particles.splice(i, 1);
  }
}


// ============================================================
// [HUD / UI]
// ============================================================
function drawHUD() {
  var meterX = 50, meterY = 25, meterW = 200, meterH = 22;

  // Water drop icon
  ctx.fillStyle = COLORS.waterBlue;
  ctx.beginPath();
  ctx.moveTo(28, meterY - 6);
  ctx.quadraticCurveTo(38, meterY + 8, 38, meterY + 12);
  ctx.arc(28, meterY + 12, 10, 0, Math.PI, false);
  ctx.quadraticCurveTo(18, meterY + 8, 28, meterY - 6);
  ctx.closePath();
  ctx.fill();

  // Meter background
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(meterX, meterY, meterW, meterH);

  // Meter fill
  var fill = Math.min(water / MAX_WATER, 1);
  ctx.fillStyle = COLORS.waterBlue;
  ctx.fillRect(meterX, meterY, meterW * fill, meterH);

  // Meter border
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(meterX, meterY, meterW, meterH);

  // Water number
  ctx.fillStyle = COLORS.white;
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "left";
  ctx.fillText(Math.floor(water) + " / " + MAX_WATER, meterX + 4, meterY + 16);

  // Score
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "left";
  ctx.fillText("SCORE: " + Math.floor(water), 28, meterY + meterH + 22);

  // Distance
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "right";
  var distText = distance.toFixed(2) + " km / " + TOTAL_DISTANCE + " km";
  ctx.fillText("DISTANCE: " + distText, W - 70, 42);

  drawPauseButton();

  // Controls hint (first 3 seconds)
  if (frameCount < 180 && !infiniteMode) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("W / \u2191  to JUMP    \u2022    S / \u2193  to DUCK    \u2022    P to PAUSE", W / 2, GROUND_Y - 20);
  }
}

function drawPauseButton() {
  var x = PAUSE_BTN_X, y = PAUSE_BTN_Y, s = PAUSE_BTN_SIZE;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = COLORS.white;
  var barW = 6, barH = 20, barY = y + (s - barH) / 2;
  ctx.fillRect(x + s/2 - barW - 3, barY, barW, barH);
  ctx.fillRect(x + s/2 + 3, barY, barW, barH);
}


// ============================================================
// [PAUSE SCREEN]
// ============================================================
function drawPauseOverlay() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 56px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PAUSED", W/2, H/2 - 30);

  ctx.fillStyle = COLORS.white;
  ctx.font = "20px sans-serif";
  ctx.fillText("Press P, Escape, or click below to resume", W/2, H/2 + 10);

  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(W/2 - 90, H/2 + 30, 180, 44);
  ctx.fillStyle = COLORS.darkBlue;
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("RESUME", W/2, H/2 + 58);
}


// ============================================================
// [SCREENS]
// ============================================================
function drawStartScreen() {
  drawSky(0); drawSun(0); drawHills(0); drawGround(0);

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WATER WALK", W/2, 160);

  ctx.fillStyle = COLORS.white;
  ctx.font = "18px sans-serif";
  ctx.fillText("Guide a jerry can 6km to collect clean water.", W/2, 210);
  ctx.fillText("A charity:water awareness game.", W/2, 235);

  ctx.fillStyle = COLORS.waterBlue;
  ctx.font = "bold 16px monospace";
  ctx.fillText("W / \u2191 / Space  =  JUMP       S / \u2193  =  DUCK       P  =  PAUSE", W/2, 280);

  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(W/2 - 100, 340, 200, 50);
  ctx.fillStyle = COLORS.darkBlue;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("START GAME", W/2, 372);

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "14px sans-serif";
  ctx.fillText("Mobile: Swipe Up = Jump, Swipe Down = Duck", W/2, 420);
}

function drawCountdown() {
  drawSky(0); drawSun(0); drawHills(0); drawGround(0);

  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(countdownNum, W/2, H/2 + 30);
}

function drawEndScreen() {
  var km;
  if (infiniteMode) km = 3;
  else if (endResult === "loss") km = Math.min(distance, 4);
  else km = 5;

  drawSky(km); drawSun(km); drawHills(km); drawGround(km);

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";

  if (infiniteMode) {
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("INFINITE MODE", W/2, 100);

    ctx.fillStyle = COLORS.white;
    ctx.font = "24px sans-serif";
    ctx.fillText("Distance: " + infiniteDistance.toFixed(2) + " km", W/2, 160);

    ctx.fillStyle = COLORS.waterBlue;
    ctx.font = "20px sans-serif";
    ctx.fillText("High Score: " + infiniteHighScore.toFixed(2) + " km", W/2, 200);

    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(W/2 - 100, 400, 200, 50);
    ctx.fillStyle = COLORS.darkBlue;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("PLAY AGAIN (R)", W/2, 432);
    return;
  }

  if (endResult === "loss") {
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("OUT OF WATER!", W/2, 90);

    ctx.fillStyle = COLORS.white;
    ctx.font = "20px sans-serif";
    ctx.fillText("Distance traveled: " + distance.toFixed(2) + " km", W/2, 150);
    ctx.fillText("Water collected: " + Math.floor(water), W/2, 180);

    var loseImg = sprites["lose"];
    if (loseImg && loseImg._loaded) {
      var iconW = 140;
      var iconH = Math.round(iconW * LOSE_ASPECT);
      ctx.drawImage(loseImg, W/2 - iconW/2, 220, iconW, iconH);
    }

    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(W/2 - 100, 400, 200, 50);
    ctx.fillStyle = COLORS.darkBlue;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("PLAY AGAIN (R)", W/2, 432);

  } else if (endResult === "partial") {
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("6 KM COMPLETE!", W/2, 80);

    ctx.fillStyle = COLORS.white;
    ctx.font = "20px sans-serif";
    ctx.fillText("You made it, but didn't collect enough water.", W/2, 125);
    ctx.fillText("Distance: \u2713  6 km", W/2, 170);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("Water Goal: \u2717  (" + Math.floor(water) + " / " + WIN_WATER + ")", W/2, 200);

    drawEducationalFacts(240);
    drawEndButtons();

  } else if (endResult === "win") {
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("MISSION COMPLETE!", W/2, 80);

    ctx.fillStyle = COLORS.white;
    ctx.font = "20px sans-serif";
    ctx.fillText("Distance: \u2713  6 km", W/2, 135);
    ctx.fillStyle = "#5ddb6d";
    ctx.fillText("Water Goal: \u2713  (" + Math.floor(water) + " / " + WIN_WATER + ")", W/2, 165);

    drawEducationalFacts(210);
    drawEndButtons();
  }
}

function drawEducationalFacts(startY) {
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(W/2 - 320, startY - 10, 640, 90);

  ctx.fillStyle = COLORS.waterBlue;
  ctx.font = "bold 15px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DID YOU KNOW?", W/2, startY + 12);

  ctx.fillStyle = COLORS.white;
  ctx.font = "15px sans-serif";
  ctx.fillText("1 in 10 people worldwide lack access to clean water.", W/2, startY + 38);
  ctx.fillText("6km is the average distance women and girls walk each day for water.", W/2, startY + 60);

  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("Learn more: charitywater.org", W/2, startY + 85);
}

function drawEndButtons() {
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(W/2 - 200, 400, 185, 50);
  ctx.fillStyle = COLORS.darkBlue;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLAY AGAIN (R)", W/2 - 108, 432);

  if (infiniteUnlocked) {
    ctx.fillStyle = COLORS.blue;
    ctx.fillRect(W/2 + 15, 400, 185, 50);
    ctx.fillStyle = COLORS.white;
    ctx.fillText("INFINITE MODE (I)", W/2 + 108, 432);
  }
}


// ============================================================
// [GAME LOOP]
// ============================================================
function resetGame() {
  player = {
    x: PLAYER_X, y: GROUND_Y, vy: 0,
    onGround: true, ducking: false, duckTimer: 0,
    invulnTimer: 0, stumbleTimer: 0
  };
  drops = [];
  obstacles = [];
  particles = [];
  water = START_WATER;
  distance = 0;
  elapsed = 0;
  scrollSpeed = BASE_SPEED;
  frameCount = 0;
  nextDropSpawn = 30;
  nextObstacleSpawn = 180;
  hillOffset = 0;
  paused = false;
  walkFrameIndex = 0;
  walkFrameTimer = 0;
  dyingTimer = 0;
  endResult = "";
  // Cutscene resets
  cutscenePhase = "";
  cutsceneTimer = 0;
  cutsceneSpeedSnap = 0;
  cutscenePlayerStart = 0;
  cutsceneCamY = 0;
  cutsceneSunScale = 1;
  cutsceneRayAngle = 0;
  cutsceneWhiteout = 0;
}

function startCountdown() {
  resetGame();
  state = "countdown";
  countdownNum = 3;
  countdownTimer = 0;
  infiniteMode = false;
}

function resetAndPlay() {
  startCountdown();
}

function startInfinite() {
  resetGame();
  state = "countdown";
  countdownNum = 3;
  countdownTimer = 0;
  infiniteMode = true;
}

function update() {
  if (paused) return;

  if (state === "countdown") {
    countdownTimer++;
    if (countdownTimer >= 60) {
      countdownTimer = 0;
      countdownNum--;
      if (countdownNum <= 0) {
        state = infiniteMode ? "infinite" : "playing";
      }
    }
    return;
  }

  if (state !== "playing" && state !== "infinite" && state !== "dying" && state !== "cutscene") return;

  if (state === "dying") return;

  // ---- CUTSCENE UPDATE ----
  if (state === "cutscene") {
    updateCutscene();
    return;
  }

  // Input
  if (keys["w"] || keys["W"] || keys["ArrowUp"] || keys[" "]) tryJump();
  if (keys["s"] || keys["S"] || keys["ArrowDown"]) tryDuck();

  // Speed & distance
  if (!infiniteMode) {
    var progress = Math.min(elapsed / TOTAL_TIME, 1);
    scrollSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * progress;
    elapsed += 1 / 60;
    distance = progress * TOTAL_DISTANCE;
  } else {
    scrollSpeed = BASE_SPEED + elapsed * 0.06;
    elapsed += 1 / 60;
    infiniteDistance = elapsed * (scrollSpeed / 60);
  }

  // Player physics
  if (!player.onGround) {
    player.vy += GRAVITY;
    player.y += player.vy;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }
  }

  if (player.ducking) {
    player.duckTimer--;
    if (player.duckTimer <= 0) player.ducking = false;
  }

  if (player.invulnTimer > 0) player.invulnTimer--;
  if (player.stumbleTimer > 0) player.stumbleTimer--;

  updateWalkCycle();

  // Parallax
  hillOffset += scrollSpeed;

  // Spawning
  updateSpawning();

  // Move drops
  for (var i = drops.length - 1; i >= 0; i--) {
    drops[i].x -= scrollSpeed;
    if (drops[i].x < -50) drops.splice(i, 1);
  }

  // Move obstacles
  for (var i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= scrollSpeed;
    if (obstacles[i].x < -100) obstacles.splice(i, 1);
  }

  // Collision: Player vs Drops
  var pBox = getPlayerBox();
  for (var i = drops.length - 1; i >= 0; i--) {
    var dBox = getDropBox(drops[i]);
    if (boxOverlap(pBox, dBox)) {
      water = Math.min(water + DROP_VALUE, MAX_WATER);
      ctx.save();
      var gx = drops[i].x + DROP_W/2;
      var gy = drops[i].y;
      var glowGrad = ctx.createRadialGradient(gx, gy, 0, gx, gy, 28);
      glowGrad.addColorStop(0, "rgba(77, 184, 232, 0.5)");
      glowGrad.addColorStop(1, "rgba(77, 184, 232, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(gx, gy, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drops.splice(i, 1);
    }
  }

  // Collision: Player vs Obstacles
  if (player.invulnTimer <= 0) {
    for (var i = 0; i < obstacles.length; i++) {
      var oBox = getObsBox(obstacles[i]);
      if (boxOverlap(pBox, oBox)) {
        if (infiniteMode) {
          infiniteHighScore = Math.max(infiniteHighScore, infiniteDistance);
          startDyingAnimation(player.ducking);
          endResult = "infinite";
          return;
        }

        var dmg = DAMAGE_ZONE_1;
        if (distance >= 4) dmg = DAMAGE_ZONE_3;
        else if (distance >= 2) dmg = DAMAGE_ZONE_2;

        water -= dmg;
        player.invulnTimer = INVULN_FRAMES;
        player.stumbleTimer = 20;
        spawnParticles(player.x + PLAYER_W/2, player.y - PLAYER_H/2, COLORS.waterBlue, 10);

        if (water <= 0 && distance >= 0.5) {
          water = 0;
          startDyingAnimation(player.ducking);
          return;
        }
        water = Math.max(0, water);
        break;
      }
    }
  }

  // Win check — trigger cutscene instead of immediate end
  if (!infiniteMode && distance >= TOTAL_DISTANCE) {
    infiniteUnlocked = true;
    endResult = water >= WIN_WATER ? "win" : "partial";
    // Start cutscene — if mid-air, land first
    state = "cutscene";
    cutscenePhase = player.onGround ? "decel" : "landing";
    cutsceneTimer = 0;
    cutsceneSpeedSnap = scrollSpeed;
    cutsceneCamY = 0;
    cutsceneSunScale = 1;
    cutsceneRayAngle = 0;
    cutsceneWhiteout = 0;
    // Force out of ducking
    player.ducking = false;
    player.duckTimer = 0;
  }
}

// ============================================================
// [CUTSCENE SYSTEM] — end-of-game cinematic sequence
// ============================================================

// Easing: cubic ease-out (fast start, slow end)
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Easing: cubic ease-in (slow start, fast end)
function easeInCubic(t) { return t * t * t; }

// Easing: ease-in-out cubic
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function updateCutscene() {
  cutsceneTimer++;

  // Phase 0: LANDING — finish the jump arc before anything else
  if (cutscenePhase === "landing") {
    // Continue gravity + downward motion
    player.vy += GRAVITY;
    player.y += player.vy;

    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
      // Now transition into decel
      cutscenePhase = "decel";
      cutsceneTimer = 0;
    }

    // Keep scrolling and clearing during landing
    hillOffset += scrollSpeed;
    for (var i = drops.length - 1; i >= 0; i--) {
      drops[i].x -= scrollSpeed;
      if (drops[i].x < -50) drops.splice(i, 1);
    }
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= scrollSpeed;
      if (obstacles[i].x < -100) obstacles.splice(i, 1);
    }
    return;
  }

  if (cutscenePhase === "decel") {
    // Phase 1: Ease scroll speed to zero
    var t = Math.min(cutsceneTimer / DECEL_FRAMES, 1);
    var eased = easeOutCubic(t);
    scrollSpeed = cutsceneSpeedSnap * (1 - eased);

    // Keep scrolling background during decel
    hillOffset += scrollSpeed;

    // Still move remaining drops/obstacles off screen
    for (var i = drops.length - 1; i >= 0; i--) {
      drops[i].x -= scrollSpeed;
      if (drops[i].x < -50) drops.splice(i, 1);
    }
    for (var i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= scrollSpeed;
      if (obstacles[i].x < -100) obstacles.splice(i, 1);
    }

    // Walk animation continues
    updateWalkCycle();

    if (t >= 1) {
      scrollSpeed = 0;
      cutscenePhase = "walkCenter";
      cutsceneTimer = 0;
      cutscenePlayerStart = player.x;
    }
  }

  else if (cutscenePhase === "walkCenter") {
    // Phase 2: Walk the character to screen center
    var targetX = W / 2 - PLAYER_W / 2;
    var dx = targetX - player.x;

    if (Math.abs(dx) > 2) {
      player.x += Math.sign(dx) * WALK_CENTER_SPEED;
      updateWalkCycle();
    } else {
      player.x = targetX;
      cutscenePhase = "spriteSwap";
      cutsceneTimer = 0;
    }
  }

  else if (cutscenePhase === "spriteSwap") {
    // Phase 3: Brief pause showing back 3/4 sprite
    if (cutsceneTimer >= SPRITE_SWAP_PAUSE) {
      cutscenePhase = "panSun";
      cutsceneTimer = 0;
    }
  }

  else if (cutscenePhase === "panSun") {
    // Phase 4: Camera pans up, sun rises and grows with rays
    var t = Math.min(cutsceneTimer / PAN_SUN_FRAMES, 1);
    var eased = easeInOutCubic(t);

    // Camera pans up (increasing offset moves scene downward → reveals sky)
    cutsceneCamY = eased * 450;

    // Sun grows: starts at 1x, ends at ~12x radius
    cutsceneSunScale = 1 + eased * 11;

    // Ray rotation — starts slow, speeds up
    var rotSpeed = 0.003 + eased * 0.02;
    cutsceneRayAngle += rotSpeed;

    if (t >= 1) {
      cutscenePhase = "whiteout";
      cutsceneTimer = 0;
    }
  }

  else if (cutscenePhase === "whiteout") {
    // Phase 5: Radial white-out consumes the screen
    var t = Math.min(cutsceneTimer / WHITEOUT_FRAMES, 1);
    cutsceneWhiteout = easeInCubic(t);

    // Keep rays rotating during whiteout
    cutsceneRayAngle += 0.023;

    if (t >= 1) {
      cutscenePhase = "postWhite";
      cutsceneTimer = 0;
    }
  }

  else if (cutscenePhase === "postWhite") {
    // Phase 6: Hold on the gradient, then transition to end screen
    if (cutsceneTimer >= POST_WHITE_PAUSE) {
      state = "end";
    }
  }
}


function drawCutscene() {
  var km = 6;  // fully sunrise palette

  // ======== LAYER 1: Sky (screen space — always fills full canvas) ========
  var skyTop = blendPalette(skyTopPalette, km);
  var skyBot = blendPalette(skyBotPalette, km);
  var skyGrad = ctx.createLinearGradient(0, 0, 0, H);
  skyGrad.addColorStop(0, rgb(skyTop));
  skyGrad.addColorStop(1, rgb(skyBot));
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H);

  // ======== LAYER 2: Sun (screen space — rises independently) ========
  drawCutsceneSun(km);

  // ======== LAYER 3: Hills, ground, character (camera space — slide down) ========
  ctx.save();
  ctx.translate(0, cutsceneCamY);  // positive = push content down = camera pans up

  drawHills(km);
  drawGround(km);

  // Character
  if (cutscenePhase === "landing" || cutscenePhase === "decel" || cutscenePhase === "walkCenter") {
    drawJerryCan();
  } else if (cutscenePhase === "spriteSwap" || cutscenePhase === "panSun") {
    drawBack34Sprite();
  }

  ctx.restore();

  // ======== LAYER 4: HUD fade (screen space) ========
  var hudAlpha = 1;
  if (cutscenePhase === "landing") {
    hudAlpha = 1;
  } else if (cutscenePhase === "decel") {
    hudAlpha = 1 - Math.min(cutsceneTimer / (DECEL_FRAMES * 0.6), 1);
  } else {
    hudAlpha = 0;
  }
  if (hudAlpha > 0) {
    ctx.globalAlpha = hudAlpha;
    drawHUD();
    ctx.globalAlpha = 1;
  }

  // ======== LAYER 5: Whiteout (screen space — radial from sun center) ========
  if (cutsceneWhiteout > 0 || cutscenePhase === "postWhite") {
    var alpha = cutscenePhase === "postWhite" ? 1 : cutsceneWhiteout;

    // Sun screen position (matches drawCutsceneSun's screen coords)
    var sunScreenX = W * 0.58;
    var sunBaseY = lerpKeyframes(sunPositions, km, "y");
    var sunTargetY = H * 0.32;
    var sunScreenY = lerp(sunBaseY, sunTargetY, 1);  // sun is at final position during whiteout

    var whiteGrad = ctx.createRadialGradient(
      sunScreenX, sunScreenY, 0,
      sunScreenX, sunScreenY, Math.max(W, H) * 1.2
    );
    whiteGrad.addColorStop(0, "rgba(255, 255, 255, " + alpha + ")");
    whiteGrad.addColorStop(0.6, "rgba(240, 251, 255, " + alpha + ")");
    whiteGrad.addColorStop(1, "rgba(225, 247, 255, " + alpha + ")");

    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, W, H);
  }
}


function drawCutsceneSun(km) {
  var sunX = W * 0.58;
  var sunBaseY = lerpKeyframes(sunPositions, km, "y");  // world Y at km=6 ≈ 240
  var baseRadius = lerpKeyframes(sunPositions, km, "r"); // ≈ 85

  // Sun rises in SCREEN SPACE: starts at its world position, moves toward screen center
  // During panSun phase, interpolate from base position to a higher screen position
  var sunTargetY = H * 0.32;  // target: upper-center of screen
  var riseT = 0;
  if (cutscenePhase === "panSun") {
    riseT = easeInOutCubic(Math.min(cutsceneTimer / PAN_SUN_FRAMES, 1));
  } else if (cutscenePhase === "whiteout" || cutscenePhase === "postWhite") {
    riseT = 1;
  }
  var sunY = lerp(sunBaseY, sunTargetY, riseT);

  var radius = baseRadius * cutsceneSunScale;

  var col = blendPalette(sunPalette, km);
  var ringCol = blendPalette(sunRingPalette, km);
  var centerCol = blendPalette(sunCenterPalette, km);

  // ---- Soft glow (scales with sun) ----
  var glow = ctx.createRadialGradient(sunX, sunY, radius * 0.3, sunX, sunY, radius * 2.5);
  glow.addColorStop(0, rgba(col, 0.35));
  glow.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ---- Radiating sun rays ----
  if (cutsceneSunScale > 1.2) {
    drawSunRays(sunX, sunY, radius);
  }

  // ---- Outer ring ----
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius + 14 * Math.min(cutsceneSunScale, 4), 0, Math.PI * 2);
  ctx.fillStyle = rgba(ringCol, 0.65);
  ctx.fill();

  // ---- Main disc ----
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fillStyle = rgb(col);
  ctx.fill();

  // ---- Bright center ----
  var inner = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius * 0.7);
  inner.addColorStop(0, rgba(centerCol, 0.7));
  inner.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.arc(sunX, sunY, radius, 0, Math.PI * 2);
  ctx.fill();
}


function drawSunRays(cx, cy, radius) {
  var numRays = 12;
  var rayLength = radius * 2.5;
  var rayWidth = 0.09;  // radians — thick rays

  // Rays fade in as sun grows
  var fadeIn = clamp((cutsceneSunScale - 1.2) / 2, 0, 1);
  var alpha = fadeIn * 0.45;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(cutsceneRayAngle);

  for (var i = 0; i < numRays; i++) {
    var angle = (i / numRays) * Math.PI * 2;

    ctx.save();
    ctx.rotate(angle);

    // Each ray is a tapered triangle from disc edge outward
    ctx.beginPath();
    ctx.moveTo(radius * 0.7, -Math.tan(rayWidth) * radius * 0.7);
    ctx.lineTo(radius + rayLength, 0);
    ctx.lineTo(radius * 0.7, Math.tan(rayWidth) * radius * 0.7);
    ctx.closePath();

    // Gradient along the ray: solid near sun, fades outward
    var rayGrad = ctx.createLinearGradient(radius * 0.7, 0, radius + rayLength, 0);
    rayGrad.addColorStop(0, "rgba(255, 203, 61, " + alpha + ")");        // brand yellow
    rayGrad.addColorStop(0.4, "rgba(255, 215, 90, " + (alpha * 0.7) + ")");
    rayGrad.addColorStop(1, "rgba(255, 235, 170, 0)");

    ctx.fillStyle = rayGrad;
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}


function drawBack34Sprite() {
  var img = sprites["back34"];
  var drawW = SPRITE_BACK34_W;
  var drawH = SPRITE_BACK34_H;
  var drawX = player.x + (PLAYER_W - drawW) / 2;
  var drawY = player.y - drawH + PLAYER_DRAW_Y_OFFSET;

  if (img && img._loaded) {
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
  } else {
    // Fallback yellow rectangle
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(player.x, player.y - PLAYER_H + PLAYER_DRAW_Y_OFFSET, PLAYER_W, PLAYER_H);
    ctx.strokeStyle = "#d4a830";
    ctx.lineWidth = 2;
    ctx.strokeRect(player.x, player.y - PLAYER_H + PLAYER_DRAW_Y_OFFSET, PLAYER_W, PLAYER_H);
  }
}


function draw() {
  ctx.clearRect(0, 0, W, H);

  if (state === "start")     { drawStartScreen(); return; }
  if (state === "countdown") { drawCountdown(); return; }
  if (state === "cutscene")  { drawCutscene(); return; }
  if (state === "end")       { drawEndScreen(); return; }

  // Gameplay draw
  var km = infiniteMode ? Math.min(elapsed * 0.3, 5) : distance;

  drawSky(km);
  drawSun(km);
  drawHills(km);
  drawGround(km);

  for (var i = 0; i < drops.length; i++) drawDrop(drops[i]);
  for (var i = 0; i < obstacles.length; i++) drawObstacle(obstacles[i]);

  drawJerryCan();

  if (!paused || state === "dying") updateAndDrawParticles();

  drawHUD();

  // Km flash
  var kmFloor = Math.floor(distance);
  var kmFrac  = distance - kmFloor;
  if (kmFloor > 0 && kmFrac < 0.02 && !infiniteMode) {
    ctx.fillStyle = "rgba(255,203,61,0.15)";
    ctx.fillRect(0, 0, W, H);
  }

  if (paused) drawPauseOverlay();
}


// ============================================================
// [INITIALIZATION]
// ============================================================
var gameLoopStarted = false;

function startGameLoop() {
  if (gameLoopStarted) return;
  gameLoopStarted = true;
  gameLoop();
}

loadSprites(function() {
  startGameLoop();
});

// Fallback: start even if sprites fail after 2 seconds
setTimeout(function() {
  if (!spritesLoaded) spritesLoaded = true;
  startGameLoop();
}, 2000);

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}


// ============================================================
// [FULLSCREEN BUTTON]
// ============================================================
(function() {
  var btn = document.getElementById("fullscreenBtn");
  var card = document.getElementById("gameCard");
  if (btn && card) {
    btn.addEventListener("click", function() {
      if (!document.fullscreenElement) {
        if (card.requestFullscreen) card.requestFullscreen();
        else if (card.webkitRequestFullscreen) card.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      }
    });
  }
})();


// ============================================================
// [ORIENTATION OVERLAY DISMISS]
// The overlay is shown/hidden entirely by CSS media queries.
// JS only handles the "Play Anyway" dismiss button.
// ============================================================
(function() {
  var overlay = document.getElementById("orientationOverlay");
  var dismissBtn = document.getElementById("orientationDismiss");

  if (dismissBtn && overlay) {
    dismissBtn.addEventListener("click", function() {
      overlay.classList.add("dismissed");
    });
  }
})();