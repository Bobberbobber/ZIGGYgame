const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const $ = (id) => document.getElementById(id);
const state = {
  phase: "home",
  time: 0,
  wave: 1,
  waveKills: 0,
  totalKills: 0,
  attackersSpawned: 0,
  score: 0,
  coins: 0,
  core: 100,
  playerHp: 100,
  playerMaxHp: 100,
  shield: 50,
  shieldMax: 50,
  shieldRechargeDelay: 2.5,
  shieldRechargeRate: 18,
  shieldRechargeTimer: 0,
  level: 1,
  xp: 0,
  nextXp: 100,
  fireCooldown: 0,
  spawnTimer: 0,
  dashCooldown: 0,
  grenadeCooldown: 0,
  screenShake: 0,
  muzzleFlash: 0,
  stamina: 5,
  sound: true,
  buildMode: false,
  removeMode: false,
  pendingTowerType: "sentry",
  bossSpawned: false,
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  touchMove: { x: 0, y: 0 },
  player: { x: 0, y: 0, r: 13, angle: 0 },
  bullets: [],
  grenades: [],
  coinsOnGround: [],
  enemies: [],
  towers: [],
  particles: [],
  shockwaves: [],
  weapon: "Pulse Rifle",
  attackersHit: 0,
  upgrades: {
    damage: 18,
    fireRate: 240,
    speed: 2.7,
    multishot: 1,
    homing: 0,
    dash: 1,
    towerDamage: 1,
    towerLife: 1,
    towerRate: 1,
    towerRange: 260,
    towerHoming: 0,
    defense: 0,
    magnet: 0,
    turretLimit: 2,
    shieldCapacity: 50,
    grenadeRadius: 58,
    grenadeDamage: 65,
    grenadeCooldown: 2.5,
    extraGrenade: 1,
    clusterGrenade: false,
    stickyGrenade: false,
    element: null,
    elementPower: 0,
  },
  structures: { sentry: true, tesla: false },
};
let audioContext;
function sound(type) {
  if (!state.sound) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type === "hit" ? "square" : "sine";
  oscillator.frequency.value =
    type === "shot" ? 180 : type === "hit" ? 90 : type === "boss" ? 70 : 420;
  gain.gain.setValueAtTime(0.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.2);
}
function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  if (!state.player.x) {
    state.player.x = canvas.clientWidth / 2;
    state.player.y = canvas.clientHeight / 2;
  }
}
window.addEventListener("resize", resize);
resize();
function setText(id, text) {
  $(id).textContent = text;
}
function log(message) {
  const time = String(Math.floor(state.time)).padStart(2, "0");
  $("log").insertAdjacentHTML(
    "afterbegin",
    `<p><span>00:${time}</span> ${message}</p>`,
  );
  while ($("log").children.length > 4) $("log").lastChild.remove();
}
function updateUI() {
  setText("levelValue", String(state.level).padStart(2, "0"));
  setText("xpValue", `${state.xp} / ${state.nextXp} XP`);
  $("xpBar").style.width = `${Math.min(100, (state.xp / state.nextXp) * 100)}%`;
  setText("perkValue", `+${state.level - 1} PERKS`);
  setText("waveValue", String(state.wave).padStart(2, "0"));
  setText("waveTitle", `WAVE ${String(state.wave).padStart(2, "0")}`);
  setText("killsValue", state.totalKills);
  setText("scoreValue", String(state.score).padStart(5, "0"));
  setText("coreValue", `${Math.max(0, Math.round(state.core))}%`);
  setText("playerHpValue", `${Math.max(0, Math.round(state.playerHp))}%`);
  setText("shieldValue", `${Math.max(0, Math.round(state.shield))}%`);
  $("playerHpBar").style.width = `${Math.max(0, state.playerHp / state.playerMaxHp * 100)}%`;
  $("shieldBar").style.width = `${Math.max(0, state.shield / state.shieldMax * 100)}%`;
  setText("staminaValue", `${state.stamina.toFixed(1)}s`);
  $("staminaBar").style.width = `${state.stamina / 5 * 100}%`;
  $("staminaBar").classList.toggle("empty", state.stamina <= 0);
  setText("coinValue", `${state.coins} COINS`);
  const profile = weaponProfiles[state.weapon] || weaponProfiles["Pulse Rifle"];
  setText("weaponValue", state.weapon.toUpperCase());
  $("weaponIcon").style.color = profile.color;
  setText("damageValue", `DAMAGE ${Math.round(state.upgrades.damage)}`);
  setText(
    "fireRateValue",
    `FIRE RATE ${Math.round(state.upgrades.fireRate)} RPM`,
  );
  setText("enemyCount", `${state.enemies.length} HOSTILES`);
  $("waveBar").style.width =
    `${Math.min(100, (state.waveKills / (4 + state.wave * 2)) * 100)}%`;
  setText(
    "sentryValue",
    `${state.towers.length} / UNLIMITED`,
  );
  setText(
    "towerValue",
    state.removeMode ? "CLICK TO REMOVE" : "UNLIMITED / COIN GATED",
  );
  setText("shopCost", state.towers.length < 2 ? "FREE" : "100 COINS");
  const teslaButton = $("buyTeslaButton");
  if (teslaButton) {
    teslaButton.disabled = !state.structures.tesla;
    teslaButton.querySelector("small").textContent = state.structures.tesla ? "150 COINS" : "LOCKED";
  }
  const threat =
    state.wave % 5 === 0
      ? "BOSS"
      : state.wave < 3
        ? "LOW"
        : state.wave < 6
          ? "ELEVATED"
          : "CRITICAL";
  setText("threatValue", threat);
  $("bossAlert").textContent = state.wave % 5 === 0 ? "WARDEN INBOUND" : "";
}
function reset() {
  Object.assign(state, {
    phase: "running",
    time: 0,
    wave: 1,
    waveKills: 0,
    totalKills: 0,
    attackersSpawned: 0,
    score: 0,
    coins: 0,
    level: 1,
    xp: 0,
    nextXp: 100,
    core: 100,
    playerHp: 100,
    playerMaxHp: 100,
    shield: 50,
    shieldMax: 50,
    shieldRechargeDelay: 2.5,
    shieldRechargeRate: 18,
    shieldRechargeTimer: 0,
    fireCooldown: 0,
    grenadeCooldown: 0,
    screenShake: 0,
    muzzleFlash: 0,
    spawnTimer: 0,
    dashCooldown: 0,
    stamina: 5,
    buildMode: false,
    removeMode: false,
    pendingTowerType: "sentry",
    bossSpawned: false,
    bullets: [],
    grenades: [],
    coinsOnGround: [],
    enemies: [],
    towers: [],
    particles: [],
    shockwaves: [],
    weapon: "Pulse Rifle",
    attackersHit: 0,
    structures: { sentry: true, tesla: false },
    upgrades: {
      damage: 18,
      fireRate: 240,
      speed: 2.7,
      multishot: 1,
      homing: 0,
      dash: 1,
      towerDamage: 1,
      towerLife: 1,
      towerRate: 1,
      towerRange: 260,
      towerHoming: 0,
      defense: 0,
      magnet: 0,
      turretLimit: 2,
      shieldCapacity: 50,
      grenadeRadius: 58,
      grenadeDamage: 65,
      grenadeCooldown: 2.5,
      extraGrenade: 1,
      clusterGrenade: false,
      stickyGrenade: false,
      element: null,
      elementPower: 0,
    },
  });
  state.player.x = canvas.clientWidth / 2;
  state.player.y = canvas.clientHeight / 2;
  $("startOverlay").classList.add("hidden");
  $("gameOverOverlay").classList.add("hidden");
  $("upgradeOverlay").classList.add("hidden");
  setText("statusText", "SYSTEMS ONLINE");
  log("Outpost link established.");
  updateUI();
  last = performance.now();
  requestAnimationFrame(loop);
}
const rarityInfo = {
  Common: ["#91a69b", 50],
  Uncommon: ["#6be4d8", 30],
  Rare: ["#62a7ff", 15],
  Epic: ["#d58cff", 4],
  Legendary: ["#ffcf68", 1],
};
const upgradePool = [
  [
    "OVERCHARGE",
    "Pulse rifle damage +8",
    "Common",
    () => (state.upgrades.damage += 8),
  ],
  [
    "QUICK HANDS",
    "Pulse rifle fire rate +60 RPM",
    "Common",
    () => (state.upgrades.fireRate += 60),
  ],
  [
    "LIGHT FEET",
    "Movement speed +0.55",
    "Common",
    () => (state.upgrades.speed += 0.55),
  ],
  [
    "FORTIFIED CORE",
    "Defense reduces incoming damage",
    "Common",
    () => (state.upgrades.defense += 0.18),
  ],
  [
    "SHIELD CAPACITY",
    "Energy shield capacity +25",
    "Common",
    () => {
      state.upgrades.shieldCapacity += 25;
      state.shieldMax += 25;
      state.shield = state.shieldMax;
    },
  ],
  [
    "SHIELD RECHARGE",
    "Shield recharge rate +8 per second",
    "Uncommon",
    () => (state.shieldRechargeRate += 8),
  ],
  [
    "QUICK SHIELD",
    "Shield recharge delay -0.5 seconds",
    "Uncommon",
    () => (state.shieldRechargeDelay = Math.max(0.7, state.shieldRechargeDelay - 0.5)),
  ],
  [
    "REPAIR NANITES",
    "Restore 20% core integrity",
    "Uncommon",
    () => (state.core = Math.min(100, state.core + 20)),
  ],
  [
    "TWIN PULSE",
    "Fire one extra projectile",
    "Uncommon",
    () => state.upgrades.multishot++,
  ],
  [
    "SENTRY ARMOR",
    "Turret survives 20% longer",
    "Uncommon",
    () => (state.upgrades.towerLife += 0.2),
  ],
  [
    "PHASE DASH",
    "Dash cooldown is reduced",
    "Uncommon",
    () => (state.upgrades.dash += 0.35),
  ],
  [
    "MAGNET I",
    "Collect coins within a small radius",
    "Uncommon",
    () => (state.upgrades.magnet = Math.max(1, state.upgrades.magnet)),
  ],
  [
    "HOMING ROUNDS",
    "Bullets curve toward hostiles",
    "Rare",
    () => state.upgrades.homing++,
  ],
  [
    "SENTRY DAMAGE",
    "Turret damage +35%",
    "Rare",
    () => (state.upgrades.towerDamage += 0.35),
  ],
  [
    "SENTRY RANGE",
    "Turret range +90",
    "Rare",
    () => (state.upgrades.towerRange += 90),
  ],
  [
    "RAPID SENTRY",
    "Turret attack speed +35%",
    "Rare",
    () => (state.upgrades.towerRate += 0.35),
  ],
  [
    "SENTRY TRACKING",
    "Turret bullets home toward hostiles",
    "Epic",
    () => (state.upgrades.towerHoming = 1),
  ],
  [
    "MAGNET II",
    "Magnet radius increases to medium",
    "Rare",
    () => (state.upgrades.magnet = Math.max(2, state.upgrades.magnet)),
  ],
  [
    "TESLA NODE",
    "Unlock a chain-lightning structure",
    "Epic",
    () => (state.structures.tesla = true),
  ],
  [
    "THIRD SENTRY",
    "Unlock a 3rd turret for 100 coins",
    "Epic",
    () => (state.upgrades.turretLimit = 3),
  ],
  [
    "VOID MAGAZINE",
    "Pulse rifle damage +28",
    "Epic",
    () => (state.upgrades.damage += 28),
  ],
  [
    "MAGNET III",
    "Magnet radius increases to large",
    "Epic",
    () => (state.upgrades.magnet = 3),
  ],
  [
    "NANITE SWARM",
    "Homing rounds deal +20 damage",
    "Legendary",
    () => {
      state.upgrades.homing++;
      state.upgrades.damage += 20;
    },
  ],
  ["BLAST RADIUS", "Grenades explode across a wider area", "Common", () => (state.upgrades.grenadeRadius += 18)],
  ["GRENADE DAMAGE", "Grenades deal +28 explosion damage", "Common", () => (state.upgrades.grenadeDamage += 28)],
  ["FASTER COOLDOWN", "Throw grenades more often", "Uncommon", () => (state.upgrades.grenadeCooldown = Math.max(.7, state.upgrades.grenadeCooldown - .35))],
  ["EXTRA GRENADE", "Throw two grenades per press", "Uncommon", () => (state.upgrades.extraGrenade = 2)],
  ["CLUSTER GRENADE", "Detonations split into smaller blasts", "Rare", () => (state.upgrades.clusterGrenade = true)],
  ["STICKY GRENADE", "Grenades attach to the first enemy hit", "Rare", () => (state.upgrades.stickyGrenade = true)],
  ["ROCKET LAUNCHER", "Slow, explosive, high-damage shots", "Epic", () => (state.weapon = "Rocket Launcher")],
  ["MINIGUN", "Very fast fire rate with light damage", "Epic", () => { state.weapon = "Minigun"; state.upgrades.fireRate += 360; state.upgrades.damage = Math.max(8, state.upgrades.damage - 4); }],
  ["LASER RIFLE", "Continuous piercing beam", "Legendary", () => (state.weapon = "Laser Rifle")],
  ["SHOTGUN", "Seven close-range pellets with heavy spread", "Rare", () => (state.weapon = "Shotgun")],
  ["RAILGUN", "Piercing rounds travel straight through hostiles", "Epic", () => (state.weapon = "Railgun")],
  ["TESLA COIL GUN", "Chain lightning bounces between three hostiles", "Epic", () => (state.weapon = "Tesla Coil Gun")],
  ["FLAMETHROWER", "Hold fire to burn enemies in a cone", "Rare", () => { state.weapon = "Flamethrower"; state.upgrades.element = "fire"; }],
  ["FIRE CORE", "Hits burn enemies over time", "Rare", () => { state.upgrades.element = "fire"; state.upgrades.elementPower++; }],
  ["ICE CORE", "Hits slow enemies with frost", "Rare", () => { state.upgrades.element = "ice"; state.upgrades.elementPower++; }],
  ["POISON CORE", "Poisoned enemies take 30% more damage", "Epic", () => { state.upgrades.element = "poison"; state.upgrades.elementPower++; }],
  ["DARK CORE", "Hits trigger a violet area burst", "Legendary", () => { state.upgrades.element = "dark"; state.upgrades.elementPower++; }],
];
function weightedRarity() {
  const boost = Math.min(18, state.level * 1.2);
  const weights = {
    Common: Math.max(20, 50 - boost * 1.4),
    Uncommon: 30 + boost * 0.7,
    Rare: 15 + boost * 0.5,
    Epic: 4 + boost * 0.18,
    Legendary: 1 + boost * 0.04,
  };
  const roll =
    Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
  let total = 0;
  for (const rarity of Object.keys(weights)) {
    total += weights[rarity];
    if (roll <= total) return rarity;
  }
  return "Common";
}
function showUpgrades() {
  state.phase = "upgrade";
  state.mouse.down = false;
  const available = [...upgradePool];
  const choices = [];
  while (choices.length < 3 && available.length) {
    const rarity = weightedRarity();
    const matches = available.filter((item) => item[2] === rarity);
    const pick = (matches.length ? matches : available)[
      Math.floor(
        Math.random() * (matches.length ? matches.length : available.length),
      )
    ];
    choices.push(pick);
    available.splice(available.indexOf(pick), 1);
  }
  $("upgradeOptions").innerHTML = choices
    .map(
      (choice, i) =>
        `<button class="upgrade-button rarity-${choice[2].toLowerCase()}" data-upgrade="${i}"><span class="rarity-label">${choice[2]}</span><b>${choice[0]}</b><small>${choice[1]}</small></button>`,
    )
    .join("");
  $("upgradeOverlay").classList.remove("hidden");
  setText("upgradeNote", "Choose one upgrade before the next assault.");
  $("upgradeOptions")
    .querySelectorAll("button")
    .forEach(
      (button, i) =>
        (button.onclick = () => {
          choices[i][3]();
          $("upgradeOptions").innerHTML = "";
          $("upgradeOverlay").classList.add("hidden");
          state.phase = "running";
          setText("upgradeNote", "Upgrade installed. Keep moving.");
          log(`${choices[i][0]} installed.`);
          updateUI();
          last = performance.now();
          requestAnimationFrame(loop);
        }),
    );
  sound("level");
}
function addXp(amount) {
  state.xp += amount;
  while (state.xp >= state.nextXp) {
    state.xp -= state.nextXp;
    state.level++;
    state.nextXp = Math.round(state.nextXp * 1.35);
    showUpgrades();
    log(`Level ${state.level} reached. Upgrade ready.`);
  }
}
function enemyAtEdge(type) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    side = Math.floor(Math.random() * 4),
    pad = 35;
  return {
    x: side === 0 ? -pad : side === 1 ? w + pad : Math.random() * w,
    y: side === 2 ? -pad : side === 3 ? h + pad : Math.random() * h,
    type,
  };
}
function spawn(type, elite = false) {
  const info = {
    drone: [11, 24 + state.wave * 3, 0.68 + state.wave * 0.02, "#6be4d8", 20],
    brute: [17, 45 + state.wave * 5, 0.42 + state.wave * 0.015, "#ff8c57", 35],
    shooter: [13, 31 + state.wave * 4, 0.5 + state.wave * 0.015, "#d58cff", 30],
    boss: [34, 430 + state.wave * 45, 0.22 + state.wave * 0.01, "#ff5864", 180],
  }[type];
  const enemy = enemyAtEdge(type);
  const isElite = elite && type !== "boss";
  state.enemies.push({
    ...enemy,
    r: info[0] * (isElite ? 1.12 : 1),
    hp: info[1] * (isElite ? 3 : 1),
    maxHp: info[1] * (isElite ? 3 : 1),
    speed: info[2] * (isElite ? 0.86 : 1),
    color: isElite ? "#ffcf68" : info[3],
    xp: info[4] * (isElite ? 2 : 1),
    elite: isElite,
    displayHp: info[1] * (isElite ? 3 : 1),
    burn: 0,
    slow: 0,
    poisoned: 0,
    shot: 2.5,
  });
}
function spawnWaveEnemy() {
  state.attackersSpawned++;
  const roll = Math.random();
  spawn(
    roll < Math.min(0.12, state.wave * 0.018)
      ? "shooter"
      : roll < Math.min(0.22, state.wave * 0.035)
        ? "brute"
        : "drone",
    state.level > 5 && state.attackersSpawned % 10 === 0,
  );
}
function burst(x, y, color, count = 8) {
  for (let i = 0; i < count; i++)
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      life: 1,
      color,
    });
}
const weaponProfiles = {
  "Pulse Rifle": { rate: 1, damage: 1, color: "#c7f36b", size: 3, shape: "rifle" },
  "Rocket Launcher": { rate: .28, damage: 4, color: "#ff8c57", size: 6, shape: "rocket" },
  Minigun: { rate: 3.4, damage: .45, color: "#c7f36b", size: 2, shape: "minigun" },
  "Laser Rifle": { rate: 8, damage: .25, color: "#6be4d8", size: 2, shape: "laser" },
  Shotgun: { rate: .55, damage: .65, color: "#ffcf68", size: 3, shape: "shotgun" },
  Railgun: { rate: .22, damage: 3.5, color: "#62a7ff", size: 5, shape: "railgun" },
  "Tesla Coil Gun": { rate: .7, damage: 1.4, color: "#d58cff", size: 4, shape: "tesla" },
  Flamethrower: { rate: 7, damage: .24, color: "#ff8c57", size: 3, shape: "flame" },
};
function fireFlamethrower() {
  const range = 185;
  state.enemies.forEach((enemy) => {
    const distance = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    const angle = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
    const delta = Math.atan2(Math.sin(angle - state.player.angle), Math.cos(angle - state.player.angle));
    if (distance < range && Math.abs(delta) < 0.48) {
      enemy.hp -= state.upgrades.damage * 0.24;
      enemy.burn = Math.max(enemy.burn, 2 + state.upgrades.elementPower);
    }
  });
  burst(state.player.x + Math.cos(state.player.angle) * 70, state.player.y + Math.sin(state.player.angle) * 70, "#ff8c57", 5);
}
function defeatEnemy(enemy) {
  const index = state.enemies.indexOf(enemy);
  if (index < 0) return;
  state.enemies.splice(index, 1);
  state.waveKills++;
  state.totalKills++;
  const reward = enemy.elite ? 50 : 10;
  state.coinsOnGround.push({ x: enemy.x, y: enemy.y, value: reward, life: 30 });
  state.score += enemy.type === "boss" ? 1200 : enemy.type === "brute" ? 250 : 100;
  addXp(enemy.xp);
  burst(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 35 : 14);
  log(`Hostile cleared. ${reward} coin pickup dropped.`);
}
function fireTeslaCoil() {
  const target = state.enemies
    .map((enemy) => ({ enemy, distance: Math.hypot(enemy.x - state.mouse.x, enemy.y - state.mouse.y) }))
    .sort((a, b) => a.distance - b.distance)[0]?.enemy;
  if (!target || Math.hypot(target.x - state.player.x, target.y - state.player.y) > 360) return;
  const chain = [target];
  while (chain.length < 3) {
    const next = state.enemies
      .filter((enemy) => !chain.includes(enemy))
      .sort((a, b) => Math.hypot(a.x - chain.at(-1).x, a.y - chain.at(-1).y) - Math.hypot(b.x - chain.at(-1).x, b.y - chain.at(-1).y))[0];
    if (!next || Math.hypot(next.x - chain.at(-1).x, next.y - chain.at(-1).y) > 135) break;
    chain.push(next);
  }
  chain.forEach((enemy, index) => {
    enemy.hp -= state.upgrades.damage * 1.4 * (1 - index * 0.2);
    burst(enemy.x, enemy.y, "#d58cff", 7);
  });
  state.shockwaves.push({ x: target.x, y: target.y, radius: 12, maxRadius: 42, life: .8, color: "#d58cff" });
}
function explode(x, y, radius, damage, source = "grenade") {
  state.shockwaves.push({ x, y, radius: 8, maxRadius: radius, life: 1, color: source === "grenade" ? "#ff8c57" : "#d58cff" });
  burst(x, y, source === "grenade" ? "#ff8c57" : "#d58cff", 22);
  state.enemies.forEach((enemy) => {
    if (Math.hypot(enemy.x - x, enemy.y - y) < radius) enemy.hp -= damage;
  });
  state.screenShake = Math.max(state.screenShake, .18);
}
function throwGrenade() {
  if (state.grenadeCooldown > 0) return;
  const count = state.upgrades.extraGrenade;
  for (let i = 0; i < count; i++) state.grenades.push({ x: state.player.x, y: state.player.y, tx: state.mouse.x + (i ? 18 : 0), ty: state.mouse.y + (i ? 18 : 0), life: .75, fuse: 1.1, damage: state.upgrades.grenadeDamage });
  state.grenadeCooldown = state.upgrades.grenadeCooldown;
  sound("grenade");
}
function shoot(
  x = state.player.x,
  y = state.player.y,
  angle = state.player.angle,
  damage = state.upgrades.damage,
  source = "player",
) {
  const profile = weaponProfiles[state.weapon] || weaponProfiles["Pulse Rifle"];
  if (source === "player" && state.weapon === "Flamethrower") {
    fireFlamethrower();
    sound("flame");
    return;
  }
  if (source === "player" && state.weapon === "Tesla Coil Gun") {
    fireTeslaCoil();
    sound("tesla");
    return;
  }
  const count = source === "player"
    ? state.weapon === "Shotgun" ? 7 : 1
    : 1;
  const spread = state.weapon === "Shotgun" ? 0.16 : 0;
  for (let i = 0; i < count; i++) {
    const shotAngle = angle + (i - (count - 1) / 2) * spread;
    state.bullets.push({
      x: x + Math.cos(shotAngle) * 18,
      y: y + Math.sin(shotAngle) * 18,
      vx: Math.cos(shotAngle) * (state.weapon === "Railgun" ? 14 : 8),
      vy: Math.sin(shotAngle) * (state.weapon === "Railgun" ? 14 : 8),
      life: state.weapon === "Shotgun" ? .45 : state.weapon === "Railgun" ? .9 : 1.1,
      damage: damage * profile.damage * (state.weapon === "Shotgun" ? 0.65 : 1),
      source,
      color: source === "tower" ? "#6be4d8" : profile.color,
      size: source === "tower" ? 2 : profile.size,
      pierce: state.weapon === "Railgun",
      hitEnemies: [],
      trail: [],
      homing:
        (source === "player" && state.upgrades.homing > 0) ||
        (source === "tower" && state.upgrades.towerHoming > 0),
    });
  }
  state.muzzleFlash = .12;
  sound(source === "tower" ? "turret" : state.weapon === "Rocket Launcher" ? "rocket" : state.weapon === "Railgun" ? "rail" : "shot");
}
function toggleBuildMode() {
  state.buildMode = !state.buildMode;
  state.removeMode = false;
  towerButton.classList.toggle("selected", state.buildMode);
  destroyTowerButton.classList.remove("selected");
  setText(
    "upgradeNote",
    state.buildMode
      ? "Click the arena to place a sentry."
      : "Clear hostiles to earn XP.",
  );
}
function buildTower(x, y, type = state.pendingTowerType) {
  if (Math.hypot(x - state.player.x, y - state.player.y) < 65)
    return;
  const cost = type === "tesla" ? 150 : state.towers.length < 2 ? 0 : 100;
  if (state.coins < cost) {
    log("Not enough coins for another sentry.");
    return;
  }
  state.coins -= cost;
  state.towers.push({
    x,
    y,
    hp: 100,
    maxHp: 100,
    age: 0,
    cooldown: 0,
    angle: 0,
    type,
  });
  state.buildMode = false;
  towerButton.classList.remove("selected");
  sound("build");
  log(`${cost ? `Paid ${cost} coins. ` : ""}${type === "tesla" ? "Tesla tower" : "Sentry"} deployed.`);
  updateUI();
}
function buyTower(type = "sentry") {
  if (type === "tesla" && !state.structures.tesla) {
    log("Tesla Node upgrade required.");
    return;
  }
  state.pendingTowerType = type;
  toggleBuildMode();
  log(
    type === "tesla"
      ? "Tesla tower costs 150 coins. Choose a deployment point."
      : state.towers.length < 2
        ? "Sentry deployment is free. Choose a point."
        : "Sentry costs 100 coins. Choose a deployment point.",
  );
  updateUI();
}
function toggleRemoveMode() {
  state.removeMode = !state.removeMode;
  state.buildMode = false;
  destroyTowerButton.classList.toggle("selected", state.removeMode);
  towerButton.classList.remove("selected");
  setText(
    "upgradeNote",
    state.removeMode
      ? "Click a sentry to dismantle that specific turret."
      : "Clear hostiles to earn XP.",
  );
}
function removeTower(x, y) {
  if (!state.towers.length) return;
  const index = state.towers.reduce(
    (best, tower, i, towers) =>
      Math.hypot(tower.x - x, tower.y - y) <
      Math.hypot(towers[best].x - x, towers[best].y - y)
        ? i
        : best,
    0,
  );
  if (Math.hypot(state.towers[index].x - x, state.towers[index].y - y) < 32) {
    state.towers.splice(index, 1);
    log("Selected sentry dismantled.");
    updateUI();
  }
}
function towerFire(tower, target) {
  tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
  shoot(
    tower.x,
    tower.y,
    tower.angle,
    state.upgrades.damage * 0.55 * state.upgrades.towerDamage,
    "tower",
  );
  tower.cooldown = 0.8 / state.upgrades.towerRate;
}
function damagePlayer(amount) {
  const reducedDamage = amount * (1 - state.upgrades.defense);
  const shieldDamage = Math.min(state.shield, reducedDamage);
  state.shield -= shieldDamage;
  state.playerHp = Math.max(0, state.playerHp - (reducedDamage - shieldDamage));
  state.shieldRechargeTimer = state.shieldRechargeDelay;
  burst(state.player.x, state.player.y, shieldDamage ? "#6be4d8" : "#ff5864", 5);
}
function update(dt) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight,
    p = state.player;
  state.time += dt;
  state.fireCooldown -= dt;
  state.grenadeCooldown -= dt;
  state.muzzleFlash = Math.max(0, state.muzzleFlash - dt);
  state.screenShake = Math.max(0, state.screenShake - dt);
  state.spawnTimer -= dt;
  state.shieldRechargeTimer = Math.max(0, state.shieldRechargeTimer - dt);
  if (state.shieldRechargeTimer === 0)
    state.shield = Math.min(state.shieldMax, state.shield + state.shieldRechargeRate * dt);
  if (state.wave % 5 === 0 && !state.bossSpawned) {
    spawn("boss");
    state.bossSpawned = true;
    log("WARDEN BOSS DETECTED. Focus fire.");
    sound("boss");
  }
  if (
    state.spawnTimer <= 0 &&
    state.enemies.length < (state.wave % 5 === 0 ? 4 : 5 + state.wave * 2)
  ) {
    spawnWaveEnemy();
    state.spawnTimer = Math.max(0.32, 1.3 - state.wave * 0.07);
  }
  if (state.waveKills >= 4 + state.wave * 2 && state.enemies.length === 0) {
    state.wave++;
    state.waveKills = 0;
    state.bossSpawned = false;
    log(`Wave ${state.wave} inbound. Stay sharp.`);
    sound("level");
  }
  let dx = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0) + state.touchMove.x,
    dy = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0) + state.touchMove.y;
  const sprinting = state.keys.shift && state.stamina > 0 && (dx || dy);
  if (sprinting) state.stamina = Math.max(0, state.stamina - dt);
  else state.stamina = Math.min(5, state.stamina + dt * 0.8);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    const movementSpeed = state.upgrades.speed * (sprinting ? 1.5 : 1);
    p.x += (dx / len) * movementSpeed * 60 * dt;
    p.y += (dy / len) * movementSpeed * 60 * dt;
  }
  p.x = Math.max(22, Math.min(w - 22, p.x));
  p.y = Math.max(22, Math.min(h - 22, p.y));
  if (state.dashCooldown > 0) state.dashCooldown -= dt;
  if (state.keys[" "] && state.dashCooldown <= 0) {
    const dashX = dx || Math.cos(p.angle),
      dashY = dy || Math.sin(p.angle);
    p.x = Math.max(22, Math.min(w - 22, p.x + dashX * 70));
    p.y = Math.max(22, Math.min(h - 22, p.y + dashY * 70));
    state.dashCooldown = 2 / state.upgrades.dash;
    state.keys[" "] = false;
    burst(p.x, p.y, "#c7f36b", 10);
  }
  p.angle = Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x);
  const weaponRate = (weaponProfiles[state.weapon] || weaponProfiles["Pulse Rifle"]).rate;
  if (state.mouse.down && state.fireCooldown <= 0) {
    shoot();
    state.fireCooldown = 60 / (state.upgrades.fireRate * weaponRate);
  }
  state.grenades.forEach((grenade) => {
    grenade.fuse -= dt;
    const progress = Math.min(1, 1 - grenade.fuse / 1.1);
    grenade.x += (grenade.tx - grenade.x) * Math.min(1, dt * 5);
    grenade.y += (grenade.ty - grenade.y) * Math.min(1, dt * 5) - Math.sin(progress * Math.PI) * 90 * dt;
    if (grenade.fuse <= 0) {
      explode(grenade.x, grenade.y, state.upgrades.grenadeRadius, grenade.damage);
      if (state.upgrades.clusterGrenade) {
        for (let i = 0; i < 3; i++) explode(grenade.x + Math.cos(i * 2.1) * 28, grenade.y + Math.sin(i * 2.1) * 28, state.upgrades.grenadeRadius * .38, grenade.damage * .35, "cluster");
      }
      grenade.life = 0;
    }
  });
  state.grenades = state.grenades.filter((grenade) => grenade.life > 0);
  state.bullets.forEach((b) => {
    b.trail.push({ x: b.x, y: b.y, life: 1 });
    b.trail = b.trail.filter((point) => (point.life -= dt * 5) > 0).slice(-6);
    if (b.homing) {
      const target = state.enemies.reduce(
        (nearest, enemy) =>
          !nearest ||
          Math.hypot(enemy.x - b.x, enemy.y - b.y) <
            Math.hypot(nearest.x - b.x, nearest.y - b.y)
            ? enemy
            : nearest,
        null,
      );
      if (target) {
        const angle = Math.atan2(target.y - b.y, target.x - b.x);
        b.vx += Math.cos(angle) * 0.08;
        b.vy += Math.sin(angle) * 0.08;
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = (b.vx / speed) * 8;
        b.vy = (b.vy / speed) * 8;
      }
    }
    b.x += b.vx * 60 * dt;
    b.y += b.vy * 60 * dt;
    b.life -= dt;
  });
  state.bullets = state.bullets.filter(
    (b) => b.life > 0 && b.x > -30 && b.x < w + 30 && b.y > -30 && b.y < h + 30,
  );
  state.towers.forEach((tower) => {
    tower.age += dt;
    tower.cooldown -= dt;
    if (tower.type === "tesla") {
      if (tower.cooldown <= 0) {
        const targets = state.enemies.filter((enemy) => Math.hypot(enemy.x - tower.x, enemy.y - tower.y) < state.upgrades.towerRange);
        targets.forEach((enemy) => {
          enemy.hp -= state.upgrades.damage * 0.7 * state.upgrades.towerDamage;
          burst(enemy.x, enemy.y, "#d58cff", 4);
        });
        tower.cooldown = 5 / state.upgrades.towerRate;
      }
      return;
    }
    if (tower.cooldown <= 0) {
      const target = state.enemies
        .slice()
        .sort(
          (a, b) =>
            Math.hypot(a.x - tower.x, a.y - tower.y) -
            Math.hypot(b.x - tower.x, b.y - tower.y),
        )[0];
      if (
        target &&
        Math.hypot(target.x - tower.x, target.y - tower.y) <
          state.upgrades.towerRange
      )
        towerFire(tower, target);
    }
  });
  state.enemies.forEach((e) => {
    const angle = Math.atan2(p.y - e.y, p.x - e.x),
      distance = Math.hypot(p.x - e.x, p.y - e.y);
    if (e.type === "shooter") {
      e.shot -= dt;
      if (e.shot <= 0 && distance < 370) {
        shoot(e.x, e.y, angle, 0, "enemy");
        e.shot = 2.7;
      }
      if (distance > 210) {
        e.x += Math.cos(angle) * e.speed * 60 * dt;
        e.y += Math.sin(angle) * e.speed * 60 * dt;
      }
    } else {
      const targetTower = state.towers.find((tower) => Math.hypot(tower.x - e.x, tower.y - e.y) < e.r + 18);
      if (targetTower) targetTower.hp -= (e.type === "boss" ? 24 : 12) * dt;
      else if (distance < e.r + p.r || (e.type === "boss" && distance < 100)) {
        damagePlayer((e.type === "boss" ? 14 : 9) * dt);
        state.core -= (e.type === "boss" ? 5 : 2) * dt;
      }
      else {
        e.x += Math.cos(angle) * e.speed * 60 * dt;
        e.y += Math.sin(angle) * e.speed * 60 * dt;
      }
    }
  });
  state.towers = state.towers.filter((tower) => tower.hp > 0);
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    for (let j = state.bullets.length - 1; j >= 0; j--) {
      const bullet = state.bullets[j];
      if (
        bullet.source === "enemy" ||
        bullet.hitEnemies.includes(enemy) ||
        Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) >= enemy.r + 4
      )
        continue;
      enemy.hp -= bullet.damage;
      state.attackersHit++;
      sound("hit");
      burst(bullet.x, bullet.y, bullet.color || enemy.color, 4);
      state.screenShake = Math.max(state.screenShake, .035);
      if (state.upgrades.element) {
        enemy.element = state.upgrades.element;
        if (state.upgrades.element === "fire") enemy.burn = 2 + state.upgrades.elementPower;
        if (state.upgrades.element === "ice") enemy.slow = 2 + state.upgrades.elementPower;
        if (state.upgrades.element === "poison") enemy.poisoned = 2 + state.upgrades.elementPower;
        if (state.upgrades.element === "dark") explode(enemy.x, enemy.y, 30 + state.upgrades.elementPower * 8, 12, "dark");
      }
      bullet.hitEnemies.push(enemy);
      if (!bullet.pierce) state.bullets.splice(j, 1);
      burst(bullet.x, bullet.y, enemy.color, 3);
      if (enemy.hp <= 0) {
        state.enemies.splice(i, 1);
        state.waveKills++;
        state.totalKills++;
        const reward = enemy.elite ? 50 : 10;
        state.coinsOnGround.push({ x: enemy.x, y: enemy.y, value: reward, life: 30 });
        state.score +=
          enemy.type === "boss" ? 1200 : enemy.type === "brute" ? 250 : 100;
        addXp(enemy.xp);
        burst(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 35 : 14);
        log(`Hostile cleared. ${reward} coin pickup dropped.`);
      }
      break;
    }
  }
  state.bullets.forEach((b) => {
    if (b.source === "enemy" && Math.hypot(b.x - p.x, b.y - p.y) < p.r + 5) {
      damagePlayer(8);
      b.life = 0;
      burst(b.x, b.y, "#ff5864", 5);
    }
  });
  state.enemies.forEach((enemy) => {
    enemy.displayHp += (enemy.hp - enemy.displayHp) * Math.min(1, dt * 9);
    if (enemy.burn > 0) { enemy.burn -= dt; enemy.hp -= (4 + state.upgrades.elementPower * 2) * dt; }
    if (enemy.slow > 0) enemy.slow -= dt;
    if (enemy.poisoned > 0) enemy.poisoned -= dt;
  });
  state.enemies.slice().filter((enemy) => enemy.hp <= 0).forEach(defeatEnemy);
  state.shockwaves.forEach((ring) => { ring.life -= dt * 3; ring.radius += (ring.maxRadius - ring.radius) * dt * 8; });
  state.shockwaves = state.shockwaves.filter((ring) => ring.life > 0);
  const magnetRadius = state.upgrades.magnet ? [0, 70, 125, 190][state.upgrades.magnet] : 20;
  state.coinsOnGround.forEach((coin) => {
    coin.life -= dt;
    if (magnetRadius && Math.hypot(coin.x - p.x, coin.y - p.y) < magnetRadius) {
      state.coins += coin.value;
      coin.life = 0;
    }
  });
  state.coinsOnGround = state.coinsOnGround.filter((coin) => coin.life > 0);
  state.particles.forEach((q) => {
    q.x += q.vx;
    q.y += q.vy;
    q.life -= dt * 2;
  });
  state.particles = state.particles.filter((q) => q.life > 0);
  if (state.core <= 0 || state.playerHp <= 0) endGame();
  updateUI();
}
function draw() {
  const w = canvas.clientWidth,
    h = canvas.clientHeight;
  const p = state.player;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1411";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(108,176,120,.1)";
  for (let x = 0; x < w; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(state.time * 0.15);
  ctx.strokeStyle = "rgba(199,243,107,.2)";
  ctx.setLineDash([5, 9]);
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  const playerBarWidth = 34;
  const playerBarX = p.x - playerBarWidth / 2;
  const playerBarY = p.y - 29;
  ctx.fillStyle = "#1c2822";
  ctx.fillRect(playerBarX, playerBarY, playerBarWidth, 3);
  ctx.fillStyle = "#ff5864";
  ctx.fillRect(playerBarX, playerBarY, playerBarWidth * Math.max(0, p ? state.playerHp / state.playerMaxHp : 0), 3);
  ctx.fillStyle = "#1c2822";
  ctx.fillRect(playerBarX, playerBarY - 5, playerBarWidth, 3);
  ctx.fillStyle = "#6be4d8";
  ctx.fillRect(playerBarX, playerBarY - 5, playerBarWidth * Math.max(0, state.shield / state.shieldMax), 3);
  state.coinsOnGround.forEach((coin) => {
    ctx.fillStyle = coin.value === 50 ? "#ffcf68" : "#ff8c57";
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, coin.value === 50 ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  state.towers.forEach((t) => {
    ctx.fillStyle = "#1c2822";
    ctx.fillRect(t.x - 16, t.y - 22, 32, 3);
    ctx.fillStyle = "#6be4d8";
    ctx.fillRect(
      t.x - 16,
      t.y - 22,
      32 * Math.max(0, t.hp / t.maxHp),
      3,
    );
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    const towerColor = t.type === "tesla" ? "#d58cff" : "#c7f36b";
    ctx.fillStyle = towerColor;
    ctx.shadowBlur = t.type === "tesla" ? 22 : 14;
    ctx.shadowColor = towerColor;
    if (t.type === "tesla") {
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.strokeStyle = towerColor;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillRect(-3, -19, 6, 38);
      ctx.fillRect(-19, -3, 38, 6);
    } else {
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = "#0b1411";
      ctx.fillRect(0, -3, 19, 6);
    }
    ctx.restore();
  });
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  const profile = weaponProfiles[state.weapon] || weaponProfiles["Pulse Rifle"];
  ctx.shadowBlur = 18;
  ctx.shadowColor = profile.color;
  ctx.fillStyle = profile.color;
  ctx.fillRect(-9, -8, state.weapon === "Flamethrower" ? 19 : 22, 16);
  ctx.fillStyle = "#e8f2e8";
  ctx.fillRect(5, -3, state.weapon === "Shotgun" ? 25 : state.weapon === "Railgun" ? 31 : 17, state.weapon === "Flamethrower" ? 9 : 6);
  if (state.shield > 0) {
    ctx.strokeStyle = "rgba(107,228,216,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  state.bullets.forEach((b) => {
    ctx.fillStyle = b.source === "enemy" ? "#ff5864" : "#c7f36b";
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size || 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  state.enemies.forEach((e) => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(state.time * (e.type === "boss" ? 0.4 : 2));
    ctx.fillStyle = e.color;
    ctx.shadowBlur = e.type === "boss" ? 28 : 18;
    ctx.shadowColor = e.color;
    ctx.beginPath();
    if (e.type === "shooter") {
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, e.r);
      ctx.lineTo(-e.r, e.r);
    } else {
      ctx.moveTo(0, -e.r);
      ctx.lineTo(e.r, 0);
      ctx.lineTo(0, e.r);
      ctx.lineTo(-e.r, 0);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#1c2822";
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
    ctx.fillStyle = e.elite ? "#ffcf68" : e.type === "boss" ? "#ff8c57" : "#ff5864";
    ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * (e.hp / e.maxHp), 3);
  });
  state.particles.forEach((q) => {
    ctx.globalAlpha = q.life;
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x, q.y, 3, 3);
    ctx.globalAlpha = 1;
  });
}
let last = 0;
function loop(now) {
  if (state.phase !== "running") {
    draw();
    return;
  }
  const dt = Math.min(0.033, (now - last) / 1000 || 0);
  last = now;
  update(dt);
  draw();
  if (state.phase === "running") requestAnimationFrame(loop);
}
function endGame() {
  state.phase = "gameover";
  setText(
    "finalScore",
    `You held the line through ${state.wave} waves and cleared ${state.totalKills} hostiles.`,
  );
  $("gameOverOverlay").classList.remove("hidden");
  setText("statusText", "SIGNAL LOST");
  sound("boss");
}
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
function updateAim(event) {
  Object.assign(state.mouse, canvasPoint(event));
}
function stopFiring() {
  state.mouse.down = false;
}
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  state.keys[key] = true;
  if (event.key === " ") event.preventDefault();
  if ((key === "b" || key === "t") && state.phase === "running")
    toggleBuildMode();
});
window.addEventListener(
  "keyup",
  (event) => (state.keys[event.key.toLowerCase()] = false),
);
canvas.addEventListener("pointermove", updateAim);
canvas.addEventListener("pointerdown", (event) => {
  const point = canvasPoint(event);
  if (state.phase !== "running") return;
  canvas.setPointerCapture?.(event.pointerId);
  if (state.buildMode) buildTower(point.x, point.y);
  else if (state.removeMode) removeTower(point.x, point.y);
  else state.mouse.down = true;
});
canvas.addEventListener("pointerup", stopFiring);
canvas.addEventListener("pointercancel", stopFiring);
window.addEventListener("pointerup", stopFiring);
const joystick = $("joystick");
const joystickKnob = joystick.querySelector("span");
let joystickPointerId = null;
function updateJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const maxDistance = rect.width * 0.31;
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  const distance = Math.min(maxDistance, Math.hypot(x, y));
  const angle = Math.atan2(y, x);
  const knobX = Math.cos(angle) * distance;
  const knobY = Math.sin(angle) * distance;
  state.touchMove.x = knobX / maxDistance;
  state.touchMove.y = knobY / maxDistance;
  joystickKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;
}
function resetJoystick(event) {
  if (event.pointerId !== joystickPointerId) return;
  joystickPointerId = null;
  state.touchMove.x = 0;
  state.touchMove.y = 0;
  joystickKnob.style.transform = "translate(0, 0)";
}
joystick.addEventListener("pointerdown", (event) => {
  joystickPointerId = event.pointerId;
  joystick.setPointerCapture?.(event.pointerId);
  updateJoystick(event);
});
joystick.addEventListener("pointermove", (event) => {
  if (event.pointerId === joystickPointerId) updateJoystick(event);
});
joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);
const mobileFire = $("mobileFire");
mobileFire.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  if (state.phase === "running") state.mouse.down = true;
});
mobileFire.addEventListener("pointerup", stopFiring);
mobileFire.addEventListener("pointercancel", stopFiring);
mobileFire.addEventListener("pointerleave", stopFiring);
const towerButton = $("towerButton");
const destroyTowerButton = $("destroyTowerButton");
towerButton.onclick = toggleBuildMode;
$("buyTowerButton").onclick = buyTower;
$("buyTeslaButton").onclick = () => buyTower("tesla");
destroyTowerButton.onclick = toggleRemoveMode;
$("startButton").onclick = reset;
$("restartButton").onclick = reset;
$("homeButton").onclick = () => {
  state.phase = "home";
  state.mouse.down = false;
  $("gameOverOverlay").classList.add("hidden");
  $("upgradeOverlay").classList.add("hidden");
  $("startOverlay").classList.remove("hidden");
  setText("statusText", "AWAITING DEPLOYMENT");
  draw();
};
$("soundButton").onclick = () => {
  state.sound = !state.sound;
  $("soundButton").textContent = state.sound ? "◖" : "○";
};
setText("statusText", "AWAITING DEPLOYMENT");
updateUI();
draw();
