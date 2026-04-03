const STORAGE_KEY = "black-hole-cleanup-zh-v3";

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
  baseRadius: 95,
  holeRadiusBase: 26,
  holeRadiusGrowth: 3,
  itemCount: 64,
  minecartStationRadius: 110,
};

const ITEM_LIBRARY = [
  { type: "book", name: "書本", tier: "small", load: 8, value: 14, color: "#6b8bd6" },
  { type: "notebook", name: "筆記本", tier: "small", load: 9, value: 15, color: "#78b9a6" },
  { type: "sticky", name: "便條紙", tier: "small", load: 6, value: 11, color: "#f0d770" },
  { type: "eraser", name: "橡皮擦", tier: "small", load: 7, value: 12, color: "#f1a3b0" },
  { type: "pencil", name: "鉛筆", tier: "small", load: 7, value: 12, color: "#e7b04a" },

  { type: "mug", name: "馬克杯", tier: "medium", load: 14, value: 24, color: "#d97e6f" },
  { type: "plant", name: "盆栽", tier: "medium", load: 16, value: 27, color: "#62b36b" },
  { type: "box", name: "收納盒", tier: "medium", load: 15, value: 25, color: "#b58a63" },

  { type: "lamp", name: "檯燈", tier: "large", load: 26, value: 46, color: "#f3d27c" },
  { type: "chair", name: "椅子", tier: "large", load: 30, value: 50, color: "#8f6c4d" },
  { type: "sideTable", name: "小桌", tier: "large", load: 34, value: 56, color: "#a57a53" },
];

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

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function createInitialState() {
  const base = { x: 220, y: 700, radius: WORLD.baseRadius };

  return {
    money: 300,
    blackHole: {
      level: 1,
      x: base.x,
      y: base.y,
      radius: WORLD.holeRadiusBase,
      speed: 260,
      load: 0,
      capacity: 145,
      suctionRange: 72,
      pendingValue: 0,
    },
    base,
    carts: [
      {
        id: "cartA",
        name: "礦車 A",
        x: 930,
        y: 430,
        unlocked: true,
        level: 1,
        capacity: 90,
        speed: 1.0,
        cooldown: 0,
        travelTime: 7.0,
      },
      {
        id: "cartB",
        name: "礦車 B",
        x: 1520,
        y: 760,
        unlocked: true,
        level: 1,
        capacity: 95,
        speed: 1.0,
        cooldown: 0,
        travelTime: 10.0,
      },
      {
        id: "cartC",
        name: "礦車 C",
        x: 2070,
        y: 1110,
        unlocked: false,
        unlockCost: 220,
        level: 1,
        capacity: 100,
        speed: 1.0,
        cooldown: 0,
        travelTime: 14.0,
      },
    ],
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
    let candidates;
    const roll = Math.random();

    if (roll < 0.52) {
      candidates = ITEM_LIBRARY.filter((item) => item.tier === "small");
    } else if (roll < 0.84) {
      candidates = ITEM_LIBRARY.filter((item) => item.tier === "medium");
    } else {
      candidates = ITEM_LIBRARY.filter((item) => item.tier === "large");
    }

    const model = pickRandom(candidates);

    items.push({
      id: `item_${i}`,
      type: model.type,
      name: model.name,
      tier: model.tier,
      load: model.load,
      value: model.value,
      color: model.color,
      x: rand(430, WORLD.width - 130),
      y: rand(120, WORLD.height - 120),
      collected: false,
      rotation: rand(-0.35, 0.35),
      scale: rand(0.92, 1.08),
    });
  }

  return items;
}

function saveGame(showMessage = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (showMessage) logMessage("已存檔。");
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error("讀取存檔失敗", error);
    return null;
  }
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  state = createInitialState();
  renderMessages();
  renderMinecartPanel();
  updateUI();
  logMessage("已重置存檔。");
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

function getCartUpgradeCost(cart) {
  return 80 + cart.level * 70;
}

function getUpgradeAllCost() {
  const unlocked = state.carts.filter((c) => c.unlocked);
  const total = unlocked.reduce((sum, cart) => sum + getCartUpgradeCost(cart), 0);
  return Math.floor(total * 1.35);
}

