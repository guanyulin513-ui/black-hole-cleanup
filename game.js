const STORAGE_KEY = "black-hole-cleanup-save-v2";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const moneyText = document.getElementById("moneyText");
const loadText = document.getElementById("loadText");
const capacityText = document.getElementById("capacityText");
const progressText = document.getElementById("progressText");
const loadBarFill = document.getElementById("loadBarFill");
const baseStatus = document.getElementById("baseStatus");
const passStatus = document.getElementById("passStatus");
const perfectStatus = document.getElementById("perfectStatus");
const minecartList = document.getElementById("minecartList");
const messageLog = document.getElementById("messageLog");

const sellAtBaseBtn = document.getElementById("sellAtBaseBtn");
const upgradeHoleBtn = document.getElementById("upgradeHoleBtn");
const upgradeAllCartsBtn = document.getElementById("upgradeAllCartsBtn");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

const WORLD = {
  width: 2400,
  height: 1400,
  baseRadius: 90,
  holeRadiusBase: 26,
  holeRadiusGrowth: 3,
  itemCount: 95,
  minecartStationRadius: 100,
};

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  touchActive: false,
  touchTargetX: 0,
  touchTargetY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function createInitialState() {
  const base = { x: 210, y: 700, radius: WORLD.baseRadius };

  const carts = [
    {
      id: "cartA",
      name: "Minecart A",
      x: 900,
      y: 420,
      unlocked: true,
      level: 1,
      capacity: 90,
      speed: 1.0,
      cooldown: 0,
      travelTime: 7,
    },
    {
      id: "cartB",
      name: "Minecart B",
      x: 1500,
      y: 760,
      unlocked: true,
      level: 1,
      capacity: 90,
      speed: 1.0,
      cooldown: 0,
      travelTime: 10,
    },
    {
      id: "cartC",
      name: "Minecart C",
      x: 2050,
      y: 1120,
      unlocked: false,
      level: 1,
      capacity: 90,
      speed: 1.0,
      cooldown: 0,
      travelTime: 14,
      unlockCost: 220,
    },
  ];

  return {
    money: 300,
    blackHole: {
      level: 1,
      x: base.x,
      y: base.y,
      radius: WORLD.holeRadiusBase,
      speed: 260,
      load: 0,
      capacity: 140,
      suctionRange: 70,
    },
    base,
    carts,
    items: generateItems(),
    deliveries: [],
    messages: [],
    camera: { x: 0, y: 0 },
    perfectRewardClaimed: false,
    autoSaveTimer: 0,
  };
}

function generateItems() {
  const items = [];

  for (let i = 0; i < WORLD.itemCount; i++) {
    let sizeTier;
    const roll = Math.random();

    if (roll < 0.55) sizeTier = "small";
    else if (roll < 0.85) sizeTier = "medium";
    else sizeTier = "large";

    const config = {
      small: { load: 8, value: 14, radius: 10, color: "#93c5fd" },
      medium: { load: 16, value: 28, radius: 14, color: "#a7f3d0" },
      large: { load: 28, value: 48, radius: 18, color: "#fcd34d" },
    }[sizeTier];

    items.push({
      id: `item_${i}`,
      x: rand(450, WORLD.width - 120),
      y: rand(120, WORLD.height - 120),
      sizeTier,
      load: config.load,
      value: config.value,
      radius: config.radius,
      color: config.color,
      collected: false,
    });
  }

  return items;
}

let state = loadGame() || createInitialState();

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  logMessage("Game saved.");
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (error) {
    console.error("Failed to load save:", error);
    return null;
  }
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState();
  renderMinecartPanel();
  updateUI();
  logMessage("Save reset.");
}

function logMessage(text) {
  state.messages.unshift({
    id: `${Date.now()}_${Math.random()}`,
    text,
  });

  state.messages = state.messages.slice(0, 12);
  renderMessages();
}

function renderMessages() {
  messageLog.innerHTML = "";
  for (const msg of state.messages) {
    const div = document.createElement("div");
    div.className = "message";
    div.textContent = msg.text;
    messageLog.appendChild(div);
  }
}

function getCollectedCount() {
  return state.items.filter((item) => item.collected).length;
}

