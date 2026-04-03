const STORAGE_KEY = "black-hole-cleanup-save-v5";
const SAVE_VERSION = 5;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menuBtn = document.getElementById("menuBtn");
const closeMenuBtn = document.getElementById("closeMenuBtn");
const menuOverlay = document.getElementById("menuOverlay");
const levelList = document.getElementById("levelList");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

const upgradeOverlay = document.getElementById("upgradeOverlay");
const closeUpgradeBtn = document.getElementById("closeUpgradeBtn");
const holeInfo = document.getElementById("holeInfo");
const allCartInfo = document.getElementById("allCartInfo");
const upgradeHoleBtn = document.getElementById("upgradeHoleBtn");
const upgradeAllCartsBtn = document.getElementById("upgradeAllCartsBtn");
const minecartList = document.getElementById("minecartList");

const moneyText = document.getElementById("moneyText");
const loadText = document.getElementById("loadText");
const capacityText = document.getElementById("capacityText");
const progressText = document.getElementById("progressText");
const loadBarFill = document.getElementById("loadBarFill");
const messageLog = document.getElementById("messageLog");

const baseStatus = { sell: false, upgrade: false };

const WORLD = {
  width: 2600,
  height: 1600,
  holeRadiusBase: 24,
  holeRadiusGrowth: 3,
  stationRadius: 110,
  autoSellRadius: 86,
  upgradeRadius: 82,
};

const LEVELS = [
  { id: 1, name: "第 1 關｜書桌角落", itemCount: 36, reward: 120, theme: "desk" },
  { id: 2, name: "第 2 關｜閱讀區", itemCount: 48, reward: 160, theme: "reading" },
  { id: 3, name: "第 3 關｜工作室", itemCount: 60, reward: 220, theme: "studio" }
];

const ITEM_LIBRARY = [
  { type: "book", name: "書本", tier: "small", load: 8, value: 12, color: "#6b8bd6" },
  { type: "notebook", name: "筆記本", tier: "small", load: 9, value: 13, color: "#80b8a4" },
  { type: "sticky", name: "便條紙", tier: "small", load: 6, value: 10, color: "#f0d56b" },
  { type: "eraser", name: "橡皮擦", tier: "small", load: 7, value: 11, color: "#ed9fb0" },
  { type: "pencil", name: "鉛筆", tier: "small", load: 7, value: 11, color: "#e3ab49" },
  { type: "mug", name: "馬克杯", tier: "medium", load: 14, value: 23, color: "#d98173" },
  { type: "plant", name: "盆栽", tier: "medium", load: 16, value: 25, color: "#62b36b" },
  { type: "box", name: "收納盒", tier: "medium", load: 15, value: 24, color: "#b58a63" },
  { type: "lamp", name: "檯燈", tier: "large", load: 26, value: 42, color: "#f2d180" },
  { type: "chair", name: "椅子", tier: "large", load: 30, value: 48, color: "#8f6d4d" },
  { type: "sideTable", name: "小桌", tier: "large", load: 34, value: 56, color: "#a57a53" }
];

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  pointerActive: false,
  targetX: 0,
  targetY: 0
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getLevelConfig(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}

function makeBase() {
  return {
    x: 220,
    y: 820,
    sellZone: { x: 140, y: 820, r: WORLD.autoSellRadius },
    upgradeZone: { x: 320, y: 820, r: WORLD.upgradeRadius }
  };
}

function createItems(levelId) {
  const level = getLevelConfig(levelId);
  const items = [];
  const count = level.itemCount;

  for (let i = 0; i < count; i++) {
    let pool;
    const roll = Math.random();

    if (roll < 0.56) pool = ITEM_LIBRARY.filter(i => i.tier === "small");
    else if (roll < 0.86) pool = ITEM_LIBRARY.filter(i => i.tier === "medium");
    else pool = ITEM_LIBRARY.filter(i => i.tier === "large");

    const model = pickRandom(pool);

    items.push({
      id: `${levelId}_${i}`,
      type: model.type,
      name: model.name,
      tier: model.tier,
      load: model.load,
      value: model.value,
      color: model.color,
      x: rand(520, WORLD.width - 160),
      y: rand(140, WORLD.height - 140),
      collected: false,
      rotation: rand(-0.35, 0.35),
      scale: rand(0.9, 1.08)
    });
  }

  return items;
}