function upgradeBlackHole() {
  if (!isNearBase()) {
    logMessage("必須回到基地旁才能升級黑洞。");
    return;
  }

  const cost = getHoleUpgradeCost();
  if (state.money < cost) {
    logMessage(`金幣不足，升級黑洞需要 ${cost}。`);
    return;
  }

  state.money -= cost;
  state.blackHole.level += 1;
  state.blackHole.capacity = Math.floor(state.blackHole.capacity * 1.18);
  state.blackHole.speed = Math.min(420, state.blackHole.speed + 15);
  state.blackHole.suctionRange = Math.min(140, state.blackHole.suctionRange + 7);
  state.blackHole.radius = WORLD.holeRadiusBase + state.blackHole.level * WORLD.holeRadiusGrowth;

  logMessage(`黑洞已升到 Lv.${state.blackHole.level}。`);
  updateUI();
}

function upgradeSingleCart(cartId) {
  if (!isNearBase()) {
    logMessage("必須回到基地旁才能升級礦車。");
    return;
  }

  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart) return;

  if (!cart.unlocked) {
    logMessage(`${cart.name} 尚未解鎖。`);
    return;
  }

  const cost = getCartUpgradeCost(cart);
  if (state.money < cost) {
    logMessage(`金幣不足，${cart.name} 升級需要 ${cost}。`);
    return;
  }

  state.money -= cost;
  cart.level += 1;
  cart.capacity = Math.floor(cart.capacity * 1.2);
  cart.speed = Number((cart.speed * 1.1).toFixed(2));
  cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));

  logMessage(`${cart.name} 已升到 Lv.${cart.level}。`);
  renderMinecartPanel();
  updateUI();
}

function upgradeAllCarts() {
  if (!isNearBase()) {
    logMessage("必須回到基地旁才能升級全部礦車。");
    return;
  }

  const unlocked = state.carts.filter((c) => c.unlocked);
  if (!unlocked.length) {
    logMessage("目前沒有可升級的礦車。");
    return;
  }

  const cost = getUpgradeAllCost();
  if (state.money < cost) {
    logMessage(`金幣不足，升級全部礦車需要 ${cost}。`);
    return;
  }

  state.money -= cost;

  for (const cart of unlocked) {
    cart.level += 1;
    cart.capacity = Math.floor(cart.capacity * 1.2);
    cart.speed = Number((cart.speed * 1.1).toFixed(2));
    cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));
  }

  logMessage("全部已解鎖礦車都升級了。");
  renderMinecartPanel();
  updateUI();
}

function unlockCart(cartId) {
  if (!isNearBase()) {
    logMessage("必須回到基地旁才能解鎖礦車。");
    return;
  }

  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart || cart.unlocked) return;

  const cost = cart.unlockCost || 200;
  if (state.money < cost) {
    logMessage(`金幣不足，解鎖 ${cart.name} 需要 ${cost}。`);
    return;
  }

  state.money -= cost;
  cart.unlocked = true;

  logMessage(`${cart.name} 已解鎖。`);
  renderMinecartPanel();
  updateUI();
}

function sellAtBase() {
  if (!isNearBase()) {
    logMessage("必須回到基地才能換錢。");
    return;
  }

  if (state.blackHole.load <= 0) {
    logMessage("目前沒有可換錢的物品。");
    return;
  }

  const value = state.blackHole.pendingValue || 0;
  state.money += value;
  state.blackHole.load = 0;
  state.blackHole.pendingValue = 0;

  logMessage(`基地回收完成，獲得 ${value} 金幣。`);
  checkPerfectReward();
  updateUI();
}