function getProgressPercent() {
  return (getCollectedCount() / state.items.length) * 100;
}

function canPassLevel() {
  return getProgressPercent() >= 95;
}

function isPerfectClear() {
  return getCollectedCount() >= state.items.length;
}

function isNearBase() {
  return (
    distance(
      { x: state.blackHole.x, y: state.blackHole.y },
      { x: state.base.x, y: state.base.y }
    ) <= state.base.radius
  );
}

function isNearCartStation(cart) {
  return (
    distance(
      { x: state.blackHole.x, y: state.blackHole.y },
      { x: cart.x, y: cart.y }
    ) <= WORLD.minecartStationRadius
  );
}

function getHoleUpgradeCost() {
  return 120 + state.blackHole.level * 90;
}

function upgradeBlackHole() {
  if (!isNearBase()) {
    logMessage("You must be near the base to upgrade the black hole.");
    return;
  }

  const cost = getHoleUpgradeCost();
  if (state.money < cost) {
    logMessage(`Not enough money. Need ${cost}.`);
    return;
  }

  state.money -= cost;
  state.blackHole.level += 1;
  state.blackHole.capacity = Math.floor(state.blackHole.capacity * 1.18);
  state.blackHole.speed = Math.min(420, state.blackHole.speed + 15);
  state.blackHole.suctionRange = Math.min(130, state.blackHole.suctionRange + 6);
  state.blackHole.radius =
    WORLD.holeRadiusBase + state.blackHole.level * WORLD.holeRadiusGrowth;

  logMessage(`Black hole upgraded to Lv.${state.blackHole.level}.`);
  updateUI();
}

function getCartUpgradeCost(cart) {
  return 80 + cart.level * 70;
}

function getUpgradeAllCost() {
  const unlocked = state.carts.filter((c) => c.unlocked);
  const total = unlocked.reduce((sum, cart) => sum + getCartUpgradeCost(cart), 0);
  return Math.floor(total * 1.35);
}

function upgradeSingleCart(cartId) {
  if (!isNearBase()) {
    logMessage("You must be near the base to upgrade minecarts.");
    return;
  }

  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart) return;

  if (!cart.unlocked) {
    logMessage(`${cart.name} is not unlocked.`);
    return;
  }

  const cost = getCartUpgradeCost(cart);
  if (state.money < cost) {
    logMessage(`Not enough money for ${cart.name}. Need ${cost}.`);
    return;
  }

  state.money -= cost;
  cart.level += 1;
  cart.capacity = Math.floor(cart.capacity * 1.2);
  cart.speed = Number((cart.speed * 1.1).toFixed(2));
  cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));

  logMessage(`${cart.name} upgraded to Lv.${cart.level}.`);
  renderMinecartPanel();
  updateUI();
}

function upgradeAllCarts() {
  if (!isNearBase()) {
    logMessage("You must be near the base to upgrade all minecarts.");
    return;
  }

  const unlocked = state.carts.filter((c) => c.unlocked);
  if (!unlocked.length) {
    logMessage("No unlocked minecarts available.");
    return;
  }

  const cost = getUpgradeAllCost();
  if (state.money < cost) {
    logMessage(`Not enough money. Need ${cost} to upgrade all minecarts.`);
    return;
  }

  state.money -= cost;

  for (const cart of unlocked) {
    cart.level += 1;
    cart.capacity = Math.floor(cart.capacity * 1.2);
    cart.speed = Number((cart.speed * 1.1).toFixed(2));
    cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));
  }

  logMessage("All unlocked minecarts upgraded.");
  renderMinecartPanel();
  updateUI();
}

function unlockCart(cartId) {
  if (!isNearBase()) {
    logMessage("You must be near the base to unlock minecarts.");
    return;
  }

  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart || cart.unlocked) return;

  const cost = cart.unlockCost || 200;
  if (state.money < cost) {
    logMessage(`Not enough money to unlock ${cart.name}. Need ${cost}.`);
    return;
  }

  state.money -= cost;
  cart.unlocked = true;

  logMessage(`${cart.name} unlocked.`);
  renderMinecartPanel();
  updateUI();
}

