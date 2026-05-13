const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const comboEl = document.getElementById("combo");
const meterEl = document.getElementById("meterFill");
const messageEl = document.getElementById("message");
const powerupsEl = document.getElementById("powerups");
const startBtn = document.getElementById("start");
const restartBtn = document.getElementById("restart");

const fruits = [
  { name: "watermelon", color: "#2eb45c", deep: "#176c3f", flesh: "#f43d46", juice: "#ff304c", points: 12 },
  { name: "mango", color: "#ffb23b", deep: "#d9781e", flesh: "#ffd65d", juice: "#ffc52d", points: 10 },
  { name: "kiwi", color: "#8a5a2b", deep: "#573316", flesh: "#9ee05b", juice: "#b9ff62", points: 11 },
  { name: "dragon", color: "#fa3f96", deep: "#a82068", flesh: "#f4fbff", juice: "#ff4aa9", points: 14 },
  { name: "pineapple", color: "#f4b21d", deep: "#a56f14", flesh: "#ffd45d", juice: "#ffca35", points: 13 },
  { name: "plum", color: "#7340cf", deep: "#3a207d", flesh: "#bb89ff", juice: "#b56fff", points: 12 },
];

const spriteFruitNames = ["watermelon", "mango", "kiwi", "dragon", "pineapple", "plum"];
const spriteFruitAssets = Object.fromEntries(
  spriteFruitNames.map((name) => [
    name,
    Object.fromEntries(
      ["full", "left", "right", "splash"].map((state) => {
        const image = new Image();
        image.src = `./assets/fruits/${name}-${state}.png`;
        return [state, image];
      })
    ),
  ])
);

const powerFruit = {
  freeze: {
    label: "冰冻",
    caption: "时间暂停",
    color: "#70efff",
    flesh: "#dffcff",
    juice: "#91f7ff",
    points: 8,
    duration: 4.5,
  },
  double: {
    label: "双倍",
    caption: "积分加成",
    color: "#ffd84f",
    flesh: "#fff3a6",
    juice: "#ffe26d",
    points: 8,
    duration: 8,
  },
  frenzy: {
    label: "爆发",
    caption: "水果雨",
    color: "#ff6a6a",
    flesh: "#ffd0a8",
    juice: "#ff6f55",
    points: 8,
    duration: 6,
  },
};

let width = 0;
let height = 0;
let dpr = 1;
let objects = [];
let particles = [];
let slash = [];
let score = 0;
let best = Number(localStorage.getItem("neonFruitBest") || 0);
let lives = 3;
let combo = 1;
let comboEnergy = 0;
let running = false;
let lastTime = performance.now();
let timeLeft = 45;
let spawnTimer = 0;
let powerSpawnTimer = 5;
let pointerDown = false;
let lastPointer = null;
let nextId = 0;
let powers = { freeze: 0, double: 0, frenzy: 0 };

function resize() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = rect.width;
  height = rect.height;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function reset() {
  objects = [];
  particles = [];
  slash = [];
  score = 0;
  lives = 3;
  combo = 1;
  comboEnergy = 0;
  timeLeft = 45;
  spawnTimer = 0.25;
  powerSpawnTimer = 4.5;
  powers = { freeze: 0, double: 0, frenzy: 0 };
  running = true;
  messageEl.classList.add("hidden");
  updateHud();
}

function endGame(title = "时间到") {
  running = false;
  best = Math.max(best, score);
  localStorage.setItem("neonFruitBest", best);
  messageEl.querySelector("strong").textContent = title;
  messageEl.querySelector("span").textContent = `得分 ${score}，最佳 ${best}`;
  startBtn.textContent = "再来一局";
  messageEl.classList.remove("hidden");
  updateHud();
}

function updateHud() {
  scoreEl.textContent = score.toLocaleString("zh-CN");
  bestEl.textContent = `BEST ${best.toLocaleString("zh-CN")}`;
  timeEl.textContent = `0:${Math.max(0, Math.ceil(timeLeft)).toString().padStart(2, "0")}`;
  comboEl.textContent = `x${combo}`;
  meterEl.style.width = `${Math.min(100, comboEnergy)}%`;
  [...livesEl.children].forEach((heart, index) => heart.classList.toggle("lost", index >= lives));

  const active = Object.entries(powers).filter(([, value]) => value > 0);
  powerupsEl.innerHTML = active
    .map(([key, value]) => {
      const power = powerFruit[key];
      return `<div class="powerup ${key}"><i></i><b>${power.label}</b><small>${power.caption} ${value.toFixed(1)}s</small></div>`;
    })
    .join("");
}

