// ============================================================
//  WATER WALK  –  charity:water Educational Side-Scroller
// ============================================================
//  CONTROLS:
//    Jump  →  W  /  ArrowUp  /  Space
//    Duck  →  S  /  ArrowDown
//    Mobile: Swipe Up = Jump, Swipe Down = Duck
//
//  CODE MAP  (Ctrl+F these labels to jump around):
//    [CANVAS SETUP]
//    [BRAND COLORS]
//    [GAME CONSTANTS]
//    [GAME STATE]
//    [INPUT HANDLING]
//    [SUNRISE SYSTEM]
//    [DRAWING HELPERS]
//    [JERRY CAN CHARACTER]
//    [WATER DROPS]
//    [OBSTACLES]
//    [SPAWNING SYSTEM]
//    [COLLISION DETECTION]
//    [HUD / UI]
//    [SCREENS]  (start, countdown, end)
//    [GAME LOOP]
//    [INITIALIZATION]
// ============================================================


// ============================================================
// [CANVAS SETUP]
// ============================================================
var canvas = document.getElementById("game");
var ctx    = canvas.getContext("2d");

// Fixed internal resolution — the canvas scales to fit the window
var W = 960;
var H = 540;
canvas.width  = W;
canvas.height = H;

// Resize canvas to fill window while keeping aspect ratio
function resizeCanvas() {
  var ratio = W / H;
  var winW  = window.innerWidth;
  var winH  = window.innerHeight;
  if (winW / winH > ratio) {
    canvas.style.height = winH + "px";
    canvas.style.width  = (winH * ratio) + "px";
  } else {
    canvas.style.width  = winW + "px";
    canvas.style.height = (winW / ratio) + "px";
  }
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();


// ============================================================
// [BRAND COLORS]  –  charity:water required palette
// ============================================================
var COLORS = {
  yellow:    "#ffcb3d",   // primary yellow
  blue:      "#0090d9",   // primary blue
  darkBlue:  "#1e3a5f",   // dark blue
  waterBlue: "#4db8e8",   // water drop color
  white:     "#ffffff",
  black:     "#000000"
};


// ============================================================
// [GAME CONSTANTS]  –  tuning knobs all in one place
// ============================================================

// -- Ground --
var GROUND_Y       = H - 60;        // y-position of the ground line
var GROUND_HEIGHT  = 60;             // thickness of ground strip

// -- Player (jerry can) --
var PLAYER_X       = 100;            // fixed horizontal position
var PLAYER_W       = 50;             // width of jerry can
var PLAYER_H       = 64;             // height of jerry can (standing)
var DUCK_H         = 36;             // height when ducking
var JUMP_VELOCITY  = -10;            // upward speed when jumping (negative = up)
var GRAVITY        = 0.65;           // pulls player down each frame
var DUCK_DURATION  = 30;             // frames to stay ducked (0.5 sec at 60fps)

// -- Water system --
var START_WATER    = 20;             // water points at game start
var MAX_WATER      = 100;            // water meter cap
var DROP_VALUE     = 1;              // points per water drop collected
var WIN_WATER      = 80;             // water needed for full win

// -- Damage by zone --
var DAMAGE_ZONE_1  = 10;             // 0–2 km
var DAMAGE_ZONE_2  = 15;             // 2–4 km
var DAMAGE_ZONE_3  = 20;             // 4–6 km

// -- Game timing --
var TOTAL_TIME     = 90;             // seconds to finish 6 km
var TOTAL_DISTANCE = 6;              // km

// -- Scroll speed (pixels/frame) --
var BASE_SPEED     = 7;              // starting scroll speed
var MAX_SPEED      = 14;              // ending scroll speed

// -- Invulnerability after hit --
var INVULN_FRAMES  = 60;             // 1 second of flashing

// -- Drop sizing --
var DROP_W         = 22;
var DROP_H         = 28;

// -- Obstacle sizing --
//    These are carefully tuned so the player can always jump over
//    ground obstacles and duck under wind gusts.
var ROCK_W         = 36;
var ROCK_H         = 36;
var CLUSTER_W      = 70;
var CLUSTER_H      = 40;
var WIND_W         = 80;
var WIND_H         = 40;
// Wind gust sits at this Y so the player can duck under it
// It hovers above the ground — player's duck height (36px) fits below it
var WIND_Y_OFFSET  = PLAYER_H + 15;  // how far above ground the bottom of wind sits


// ============================================================
// [GAME STATE]  –  all variables that change during play
// ============================================================
var state = "start";     // "start" | "countdown" | "playing" | "end" | "infinite"

var player = {};         // filled by resetGame()
var drops  = [];         // active water drops on screen
var obstacles = [];      // active obstacles on screen
var particles = [];      // visual particle effects

var water       = 0;     // current water points
var distance    = 0;     // km traveled
var elapsed     = 0;     // seconds elapsed
var scrollSpeed = 0;     // current speed in px/frame
var frameCount  = 0;     // total frames since gameplay started

// Countdown
var countdownTimer = 0;
var countdownNum   = 3;

// End screen
var endResult = "";      // "loss" | "partial" | "win"

// Infinite mode
var infiniteUnlocked = false;
var infiniteMode     = false;
var infiniteDistance  = 0;
var infiniteHighScore = 0;

// Spawn timers
var nextDropSpawn     = 0;
var nextObstacleSpawn = 0;

// Background
var hillOffset = 0;      // parallax scroll position for hills
var sunriseProgress = 0; // 0 to 1 (start to finish)


// ============================================================
// [INPUT HANDLING]
// ============================================================
var keys = {};  // tracks which keys are currently held down

// Keyboard
document.addEventListener("keydown", function(e) {
  keys[e.key] = true;

  // Start screen → begin game
  if (state === "start" && (e.key === " " || e.key === "Enter")) {
    startCountdown();
  }
  // End screen → replay
  if (state === "end") {
    if (e.key === "r" || e.key === "R") resetAndPlay();
    if (e.key === "i" || e.key === "I" && infiniteUnlocked) startInfinite();
  }
});
document.addEventListener("keyup", function(e) {
  keys[e.key] = false;
});

// Touch / swipe for mobile
var touchStartY = 0;
canvas.addEventListener("touchstart", function(e) {
  e.preventDefault();
  touchStartY = e.touches[0].clientY;

  if (state === "start") startCountdown();
}, { passive: false });

canvas.addEventListener("touchend", function(e) {
  e.preventDefault();
  var touchEndY = e.changedTouches[0].clientY;
  var diff = touchStartY - touchEndY;

  if (state === "playing" || state === "infinite") {
    if (diff > 30) tryJump();        // swipe up → jump
    if (diff < -30) tryDuck();       // swipe down → duck
  }
}, { passive: false });

// Mouse click on buttons (end screen)
canvas.addEventListener("click", function(e) {
  var rect = canvas.getBoundingClientRect();
  var scaleX = W / rect.width;
  var scaleY = H / rect.height;
  var mx = (e.clientX - rect.left) * scaleX;
  var my = (e.clientY - rect.top) * scaleY;

  if (state === "start") {
    // Check START button
    if (mx > W/2 - 100 && mx < W/2 + 100 && my > 340 && my < 390) {
      startCountdown();
    }
  }

  if (state === "end") {
    // PLAY AGAIN button
    if (mx > W/2 - 200 && mx < W/2 - 10 && my > 400 && my < 450) {
      resetAndPlay();
    }
    // INFINITE MODE button (if unlocked)
    if (infiniteUnlocked && mx > W/2 + 10 && mx < W/2 + 200 && my > 400 && my < 450) {
      startInfinite();
    }
  }
});

// Helper: attempt a jump
function tryJump() {
  if (player.onGround && !player.ducking) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
  }
}