function sellAtBase() {
  if (!isNearBase()) {
    logMessage("You must be near the base to sell.");
    return;
  }

  if (state.blackHole.load <= 0) {
    logMessage("Nothing to sell.");
    return;
  }

  const value = state.blackHole.pendingValue || 0;
  state.money += value;
  state.blackHole.load = 0;
  state.blackHole.pendingValue = 0;

  logMessage(`Sold your load for ${value}.`);
  checkPerfectReward();
  updateUI();
}

function sendLoadToCart(cartId) {
  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart) return;

  if (!cart.unlocked) {
    logMessage(`${cart.name} is not unlocked.`);
    return;
  }

  if (!isNearCartStation(cart)) {
    logMessage(`You must be near ${cart.name}'s station to send goods.`);
    return;
  }

  if (cart.cooldown > 0) {
    logMessage(`${cart.name} is still away.`);
    return;
  }

  if (state.blackHole.load <= 0) {
    logMessage("Your black hole is empty.");
    return;
  }

  const currentValue = state.blackHole.pendingValue || 0;
  if (currentValue <= 0) {
    logMessage("No sellable value in current load.");
    return;
  }

  const loadRatio = Math.min(1, cart.capacity / state.blackHole.load);
  const sentLoad = Math.floor(state.blackHole.load * loadRatio);
  const sentValue = Math.floor(currentValue * loadRatio);

  if (sentLoad <= 0 || sentValue <= 0) {
    logMessage(`${cart.name} cannot take this load.`);
    return;
  }

  state.blackHole.load -= sentLoad;
  state.blackHole.pendingValue -= sentValue;

  cart.cooldown = cart.travelTime;

  state.deliveries.push({
    id: `${cart.id}_${Date.now()}`,
    cartId: cart.id,
    remaining: cart.travelTime,
    value: sentValue,
  });

  logMessage(`${cart.name} departed. Money arrives in ${cart.travelTime.toFixed(1)}s.`);
  renderMinecartPanel();
  updateUI();
}

function checkPerfectReward() {
  if (isPerfectClear() && !state.perfectRewardClaimed) {
    state.money += 150;
    state.perfectRewardClaimed = true;
    logMessage("Perfect clear bonus: +150.");
  }
}

function updateDeliveries(dt) {
  for (const delivery of state.deliveries) {
    delivery.remaining -= dt;
  }

  const arrived = state.deliveries.filter((d) => d.remaining <= 0);
  const pending = state.deliveries.filter((d) => d.remaining > 0);

  for (const done of arrived) {
    state.money += done.value;
    const cart = state.carts.find((c) => c.id === done.cartId);
    if (cart) cart.cooldown = 0;
    logMessage(`Delivery arrived: +${done.value}.`);
  }

  state.deliveries = pending;

  for (const cart of state.carts) {
    if (cart.cooldown > 0) {
      cart.cooldown = Math.max(0, cart.cooldown - dt);
    }
  }
}

function tryCollectItems() {
  for (const item of state.items) {
    if (item.collected) continue;

    const holePos = { x: state.blackHole.x, y: state.blackHole.y };
    const itemPos = { x: item.x, y: item.y };
    const d = distance(holePos, itemPos);

    if (d <= state.blackHole.suctionRange) {
      if (state.blackHole.load + item.load > state.blackHole.capacity) {
        continue;
      }

      if (item.sizeTier === "medium" && state.blackHole.level < 2) continue;
      if (item.sizeTier === "large" && state.blackHole.level < 3) continue;

      item.collected = true;
      state.blackHole.load += item.load;
      state.blackHole.pendingValue = (state.blackHole.pendingValue || 0) + item.value;
    }
  }

  checkPerfectReward();
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (input.touchActive) {
    const vx = input.touchTargetX - state.blackHole.x;
    const vy = input.touchTargetY - state.blackHole.y;
    const len = Math.sqrt(vx * vx + vy * vy);

    if (len > 8) {
      dx += vx / len;
      dy += vy / len;
    }
  }

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }

  state.blackHole.x += dx * state.blackHole.speed * dt;
  state.blackHole.y += dy * state.blackHole.speed * dt;

  state.blackHole.x = clamp(state.blackHole.x, 0, WORLD.width);
  state.blackHole.y = clamp(state.blackHole.y, 0, WORLD.height);
}