function createLevelState(levelId, existingPersistent = null) {
  const base = makeBase();

  const persistent = existingPersistent || {
    money: 300,
    holeLevel: 1,
    holeCapacity: 145,
    holeSpeed: 260,
    holeSuction: 74,
    carts: [
      { id: "cartA", name: "礦車 A", unlocked: true, level: 1, capacity: 90, travelTime: 7.0, cooldown: 0, x: 980, y: 460 },
      { id: "cartB", name: "礦車 B", unlocked: true, level: 1, capacity: 95, travelTime: 10.0, cooldown: 0, x: 1600, y: 760 },
      { id: "cartC", name: "礦車 C", unlocked: false, unlockCost: 220, level: 1, capacity: 100, travelTime: 14.0, cooldown: 0, x: 2160, y: 1140 }
    ],
    unlockedLevels: [1],
    completedLevels: [],
    perfectLevels: []
  };

  return {
    saveVersion: SAVE_VERSION,
    currentLevel: levelId,
    money: persistent.money,
    unlockedLevels: [...persistent.unlockedLevels],
    completedLevels: [...persistent.completedLevels],
    perfectLevels: [...persistent.perfectLevels],
    blackHole: {
      level: persistent.holeLevel,
      x: base.x,
      y: base.y,
      radius: WORLD.holeRadiusBase + persistent.holeLevel * WORLD.holeRadiusGrowth,
      speed: persistent.holeSpeed,
      load: 0,
      capacity: persistent.holeCapacity,
      suctionRange: persistent.holeSuction,
      pendingValue: 0
    },
    base,
    carts: structuredClone(persistent.carts),
    items: createItems(levelId),
    deliveries: [],
    messages: [],
    camera: { x: 0, y: 0 },
    autoSaveTimer: 0,
    ui: {
      menuOpen: false,
      upgradeOpen: false
    }
  };
}

function extractPersistentData(s) {
  return {
    money: s.money,
    holeLevel: s.blackHole.level,
    holeCapacity: s.blackHole.capacity,
    holeSpeed: s.blackHole.speed,
    holeSuction: s.blackHole.suctionRange,
    carts: s.carts.map(c => ({ ...c, cooldown: 0 })),
    unlockedLevels: [...s.unlockedLevels],
    completedLevels: [...s.completedLevels],
    perfectLevels: [...s.perfectLevels]
  };
}

function saveGame(showMessage = false) {
  try {
    const persistent = extractPersistentData(state);
    const payload = {
      saveVersion: SAVE_VERSION,
      persistent,
      currentLevel: state.currentLevel
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (showMessage) logMessage("已存檔。");
  } catch (e) {
    console.error(e);
    if (showMessage) logMessage("存檔失敗。");
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.saveVersion !== SAVE_VERSION) return null;
    if (!parsed.persistent) return null;
    return createLevelState(parsed.currentLevel || 1, parsed.persistent);
  } catch (e) {
    console.error(e);
    return null;
  }
}

function resetGame() {
  localStorage.removeItem(STORAGE_KEY);
  state = createLevelState(1);
  closeAllOverlays();
  renderLevelList();
  renderMinecartPanel();
  renderMessages();
  updateUI();
  logMessage("已重置存檔。");
}

function teleportToLevel(levelId) {
  if (!state.unlockedLevels.includes(levelId)) {
    logMessage("這關還沒解鎖。");
    return;
  }
  const persistent = extractPersistentData(state);
  state = createLevelState(levelId, persistent);
  closeAllOverlays();
  renderLevelList();
  renderMinecartPanel();
  renderMessages();
  updateUI();
  logMessage(`已傳送到 ${getLevelConfig(levelId).name}。`);
}