function sendLoadToCart(cartId) {
  const cart = state.carts.find((c) => c.id === cartId);
  if (!cart) return;

  if (!cart.unlocked) {
    logMessage(`${cart.name} 尚未解鎖。`);
    return;
  }

  if (!isNearCartStation(cart)) {
    logMessage(`必須靠近 ${cart.name} 站點才能送貨。`);
    return;
  }

  if (cart.cooldown > 0) {
    logMessage(`${cart.name} 還沒回來。`);
    return;
  }

  if (state.blackHole.load <= 0) {
    logMessage("黑洞目前是空的。");
    return;
  }

  const currentValue = state.blackHole.pendingValue || 0;
  if (currentValue <= 0) {
    logMessage("目前沒有可出售的內容物。");
    return;
  }

  const loadRatio = Math.min(1, cart.capacity / state.blackHole.load);
  const sentLoad = Math.floor(state.blackHole.load * loadRatio);
  const sentValue = Math.floor(currentValue * loadRatio);

  if (sentLoad <= 0 || sentValue <= 0) {
    logMessage(`${cart.name} 現在無法裝下這批貨。`);
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

  logMessage(`${cart.name} 已出發，約 ${cart.travelTime.toFixed(1)} 秒後入帳。`);
  renderMinecartPanel();
  updateUI();
}

function checkPerfectReward() {
  if (isPerfectClear() && !state.perfectRewardClaimed) {
    state.money += 150;
    state.perfectRewardClaimed = true;
    logMessage("完美通關獎勵：+150 金幣。");
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
    logMessage(`礦車送達，入帳 ${done.value} 金幣。`);
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

    if (d > state.blackHole.suctionRange) continue;
    if (state.blackHole.load + item.load > state.blackHole.capacity) continue;
    if (item.tier === "medium" && state.blackHole.level < 2) continue;
    if (item.tier === "large" && state.blackHole.level < 3) continue;

    item.collected = true;
    state.blackHole.load += item.load;
    state.blackHole.pendingValue = (state.blackHole.pendingValue || 0) + item.value;
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

function drawRoundedRect(x, y, width, height, radius, fillStyle, strokeStyle = null) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
  }
}

function drawWoodFloor() {
  ctx.fillStyle = "#d9c6a2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const plankHeight = 48;
  for (let y = -((state.camera.y % plankHeight) + plankHeight); y < canvas.height + plankHeight; y += plankHeight) {
    ctx.fillStyle = y / plankHeight % 2 === 0 ? "#d7c39c" : "#d2bc93";
    ctx.fillRect(0, y, canvas.width, plankHeight - 2);
  }

  ctx.strokeStyle = "rgba(110, 80, 45, 0.08)";
  ctx.lineWidth = 1;
  for (let x = -((state.camera.x % 120) + 120); x < canvas.width + 120; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
}

function drawRoomDecor() {
  const rugX = 820 - state.camera.x;
  const rugY = 310 - state.camera.y;
  drawRoundedRect(rugX, rugY, 1180, 720, 26, "#caa88a");

  drawRoundedRect(480 - state.camera.x, 120 - state.camera.y, 420, 180, 18, "#b08b65");
  drawRoundedRect(1450 - state.camera.x, 110 - state.camera.y, 620, 180, 18, "#a9835e");

  drawRoundedRect(300 - state.camera.x, 1120 - state.camera.y, 560, 170, 18, "#b68f68");
  drawRoundedRect(1380 - state.camera.x, 1110 - state.camera.y, 820, 180, 18, "#a47a56");
}

function drawBase() {
  const p = worldToScreen(state.base.x, state.base.y);

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.base.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(79,124,255,0.18)";
  ctx.fill();

  drawRoundedRect(p.x - 42, p.y - 28, 84, 56, 12, "#4f7cff");
  drawRoundedRect(p.x - 26, p.y - 14, 52, 28, 8, "#d8e4ff");

  ctx.fillStyle = "#1f335f";
  ctx.font = "bold 14px sans-serif";
  ctx.fillText("基地", p.x - 14, p.y + 5);
}

function drawMinecarts() {
  for (const cart of state.carts) {
    const p = worldToScreen(cart.x, cart.y);

    ctx.beginPath();
    ctx.arc(p.x, p.y, WORLD.minecartStationRadius, 0, Math.PI * 2);
    ctx.fillStyle = isNearCartStation(cart)
      ? "rgba(72,213,154,0.16)"
      : "rgba(255,255,255,0.05)";
    ctx.fill();

    ctx.fillStyle = "#5c4a3c";
    ctx.fillRect(p.x - 34, p.y + 16, 68, 6);
    ctx.fillRect(p.x - 34, p.y + 4, 68, 6);

    ctx.fillStyle = cart.unlocked ? "#34c38f" : "#777";
    drawRoundedRect(p.x - 20, p.y - 18, 40, 28, 6, cart.unlocked ? "#34c38f" : "#777");

    ctx.fillStyle = "#2f2f2f";
    ctx.beginPath();
    ctx.arc(p.x - 12, p.y + 14, 6, 0, Math.PI * 2);
    ctx.arc(p.x + 12, p.y + 14, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(cart.name, p.x - 26, p.y - 30);

    if (cart.cooldown > 0) {
      ctx.font = "12px sans-serif";
      ctx.fillText(`${cart.cooldown.toFixed(1)}秒`, p.x - 18, p.y + 40);
    }
  }
}

function drawBook(item) {
  drawRoundedRect(-16, -10, 32, 20, 4, item.color, "#35508e");
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(-12, -6, 22, 12);
  ctx.fillStyle = "#35508e";
  ctx.fillRect(-14, -8, 4, 16);
}

function drawNotebook(item) {
  drawRoundedRect(-15, -11, 30, 22, 4, item.color, "#4f6f68");
  ctx.strokeStyle = "#f8f8f8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.lineTo(-8, 7);
  ctx.stroke();
}

function drawSticky(item) {
  drawRoundedRect(-11, -11, 22, 22, 3, item.color, "#d6be5f");
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-8, -8, 8, 6);
}

function drawEraser(item) {
  drawRoundedRect(-14, -8, 28, 16, 4, item.color, "#c87d89");
  ctx.fillStyle = "#fff4f5";
  ctx.fillRect(-14, -8, 14, 16);
}

function drawPencil(item) {
  ctx.fillStyle = "#e3ad4c";
  ctx.fillRect(-18, -3, 30, 6);
  ctx.fillStyle = "#f7e0b3";
  ctx.beginPath();
  ctx.moveTo(12, -3);
  ctx.lineTo(20, 0);
  ctx.lineTo(12, 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(16, -1);
  ctx.lineTo(16, 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d96d7d";
  ctx.fillRect(-18, -3, 5, 6);
}

function drawMug(item) {
  ctx.fillStyle = item.color;
  drawRoundedRect(-11, -10, 20, 20, 6, item.color, "#9a5549");
  ctx.strokeStyle = "#9a5549";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(12, -1, 6, -1.2, 1.2);
  ctx.stroke();
}

function drawPlant(item) {
  drawRoundedRect(-10, 4, 20, 12, 3, "#b57d56", "#8a5f42");
  ctx.fillStyle = "#5ca95e";
  ctx.beginPath();
  ctx.ellipse(-6, -2, 7, 11, -0.4, 0, Math.PI * 2);
  ctx.ellipse(0, -6, 8, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(7, -1, 7, 10, 0.35, 0, Math.PI * 2);
  ctx.fill();
}

function drawBox(item) {
  drawRoundedRect(-15, -11, 30, 22, 4, item.color, "#88684d");
  ctx.strokeStyle = "#88684d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.lineTo(0, 11);
  ctx.moveTo(-15, 0);
  ctx.lineTo(15, 0);
  ctx.stroke();
}

function drawLamp(item) {
  ctx.fillStyle = "#745e4b";
  ctx.fillRect(-3, -5, 6, 20);
  ctx.beginPath();
  ctx.arc(0, 15, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = item.color;
  ctx.beginPath();
  ctx.moveTo(-18, -8);
  ctx.lineTo(18, -8);
  ctx.lineTo(10, -26);
  ctx.lineTo(-10, -26);
  ctx.closePath();
  ctx.fill();
}

function drawChair(item) {
  ctx.fillStyle = item.color;
  drawRoundedRect(-16, -6, 32, 20, 4, item.color, "#6f543d");
  ctx.fillRect(-16, -26, 6, 20);
  ctx.fillRect(10, -26, 6, 20);
  ctx.fillRect(-12, 14, 4, 12);
  ctx.fillRect(8, 14, 4, 12);
}

function drawSideTable(item) {
  ctx.fillStyle = item.color;
  drawRoundedRect(-20, -12, 40, 24, 5, item.color, "#825b3a");
  ctx.fillRect(-15, 12, 4, 15);
  ctx.fillRect(11, 12, 4, 15);
  ctx.fillRect(-15, -27, 4, 15);
  ctx.fillRect(11, -27, 4, 15);
}

function drawItem(item) {
  switch (item.type) {
    case "book":
      drawBook(item);
      break;
    case "notebook":
      drawNotebook(item);
      break;
    case "sticky":
      drawSticky(item);
      break;
    case "eraser":
      drawEraser(item);
      break;
    case "pencil":
      drawPencil(item);
      break;
    case "mug":
      drawMug(item);
      break;
    case "plant":
      drawPlant(item);
      break;
    case "box":
      drawBox(item);
      break;
    case "lamp":
      drawLamp(item);
      break;
    case "chair":
      drawChair(item);
      break;
    case "sideTable":
      drawSideTable(item);
      break;
  }
}

function drawItems() {
  for (const item of state.items) {
    if (item.collected) continue;
    const p = worldToScreen(item.x, item.y);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(item.rotation);
    ctx.scale(item.scale, item.scale);

    ctx.shadowColor = "rgba(0,0,0,0.14)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    drawItem(item);

    ctx.restore();
  }
}

function drawBlackHole() {
  const p = worldToScreen(state.blackHole.x, state.blackHole.y);

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius + 12, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(143,103,255,0.16)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = "#090914";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius - 5, 0, Math.PI * 2);
  ctx.fillStyle = "#121221";
  ctx.fill();

  ctx.strokeStyle = "#a88cff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, state.blackHole.radius + 1, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWorldBounds() {
  ctx.strokeStyle = "rgba(93, 72, 46, 0.18)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-state.camera.x, -state.camera.y, WORLD.width, WORLD.height);
}

function render() {
  drawWoodFloor();
  drawRoomDecor();
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

  baseStatus.textContent = isNearBase() ? "在基地旁" : "不在基地旁";
  passStatus.textContent = canPassLevel() ? "是" : "否";
  perfectStatus.textContent = isPerfectClear() ? "是" : "否";

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
        <div class="minecart-status">${cart.unlocked ? `Lv.${cart.level}` : "未解鎖"}</div>
      </div>

      <div class="minecart-meta">
        <div>容量：${cart.capacity}</div>
        <div>送達時間：${cart.travelTime.toFixed(1)} 秒</div>
        <div>狀態：${cart.cooldown > 0 ? `外出中 ${cart.cooldown.toFixed(1)} 秒` : "可使用"}</div>
        <div>站點：${near ? "範圍內" : "距離太遠"}</div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "minecart-actions";

    const sendBtn = document.createElement("button");
    sendBtn.textContent = "送貨";
    sendBtn.disabled = !canSend;
    sendBtn.addEventListener("click", () => sendLoadToCart(cart.id));

    const upgradeBtn = document.createElement("button");
    upgradeBtn.textContent = cart.unlocked ? `升級 ${getCartUpgradeCost(cart)}` : "未解鎖";
    upgradeBtn.disabled = !cart.unlocked || !isNearBase() || state.money < getCartUpgradeCost(cart);
    upgradeBtn.addEventListener("click", () => upgradeSingleCart(cart.id));

    const unlockBtn = document.createElement("button");
    if (cart.unlocked) {
      unlockBtn.textContent = "已可用";
      unlockBtn.disabled = true;
    } else {
      const unlockCost = cart.unlockCost || 200;
      unlockBtn.textContent = `解鎖 ${unlockCost}`;
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

window.addEventListener("keydown", (e) => {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") input.up = true;
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") input.down = true;
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.left = true;
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.right = true;
});

window.addEventListener("keyup", (e) => {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") input.up = false;
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") input.down = false;
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.left = false;
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.right = false;
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
saveBtn.addEventListener("click", () => saveGame(true));
resetBtn.addEventListener("click", resetGame);

let state = loadGame() || createInitialState();
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
    saveGame(false);
  }

  render();
  updateUI();
  requestAnimationFrame(tick);
}

renderMessages();
renderMinecartPanel();
updateUI();
requestAnimationFrame(tick);