function updateCamera() {
  state.camera.x = clamp(state.blackHole.x - canvas.width / 2, 0, WORLD.width - canvas.width);
  state.camera.y = clamp(state.blackHole.y - canvas.height / 2, 0, WORLD.height - canvas.height);
}

function worldToScreen(x, y) {
  return {
    x: x - state.camera.x,
    y: y - state.camera.y,
  };
}

function drawBackground() {
  ctx.fillStyle = "#101828";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;

  const gridSize = 80;
  for (let x = 0; x <= WORLD.width; x += gridSize) {
    const sx = x - state.camera.x;
    ctx.beginPath();
    ctx.moveTo(sx, -state.camera.y);
    ctx.lineTo(sx, WORLD.height - state.camera.y);
    ctx.stroke();
  }

  for (let y = 0; y <= WORLD.height; y += gridSize) {
    const sy = y - state.camera.y;
    ctx.beginPath();
    ctx.moveTo(-state.camera.x, sy);
    ctx.lineTo(WORLD.width - state.camera.x, sy);
    ctx.stroke();
  }
}

function drawBase() {
  const p = worldToScreen(state.base.x, state.base.y);

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.base.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(59,130,246,0.16)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, 32, 0, Math.PI * 2);
  ctx.fillStyle = "#3b82f6";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.fillText("BASE", p.x - 18, p.y + 5);
}

function drawMinecarts() {
  for (const cart of state.carts) {
    const p = worldToScreen(cart.x, cart.y);

    ctx.beginPath();
    ctx.arc(p.x, p.y, WORLD.minecartStationRadius, 0, Math.PI * 2);
    ctx.fillStyle = isNearCartStation(cart)
      ? "rgba(52,211,153,0.18)"
      : "rgba(255,255,255,0.05)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = cart.unlocked ? "#10b981" : "#6b7280";
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px Arial";
    ctx.fillText(cart.name, p.x - 28, p.y - 28);

    if (cart.cooldown > 0) {
      ctx.font = "12px Arial";
      ctx.fillText(`${cart.cooldown.toFixed(1)}s`, p.x - 14, p.y + 4);
    }
  }
}

function drawItems() {
  for (const item of state.items) {
    if (item.collected) continue;

    const p = worldToScreen(item.x, item.y);

    ctx.beginPath();
    ctx.arc(p.x, p.y, item.radius, 0, Math.PI * 2);
    ctx.fillStyle = item.color;
    ctx.fill();
  }
}

function drawBlackHole() {
  const p = worldToScreen(state.blackHole.x, state.blackHole.y);

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(167,139,250,0.18)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius, 0, Math.PI * 2);
  ctx.fillStyle = "#020617";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius - 5, 0, Math.PI * 2);
  ctx.fillStyle = "#111827";
  ctx.fill();

  ctx.strokeStyle = "#a78bfa";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius + 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWorldBounds() {
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 3;
  ctx.strokeRect(-state.camera.x, -state.camera.y, WORLD.width, WORLD.height);
}

function render() {
  drawBackground();
  drawWorldBounds();
  drawBase();
  drawMinecarts();
  drawItems();
  drawBlackHole();
}

function updateUI() {
  const progress = getProgressPercent();
  const loadRatio = state.blackHole.capacity > 0
    ? state.blackHole.load / state.blackHole.capacity
    : 0;

  moneyText.textContent = String(state.money);
  loadText.textContent = String(state.blackHole.load);
  capacityText.textContent = String(state.blackHole.capacity);
  progressText.textContent = progress.toFixed(1);
  loadBarFill.style.width = `${Math.min(100, loadRatio * 100)}%`;

  baseStatus.textContent = isNearBase() ? "Near base" : "Far from base";
  passStatus.textContent = canPassLevel() ? "Yes" : "No";
  perfectStatus.textContent = isPerfectClear() ? "Yes" : "No";

  sellAtBaseBtn.disabled = !isNearBase() || state.blackHole.load <= 0;
  upgradeHoleBtn.disabled = !isNearBase() || state.money < getHoleUpgradeCost();
  upgradeAllCartsBtn.disabled = !isNearBase() || state.money < getUpgradeAllCost();

  renderMinecartPanel();
}