function spawnObject(forceType = null) {
  const isFrenzy = powers.frenzy > 0;
  const isBomb = !forceType && !isFrenzy && Math.random() < Math.min(0.18, 0.07 + score / 5200);
  const fruit = fruits[Math.floor(Math.random() * fruits.length)];
  const radius = 29 + Math.random() * 18;
  const x = 52 + Math.random() * (width - 104);
  const kind = forceType || (isBomb ? "bomb" : "fruit");
  const powerKey = Object.keys(powerFruit)[Math.floor(Math.random() * 3)];
  const power = kind === "power" ? powerFruit[powerKey] : null;
  const apex = height * (0.18 + Math.random() * 0.22);
  const gravity = 560 + Math.random() * 150 + radius * 1.4;
  const launchSpeed = Math.sqrt(Math.max(1, 2 * gravity * (height + radius + 30 - apex)));
  const sideBias = (width / 2 - x) * (0.36 + Math.random() * 0.22);
  const vx = sideBias + (Math.random() - 0.5) * 120;

  objects.push({
    id: `object-${nextId++}`,
    kind,
    powerKey,
    type: power ? powerKey : isBomb ? "bomb" : fruit.name,
    fruit: power || fruit,
    x,
    y: height + radius + 30,
    vx,
    vy: -launchSpeed - (isFrenzy ? 45 : 0),
    gravity,
    drag: 0.985 + Math.random() * 0.01,
    driftPhase: Math.random() * Math.PI * 2,
    driftSpeed: 1.3 + Math.random() * 1.2,
    driftStrength: 14 + Math.random() * 22,
    radius: isBomb ? radius * 0.92 : kind === "power" ? radius * 0.86 : radius,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 3.8,
    sliced: false,
    missed: false,
    shimmer: Math.random() * Math.PI * 2,
  });
}

function update(dt) {
  if (!running) return;
  const clockDt = powers.freeze > 0 ? 0 : dt;
  timeLeft -= clockDt;
  spawnTimer -= dt;
  powerSpawnTimer -= dt;
  Object.keys(powers).forEach((key) => {
    powers[key] = Math.max(0, powers[key] - dt);
  });
  comboEnergy = Math.max(0, comboEnergy - dt * 17);
  combo = 1 + Math.floor(comboEnergy / 28);

  if (spawnTimer <= 0) {
    spawnObject();
    if (score > 80 && Math.random() < (powers.frenzy > 0 ? 0.82 : 0.3)) spawnObject();
    if (powers.frenzy > 0 && Math.random() < 0.5) spawnObject();
    spawnTimer = powers.frenzy > 0 ? 0.22 + Math.random() * 0.16 : Math.max(0.56, 1.1 - score / 9800);
  }

  if (powerSpawnTimer <= 0 && objects.filter((object) => object.kind === "power").length < 1) {
    spawnObject("power");
    powerSpawnTimer = 8.5 + Math.random() * 5.5;
  }

  for (const object of objects) {
    const motionScale = powers.freeze > 0 && object.kind !== "power" ? 0.58 : 1;
    const easedDt = dt * motionScale;
    const gravityScale = powers.freeze > 0 && object.kind !== "power" ? 0.56 : 1;
    const drag = Math.pow(object.drag, dt * 60);
    object.driftPhase += object.driftSpeed * easedDt;
    object.vx = object.vx * drag + Math.sin(object.driftPhase) * object.driftStrength * easedDt;
    object.vy += object.gravity * gravityScale * easedDt;
    object.x += object.vx * easedDt;
    object.y += object.vy * easedDt;
    object.rotation += object.spin * easedDt;
    object.shimmer += dt * 5;
    if (!object.missed && !object.sliced && object.kind === "fruit" && object.vy > 0 && object.y > height + object.radius + 160) {
      object.missed = true;
      lives -= 1;
      comboEnergy = 0;
      burst(object.x, height - 80, "#68e8ff", 8, 4);
      if (lives <= 0) endGame("失手了");
    }
  }

  objects = objects.filter((object) => object.y < height + 145 && !object.sliced);
  particles = particles.filter((particle) => particle.life > 0);
  for (const particle of particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += (particle.float ? 60 : 420) * dt;
    particle.rotation = (particle.rotation || 0) + (particle.spin || 0) * dt;
  }
  slash = slash.filter((point) => performance.now() - point.t < 220);

  if (timeLeft <= 0) endGame();
  updateHud();
}