function completeLevelIfNeeded() {
  const progress = getProgressPercent();

  if (progress >= 95 && !state.completedLevels.includes(state.currentLevel)) {
    state.completedLevels.push(state.currentLevel);

    const currentIndex = LEVELS.findIndex(l => l.id === state.currentLevel);
    const nextLevel = LEVELS[currentIndex + 1];
    if (nextLevel && !state.unlockedLevels.includes(nextLevel.id)) {
      state.unlockedLevels.push(nextLevel.id);
      logMessage(`已過關，解鎖 ${nextLevel.name}。`);
    } else {
      logMessage("已達過關條件。");
    }

    state.money += getLevelConfig(state.currentLevel).reward;
    logMessage(`過關獎勵 +${getLevelConfig(state.currentLevel).reward} 金幣。`);
    saveGame();
  }

  if (progress >= 100 && !state.perfectLevels.includes(state.currentLevel)) {
    state.perfectLevels.push(state.currentLevel);
    state.money += 120;
    logMessage("完美通關獎勵 +120 金幣。");
    saveGame();
  }
}

function logMessage(text) {
  state.messages.unshift({ id: `${Date.now()}_${Math.random()}`, text });
  state.messages = state.messages.slice(0, 6);
  renderMessages();
}

function renderMessages() {
  messageLog.innerHTML = "";
  for (const m of state.messages) {
    const div = document.createElement("div");
    div.className = "message";
    div.textContent = m.text;
    messageLog.appendChild(div);
  }
}

function getCollectedCount() {
  return state.items.filter(i => i.collected).length;
}

function getProgressPercent() {
  return (getCollectedCount() / state.items.length) * 100;
}

function isNear(point, x, y, r) {
  return distance(point, { x, y }) <= r;
}

function holePos() {
  return { x: state.blackHole.x, y: state.blackHole.y };
}

function isNearUpgradeZone() {
  return isNear(holePos(), state.base.upgradeZone.x, state.base.upgradeZone.y, state.base.upgradeZone.r);
}

function isNearSellZone() {
  return isNear(holePos(), state.base.sellZone.x, state.base.sellZone.y, state.base.sellZone.r);
}

function isNearCartStation(cart) {
  return isNear(holePos(), cart.x, cart.y, WORLD.stationRadius);
}

function openMenu() {
  state.ui.menuOpen = true;
  menuOverlay.classList.remove("hidden");
  renderLevelList();
}

function closeMenu() {
  state.ui.menuOpen = false;
  menuOverlay.classList.add("hidden");
}

function openUpgrade() {
  state.ui.upgradeOpen = true;
  upgradeOverlay.classList.remove("hidden");
  renderMinecartPanel();
  updateUpgradeInfo();
}

function closeUpgrade() {
  state.ui.upgradeOpen = false;
  upgradeOverlay.classList.add("hidden");
}

function closeAllOverlays() {
  closeMenu();
  closeUpgrade();
}

function renderLevelList() {
  levelList.innerHTML = "";
  for (const level of LEVELS) {
    const btn = document.createElement("button");
    btn.className = "level-btn";
    const unlocked = state.unlockedLevels.includes(level.id);
    const completed = state.completedLevels.includes(level.id);
    const perfect = state.perfectLevels.includes(level.id);

    btn.textContent = `${level.name}${perfect ? " ★" : completed ? " ✓" : ""}`;
    btn.disabled = !unlocked;
    if (!unlocked) btn.classList.add("locked");
    btn.addEventListener("click", () => teleportToLevel(level.id));
    levelList.appendChild(btn);
  }
}

function getHoleUpgradeCost() {
  return 120 + state.blackHole.level * 90;
}

function getCartUpgradeCost(cart) {
  return 80 + cart.level * 70;
}

function getUpgradeAllCost() {
  const unlocked = state.carts.filter(c => c.unlocked);
  const total = unlocked.reduce((sum, c) => sum + getCartUpgradeCost(c), 0);
  return Math.floor(total * 1.35);
}

function updateUpgradeInfo() {
  holeInfo.innerHTML = `
    等級：Lv.${state.blackHole.level}<br>
    容量：${state.blackHole.capacity}<br>
    吸力範圍：${state.blackHole.suctionRange}<br>
    升級費用：${getHoleUpgradeCost()}
  `;
  allCartInfo.innerHTML = `
    已解鎖礦車：${state.carts.filter(c => c.unlocked).length} 台<br>
    全部升級費用：${getUpgradeAllCost()}
  `;
  upgradeHoleBtn.disabled = state.money < getHoleUpgradeCost();
  upgradeAllCartsBtn.disabled = state.money < getUpgradeAllCost();
}