// Helper: attempt a duck
function tryDuck() {
  if (player.onGround && !player.ducking) {
    player.ducking = true;
    player.duckTimer = DUCK_DURATION;
  }
}


// ============================================================
// [SUNRISE SYSTEM]  –  smooth color transitions over 6 km
// ============================================================
// Each keyframe has: distance (0–6), skyTop, skyBottom, hillColor, sunColor, sunRadius, sunY
var SUNRISE_KEYS = [
  { km: 0, skyTop: "#1a1a3e", skyBot: "#2d3561", hill: "#0f1428", sun: "#f4a460", sunR: 20, sunY: GROUND_Y - 10 },
  { km: 1, skyTop: "#2d3561", skyBot: "#d4895c", hill: "#1e3a5f", sun: "#f4a460", sunR: 35, sunY: GROUND_Y - 50 },
  { km: 3, skyTop: "#5a6fa8", skyBot: "#f4a460", hill: "#2d5f7f", sun: "#ffcb3d", sunR: 50, sunY: GROUND_Y - 120 },
  { km: 5, skyTop: "#87ceeb", skyBot: "#ffd700", hill: "#4a7ba7", sun: "#ffcb3d", sunR: 65, sunY: GROUND_Y - 200 },
  { km: 6, skyTop: "#ffffff", skyBot: "#ffffff", hill: "#ffffff", sun: "#ffffff", sunR: 80, sunY: GROUND_Y - 240 }
];

// Lerp (linear interpolation) between two numbers
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Lerp between two hex colors
function lerpColor(hex1, hex2, t) {
  // Convert hex to RGB
  var r1 = parseInt(hex1.slice(1,3), 16);
  var g1 = parseInt(hex1.slice(3,5), 16);
  var b1 = parseInt(hex1.slice(5,7), 16);
  var r2 = parseInt(hex2.slice(1,3), 16);
  var g2 = parseInt(hex2.slice(3,5), 16);
  var b2 = parseInt(hex2.slice(5,7), 16);
  // Blend
  var r = Math.round(lerp(r1, r2, t));
  var g = Math.round(lerp(g1, g2, t));
  var b = Math.round(lerp(b1, b2, t));
  return "rgb(" + r + "," + g + "," + b + ")";
}