function burst(x, y, color, count = 24, force = 1, float = false) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (140 + Math.random() * 360) * force;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 7,
      color,
      life: 0.35 + Math.random() * 0.55,
      float,
      spin: (Math.random() - 0.5) * 8,
    });
  }
}

function addFloatingText(x, y, text) {
  particles.push({
    x,
    y,
    vx: 0,
    vy: -72,
    size: 26,
    color: "#fff7ba",
    text,
    life: 0.95,
    fadeDuration: 0.95,
    float: true,
  });
}

function cutAt(x, y, previous) {
  let fruitHits = 0;
  let hitCenterX = 0;
  let hitCenterY = 0;

  for (const object of objects) {
    if (object.sliced) continue;
    const hit = distanceToSegment({ x: object.x, y: object.y }, previous || { x, y }, { x, y }) < object.radius + 10;
    if (!hit) continue;

    object.sliced = true;
    if (object.kind === "bomb") {
      lives = 0;
      burst(object.x, object.y, "#ff3a35", 42, 1.7);
      endGame("炸弹命中");
      return;
    }

    if (object.kind === "power") {
      activatePower(object.powerKey);
      score += powerFruit[object.powerKey].points * combo * (powers.double > 0 ? 2 : 1);
      comboEnergy = Math.min(100, comboEnergy + 24);
      burst(object.x, object.y, object.fruit.juice, 42, 1.25, true);
      createHalves(object);
      continue;
    }

    score += object.fruit.points * combo * (powers.double > 0 ? 2 : 1);
    comboEnergy = Math.min(100, comboEnergy + 18);
    fruitHits += 1;
    hitCenterX += object.x;
    hitCenterY += object.y;
    burst(object.x, object.y, object.fruit.juice, 30, 1);
    createHalves(object);
  }

  if (fruitHits >= 3) {
    const doubleScale = powers.double > 0 ? 2 : 1;
    const bonus = fruitHits * 12 * combo * doubleScale;
    score += bonus;
    comboEnergy = Math.min(100, comboEnergy + fruitHits * 8);
    addFloatingText(hitCenterX / fruitHits, hitCenterY / fruitHits - 28, `${fruitHits}连切 +${bonus}`);
  }
}

function activatePower(key) {
  powers[key] = powerFruit[key].duration;
  if (key === "frenzy") {
    spawnTimer = 0.05;
    for (let i = 0; i < 4; i += 1) spawnObject("fruit");
  }
  if (key === "freeze") timeLeft = Math.min(60, timeLeft + 0.25);
}

function createHalves(object) {
  if (hasSpriteFruit(object.type)) {
    addSpriteSliceParticles(object);
    return;
  }

  for (const side of [-1, 1]) {
    particles.push({
      x: object.x + side * 7,
      y: object.y,
      vx: side * (145 + Math.random() * 95),
      vy: -140 - Math.random() * 130,
      size: object.radius * 1.25,
      color: object.fruit.flesh,
      fruitHalf: object,
      side,
      life: 0.78,
      spin: side * (4 + Math.random() * 2),
    });
  }
}

function hasSpriteFruit(type) {
  const assets = spriteFruitAssets[type];
  return Boolean(assets && assets.full.complete && assets.full.naturalWidth > 0);
}

function addSpriteSliceParticles(object) {
  for (const side of [-1, 1]) {
    particles.push({
      x: object.x + side * 9,
      y: object.y,
      vx: side * (150 + Math.random() * 95),
      vy: -150 - Math.random() * 140,
      spriteFruit: object.type,
      spriteState: side < 0 ? "left" : "right",
      targetSize: object.radius * 2.3,
      side,
      life: 0.86,
      spin: side * (3.4 + Math.random() * 1.8),
    });
  }

  particles.push({
    x: object.x,
    y: object.y,
    vx: (Math.random() - 0.5) * 40,
    vy: -40,
    spriteFruit: object.type,
    spriteState: "splash",
    targetSize: object.radius * 2.75,
    life: 0.44,
    float: true,
    spin: (Math.random() - 0.5) * 1.2,
  });
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(point.x - px, point.y - py);
}