function upgradeBlackHole() {
  const cost = getHoleUpgradeCost();
  if (state.money < cost) {
    logMessage(`金幣不足，黑洞升級需要 ${cost}。`);
    return;
  }
  state.money -= cost;
  state.blackHole.level += 1;
  state.blackHole.capacity = Math.floor(state.blackHole.capacity * 1.18);
  state.blackHole.speed = Math.min(420, state.blackHole.speed + 15);
  state.blackHole.suctionRange = Math.min(150, state.blackHole.suctionRange + 8);
  state.blackHole.radius = WORLD.holeRadiusBase + state.blackHole.level * WORLD.holeRadiusGrowth;
  logMessage(`黑洞升到 Lv.${state.blackHole.level}。`);
  updateUpgradeInfo();
  updateUI();
  saveGame();
}

function upgradeSingleCart(cartId) {
  const cart = state.carts.find(c => c.id === cartId);
  if (!cart || !cart.unlocked) return;
  const cost = getCartUpgradeCost(cart);
  if (state.money < cost) {
    logMessage(`金幣不足，${cart.name} 升級需要 ${cost}。`);
    return;
  }
  state.money -= cost;
  cart.level += 1;
  cart.capacity = Math.floor(cart.capacity * 1.2);
  cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));
  logMessage(`${cart.name} 已升到 Lv.${cart.level}。`);
  renderMinecartPanel();
  updateUpgradeInfo();
  updateUI();
  saveGame();
}

function upgradeAllCarts() {
  const cost = getUpgradeAllCost();
  if (state.money < cost) {
    logMessage(`金幣不足，全部礦車升級需要 ${cost}。`);
    return;
  }
  state.money -= cost;
  for (const cart of state.carts.filter(c => c.unlocked)) {
    cart.level += 1;
    cart.capacity = Math.floor(cart.capacity * 1.2);
    cart.travelTime = Math.max(3, Number((cart.travelTime * 0.92).toFixed(1)));
  }
  logMessage("全部已解鎖礦車都升級了。");
  renderMinecartPanel();
  updateUpgradeInfo();
  updateUI();
  saveGame();
}

function unlockCart(cartId) {
  const cart = state.carts.find(c => c.id === cartId);
  if (!cart || cart.unlocked) return;
  const cost = cart.unlockCost || 220;
  if (state.money < cost) {
    logMessage(`金幣不足，解鎖 ${cart.name} 需要 ${cost}。`);
    return;
  }
  state.money -= cost;
  cart.unlocked = true;
  logMessage(`${cart.name} 已解鎖。`);
  renderMinecartPanel();
  updateUpgradeInfo();
  updateUI();
  saveGame();
}