// Get interpolated sunrise values for a given distance (0–6)
function getSunrise(km) {
  // Find the two keyframes we're between
  var i = 0;
  for (var j = 0; j < SUNRISE_KEYS.length - 1; j++) {
    if (km >= SUNRISE_KEYS[j].km) i = j;
  }
  var a = SUNRISE_KEYS[i];
  var b = SUNRISE_KEYS[Math.min(i + 1, SUNRISE_KEYS.length - 1)];
  // How far between keyframe a and b (0 to 1)
  var range = b.km - a.km;
  var t = range > 0 ? (km - a.km) / range : 1;
  t = Math.max(0, Math.min(1, t));  // clamp

  return {
    skyTop:  lerpColor(a.skyTop, b.skyTop, t),
    skyBot:  lerpColor(a.skyBot, b.skyBot, t),
    hill:    lerpColor(a.hill, b.hill, t),
    sun:     lerpColor(a.sun, b.sun, t),
    sunR:    lerp(a.sunR, b.sunR, t),
    sunY:    lerp(a.sunY, b.sunY, t)
  };
}


// ============================================================
// [DRAWING HELPERS]
// ============================================================

// Draw gradient sky
function drawSky(topColor, botColor) {
  var grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, botColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);
}

// Draw sun with glow
function drawSun(color, radius, y) {
  var x = W * 0.7;
  // Outer glow
  var glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 2);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
  ctx.fill();
  // Solid center
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// Draw parallax rolling hills (silhouette sine waves)
function drawHills(color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  for (var x = 0; x <= W; x += 4) {
    // Two overlapping sine waves for organic hill shape
    var y1 = Math.sin((x + hillOffset * 0.3) * 0.008) * 50;
    var y2 = Math.sin((x + hillOffset * 0.3) * 0.015 + 1) * 30;
    ctx.lineTo(x, GROUND_Y - 80 + y1 + y2);
  }
  ctx.lineTo(W, GROUND_Y);
  ctx.closePath();
  ctx.fill();
}

// Draw ground
function drawGround(hillColor) {
  // Ground is slightly darker than hills
  ctx.fillStyle = hillColor;
  ctx.fillRect(0, GROUND_Y, W, GROUND_HEIGHT);
  // Subtle line at ground top
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();
}


// ============================================================
// [JERRY CAN CHARACTER]  –  drawn to match mockup
// ============================================================
// The jerry can is a yellow rectangle with rounded corners,
// a handle on the back, a cap on top, eyes, a smile, and legs.

