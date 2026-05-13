const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const timeEl = document.getElementById("time");
const livesEl = document.getElementById("lives");
const comboEl = document.getElementById("combo");
const meterEl = document.getElementById("meterFill");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("start");
const restartBtn = document.getElementById("restart");

const fruits = [
  { name: "watermelon", color: "#2eb45c", flesh: "#f43d46", juice: "#ff304c", points: 12 },
  { name: "mango", color: "#ffb83d", flesh: "#ffd35a", juice: "#ffc52d", points: 10 },
  { name: "kiwi", color: "#8a5a2b", flesh: "#9ee05b", juice: "#b9ff62", points: 11 },
  { name: "dragon", color: "#fa3f96", flesh: "#f4fbff", juice: "#ff4aa9", points: 14 },
  { name: "pineapple", color: "#f4b21d", flesh: "#ffd45d", juice: "#ffca35", points: 13 },
];

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
let pointerDown = false;
let lastPointer = null;
let nextId = 0;

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
  spawnTimer = 0;
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
}

function spawnObject() {
  const isBomb = Math.random() < Math.min(0.18, 0.08 + score / 5000);
  const fruit = fruits[Math.floor(Math.random() * fruits.length)];
  const radius = 28 + Math.random() * 18;
  const x = 52 + Math.random() * (width - 104);
  const speed = 980 + Math.random() * 190;
  const vx = (width / 2 - x) * (0.55 + Math.random() * 0.45);
  objects.push({
    id: `object-${nextId++}`,
    type: isBomb ? "bomb" : fruit.name,
    fruit,
    x,
    y: height + radius + 30,
    vx,
    vy: -speed,
    radius: isBomb ? radius * 0.92 : radius,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 5,
    sliced: false,
    missed: false,
  });
}

function update(dt) {
  if (!running) return;
  timeLeft -= dt;
  spawnTimer -= dt;
  comboEnergy = Math.max(0, comboEnergy - dt * 18);
  combo = 1 + Math.floor(comboEnergy / 28);

  if (spawnTimer <= 0) {
    spawnObject();
    if (score > 80 && Math.random() < 0.28) spawnObject();
    spawnTimer = Math.max(0.58, 1.12 - score / 10000);
  }

  for (const object of objects) {
    object.vy += 720 * dt;
    object.x += object.vx * dt;
    object.y += object.vy * dt;
    object.rotation += object.spin * dt;
    if (!object.missed && !object.sliced && object.type !== "bomb" && object.vy > 0 && object.y > height + object.radius + 160) {
      object.missed = true;
      lives -= 1;
      comboEnergy = 0;
      burst(object.x, height - 80, "#67f7ff", 8, 4);
      if (lives <= 0) endGame("失手了");
    }
  }

  objects = objects.filter((object) => object.y < height + 140 && !object.sliced);
  particles = particles.filter((particle) => particle.life > 0);
  for (const particle of particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 420 * dt;
  }
  slash = slash.filter((point) => performance.now() - point.t < 220);

  if (timeLeft <= 0) endGame();
  updateHud();
}

function burst(x, y, color, count = 24, force = 1) {
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
    });
  }
}

function cutAt(x, y, previous) {
  for (const object of objects) {
    if (object.sliced) continue;
    const hit = distanceToSegment({ x: object.x, y: object.y }, previous || { x, y }, { x, y }) < object.radius + 8;
    if (!hit) continue;

    object.sliced = true;
    if (object.type === "bomb") {
      lives = 0;
      burst(object.x, object.y, "#ff3a35", 36, 1.6);
      endGame("炸弹命中");
      return;
    }

    score += object.fruit.points * combo;
    comboEnergy = Math.min(100, comboEnergy + 18);
    burst(object.x, object.y, object.fruit.juice, 28, 1);
    createHalves(object);
  }
}

function createHalves(object) {
  for (const side of [-1, 1]) {
    particles.push({
      x: object.x + side * 6,
      y: object.y,
      vx: side * (130 + Math.random() * 80),
      vy: -120 - Math.random() * 120,
      size: object.radius * 1.2,
      color: object.fruit.flesh,
      fruitHalf: object,
      side,
      life: 0.72,
    });
  }
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
  drawSlash();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#061014");
  sky.addColorStop(0.54, "#0b2023");
  sky.addColorStop(1, "#180d09");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.globalAlpha = 0.42;
  for (let i = 0; i < 18; i += 1) {
    const x = ((i * 73) % width) + Math.sin(i) * 18;
    const y = 110 + ((i * 61) % Math.max(160, height * 0.54));
    drawLantern(x, y, i % 2 ? "#ff795a" : "#4df5ee");
  }
  ctx.restore();

  ctx.strokeStyle = "rgba(255, 112, 82, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, height * 0.28);
  ctx.quadraticCurveTo(width * 0.5, height * 0.2, width + 20, height * 0.26);
  ctx.stroke();

  const tableY = height * 0.78;
  const table = ctx.createLinearGradient(0, tableY, 0, height);
  table.addColorStop(0, "#3b160e");
  table.addColorStop(1, "#130805");
  ctx.fillStyle = table;
  ctx.fillRect(0, tableY, width, height - tableY);
  ctx.strokeStyle = "rgba(255, 166, 91, 0.22)";
  for (let y = tableY + 18; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + Math.sin(y) * 8);
    ctx.stroke();
  }
}

function drawLantern(x, y, color) {
  ctx.save();
  ctx.translate(x, y);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 54);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawObject(object) {
  ctx.save();
  ctx.translate(object.x, object.y);
  ctx.rotate(object.rotation);
  if (object.type === "bomb") drawBomb(object.radius);
  else drawFruit(object);
  ctx.restore();
}

function drawFruit(object) {
  const r = object.radius;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, 4, 0, 0, r);
  g.addColorStop(0, "#ffffff99");
  g.addColorStop(0.32, object.fruit.flesh);
  g.addColorStop(1, object.fruit.color);
  ctx.fillStyle = g;
  if (object.type === "pineapple") {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.92, -r * 0.12);
    ctx.lineTo(r * 0.46, r);
    ctx.lineTo(-r * 0.58, r * 0.76);
    ctx.lineTo(-r, -r * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * (object.type === "watermelon" ? 1.22 : 1), r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,.42)";
  ctx.lineWidth = 2;
  ctx.stroke();
  if (object.type === "watermelon" || object.type === "kiwi" || object.type === "dragon") drawSeeds(r, object.type);
}

function drawSeeds(r, type) {
  ctx.fillStyle = type === "dragon" ? "#1b1b1b" : "#121412";
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * r * 0.42, Math.sin(angle) * r * 0.42, 2, 4, angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBomb(r) {
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.35, 2, 0, 0, r);
  g.addColorStop(0, "#777");
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
}

function drawParticle(particle) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, particle.life / 0.72);
  ctx.translate(particle.x, particle.y);
  if (particle.fruitHalf) {
    ctx.rotate((1 - particle.life) * particle.side * 4);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size * 0.42, -Math.PI / 2, Math.PI / 2, particle.side < 0);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSlash() {
  if (slash.length < 2) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = "#67f7ff";
  ctx.shadowBlur = 24;
  for (let i = 1; i < slash.length; i += 1) {
    const age = (performance.now() - slash[i].t) / 220;
    ctx.strokeStyle = `rgba(116, 249, 255, ${1 - age})`;
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