function renderMinecartPanel() {
  minecartList.innerHTML = "";

  for (const cart of state.carts) {
    const card = document.createElement("div");
    card.className = "minecart-card";

    card.innerHTML = `
      <div class="minecart-head">
        <div class="minecart-name">${cart.name}</div>
        <div>${cart.unlocked ? `Lv.${cart.level}` : "未解鎖"}</div>
      </div>
      <div class="minecart-meta">
        容量：${cart.capacity}<br>
        送達時間：${cart.travelTime.toFixed(1)} 秒<br>
        狀態：${cart.cooldown > 0 ? `外出中 ${cart.cooldown.toFixed(1)} 秒` : "可使用"}
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "minecart-actions";

    const upgradeBtn = document.createElement("button");
    if (cart.unlocked) {
      upgradeBtn.textContent = `升級 ${getCartUpgradeCost(cart)}`;
      upgradeBtn.disabled = state.money < getCartUpgradeCost(cart);
      upgradeBtn.addEventListener("click", () => upgradeSingleCart(cart.id));
    } else {
      upgradeBtn.textContent = `解鎖 ${cart.unlockCost || 220}`;
      upgradeBtn.disabled = state.money < (cart.unlockCost || 220);
      upgradeBtn.addEventListener("click", () => unlockCart(cart.id));
    }

    const infoBtn = document.createElement("button");
    infoBtn.textContent = "查看站點";
    infoBtn.addEventListener("click", () => {
      closeUpgrade();
      state.blackHole.x = cart.x - 40;
      state.blackHole.y = cart.y;
      logMessage(`已移到 ${cart.name} 附近。`);
    });

    actions.appendChild(upgradeBtn);
    actions.appendChild(infoBtn);
    card.appendChild(actions);
    minecartList.appendChild(card);
  }
}

function autoSellAtBase() {
  if (!isNearSellZone()) return;
  if (state.blackHole.load <= 0) return;

  const value = state.blackHole.pendingValue || 0;
  state.money += value;
  state.blackHole.load = 0;
  state.blackHole.pendingValue = 0;
  logMessage(`自動回收完成，獲得 ${value} 金幣。`);
  completeLevelIfNeeded();
  saveGame();
}

function sendLoadToCart(cart) {
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
    logMessage("黑洞裡沒有東西。");
    return;
  }

  const ratio = Math.min(1, cart.capacity / state.blackHole.load);
  const sentLoad = Math.floor(state.blackHole.load * ratio);
  const sentValue = Math.floor(state.blackHole.pendingValue * ratio);

  if (sentLoad <= 0 || sentValue <= 0) {
    logMessage(`${cart.name} 現在無法裝下這批貨。`);
    return;
  }

  state.blackHole.load -= sentLoad;
  state.blackHole.pendingValue -= sentValue;
  cart.cooldown = cart.travelTime;
  state.deliveries.push({
    id: `${Date.now()}_${cart.id}`,
    cartId: cart.id,
    remaining: cart.travelTime,
    value: sentValue
  });
  logMessage(`${cart.name} 已出發，${cart.travelTime.toFixed(1)} 秒後入帳。`);
}

function updateDeliveries(dt) {
  for (const d of state.deliveries) d.remaining -= dt;

  const arrived = state.deliveries.filter(d => d.remaining <= 0);
  state.deliveries = state.deliveries.filter(d => d.remaining > 0);

  for (const d of arrived) {
    state.money += d.value;
    const cart = state.carts.find(c => c.id === d.cartId);
    if (cart) cart.cooldown = 0;
    logMessage(`礦車送達，入帳 ${d.value} 金幣。`);
    completeLevelIfNeeded();
    saveGame();
  }

  for (const cart of state.carts) {
    if (cart.cooldown > 0) cart.cooldown = Math.max(0, cart.cooldown - dt);
  }
}

function tryCollectItems() {
  for (const item of state.items) {
    if (item.collected) continue;
    const d = distance(holePos(), { x: item.x, y: item.y });

    if (d > state.blackHole.suctionRange) continue;
    if (state.blackHole.load + item.load > state.blackHole.capacity) continue;
    if (item.tier === "medium" && state.blackHole.level < 2) continue;
    if (item.tier === "large" && state.blackHole.level < 3) continue;

    item.collected = true;
    state.blackHole.load += item.load;
    state.blackHole.pendingValue += item.value;
  }
}

function updatePlayer(dt) {
  if (state.ui.menuOpen || state.ui.upgradeOpen) return;

  let dx = 0;
  let dy = 0;

  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;

  if (input.pointerActive) {
    const vx = input.targetX - state.blackHole.x;
    const vy = input.targetY - state.blackHole.y;
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

function updateZones() {
  const nearUpgrade = isNearUpgradeZone();

  if (nearUpgrade && !state.ui.upgradeOpen) {
    openUpgrade();
  }

  autoSellAtBase();
}

function updateCamera() {
  state.camera.x = clamp(state.blackHole.x - canvas.width / 2, 0, WORLD.width - canvas.width);
  state.camera.y = clamp(state.blackHole.y - canvas.height / 2, 0, WORLD.height - canvas.height);
}

function worldToScreen(x, y) {
  return { x: x - state.camera.x, y: y - state.camera.y };
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const cx = (clientX - rect.left) * sx;
  const cy = (clientY - rect.top) * sy;
  return { x: cx + state.camera.x, y: cy + state.camera.y };
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawRoundedRect(x, y, w, h, r, fill, stroke = null) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawFloor() {
  ctx.fillStyle = "#d9c6a2";
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

  const plankH = 52;
  for (let y = -((state.camera.y % plankH) + plankH); y < window.innerHeight + plankH; y += plankH) {
    ctx.fillStyle = y / plankH % 2 === 0 ? "#d8c39d" : "#d2bc93";
    ctx.fillRect(0, y, window.innerWidth, plankH - 2);
  }
}

function drawRoomDecor() {
  const theme = getLevelConfig(state.currentLevel).theme;

  if (theme === "desk") {
    drawRoundedRect(450 - state.camera.x, 150 - state.camera.y, 1700, 980, 30, "#caa989");
  } else if (theme === "reading") {
    drawRoundedRect(650 - state.camera.x, 220 - state.camera.y, 1500, 900, 30, "#c8a383");
    drawRoundedRect(420 - state.camera.x, 1160 - state.camera.y, 760, 200, 22, "#b58d69");
  } else {
    drawRoundedRect(540 - state.camera.x, 180 - state.camera.y, 1760, 1040, 30, "#c79f7d");
    drawRoundedRect(320 - state.camera.x, 120 - state.camera.y, 600, 210, 20, "#b38861");
  }

  drawRoundedRect(60 - state.camera.x, 620 - state.camera.y, 360, 400, 24, "#b18b67");
}

function drawBase() {
  const sell = worldToScreen(state.base.sellZone.x, state.base.sellZone.y);
  const up = worldToScreen(state.base.upgradeZone.x, state.base.upgradeZone.y);
  const center = worldToScreen(state.base.x, state.base.y);

  ctx.beginPath();
  ctx.arc(sell.x, sell.y, state.base.sellZone.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(68, 190, 113, 0.15)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(up.x, up.y, state.base.upgradeZone.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(79, 124, 255, 0.15)";
  ctx.fill();

  drawRoundedRect(center.x - 70, center.y - 46, 140, 92, 18, "#4e6386");
  drawRoundedRect(sell.x - 52, sell.y - 22, 104, 44, 12, "#49b870");
  drawRoundedRect(up.x - 52, up.y - 22, 104, 44, 12, "#4f7cff");

  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("基地", center.x - 18, center.y + 6);
  ctx.fillText("換錢", sell.x - 18, sell.y + 6);
  ctx.fillText("升級", up.x - 18, up.y + 6);
}

function drawMinecarts() {
  for (const cart of state.carts) {
    const p = worldToScreen(cart.x, cart.y);

    ctx.beginPath();
    ctx.arc(p.x, p.y, WORLD.stationRadius, 0, Math.PI * 2);
    ctx.fillStyle = isNearCartStation(cart) ? "rgba(72,213,154,0.16)" : "rgba(255,255,255,0.05)";
    ctx.fill();

    ctx.fillStyle = "#6b5747";
    ctx.fillRect(p.x - 36, p.y + 16, 72, 6);
    ctx.fillRect(p.x - 36, p.y + 4, 72, 6);

    drawRoundedRect(p.x - 21, p.y - 18, 42, 28, 6, cart.unlocked ? "#34c38f" : "#7b7b7b");
    ctx.fillStyle = "#2a2a2a";
    ctx.beginPath();
    ctx.arc(p.x - 12, p.y + 14, 6, 0, Math.PI * 2);
    ctx.arc(p.x + 12, p.y + 14, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(cart.name, p.x - 24, p.y - 30);

    if (cart.cooldown > 0) {
      ctx.fillText(`${cart.cooldown.toFixed(1)}秒`, p.x - 20, p.y + 40);
    }
  }
}

function drawBook(item) {
  drawRoundedRect(-16, -10, 32, 20, 4, item.color, "#395392");
  ctx.fillStyle = "#f5f1e6";
  ctx.fillRect(-12, -6, 22, 12);
  ctx.fillStyle = "#395392";
  ctx.fillRect(-14, -8, 4, 16);
}

function drawNotebook(item) {
  drawRoundedRect(-15, -11, 30, 22, 4, item.color, "#50716b");
  ctx.strokeStyle = "#f8f8f8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.lineTo(-8, 7);
  ctx.stroke();
}

function drawSticky(item) {
  drawRoundedRect(-11, -11, 22, 22, 3, item.color, "#d5bc59");
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-8, -8, 8, 6);
}

function drawEraser(item) {
  drawRoundedRect(-14, -8, 28, 16, 4, item.color, "#c97c89");
  ctx.fillStyle = "#fff4f6";
  ctx.fillRect(-14, -8, 14, 16);
}

function drawPencil() {
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
  drawRoundedRect(-11, -10, 20, 20, 6, item.color, "#9b5649");
  ctx.strokeStyle = "#9b5649";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(12, -1, 6, -1.2, 1.2);
  ctx.stroke();
}

function drawPlant() {
  drawRoundedRect(-10, 4, 20, 12, 3, "#b67e57", "#895f42");
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
  drawRoundedRect(-16, -6, 32, 20, 4, item.color, "#6f543d");
  ctx.fillStyle = item.color;
  ctx.fillRect(-16, -26, 6, 20);
  ctx.fillRect(10, -26, 6, 20);
  ctx.fillRect(-12, 14, 4, 12);
  ctx.fillRect(8, 14, 4, 12);
}

function drawSideTable(item) {
  drawRoundedRect(-20, -12, 40, 24, 5, item.color, "#825b3a");
  ctx.fillStyle = item.color;
  ctx.fillRect(-15, 12, 4, 15);
  ctx.fillRect(11, 12, 4, 15);
  ctx.fillRect(-15, -27, 4, 15);
  ctx.fillRect(11, -27, 4, 15);
}

function drawItem(item) {
  switch (item.type) {
    case "book": drawBook(item); break;
    case "notebook": drawNotebook(item); break;
    case "sticky": drawSticky(item); break;
    case "eraser": drawEraser(item); break;
    case "pencil": drawPencil(item); break;
    case "mug": drawMug(item); break;
    case "plant": drawPlant(item); break;
    case "box": drawBox(item); break;
    case "lamp": drawLamp(item); break;
    case "chair": drawChair(item); break;
    case "sideTable": drawSideTable(item); break;
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
    ctx.shadowColor = "rgba(0,0,0,0.15)";
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

function render() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawFloor();
  drawRoomDecor();
  drawBase();
  drawMinecarts();
  drawItems();
  drawBlackHole();
}

function updateUI() {
  moneyText.textContent = String(state.money);
  loadText.textContent = String(state.blackHole.load);
  capacityText.textContent = String(state.blackHole.capacity);
  progressText.textContent = getProgressPercent().toFixed(1);
  loadBarFill.style.width = `${Math.min(100, (state.blackHole.load / state.blackHole.capacity) * 100)}%`;
  updateUpgradeInfo();
}

window.addEventListener("keydown", e => {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") input.up = true;
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") input.down = true;
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.left = true;
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.right = true;
  if (e.key === "Escape") closeAllOverlays();
});

window.addEventListener("keyup", e => {
  if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") input.up = false;
  if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") input.down = false;
  if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") input.left = false;
  if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") input.right = false;
});

canvas.addEventListener("pointerdown", e => {
  if (state.ui.menuOpen || state.ui.upgradeOpen) return;
  input.pointerActive = true;
  const w = screenToWorld(e.clientX, e.clientY);
  input.targetX = w.x;
  input.targetY = w.y;
});

canvas.addEventListener("pointermove", e => {
  if (!input.pointerActive) return;
  const w = screenToWorld(e.clientX, e.clientY);
  input.targetX = w.x;
  input.targetY = w.y;
});

window.addEventListener("pointerup", () => {
  input.pointerActive = false;
});

menuBtn.addEventListener("click", openMenu);
closeMenuBtn.addEventListener("click", closeMenu);
closeUpgradeBtn.addEventListener("click", closeUpgrade);
saveBtn.addEventListener("click", () => saveGame(true));
resetBtn.addEventListener("click", resetGame);
upgradeHoleBtn.addEventListener("click", upgradeBlackHole);
upgradeAllCartsBtn.addEventListener("click", upgradeAllCarts);

window.addEventListener("resize", resizeCanvas);

canvas.addEventListener("dblclick", () => {
  for (const cart of state.carts) {
    if (isNearCartStation(cart)) {
      sendLoadToCart(cart);
      break;
    }
  }
});

let state = loadGame() || createLevelState(1);
let lastTime = performance.now();

function tick(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  updatePlayer(dt);
  tryCollectItems();
  updateDeliveries(dt);
  updateZones();
  completeLevelIfNeeded();
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

resizeCanvas();
renderLevelList();
renderMinecartPanel();
renderMessages();
updateUI();
requestAnimationFrame(tick);