function render() {
  drawBackground();
  for (const object of objects) drawObject(object);
  for (const particle of particles) drawParticle(particle);
  drawPowerOverlay();
  drawSlash();
}

function drawBackground() {
  const wall = ctx.createLinearGradient(0, 0, width, height);
  wall.addColorStop(0, "#d9f0f6");
  wall.addColorStop(0.45, "#acd6e2");
  wall.addColorStop(1, "#7fb8c9");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, width, height);

  const plankW = Math.max(72, width / 5.2);
  for (let x = -plankW; x < width + plankW; x += plankW) {
    const tint = Math.sin(x * 0.07) * 8;
    ctx.fillStyle = `rgba(${210 + tint}, ${237 + tint}, ${244 + tint}, 0.17)`;
    ctx.fillRect(x, 0, plankW - 2, height);
    ctx.fillStyle = "rgba(55, 126, 145, 0.12)";
    ctx.fillRect(x + plankW - 3, 0, 3, height);
    drawWoodGrain(x, plankW);
  }

  ctx.save();
  ctx.globalAlpha = 0.48;
  for (let i = 0; i < 12; i += 1) {
    const x = ((i * 127) % (width + 180)) - 90;
    const y = 98 + ((i * 83) % Math.max(220, height * 0.58));
    const s = 0.62 + ((i % 4) * 0.16);
    drawCloudPattern(x, y, s);
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(55, 122, 142, 0.23)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, height * 0.28);
  ctx.quadraticCurveTo(width * 0.5, height * 0.21, width + 20, height * 0.27);
  ctx.stroke();

  const tableY = height * 0.78;
  const table = ctx.createLinearGradient(0, tableY, 0, height);
  table.addColorStop(0, "#693015");
  table.addColorStop(0.52, "#42190b");
  table.addColorStop(1, "#1a0804");
  ctx.fillStyle = table;
  ctx.fillRect(0, tableY, width, height - tableY);
  ctx.strokeStyle = "rgba(255, 180, 100, 0.24)";
  for (let y = tableY + 18; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.sin(y * 0.05) * 7);
    ctx.stroke();
  }
}

function drawWoodGrain(x, plankW) {
  ctx.save();
  ctx.strokeStyle = "rgba(47, 112, 132, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    const gx = x + 12 + ((i * 19) % Math.max(20, plankW - 20));
    ctx.beginPath();
    for (let y = -20; y < height + 20; y += 30) {
      const px = gx + Math.sin(y * 0.018 + i) * 5;
      if (y === -20) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawCloudPattern(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.bezierCurveTo(20, 24, 18, 2, 38, 4);
  ctx.bezierCurveTo(44, -14, 76, -10, 78, 10);
  ctx.bezierCurveTo(98, 6, 112, 18, 108, 34);
  ctx.lineTo(36, 34);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(38, 18, 10, Math.PI * 0.1, Math.PI * 1.65, true);
  ctx.arc(74, 18, 13, Math.PI * 1.15, Math.PI * 2.15);
  ctx.stroke();
  ctx.restore();
}

function drawObject(object) {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.rotation);
  if (object.kind === "bomb") drawBomb(object.radius);
  else if (object.kind === "power") drawPowerFruit(object);
  else drawFruit(object);
  ctx.restore();
}

function drawFruit(object) {
  if (drawSpriteFruit(object)) return;

  const r = object.radius;
  drawDropShadow(r);
  drawRimGlow(r, object.fruit.juice);
  const g = ctx.createRadialGradient(-r * 0.34, -r * 0.38, 4, 0, 0, r * 1.16);
  g.addColorStop(0, "#ffffffaa");
  g.addColorStop(0.24, object.fruit.flesh);
  g.addColorStop(0.72, object.fruit.color);
  g.addColorStop(1, object.fruit.deep);
  ctx.fillStyle = g;
  drawFruitShape(object.type, r);
  ctx.fill();

  ctx.save();
  ctx.clip();
  drawCoreVolume(r);
  drawFruitDetails(object.type, r, object.fruit);
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.58)";
  ctx.lineWidth = 2.6;
  drawFruitShape(object.type, r);
  ctx.stroke();
  ctx.strokeStyle = "rgba(2, 32, 34, 0.22)";
  ctx.lineWidth = 1.2;
  drawFruitShape(object.type, r * 0.94);
  ctx.stroke();
  drawHighlight(r);
  drawSpecularFlecks(r);
}

