const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const state = {
  running: false, gameOver: false, time: 0, wave: 1, waveKills: 0, totalKills: 0,
  score: 0, coins: 0, level: 1, xp: 0, nextXp: 100, core: 100, fireCooldown: 0,
  spawnTimer: 0, dashCooldown: 0, sound: true, buildMode: false, bossSpawned: false,
  keys: {}, mouse: { x: 0, y: 0, down: false }, touchMove: { x: 0, y: 0 },
  player: { x: 0, y: 0, r: 13, angle: 0 }, bullets: [], enemies: [], towers: [], particles: [],
  upgrades: { damage: 18, fireRate: 240, speed: 2.7, multishot: 1, towerDamage: 1, towerLife: 1 }
};
const $ = id => document.getElementById(id);
let audioContext;

function sound(type) {
  if (!state.sound) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type === 'hit' ? 'square' : 'sine';
  oscillator.frequency.value = type === 'shot' ? 180 : type === 'hit' ? 90 : type === 'boss' ? 70 : 420;
  gain.gain.setValueAtTime(.035, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + (type === 'boss' ? .35 : .08));
  oscillator.connect(gain).connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .35);
}
function resize() { canvas.width = canvas.clientWidth * devicePixelRatio; canvas.height = canvas.clientHeight * devicePixelRatio; ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); if (!state.player.x) { state.player.x = canvas.clientWidth / 2; state.player.y = canvas.clientHeight / 2; } }
window.addEventListener('resize', resize); resize();
function setText(id, text) { $(id).textContent = text; }
function log(message) { const time = String(Math.floor(state.time)).padStart(2, '0'); $('log').insertAdjacentHTML('afterbegin', `<p><span>00:${time}</span> ${message}</p>`); while ($('log').children.length > 4) $('log').lastChild.remove(); }
function updateUI() {
  setText('levelValue', String(state.level).padStart(2, '0')); setText('xpValue', `${state.xp} / ${state.nextXp} XP`); $('xpBar').style.width = `${Math.min(100, state.xp / state.nextXp * 100)}%`;
  setText('perkValue', `+${state.level - 1} PERKS`); setText('waveValue', String(state.wave).padStart(2, '0')); setText('waveTitle', `WAVE ${String(state.wave).padStart(2, '0')}`);
  setText('killsValue', state.totalKills); setText('scoreValue', String(state.score).padStart(5, '0')); setText('coreValue', `${Math.max(0, Math.round(state.core))}%`); setText('coinValue', `${state.coins} COINS`);
  setText('damageValue', `DAMAGE ${state.upgrades.damage}`); setText('fireRateValue', `FIRE RATE ${state.upgrades.fireRate} RPM`); setText('enemyCount', `${state.enemies.length} HOSTILES`);
  $('waveBar').style.width = `${Math.min(100, state.waveKills / (4 + state.wave * 2) * 100)}%`; setText('sentryValue', `${state.towers.length} / 4`); setText('towerValue', `${4 - state.towers.length} SLOTS OPEN`); setText('shopCost', `${state.towers.length >= 4 ? 'GRID FULL' : '25 COINS'}`);
  const threat = state.wave % 5 === 0 ? 'BOSS' : state.wave < 3 ? 'LOW' : state.wave < 6 ? 'ELEVATED' : 'CRITICAL'; setText('threatValue', threat); $('bossAlert').textContent = state.wave % 5 === 0 ? 'WARDEN INBOUND' : '';
}
function reset() {
  Object.assign(state, { running: true, gameOver: false, time: 0, wave: 1, waveKills: 0, totalKills: 0, score: 0, coins: 0, level: 1, xp: 0, nextXp: 100, core: 100, fireCooldown: 0, spawnTimer: 0, dashCooldown: 0, buildMode: false, bossSpawned: false, bullets: [], enemies: [], towers: [], particles: [], upgrades: { damage: 18, fireRate: 240, speed: 2.7, multishot: 1, towerDamage: 1, towerLife: 1 } });
  state.player.x = canvas.clientWidth / 2; state.player.y = canvas.clientHeight / 2; $('startOverlay').classList.add('hidden'); $('gameOverOverlay').classList.add('hidden'); $('upgradeOptions').innerHTML = ''; setText('statusText', 'SYSTEMS ONLINE'); log('Outpost link established.'); updateUI(); requestAnimationFrame(loop);
}
function addXp(amount) { state.xp += amount; while (state.xp >= state.nextXp) { state.xp -= state.nextXp; state.level++; state.nextXp = Math.round(state.nextXp * 1.35); showUpgrades(); log(`Level ${state.level} reached. Upgrade ready.`); sound('level'); } }
function showUpgrades() {
  const choices = [['OVERCHARGE', '+8 pulse rifle damage', () => state.upgrades.damage += 8], ['QUICK HANDS', '+60 RPM fire rate', () => state.upgrades.fireRate += 60], ['MULTI-SHOT', '+1 pulse rifle projectile', () => state.upgrades.multishot++], ['SENTRY AMPLIFIER', '+25% sentry damage', () => state.upgrades.towerDamage += .25], ['FORTIFIED FRAMES', '+40% sentry lifetime', () => state.upgrades.towerLife += .4], ['LIGHT FEET', '+0.55 movement speed', () => state.upgrades.speed += .55], ['NANITE PATCH', '+15 core integrity', () => state.core = Math.min(100, state.core + 15)]];
  $('upgradeOptions').innerHTML = choices.slice(0, 3).map((choice, i) => `<button class="upgrade-button" data-upgrade="${i}"><b>${choice[0]}</b><small>${choice[1]}</small></button>`).join('');
  $('upgradeOptions').querySelectorAll('button').forEach((button, i) => button.onclick = () => { choices[i][2](); $('upgradeOptions').innerHTML = ''; setText('upgradeNote', 'Upgrade installed. Keep moving.'); updateUI(); }); setText('upgradeNote', 'Choose one upgrade before the next assault.');
}
function enemyAtEdge(type) { const w = canvas.clientWidth, h = canvas.clientHeight, side = Math.floor(Math.random() * 4), pad = 35; return { x: side === 0 ? -pad : side === 1 ? w + pad : Math.random() * w, y: side === 2 ? -pad : side === 3 ? h + pad : Math.random() * h, type }; }
function spawn(type) {
  const info = { drone: [11, 24 + state.wave * 3, .68 + state.wave * .02, '#6be4d8', 20], brute: [17, 45 + state.wave * 5, .42 + state.wave * .015, '#ff8c57', 35], shooter: [13, 31 + state.wave * 4, .5 + state.wave * .015, '#d58cff', 30], boss: [34, 430 + state.wave * 45, .22 + state.wave * .01, '#ff5864', 180] }[type];
  const enemy = enemyAtEdge(type); state.enemies.push({ ...enemy, r: info[0], hp: info[1], maxHp: info[1], speed: info[2], color: info[3], xp: info[4], shot: 2.5 });
}
function spawnWaveEnemy() { const roll = Math.random(); spawn(roll < Math.min(.12, state.wave * .018) ? 'shooter' : roll < Math.min(.22, state.wave * .035) ? 'brute' : 'drone'); }
function burst(x, y, color, count = 8) { for (let i = 0; i < count; i++) state.particles.push({ x, y, vx: (Math.random() - .5) * 3, vy: (Math.random() - .5) * 3, life: 1, color }); }
function shoot(x = state.player.x, y = state.player.y, angle = state.player.angle, damage = state.upgrades.damage, source = 'player') { const count = source === 'player' ? state.upgrades.multishot : 1; for (let i = 0; i < count; i++) { const shotAngle = angle + (i - (count - 1) / 2) * .11; state.bullets.push({ x: x + Math.cos(shotAngle) * 18, y: y + Math.sin(shotAngle) * 18, vx: Math.cos(shotAngle) * 8, vy: Math.sin(shotAngle) * 8, life: 1.1, damage, source }); } sound('shot'); }
function toggleBuildMode() { state.buildMode = !state.buildMode; towerButton.classList.toggle('selected', state.buildMode); setText('upgradeNote', state.buildMode ? 'Click the arena to place a sentry.' : 'Clear hostiles to earn XP.'); }
function buildTower(x, y) { if (state.towers.length >= 4 || Math.hypot(x - state.player.x, y - state.player.y) < 65) return; state.towers.push({ x, y, hp: 100 * state.upgrades.towerLife, maxHp: 100 * state.upgrades.towerLife, cooldown: 0, angle: 0 }); state.buildMode = false; towerButton.classList.remove('selected'); sound('build'); log('Sentry deployed. Grid is expanding.'); updateUI(); }
function buyTower() { if (state.towers.length >= 4 || state.coins < 25) return; state.coins -= 25; toggleBuildMode(); log('Sentry purchased. Choose a deployment point.'); updateUI(); }
function destroyTower() { if (!state.towers.length) return; state.towers.pop(); log('Last sentry dismantled.'); updateUI(); }
function towerFire(tower, target) { tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x); shoot(tower.x, tower.y, tower.angle, state.upgrades.damage * .55 * state.upgrades.towerDamage, 'tower'); tower.cooldown = .8; }
function update(dt) {
  const w = canvas.clientWidth, h = canvas.clientHeight, p = state.player; state.time += dt; state.fireCooldown -= dt; state.spawnTimer -= dt;
  if (state.wave % 5 === 0 && !state.bossSpawned) { spawn('boss'); state.bossSpawned = true; log('WARDEN BOSS DETECTED. Focus fire.'); sound('boss'); }
  if (state.spawnTimer <= 0 && state.enemies.length < (state.wave % 5 === 0 ? 4 : 5 + state.wave * 2)) { spawnWaveEnemy(); state.spawnTimer = Math.max(.32, 1.3 - state.wave * .07); }
  if (state.waveKills >= 4 + state.wave * 2 && state.enemies.length === 0) { state.wave++; state.waveKills = 0; state.bossSpawned = false; log(`Wave ${state.wave} inbound. Stay sharp.`); sound('level'); }
  let dx = (state.keys.d ? 1 : 0) - (state.keys.a ? 1 : 0) + state.touchMove.x, dy = (state.keys.s ? 1 : 0) - (state.keys.w ? 1 : 0) + state.touchMove.y;
  if (dx || dy) { const len = Math.hypot(dx, dy); p.x += dx / len * state.upgrades.speed * 60 * dt; p.y += dy / len * state.upgrades.speed * 60 * dt; }
  p.x = Math.max(22, Math.min(w - 22, p.x)); p.y = Math.max(22, Math.min(h - 22, p.y)); if (state.dashCooldown > 0) state.dashCooldown -= dt;
  if (state.keys[' '] && state.dashCooldown <= 0) { const dashX = dx || Math.cos(p.angle), dashY = dy || Math.sin(p.angle); p.x += dashX * 70; p.y += dashY * 70; p.x = Math.max(22, Math.min(w - 22, p.x)); p.y = Math.max(22, Math.min(h - 22, p.y)); state.dashCooldown = 2; state.keys[' '] = false; burst(p.x, p.y, '#c7f36b', 10); }
  p.angle = Math.atan2(state.mouse.y - p.y, state.mouse.x - p.x); if (state.mouse.down && state.fireCooldown <= 0) { shoot(); state.fireCooldown = 60 / (state.upgrades.fireRate / 60); }
  state.bullets.forEach(b => { b.x += b.vx * 60 * dt; b.y += b.vy * 60 * dt; b.life -= dt; }); state.bullets = state.bullets.filter(b => b.life > 0 && b.x > -30 && b.x < w + 30 && b.y > -30 && b.y < h + 30);
  state.towers.forEach(tower => { tower.hp -= dt * 2; tower.cooldown -= dt; if (tower.cooldown <= 0) { const target = state.enemies.filter(e => e.type !== 'boss' || state.waveKills > 2).sort((a, b) => Math.hypot(a.x - tower.x, a.y - tower.y) - Math.hypot(b.x - tower.x, b.y - tower.y))[0]; if (target && Math.hypot(target.x - tower.x, target.y - tower.y) < 260) towerFire(tower, target); } }); state.towers = state.towers.filter(tower => tower.hp > 0);
  state.enemies.forEach(e => { const angle = Math.atan2(p.y - e.y, p.x - e.x), distance = Math.hypot(p.x - e.x, p.y - e.y); if (e.type === 'shooter') { e.shot -= dt; if (e.shot <= 0 && distance < 370) { shoot(e.x, e.y, angle, 0, 'enemy'); e.shot = 2.7; } if (distance > 210) { e.x += Math.cos(angle) * e.speed * 60 * dt; e.y += Math.sin(angle) * e.speed * 60 * dt; } } else if (distance < e.r + p.r || (e.type === 'boss' && distance < 100)) { state.core -= (e.type === 'boss' ? 14 : 9) * dt; } else { e.x += Math.cos(angle) * e.speed * 60 * dt; e.y += Math.sin(angle) * e.speed * 60 * dt; } });
  for (let i = state.enemies.length - 1; i >= 0; i--) { const enemy = state.enemies[i]; for (let j = state.bullets.length - 1; j >= 0; j--) { const bullet = state.bullets[j]; if (bullet.source === 'enemy' || Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) >= enemy.r + 4) continue; enemy.hp -= bullet.damage; state.bullets.splice(j, 1); burst(bullet.x, bullet.y, enemy.color, 3); sound('hit'); if (enemy.hp <= 0) { state.enemies.splice(i, 1); state.waveKills++; state.totalKills++; const reward = enemy.type === 'boss' ? 50 : enemy.type === 'brute' ? 12 : enemy.type === 'shooter' ? 8 : 5; state.coins += reward; state.score += enemy.type === 'boss' ? 1200 : enemy.type === 'brute' ? 250 : 100; addXp(enemy.xp); burst(enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 35 : 14); log(`Hostile cleared. +${reward} coins.`); if (enemy.type === 'boss') { state.core = Math.min(100, state.core + 20); log('Warden down. Core repair +20%.'); sound('boss'); } } break; } }
  state.bullets.forEach(b => { if (b.source === 'enemy' && Math.hypot(b.x - p.x, b.y - p.y) < p.r + 5) { state.core -= 8; b.life = 0; burst(b.x, b.y, '#ff5864', 5); } });
  state.particles.forEach(q => { q.x += q.vx; q.y += q.vy; q.life -= dt * 2; }); state.particles = state.particles.filter(q => q.life > 0); if (state.core <= 0) endGame(); updateUI();
}
function draw() {
  const w = canvas.clientWidth, h = canvas.clientHeight; ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#0b1411'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(108,176,120,.1)'; ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(state.time * .15); ctx.strokeStyle = 'rgba(199,243,107,.2)'; ctx.setLineDash([5, 9]); ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  state.towers.forEach(t => { ctx.fillStyle = '#1c2822'; ctx.fillRect(t.x - 16, t.y - 22, 32, 3); ctx.fillStyle = '#6be4d8'; ctx.fillRect(t.x - 16, t.y - 22, 32 * (t.hp / t.maxHp), 3); ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.angle); ctx.fillStyle = '#c7f36b'; ctx.shadowBlur = 14; ctx.shadowColor = '#c7f36b'; ctx.fillRect(-12, -12, 24, 24); ctx.fillStyle = '#0b1411'; ctx.fillRect(0, -3, 19, 6); ctx.restore(); });
  const p = state.player; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.shadowBlur = 18; ctx.shadowColor = '#c7f36b'; ctx.fillStyle = '#c7f36b'; ctx.fillRect(-9, -8, 22, 16); ctx.fillStyle = '#e8f2e8'; ctx.fillRect(5, -3, 17, 6); ctx.restore();
  state.bullets.forEach(b => { ctx.fillStyle = b.source === 'enemy' ? '#ff5864' : '#c7f36b'; ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
  state.enemies.forEach(e => { ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(state.time * (e.type === 'boss' ? .4 : 2)); ctx.fillStyle = e.color; ctx.shadowBlur = e.type === 'boss' ? 28 : 18; ctx.shadowColor = e.color; ctx.beginPath(); if (e.type === 'shooter') { ctx.moveTo(0, -e.r); ctx.lineTo(e.r, e.r); ctx.lineTo(-e.r, e.r); } else { ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0); } ctx.closePath(); ctx.fill(); ctx.restore(); ctx.fillStyle = '#1c2822'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3); ctx.fillStyle = e.type === 'boss' ? '#ff8c57' : '#ff5864'; ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * (e.hp / e.maxHp), 3); });
  state.particles.forEach(q => { ctx.globalAlpha = q.life; ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, 3, 3); ctx.globalAlpha = 1; });
}
let last = 0; function loop(now) { if (!state.running) return; const dt = Math.min(.033, (now - last) / 1000 || 0); last = now; update(dt); draw(); if (state.running) requestAnimationFrame(loop); }
function endGame() { state.running = false; state.gameOver = true; setText('finalScore', `You held the line through ${state.wave} waves and cleared ${state.totalKills} hostiles.`); $('gameOverOverlay').classList.remove('hidden'); setText('statusText', 'SIGNAL LOST'); sound('boss'); }
function canvasPoint(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
window.addEventListener('keydown', event => { const key = event.key.toLowerCase(); state.keys[key] = true; if (event.key === ' ') event.preventDefault(); if (key === 'b' || key === 't') toggleBuildMode(); }); window.addEventListener('keyup', event => state.keys[event.key.toLowerCase()] = false);
canvas.addEventListener('mousemove', event => Object.assign(state.mouse, canvasPoint(event))); canvas.addEventListener('mousedown', event => { const point = canvasPoint(event); if (state.buildMode) buildTower(point.x, point.y); else state.mouse.down = true; }); window.addEventListener('mouseup', () => state.mouse.down = false);
const towerButton = $('towerButton'); towerButton.onclick = toggleBuildMode; $('buyTowerButton').onclick = buyTower; $('destroyTowerButton').onclick = destroyTower;
$('startButton').onclick = reset; $('restartButton').onclick = reset; $('soundButton').onclick = () => { state.sound = !state.sound; $('soundButton').style.color = state.sound ? 'var(--lime)' : 'var(--dim)'; };
const fireButton = $('mobileFire'); fireButton.addEventListener('touchstart', event => { event.preventDefault(); state.mouse.down = true; }); fireButton.addEventListener('touchend', () => state.mouse.down = false);
const joystick = $('joystick'); let joystickTouch; joystick.addEventListener('touchstart', event => { joystickTouch = event.changedTouches[0].identifier; event.preventDefault(); }); joystick.addEventListener('touchmove', event => { const touch = [...event.changedTouches].find(item => item.identifier === joystickTouch); if (!touch) return; const rect = joystick.getBoundingClientRect(), x = touch.clientX - (rect.left + rect.width / 2), y = touch.clientY - (rect.top + rect.height / 2), length = Math.min(26, Math.hypot(x, y)); state.touchMove.x = x / (length || 1) * length / 26; state.touchMove.y = y / (length || 1) * length / 26; joystick.querySelector('span').style.transform = `translate(${state.touchMove.x * 26}px,${state.touchMove.y * 26}px)`; event.preventDefault(); }); joystick.addEventListener('touchend', () => { joystickTouch = null; state.touchMove.x = 0; state.touchMove.y = 0; joystick.querySelector('span').style.transform = ''; });
canvas.addEventListener('touchmove', event => { const touch = event.touches[0]; if (touch) Object.assign(state.mouse, canvasPoint(touch)); event.preventDefault(); }, { passive: false }); canvas.addEventListener('touchstart', event => { const touch = event.touches[0]; if (touch) Object.assign(state.mouse, canvasPoint(touch)); event.preventDefault(); }, { passive: false });
updateUI();