function drawJerryCan() {
  var p = player;
  var x = p.x;
  var h = p.ducking ? DUCK_H : PLAYER_H;
  var y = p.y - h;  // p.y is the BOTTOM of the character (feet)
  var w = PLAYER_W;

  // Invulnerability flash — skip drawing every other frame
  if (p.invulnTimer > 0 && Math.floor(p.invulnTimer / 4) % 2 === 0) {
    return;
  }

  ctx.save();

  // ---- WALKING ANIMATION: gentle side-to-side tilt ----
  if (p.onGround && !p.ducking) {
    var tilt = Math.sin(frameCount * 0.2) * 0.05;  // subtle wobble
    ctx.translate(x + w/2, y + h);
    ctx.rotate(tilt);
    ctx.translate(-(x + w/2), -(y + h));
  }

  // ---- STUMBLE ANIMATION ----
  if (p.stumbleTimer > 0) {
    var shake = Math.sin(p.stumbleTimer * 0.8) * 3;
    ctx.translate(shake, 0);
  }

  // ---- LEGS (two small rectangles, animated) ----
  var legW = 8;
  var legH = 12;
  var legY = y + h;  // legs start at bottom of body

  if (p.onGround && !p.ducking) {
    // Walking: legs alternate forward/back
    var legSwing = Math.sin(frameCount * 0.25) * 6;
    // Left leg
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x + 10 + legSwing, legY, legW, legH);
    // Right leg
    ctx.fillRect(x + w - 18 - legSwing, legY, legW, legH);
    // Feet (small dark shoes)
    ctx.fillStyle = "#c49a2a";
    ctx.fillRect(x + 10 + legSwing, legY + legH - 3, legW + 2, 3);
    ctx.fillRect(x + w - 18 - legSwing, legY + legH - 3, legW + 2, 3);
  } else if (!p.ducking) {
    // In air: legs together
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(x + 14, legY, legW, legH - 2);
    ctx.fillRect(x + w - 22, legY, legW, legH - 2);
  }

  // ---- BODY (main yellow rectangle with rounded corners) ----
  var bodyX = x;
  var bodyY = y;
  var bodyW = w;
  var bodyH = h;
  var radius = 6;

  ctx.fillStyle = COLORS.yellow;
  ctx.beginPath();
  ctx.moveTo(bodyX + radius, bodyY);
  ctx.lineTo(bodyX + bodyW - radius, bodyY);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY, bodyX + bodyW, bodyY + radius);
  ctx.lineTo(bodyX + bodyW, bodyY + bodyH - radius);
  ctx.quadraticCurveTo(bodyX + bodyW, bodyY + bodyH, bodyX + bodyW - radius, bodyY + bodyH);
  ctx.lineTo(bodyX + radius, bodyY + bodyH);
  ctx.quadraticCurveTo(bodyX, bodyY + bodyH, bodyX, bodyY + bodyH - radius);
  ctx.lineTo(bodyX, bodyY + radius);
  ctx.quadraticCurveTo(bodyX, bodyY, bodyX + radius, bodyY);
  ctx.closePath();
  ctx.fill();

  // Darker edge/outline
  ctx.strokeStyle = "#d4a830";
  ctx.lineWidth = 2;
  ctx.stroke();

  // ---- HANDLE (on the left/back side) ----
  if (!p.ducking) {
    ctx.strokeStyle = "#d4a830";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(bodyX - 2, bodyY + 12);
    ctx.quadraticCurveTo(bodyX - 14, bodyY + 12, bodyX - 14, bodyY + 28);
    ctx.quadraticCurveTo(bodyX - 14, bodyY + 44, bodyX - 2, bodyY + 44);
    ctx.stroke();
  }

  // ---- CAP (small rectangle on top) ----
  if (!p.ducking) {
    ctx.fillStyle = "#d4a830";
    ctx.fillRect(bodyX + bodyW/2 - 6, bodyY - 8, 12, 10);
    ctx.fillStyle = "#c49a2a";
    ctx.fillRect(bodyX + bodyW/2 - 8, bodyY - 8, 16, 4);
  }

  // ---- FACE ----
  if (!p.ducking) {
    // Eyes (white circles with black pupils)
    // Left eye
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(bodyX + 16, bodyY + 22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.beginPath();
    ctx.arc(bodyX + 18, bodyY + 22, 4, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(bodyX + 34, bodyY + 22, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.beginPath();
    ctx.arc(bodyX + 36, bodyY + 22, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile (curved line)
    ctx.strokeStyle = COLORS.black;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bodyX + 26, bodyY + 32, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  } else {
    // Ducking face: squished, eyes closer together
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(bodyX + 18, bodyY + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.beginPath();
    ctx.arc(bodyX + 20, bodyY + 12, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(bodyX + 34, bodyY + 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.black;
    ctx.beginPath();
    ctx.arc(bodyX + 36, bodyY + 12, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Flat mouth for ducking expression
    ctx.strokeStyle = COLORS.black;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bodyX + 18, bodyY + 22);
    ctx.lineTo(bodyX + 34, bodyY + 22);
    ctx.stroke();
  }

  ctx.restore();
}


// ============================================================
// [WATER DROPS]
// ============================================================

// Draw a single teardrop shape
function drawDrop(drop) {
  var x = drop.x + DROP_W / 2;
  // Gentle bobbing animation
  var bob = Math.sin(frameCount * 0.08 + drop.x * 0.1) * 4;
  var y = drop.y + bob;

  ctx.fillStyle = COLORS.waterBlue;
  ctx.beginPath();
  // Teardrop: pointy top, round bottom
  ctx.moveTo(x, y - DROP_H / 2);                          // top point
  ctx.quadraticCurveTo(x + DROP_W / 2, y, x + DROP_W / 2, y + DROP_H / 4);
  ctx.arc(x, y + DROP_H / 4, DROP_W / 2, 0, Math.PI, false);
  ctx.quadraticCurveTo(x - DROP_W / 2, y, x, y - DROP_H / 2);
  ctx.closePath();
  ctx.fill();

  // Small white highlight (shine)
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(x - 3, y - 2, 3, 0, Math.PI * 2);
  ctx.fill();
}

// Get drop hitbox (for collision)
function getDropBox(drop) {
  var bob = Math.sin(frameCount * 0.08 + drop.x * 0.1) * 4;
  return {
    x: drop.x,
    y: drop.y + bob - DROP_H / 2,
    w: DROP_W,
    h: DROP_H
  };
}


// ============================================================
// [OBSTACLES]
// ============================================================

// Draw obstacle based on type
function drawObstacle(obs) {
  if (obs.type === "rock") {
    drawRock(obs);
  } else if (obs.type === "cluster") {
    drawCluster(obs);
  } else if (obs.type === "wind") {
    drawWind(obs);
  }
}

// ROCK: single triangular spike, tan colored
function drawRock(obs) {
  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.moveTo(obs.x + ROCK_W / 2, obs.y - ROCK_H);  // tip
  ctx.lineTo(obs.x + ROCK_W, obs.y);                 // bottom right
  ctx.lineTo(obs.x, obs.y);                           // bottom left
  ctx.closePath();
  ctx.fill();
  // Darker outline
  ctx.strokeStyle = "#8a6d4a";
  ctx.lineWidth = 2;
  ctx.stroke();
}

// CLUSTER: multiple triangle rocks side by side
function drawCluster(obs) {
  ctx.fillStyle = "#b8956a";
  // Left rock
  ctx.beginPath();
  ctx.moveTo(obs.x + 15, obs.y - CLUSTER_H);
  ctx.lineTo(obs.x + 30, obs.y);
  ctx.lineTo(obs.x, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#8a6d4a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Middle rock (tallest)
  ctx.fillStyle = "#a3845e";
  ctx.beginPath();
  ctx.moveTo(obs.x + 38, obs.y - CLUSTER_H - 8);
  ctx.lineTo(obs.x + 55, obs.y);
  ctx.lineTo(obs.x + 20, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Right rock
  ctx.fillStyle = "#b8956a";
  ctx.beginPath();
  ctx.moveTo(obs.x + 58, obs.y - CLUSTER_H + 5);
  ctx.lineTo(obs.x + CLUSTER_W, obs.y);
  ctx.lineTo(obs.x + 45, obs.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// WIND: swirling swoosh lines (must duck under)
function drawWind(obs) {
  ctx.strokeStyle = "rgba(200, 210, 220, 0.6)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  // Animate the wind sway
  var sway = Math.sin(frameCount * 0.1 + obs.x * 0.05) * 3;

  // Three swoosh curves at different heights
  for (var i = 0; i < 3; i++) {
    var yOff = i * 12 + sway;
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y + yOff);
    ctx.quadraticCurveTo(obs.x + 20, obs.y + yOff - 8, obs.x + 35, obs.y + yOff);
    ctx.quadraticCurveTo(obs.x + 50, obs.y + yOff + 8, obs.x + WIND_W, obs.y + yOff);
    ctx.stroke();

    // Small spiral at the end of each line
    ctx.beginPath();
    ctx.arc(obs.x + WIND_W - 5, obs.y + yOff + 2, 5, 0, Math.PI * 1.3);
    ctx.stroke();
  }
}

// Get obstacle hitbox (for collision)
// IMPORTANT: hitboxes are slightly smaller than visuals (forgiving)
function getObsBox(obs) {
  if (obs.type === "rock") {
    // Shrink hitbox: triangle is narrower than its bounding box
    return {
      x: obs.x + 6,
      y: obs.y - ROCK_H + 6,
      w: ROCK_W - 12,
      h: ROCK_H - 6
    };
  }
  if (obs.type === "cluster") {
    return {
      x: obs.x + 5,
      y: obs.y - CLUSTER_H,
      w: CLUSTER_W - 10,
      h: CLUSTER_H
    };
  }
  if (obs.type === "wind") {
    return {
      x: obs.x + 5,
      y: obs.y,
      w: WIND_W - 10,
      h: WIND_H - 8
    };
  }
}


// ============================================================
// [SPAWNING SYSTEM]
// ============================================================

// Spawn a group of water drops
function spawnDropGroup() {
  // Number of drops in this group (1 to 4)
  var count = 1 + Math.floor(Math.random() * 4);

  // Height level: 0 = ground, 1 = mid, 2 = high
  var level = Math.random();
  var baseY;
  if (level < 0.4) {
    baseY = GROUND_Y - 20;                      // ground level — walk into them
  } else if (level < 0.75) {
    baseY = GROUND_Y - PLAYER_H - 10;           // mid height — easy jump
  } else {
    baseY = GROUND_Y - PLAYER_H - 50;           // high — well-timed jump
  }

  for (var i = 0; i < count; i++) {
    drops.push({
      x: W + i * 40,       // spaced 40px apart
      y: baseY
    });
  }
}

// Spawn a single obstacle
function spawnObstacle() {
  // Pick a random type
  var types = ["rock", "cluster", "wind"];
  var type = types[Math.floor(Math.random() * types.length)];

  var obs = { type: type, x: W + 20 };

  if (type === "rock") {
    obs.y = GROUND_Y;  // sits on ground
  } else if (type === "cluster") {
    obs.y = GROUND_Y;  // sits on ground
  } else if (type === "wind") {
    // Wind floats above the ground.
    // The player stands PLAYER_H tall (64px) from GROUND_Y.
    // When ducking, the player is only DUCK_H (36px) tall.
    // So wind bottom must be above DUCK_H from ground.
    obs.y = GROUND_Y - WIND_Y_OFFSET;
  }

  obstacles.push(obs);
}

// Decide when to spawn things based on distance
function updateSpawning() {
  frameCount++;

  // Calculate spawn intervals based on difficulty
  // Drops spawn more often than obstacles
  var dropInterval, obsInterval;
  if (distance < 1) {
    dropInterval = 50;     // tutorial: generous drops
    obsInterval  = 80;    // tutorial: rare obstacles
  } else if (distance < 1) {
    dropInterval = 45;
    obsInterval  = 60;
  } else if (distance < 4) {
    dropInterval = 40;
    obsInterval  = 40;
  } else {
    dropInterval = 35;
    obsInterval  = 30;     // hard: frequent obstacles
  }

  // Countdown-based spawning
  nextDropSpawn--;
  nextObstacleSpawn--;

  if (nextDropSpawn <= 0) {
    spawnDropGroup();
    nextDropSpawn = dropInterval + Math.floor(Math.random() * 20);
  }

  // First obstacle delayed ~3 seconds
  if (nextObstacleSpawn <= 0 && frameCount > 180) {
    spawnObstacle();
    nextObstacleSpawn = obsInterval + Math.floor(Math.random() * 30);

    // Sometimes spawn drops near obstacles to encourage risk
    if (Math.random() < 0.35) {
      var lastObs = obstacles[obstacles.length - 1];
      var riskY;
      if (lastObs.type === "wind") {
        // Drops ON the ground near wind — reward ducking
        riskY = GROUND_Y - 20;
      } else {
        // Drops in air near ground obstacles — reward jumping
        riskY = GROUND_Y - PLAYER_H - 20;
      }
      drops.push({ x: lastObs.x + 10, y: riskY });
      drops.push({ x: lastObs.x + 40, y: riskY });
    }
  }
}


// ============================================================
// [COLLISION DETECTION]  –  simple AABB (box vs box)
// ============================================================

// Check if two rectangles overlap
function boxOverlap(a, b) {
  return a.x < b.x + b.w &&
         a.x + a.w > b.x &&
         a.y < b.y + b.h &&
         a.y + a.h > b.y;
}

// Get player hitbox
function getPlayerBox() {
  var h = player.ducking ? DUCK_H : PLAYER_H;
  return {
    x: player.x + 6,           // slight inset for forgiveness
    y: player.y - h + 4,
    w: PLAYER_W - 12,
    h: h - 8
  };
}


// ============================================================
// [PARTICLES]  –  simple visual effects
// ============================================================

function spawnParticles(x, y, color, count) {
  for (var i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
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
    p.vy += 0.15;   // gravity on particles
    p.life--;

    // Draw
    var alpha = p.life / 30;
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Remove dead particles
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}


// ============================================================
// [HUD / UI]  –  water meter, distance tracker, score
// ============================================================

function drawHUD() {
  // ---- WATER METER (top-left) ----
  var meterX = 50;
  var meterY = 25;
  var meterW = 200;
  var meterH = 22;

  // Water drop icon to the left
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

  // ---- SCORE label ----
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "left";
  ctx.fillText("SCORE: " + Math.floor(water), 28, meterY + meterH + 22);

  // ---- DISTANCE TRACKER (top-right) ----
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "right";
  var distText = distance.toFixed(2) + " km / " + TOTAL_DISTANCE + " km";
  ctx.fillText("DISTANCE: " + distText, W - 20, 42);

  // ---- CONTROLS HINT (first 3 seconds) ----
  if (frameCount < 180 && !infiniteMode) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("W / ↑  to JUMP    •    S / ↓  to DUCK", W / 2, GROUND_Y - 20);
  }
}


// ============================================================
// [SCREENS]  –  start, countdown, and end screens
// ============================================================

function drawStartScreen() {
  // Background
  var sunrise = getSunrise(0);
  drawSky(sunrise.skyTop, sunrise.skyBot);
  drawSun(sunrise.sun, sunrise.sunR, sunrise.sunY);
  drawHills(sunrise.hill);
  drawGround(sunrise.hill);

  // Overlay
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("WATER WALK", W/2, 160);

  // Subtitle
  ctx.fillStyle = COLORS.white;
  ctx.font = "18px sans-serif";
  ctx.fillText("Guide a jerry can 6km to collect clean water.", W/2, 210);
  ctx.fillText("A charity:water awareness game.", W/2, 235);

  // Controls
  ctx.fillStyle = COLORS.waterBlue;
  ctx.font = "bold 16px monospace";
  ctx.fillText("W / ↑ / Space  =  JUMP", W/2, 280);
  ctx.fillText("S / ↓  =  DUCK", W/2, 305);

  // Start button
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(W/2 - 100, 340, 200, 50);
  ctx.fillStyle = COLORS.darkBlue;
  ctx.font = "bold 22px sans-serif";
  ctx.fillText("START GAME", W/2, 372);

  // Mobile hint
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "14px sans-serif";
  ctx.fillText("Mobile: Swipe Up = Jump, Swipe Down = Duck", W/2, 420);
}

function drawCountdown() {
  // Draw the game background behind the number
  var sunrise = getSunrise(0);
  drawSky(sunrise.skyTop, sunrise.skyBot);
  drawSun(sunrise.sun, sunrise.sunR, sunrise.sunY);
  drawHills(sunrise.hill);
  drawGround(sunrise.hill);

  // Big countdown number
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 120px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(countdownNum, W/2, H/2 + 30);
}

function drawEndScreen() {
  // Background — use final sunrise state
  var km = infiniteMode ? 3 : TOTAL_DISTANCE;
  var sunrise = getSunrise(Math.min(km, TOTAL_DISTANCE));
  drawSky(sunrise.skyTop, sunrise.skyBot);
  drawSun(sunrise.sun, sunrise.sunR, sunrise.sunY);
  drawHills(sunrise.hill);
  drawGround(sunrise.hill);

  // Overlay
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  if (infiniteMode) {
    // Infinite mode end screen
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("INFINITE MODE", W/2, 100);

    ctx.fillStyle = COLORS.white;
    ctx.font = "24px sans-serif";
    ctx.fillText("Distance: " + infiniteDistance.toFixed(2) + " km", W/2, 160);

    ctx.fillStyle = COLORS.waterBlue;
    ctx.font = "20px sans-serif";
    ctx.fillText("High Score: " + infiniteHighScore.toFixed(2) + " km", W/2, 200);

    // Play Again button
    ctx.fillStyle = COLORS.yellow;
    ctx.fillRect(W/2 - 100, 400, 200, 50);
    ctx.fillStyle = COLORS.darkBlue;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("PLAY AGAIN (R)", W/2, 432);
    return;
  }

  // Standard end screen
  if (endResult === "loss") {
    ctx.fillStyle = "#ff6b6b";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("OUT OF WATER!", W/2, 90);

    ctx.fillStyle = COLORS.white;
    ctx.font = "20px sans-serif";
    ctx.fillText("Distance traveled: " + distance.toFixed(2) + " km", W/2, 150);
    ctx.fillText("Water collected: " + Math.floor(water), W/2, 180);

    // Only Play Again
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

    ctx.fillText("Distance: ✓  6 km", W/2, 170);
    ctx.fillStyle = "#ff6b6b";
    ctx.fillText("Water Goal: ✗  (" + Math.floor(water) + " / " + WIN_WATER + ")", W/2, 200);

    // Educational facts
    drawEducationalFacts(240);
    drawEndButtons();

  } else if (endResult === "win") {
    ctx.fillStyle = COLORS.yellow;
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("MISSION COMPLETE! 🎉", W/2, 80);

    ctx.fillStyle = COLORS.white;
    ctx.font = "20px sans-serif";
    ctx.fillText("Distance: ✓  6 km", W/2, 135);
    ctx.fillStyle = "#5ddb6d";
    ctx.fillText("Water Goal: ✓  (" + Math.floor(water) + " / " + WIN_WATER + ")", W/2, 165);

    // Educational facts
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

  // charity:water link
  ctx.fillStyle = COLORS.yellow;
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("Learn more: charitywater.org", W/2, startY + 85);
}

function drawEndButtons() {
  // Play Again button (left)
  ctx.fillStyle = COLORS.yellow;
  ctx.fillRect(W/2 - 200, 400, 185, 50);
  ctx.fillStyle = COLORS.darkBlue;
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PLAY AGAIN (R)", W/2 - 108, 432);

  // Infinite Mode button (right)
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
    x: PLAYER_X,
    y: GROUND_Y,       // y = bottom of character (feet on ground)
    vy: 0,
    onGround: true,
    ducking: false,
    duckTimer: 0,
    invulnTimer: 0,
    stumbleTimer: 0
  };
  drops = [];
  obstacles = [];
  particles = [];
  water = START_WATER;
  distance = 0;
  elapsed = 0;
  scrollSpeed = BASE_SPEED;
  frameCount = 0;
  nextDropSpawn = 30;       // first drops appear quickly
  nextObstacleSpawn = 180;  // first obstacle after ~3 sec
  hillOffset = 0;
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
  // ---- COUNTDOWN STATE ----
  if (state === "countdown") {
    countdownTimer++;
    if (countdownTimer >= 60) {     // 1 second per number
      countdownTimer = 0;
      countdownNum--;
      if (countdownNum <= 0) {
        state = infiniteMode ? "infinite" : "playing";
      }
    }
    return;
  }

  // ---- END STATE ----
  if (state !== "playing" && state !== "infinite") return;

  // ---- INPUT ----
  if (keys["w"] || keys["W"] || keys["ArrowUp"] || keys[" "]) tryJump();
  if (keys["s"] || keys["S"] || keys["ArrowDown"]) tryDuck();

  // ---- SPEED & DISTANCE ----
  if (!infiniteMode) {
    // Normal mode: speed ramps up over 90 seconds
    var progress = Math.min(elapsed / TOTAL_TIME, 1);
    scrollSpeed = BASE_SPEED + (MAX_SPEED - BASE_SPEED) * progress;
    elapsed += 1 / 60;
    distance = progress * TOTAL_DISTANCE;
  } else {
    // Infinite mode: speed never stops increasing
    scrollSpeed = BASE_SPEED + elapsed * 0.05;
    elapsed += 1 / 60;
    infiniteDistance = elapsed * (scrollSpeed / 60);
  }

  // ---- PLAYER PHYSICS ----
  // Gravity
  if (!player.onGround) {
    player.vy += GRAVITY;
    player.y += player.vy;

    // Land on ground
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Duck timer
  if (player.ducking) {
    player.duckTimer--;
    if (player.duckTimer <= 0) {
      player.ducking = false;
    }
  }

  // Invulnerability timer
  if (player.invulnTimer > 0) player.invulnTimer--;

  // Stumble timer
  if (player.stumbleTimer > 0) player.stumbleTimer--;

  // ---- PARALLAX ----
  hillOffset += scrollSpeed;

  // ---- SPAWNING ----
  updateSpawning();

  // ---- MOVE DROPS ----
  for (var i = drops.length - 1; i >= 0; i--) {
    drops[i].x -= scrollSpeed;
    if (drops[i].x < -50) drops.splice(i, 1);  // off-screen cleanup
  }

  // ---- MOVE OBSTACLES ----
  for (var i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= scrollSpeed;
    if (obstacles[i].x < -100) obstacles.splice(i, 1);
  }

  // ---- COLLISION: Player vs Drops ----
  var pBox = getPlayerBox();
  for (var i = drops.length - 1; i >= 0; i--) {
    var dBox = getDropBox(drops[i]);
    if (boxOverlap(pBox, dBox)) {
      water = Math.min(water + DROP_VALUE, MAX_WATER);
      spawnParticles(drops[i].x + DROP_W/2, drops[i].y, COLORS.waterBlue, 8);
      drops.splice(i, 1);
    }
  }

  // ---- COLLISION: Player vs Obstacles ----
  if (player.invulnTimer <= 0) {
    for (var i = 0; i < obstacles.length; i++) {
      var oBox = getObsBox(obstacles[i]);
      if (boxOverlap(pBox, oBox)) {
        // HIT!
        if (infiniteMode) {
          // Infinite mode: one hit = game over
          infiniteHighScore = Math.max(infiniteHighScore, infiniteDistance);
          endResult = "infinite";
          state = "end";
          return;
        }

        // Normal mode: lose water
        var dmg = DAMAGE_ZONE_1;
        if (distance >= 4) dmg = DAMAGE_ZONE_3;
        else if (distance >= 2) dmg = DAMAGE_ZONE_2;

        water -= dmg;
        player.invulnTimer = INVULN_FRAMES;
        player.stumbleTimer = 20;
        spawnParticles(player.x + PLAYER_W/2, player.y - PLAYER_H/2, "#ff6b6b", 10);

        // Check for loss
        if (water <= 0 && distance >= 0.5) {
          water = 0;
          endResult = "loss";
          state = "end";
          return;
        }
        water = Math.max(0, water);
        break;  // only one hit per frame
      }
    }
  }

  // ---- WIN CHECK ----
  if (!infiniteMode && distance >= TOTAL_DISTANCE) {
    infiniteUnlocked = true;
    if (water >= WIN_WATER) {
      endResult = "win";
    } else {
      endResult = "partial";
    }
    state = "end";
  }
}

function draw() {
  // Clear
  ctx.clearRect(0, 0, W, H);

  if (state === "start") {
    drawStartScreen();
    return;
  }

  if (state === "countdown") {
    drawCountdown();
    return;
  }

  if (state === "end") {
    drawEndScreen();
    return;
  }

  // ---- GAMEPLAY DRAW ----
  var km = infiniteMode ? Math.min(elapsed * 0.3, 5) : distance;
  var sunrise = getSunrise(km);

  // Sky
  drawSky(sunrise.skyTop, sunrise.skyBot);

  // Sun
  drawSun(sunrise.sun, sunrise.sunR, sunrise.sunY);

  // Hills (parallax behind everything)
  drawHills(sunrise.hill);

  // Ground
  drawGround(sunrise.hill);

  // Water drops
  for (var i = 0; i < drops.length; i++) {
    drawDrop(drops[i]);
  }

  // Obstacles
  for (var i = 0; i < obstacles.length; i++) {
    drawObstacle(obstacles[i]);
  }

  // Player
  drawJerryCan();

  // Particles (on top of everything)
  updateAndDrawParticles();

  // HUD
  drawHUD();

  // ---- MILESTONE FLASH (every km) ----
  var kmFloor = Math.floor(distance);
  var kmFrac  = distance - kmFloor;
  if (kmFloor > 0 && kmFrac < 0.02 && !infiniteMode) {
    ctx.fillStyle = "rgba(255,203,61,0.15)";
    ctx.fillRect(0, 0, W, H);
  }
}


// ============================================================
// [INITIALIZATION]  –  the main loop starts here
// ============================================================

// Main game loop — runs at ~60 FPS
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// Start everything
gameLoop();