function renderMinecartPanel() {
  minecartList.innerHTML = "";

  for (const cart of state.carts) {
    const card = document.createElement("div");
    card.className = "minecart-card";

    const near = isNearCartStation(cart);
    const canSend = cart.unlocked && near && cart.cooldown <= 0 && state.blackHole.load > 0;

    card.innerHTML = `
      <div class="minecart-header">
        <div class="minecart-name">${cart.name}</div>
        <div class="minecart-status">
          ${cart.unlocked ? `Lv.${cart.level}` : "Locked"}
        </div>
      </div>

      <div class="minecart-meta">
        <div>Capacity: ${cart.capacity}</div>
        <div>Travel time: ${cart.travelTime.toFixed(1)}s</div>
        <div>Cooldown: ${cart.cooldown > 0 ? cart.cooldown.toFixed(1) + "s" : "Ready"}</div>
        <div>Station: ${near ? "In range" : "Too far"}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "minecart-actions";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "Send";
    sendBtn.disabled = !canSend;
    sendBtn.addEventListener("click", () => sendLoadToCart(cart.id));

    const upgradeBtn = document.createElement("button");
    upgradeBtn.textContent = cart.unlocked
      ? `Upgrade ${getCartUpgradeCost(cart)}`
      : "Locked";
    upgradeBtn.disabled = !cart.unlocked || !isNearBase() || state.money < getCartUpgradeCost(cart);
    upgradeBtn.addEventListener("click", () => upgradeSingleCart(cart.id));

    const unlockBtn = document.createElement("button");
    if (cart.unlocked) {
      unlockBtn.textContent = "Ready";
      unlockBtn.disabled = true;
    } else {
      const unlockCost = cart.unlockCost || 200;
      unlockBtn.textContent = `Unlock ${unlockCost}`;
      unlockBtn.disabled = !isNearBase() || state.money < unlockCost;
      unlockBtn.addEventListener("click", () => unlockCart(cart.id));
    }

    actions.appendChild(sendBtn);
    actions.appendChild(upgradeBtn);
    actions.appendChild(unlockBtn);

    card.appendChild(actions);
    minecartList.appendChild(card);
  }
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const canvasX = (clientX - rect.left) * scaleX;
  const canvasY = (clientY - rect.top) * scaleY;

  return {
    x: canvasX + state.camera.x,
    y: canvasY + state.camera.y,
  };
}

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") input.up = true;
  if (e.key === "s" || e.key === "ArrowDown") input.down = true;
  if (e.key === "a" || e.key === "ArrowLeft") input.left = true;
  if (e.key === "d" || e.key === "ArrowRight") input.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "ArrowUp") input.up = false;
  if (e.key === "s" || e.key === "ArrowDown") input.down = false;
  if (e.key === "a" || e.key === "ArrowLeft") input.left = false;
  if (e.key === "d" || e.key === "ArrowRight") input.right = false;
});

canvas.addEventListener("pointerdown", (e) => {
  input.touchActive = true;
  const world = screenToWorld(e.clientX, e.clientY);
  input.touchTargetX = world.x;
  input.touchTargetY = world.y;
});

canvas.addEventListener("pointermove", (e) => {
  if (!input.touchActive) return;
  const world = screenToWorld(e.clientX, e.clientY);
  input.touchTargetX = world.x;
  input.touchTargetY = world.y;
});

window.addEventListener("pointerup", () => {
  input.touchActive = false;
});

sellAtBaseBtn.addEventListener("click", sellAtBase);
upgradeHoleBtn.addEventListener("click", upgradeBlackHole);
upgradeAllCartsBtn.addEventListener("click", upgradeAllCarts);
saveBtn.addEventListener("click", saveGame);
resetBtn.addEventListener("click", resetGame);

let lastTime = performance.now();

function tick(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  updatePlayer(dt);
  tryCollectItems();
  updateDeliveries(dt);
  updateCamera();

  state.autoSaveTimer += dt;
  if (state.autoSaveTimer >= 5) {
    state.autoSaveTimer = 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  render();
  updateUI();
  requestAnimationFrame(tick);
}

renderMessages();
renderMinecartPanel();
updateUI();
requestAnimationFrame(tick);