function drawSpriteFruit(object) {
  if (!hasSpriteFruit(object.type)) return false;
  const image = spriteFruitAssets[object.type].full;
  if (!image.complete || !image.naturalWidth) return false;
  drawImageCentered(image, object.radius * 2.55, 0, 0);
  return true;
}

function drawImageCentered(image, targetHeight, offsetX = 0, offsetY = 0) {
  const scale = targetHeight / image.naturalHeight;
  const targetWidth = image.naturalWidth * scale;
  ctx.drawImage(image, offsetX - targetWidth / 2, offsetY - targetHeight / 2, targetWidth, targetHeight);
}

function drawFruitShape(type, r) {
  ctx.beginPath();
  if (type === "pineapple") {
    ctx.moveTo(0, -r * 1.05);
    ctx.lineTo(r * 0.95, -r * 0.16);
    ctx.lineTo(r * 0.48, r);
    ctx.lineTo(-r * 0.6, r * 0.78);
    ctx.lineTo(-r, -r * 0.08);
    ctx.closePath();
  } else if (type === "mango") {
    ctx.ellipse(0, 0, r * 0.86, r * 1.16, -0.42, 0, Math.PI * 2);
  } else if (type === "watermelon") {
    ctx.ellipse(0, 0, r * 1.22, r, 0, 0, Math.PI * 2);
  } else if (type === "dragon") {
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const rr = i % 2 ? r * 0.92 : r * 1.07;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else {
    ctx.ellipse(0, 0, r, r * 1.03, 0, 0, Math.PI * 2);
  }
}

function drawFruitDetails(type, r, fruit) {
  if (type === "watermelon") {
    ctx.strokeStyle = "rgba(12, 63, 34, 0.62)";
    ctx.lineWidth = r * 0.13;
    for (let x = -r * 1.1; x <= r * 1.1; x += r * 0.36) {
      ctx.beginPath();
      ctx.moveTo(x, -r * 0.98);
      ctx.bezierCurveTo(x + r * 0.16, -r * 0.35, x - r * 0.12, r * 0.28, x * 0.78, r);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(195, 255, 160, 0.34)";
    ctx.lineWidth = r * 0.045;
    for (let x = -r; x <= r; x += r * 0.42) {
      ctx.beginPath();
      ctx.moveTo(x + r * 0.08, -r * 0.86);
      ctx.quadraticCurveTo(x - r * 0.12, 0, x * 0.7, r * 0.86);
      ctx.stroke();
    }
    drawSeeds(r * 0.72, "watermelon", 12);
  } else if (type === "kiwi") {
    ctx.fillStyle = "rgba(236, 255, 169, 0.78)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(246, 255, 224, 0.9)";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.34)";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
      ctx.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84);
      ctx.stroke();
    }
    drawSeeds(r, "kiwi", 28);
  } else if (type === "dragon") {
    ctx.fillStyle = "rgba(255, 255, 255, 0.66)";
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.78, r * 0.72, 0.15, 0, Math.PI * 2);
    ctx.fill();
    drawSeeds(r * 0.78, "dragon", 30);
    ctx.fillStyle = "rgba(120, 255, 150, 0.58)";
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.78, r * 0.1, r * 0.26, a, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (type === "pineapple") {
    ctx.strokeStyle = "rgba(116, 76, 16, 0.42)";
    ctx.lineWidth = 2.2;
    for (let i = -5; i <= 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-r, i * r * 0.26);
      ctx.lineTo(r, i * r * 0.26 + r * 0.52);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r, i * r * 0.26 + r * 0.52);
      ctx.lineTo(r, i * r * 0.26);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 238, 121, 0.46)";
    for (let y = -r * 0.72; y < r * 0.72; y += r * 0.28) {
      for (let x = -r * 0.66; x < r * 0.72; x += r * 0.34) {
        ctx.beginPath();
        ctx.ellipse(x, y + Math.sin(x) * 2, r * 0.055, r * 0.035, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === "mango") {
    ctx.fillStyle = "rgba(255, 126, 62, 0.32)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.12, r * 0.16, r * 0.42, r * 0.82, -0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 238, 153, 0.34)";
    ctx.lineWidth = 1.4;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.34 + i * r * 0.12, -r * 0.68);
      ctx.bezierCurveTo(r * 0.08, -r * 0.28, r * 0.14, r * 0.24, -r * 0.08 + i * r * 0.08, r * 0.72);
      ctx.stroke();
    }
  } else if (type === "plum") {
    ctx.strokeStyle = "rgba(245, 210, 255, 0.34)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(-r * 0.2, -r * 0.35, -r * 0.2, r * 0.35, 0, r);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 220, 255, 0.22)";
    ctx.beginPath();
    ctx.ellipse(-r * 0.24, -r * 0.12, r * 0.18, r * 0.62, -0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  drawStemAndLeaf(r, fruit.deep);
}

function drawStemAndLeaf(r, color) {
  ctx.save();
  ctx.strokeStyle = "#5a3319";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, -r * 0.82);
  ctx.quadraticCurveTo(-r * 0.24, -r * 1.08, r * 0.06, -r * 1.16);
  ctx.stroke();
  ctx.fillStyle = color || "#34864c";
  ctx.beginPath();
  ctx.ellipse(r * 0.24, -r * 1.02, r * 0.22, r * 0.1, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSeeds(r, type, countOverride = null) {
  ctx.fillStyle = type === "dragon" ? "#1b1b1b" : "#121412";
  const count = countOverride || (type === "kiwi" ? 22 : 10);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const jitter = Math.sin(i * 7.31) * 0.08;
    const orbit = type === "kiwi" ? r * (0.54 + jitter) : type === "dragon" ? r * (0.3 + (i % 4) * 0.13) : r * (0.38 + jitter);
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 1.6, 3.5, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoreVolume(r) {
  const shadow = ctx.createRadialGradient(r * 0.46, r * 0.52, 2, r * 0.22, r * 0.2, r * 1.2);
  shadow.addColorStop(0, "rgba(0,0,0,0.22)");
  shadow.addColorStop(0.42, "rgba(0,0,0,0.04)");
  shadow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shadow;
  ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6);
}

function drawRimGlow(r, color) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.86, r * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSpecularFlecks(r) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 5; i += 1) {
    const x = -r * 0.54 + i * r * 0.16;
    const y = -r * 0.52 + Math.sin(i) * r * 0.08;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.035, r * 0.014, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPowerFruit(object) {
  const r = object.radius;
  const power = powerFruit[object.powerKey];
  drawDropShadow(r);
  ctx.save();
  ctx.shadowColor = power.color;
  ctx.shadowBlur = 24 + Math.sin(object.shimmer) * 8;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 3, 0, 0, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.36, power.flesh);
  g.addColorStop(1, power.color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(255,255,255,.72)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "rgba(3, 28, 34, 0.72)";
  ctx.font = `900 ${Math.round(r * 0.46)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const glyph = object.powerKey === "freeze" ? "II" : object.powerKey === "double" ? "x2" : "!";
  ctx.fillText(glyph, 0, 1);
  drawOrbit(r, power.color, object.shimmer);
}

function drawOrbit(r, color, shimmer) {
  ctx.save();
  ctx.rotate(shimmer);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.3, r * 0.35, 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawDropShadow(r) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = "#001015";
  ctx.beginPath();
  ctx.ellipse(r * 0.18, r * 0.28, r * 0.96, r * 0.78, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHighlight(r) {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.38, r * 0.2, r * 0.11, -0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBomb(r) {
  drawDropShadow(r);
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, 2, 0, 0, r);
  g.addColorStop(0, "#8a8a8a");
  g.addColorStop(0.55, "#181818");
  g.addColorStop(1, "#050505");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ff3a35";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = "#ff352f";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, 0);
  ctx.lineTo(r * 0.36, 0);
  ctx.moveTo(0, -r * 0.36);
  ctx.lineTo(0, r * 0.36);
  ctx.stroke();
  ctx.strokeStyle = "#a86a32";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.85);
  ctx.quadraticCurveTo(-r * 0.4, -r * 1.25, -r * 0.75, -r * 1.35);
  ctx.stroke();
  ctx.fillStyle = "#ffde79";
  ctx.beginPath();
  ctx.arc(-r * 0.78, -r * 1.36, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, particle.life / (particle.fadeDuration || 0.78)));
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.rotation || 0);
  if (particle.text) {
    ctx.font = `900 ${particle.size}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(25, 35, 38, 0.58)";
    ctx.fillStyle = particle.color;
    ctx.strokeText(particle.text, 0, 0);
    ctx.fillText(particle.text, 0, 0);
  } else if (particle.spriteFruit) {
    drawSpriteParticle(particle);
  } else if (particle.fruitHalf) {
    const object = particle.fruitHalf;
    drawFruitHalfParticle(object, particle);
  } else {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpriteParticle(particle) {
  const assets = spriteFruitAssets[particle.spriteFruit];
  const image = assets && assets[particle.spriteState];
  if (!image || !image.complete || image.naturalWidth <= 0) return;
  const baseAlpha = particle.spriteState === "splash" ? Math.min(1, particle.life / 0.28) : 1;
  ctx.globalAlpha *= baseAlpha;
  drawImageCentered(image, particle.targetSize);
}

function drawFruitHalfParticle(object, particle) {
  const r = particle.size * 0.42;
  const side = particle.side;
  const fruit = object.fruit;

  ctx.save();
  ctx.scale(side, 1);
  const flesh = ctx.createRadialGradient(-r * 0.26, -r * 0.34, 2, 0, 0, r);
  flesh.addColorStop(0, "#ffffffcc");
  flesh.addColorStop(0.3, fruit.flesh || particle.color);
  flesh.addColorStop(1, fruit.juice || particle.color);
  ctx.fillStyle = flesh;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.bezierCurveTo(r * 0.78, -r * 0.78, r * 0.82, r * 0.78, 0, r);
  ctx.bezierCurveTo(-r * 0.08, r * 0.42, -r * 0.08, -r * 0.42, 0, -r);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = fruit.deep || "rgba(0,0,0,0.3)";
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 1.2;
  for (let i = -2; i <= 2; i += 1) {
    ctx.beginPath();
    ctx.moveTo(r * 0.1, i * r * 0.18);
    ctx.quadraticCurveTo(r * 0.42, i * r * 0.12, r * 0.68, i * r * 0.24);
    ctx.stroke();
  }

  if (object.type === "watermelon" || object.type === "kiwi" || object.type === "dragon") {
    ctx.fillStyle = object.type === "dragon" ? "#1b1b1b" : "#141414";
    for (let i = 0; i < 5; i += 1) {
      const a = -0.72 + i * 0.36;
      ctx.beginPath();
      ctx.ellipse(r * (0.34 + (i % 2) * 0.16), Math.sin(a) * r * 0.58, 1.4, 3.1, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "rgba(255,255,255,0.34)";
  ctx.beginPath();
  ctx.ellipse(r * 0.28, -r * 0.42, r * 0.12, r * 0.04, -0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerOverlay() {
  if (powers.double <= 0 && powers.freeze <= 0 && powers.frenzy <= 0) return;
  ctx.save();
  if (powers.freeze > 0) {
    ctx.fillStyle = "rgba(112, 239, 255, 0.08)";
    ctx.fillRect(0, 0, width, height);
  }
  if (powers.frenzy > 0) {
    ctx.strokeStyle = "rgba(255, 112, 90, 0.28)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);
  }
  ctx.restore();
}

function drawSlash() {
  if (slash.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = powers.double > 0 ? "#ffdf78" : "#67f7ff";
  ctx.shadowBlur = 24;
  for (let i = 1; i < slash.length; i += 1) {
    const age = (performance.now() - slash[i].t) / 220;
    ctx.strokeStyle = powers.double > 0 ? `rgba(255, 222, 118, ${1 - age})` : `rgba(116, 249, 255, ${1 - age})`;
    ctx.lineWidth = 10 * (1 - age) + 2;
    ctx.beginPath();
    ctx.moveTo(slash[i - 1].x, slash[i - 1].y);
    ctx.lineTo(slash[i].x, slash[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener("pointerdown", (event) => {
  pointerDown = true;
  lastPointer = pointerPosition(event);
  slash.push({ ...lastPointer, t: performance.now() });
});

canvas.addEventListener("pointermove", (event) => {
  if (!pointerDown) return;
  const point = pointerPosition(event);
  slash.push({ ...point, t: performance.now() });
  cutAt(point.x, point.y, lastPointer);
  lastPointer = point;
});

window.addEventListener("pointerup", () => {
  pointerDown = false;
  lastPointer = null;
});

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", reset);
restartBtn.addEventListener("click", reset);
window.addEventListener("resize", resize);

resize();
updateHud();
requestAnimationFrame(loop);
