// game.js — core engine
import {
  Y_EXP_RADIUS, BASE_TIME_SEC, EXTRA_TIME_ON_CONTINUE,
  BLAST_DAMAGE, BLAST_STUN_MS,
  GHOST_SPEED_TPS, SEEK_RADIUS, GIVEUP_RADIUS, GO_SPEED_TPS,
  PAINT_INTERVAL, PAINT_PROB, PAINT_TOUCH_DIST,
  BLAST_RING_LIFE, BLAST_RING_WIDTH, BLAST_SPARKS, BLAST_SPARK_LIFE,
  BLAST_SHAKE_MS, BLAST_SHAKE_MAG,
  PAC_VISUAL_SIZE_TILES, PAC_EAT_RADIUS_TILES,
  SCORE_UI, SCORE_CFG, SCORING
} from './config.js';
import { QRGenerator } from './qr.js';
import { sendScore, loadScores, renderScores } from './api.js';

export function initGame({ els, uuid = "", nickname = "anonymous" }) {
  // canvas contexts
  const qrc = els.qrCanvas.getContext('2d');
  const g = els.game.getContext('2d');

  // joystick stick
  const joyStick = els.joy.querySelector('.stick');

  // state
  const state = {
    modules: 33,
    moduleSize: 50,
    map: [],
    foods: [],
    totalFoods: 0,
    pac: { x: 0, y: 0, r: 8, vx: 0, vy: 0, angle: 0, pulseT: 0 },
    score: 0,
    playing: false,
    input: { vx: 0, vy: 0 },
    originalText: '',
    scanTimer: null,
    isScannable: true,
    countdownTimer: null,
    timeLeft: 5,
    timeMax: 5,
    timerFrozen: false,
    lastEndWasWin: false,
    stunUntil: 0,
    hp: 100,
    continues: 0,
    bonus: 0,
    ghosts: [],
    scorePeak: 0,
    fx: { blasts: [], sparks: [], shakeUntil: 0 },
  };

  // helpers
  const scanCan = document.createElement('canvas');
  const scanCtx = scanCan.getContext('2d', { willReadFrequently: true });
  let lastTs = null;
  const keys = new Set();

  function nowMs() { return performance.now(); }
  function pickPaintColor() { return Math.random() < 0.5 ? 'red' : 'yellow'; }

  // scan loop
  const SCAN_INTERVAL_MS = 100;
  function startScanLoop() { stopScanLoop(); state.scanTimer = setInterval(scanCurrentQR, SCAN_INTERVAL_MS); }
  function stopScanLoop() { if (state.scanTimer) { clearInterval(state.scanTimer); state.scanTimer = null; } }

  // sizing
  function setGameSizePx(widthPx, heightPx) {
    const N = state.map.length || state.modules || 33;
    const MARGIN = 24;
    let side = Math.min(widthPx || 0, heightPx || 0);
    if (!side || !isFinite(side)) side = Math.min(window.innerWidth, window.innerHeight);
    const touchMode = document.documentElement.classList.contains('touch-ui');
    if (touchMode) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const portrait = vh >= vw;
      const cap = portrait ? Math.min(vw * 0.90, vh * 0.70) : Math.min(vw * 0.90, vh * 0.80);
      side = Math.min(side, cap);
    }
    state.moduleSize = Math.max(6, Math.floor((side - MARGIN * 2) / N));
    const W = N * state.moduleSize + MARGIN * 2;
    const H = N * state.moduleSize + MARGIN * 2;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    els.game.width = Math.floor(W * dpr);
    els.game.height = Math.floor(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.imageSmoothingEnabled = false;
    els.game.style.width = W + 'px';
    els.game.style.height = 'auto';
    state.pac.r = Math.max(6, state.moduleSize * PAC_VISUAL_SIZE_TILES);
  }

  // stats
  function updateStats() {
    const alive = state.foods.filter(f => f.alive).length;
    const eaten = state.totalFoods - alive;
    const pct = state.totalFoods ? Math.round((eaten / state.totalFoods) * 100) : 100;

    const foodFill = document.getElementById('foodFill');
    const foodVal = document.getElementById('foodVal');
    if (foodFill) foodFill.style.width = pct + '%';
    if (foodVal) foodVal.textContent = `${pct}% (${eaten}/${state.totalFoods})`;

    const hp = Math.max(0, Math.min(100, state.hp || 0));
    const hpFill = document.getElementById('hpFill');
    const hpVal = document.getElementById('hpVal');
    if (hpFill) {
      hpFill.style.width = hp + '%';
      if (hp <= 20) hpFill.parentElement.classList.add('low');
      else hpFill.parentElement.classList.remove('low');
    }
    if (hpVal) hpVal.textContent = `${hp}%`;

    const timeFill = document.getElementById('timeFill');
    const timeVal = document.getElementById('timeVal');
    const maxT = Math.max(0.0001, state.timeMax || 0);
    const pctTime = Math.max(0, Math.min(100, (state.timeLeft / maxT) * 100));
    if (timeFill) timeFill.style.width = pctTime + '%';
    if (timeVal) timeVal.textContent = `${state.timeLeft.toFixed(1)}s`;

    const scoreFill = document.getElementById('scoreFill');
    const scoreVal = document.getElementById('scoreVal');
    if (scoreFill) {
      let gaugeMin = SCORE_UI.MIN;
      let gaugeMax = SCORE_UI.MAX;
      if (SCORE_UI.DYNAMIC) {
        state.scorePeak = Math.max(state.scorePeak || 0, state.score || 0);
        gaugeMax = Math.max(gaugeMin + 1, state.scorePeak);
      }
      const p = ((state.score - gaugeMin) / (gaugeMax - gaugeMin)) * 100;
      scoreFill.style.width = Math.max(0, Math.min(100, p)) + '%';
    }
    if (scoreVal) scoreVal.textContent = `${Math.max(0, Math.round(state.score))} pts`;
  }

  function updateScanBadge(ok) {
    els.scanStateEl.innerHTML = `Scannable: <span class="${ok ? 'scan-ok' : 'scan-bad'}">${ok ? 'YES' : 'NO'}</span>`;
  }

  // build QR + map
  function buildQR() {
    state.bonus = 0;
    state.score = 0;
    state.scorePeak = 0;
    state.continues = 0;
    state.hp = 100;
    state.stunUntil = 0;
    state.input.vx = 0;
    state.input.vy = 0;
    state.lastEndWasWin = false;
    state.scoreFactor = 1;

    keys.clear?.();

    const modules = Math.max(21, Math.min(57, parseInt(els.qrSize.value || 33)));
    state.modules = modules;
    state.originalText = (els.qrTextEl.value.trim() || 'QR-Pac');

    const qr = QRGenerator.create(state.originalText, modules);
    const N = qr.getModuleCount();

    const size = Math.min(els.qrCanvas.width, els.qrCanvas.height);
    const cell = Math.floor(size / N);
    const pad = Math.floor((size - cell * N) / 2);

    // preview
    qrc.fillStyle = '#fff';
    qrc.fillRect(0, 0, els.qrCanvas.width, els.qrCanvas.height);
    qrc.fillStyle = '#000';
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (qr.isDark(r, c)) qrc.fillRect(pad + c * cell, pad + r * cell, cell, cell);

    // map & foods
    state.map = Array.from({ length: N }, (_, r) =>
      Array.from({ length: N }, (_, c) => qr.isDark(r, c))
    );

    state.foods = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (state.map[r][c]) state.foods.push({ x: c + 0.5, y: r + 0.5, alive: true, kind: 'white' });
      }
    }
    state.totalFoods = state.foods.length;

    // random yellow/red
    const Y_COUNT = Math.max(0, Math.floor(state.totalFoods * 0.1));
    const R_COUNT = Math.max(0, Math.floor(state.totalFoods * 0.075));
    const idxs = Array.from({ length: state.totalFoods }, (_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    for (let i = 0; i < Y_COUNT; i++) state.foods[idxs[i]].kind = 'yellow';
    for (let i = Y_COUNT; i < Y_COUNT + R_COUNT && i < idxs.length; i++) state.foods[idxs[i]].kind = 'red';

    setGameSizePx(480, 480);

    state.pac.x = N / 2;
    state.pac.y = N / 2;
    state.pac.vx = 0;
    state.pac.vy = 0;
    state.pac.angle = 0;
    state.pac.pulseT = 0;

    function randomThreeEdgeMask() {
      const mask = [true, true, true, true];
      const ban = Math.floor(Math.random() * 4);
      mask[ban] = false;
      return mask;
    }

    state.ghosts = [
      { x: 3.5, y: 3.5, color: '#ff3b3b', role: 'yellow', lastPaint: -Math.random() * PAINT_INTERVAL, paintMask: randomThreeEdgeMask(), phase: Math.random() * Math.PI * 2, paintTarget: -1 },
      { x: N - 3.5, y: 3.5, color: '#00a2ff', role: 'red', lastPaint: -Math.random() * PAINT_INTERVAL, paintMask: randomThreeEdgeMask(), phase: Math.random() * Math.PI * 2, paintTarget: -1 },
      { x: 3.5, y: N - 3.5, color: '#26d926', role: 'mix', lastPaint: -Math.random() * PAINT_INTERVAL, paintMask: randomThreeEdgeMask(), phase: Math.random() * Math.PI * 2, paintTarget: -1 },
    ];

    state.score = 0;
    state.playing = false;
    state.isScannable = true;
    state.timeLeft = BASE_TIME_SEC;
    state.timeMax = BASE_TIME_SEC;
    state.timerFrozen = false;

    updateStats();
    updateScanBadge(true);
    stopScanLoop();

    if (state.countdownTimer) { clearInterval(state.countdownTimer); state.countdownTimer = null; }

    els.overlay.classList.remove('hidden');
    els.countText.textContent = 'QR-Pac';
    els.overlayMsg.textContent = 'กดเริ่มเพื่อเล่น';
    const sub = els.overlay.querySelector('.sub');
    if (sub) sub.innerHTML = `เวลาเล่น <b>${BASE_TIME_SEC} วินาที</b> • ชนะถ้า QR สแกนไม่ได้`;

    els.startBtn.style.display = '';
    els.continueBtn.style.display = 'none';
    els.restartBtn.style.display = 'none';
    if (els.sampleCard) els.sampleCard.style.display = '';

    els.saveYesBtn.style.display = 'none';
    els.saveNoBtn.style.display = 'none';
    els.saveForm.style.display = 'none';
  }

  // input
  window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', e => { keys.delete(e.key.toLowerCase()); });

  function stepControls() {
    if (!state.playing) return;
    if (performance.now() < state.stunUntil) { state.pac.vx = 0; state.pac.vy = 0; return; }
    let kx = 0, ky = 0;
    if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
    if (keys.has('arrowright') || keys.has('d')) kx += 1;
    if (keys.has('arrowup') || keys.has('w')) ky -= 1;
    if (keys.has('arrowdown') || keys.has('s')) ky += 1;

    let dx = kx + state.input.vx;
    let dy = ky + state.input.vy;
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      state.pac.vx = dx; state.pac.vy = dy;
      state.pac.angle = Math.atan2(dy, dx);
    } else { state.pac.vx = 0; state.pac.vy = 0; }
  }

  // movement + game rules
  function tryMove(entity, dx, dy) {
    const N = state.map.length;
    let nx = entity.x + dx;
    if (nx < 0.3) nx = N - 0.3;
    if (nx > N - 0.3) nx = 0.3;
    entity.x = nx;
    let ny = entity.y + dy;
    ny = Math.max(0.4, Math.min(N - 0.4, ny));
    entity.y = ny;
  }

  function eatFoods() {
    if (!state.playing) return;
    const p = state.pac;
    const rEat = PAC_EAT_RADIUS_TILES;
    for (const f of state.foods) {
      if (!f.alive) continue;
      const dx = f.x - p.x, dy = f.y - p.y;
      if (dx * dx + dy * dy <= rEat * rEat) {
        f.alive = false;
        if (f.kind === 'white') state.score += SCORE_CFG.WHITE_POINT;
        else if (f.kind === 'yellow') state.stunUntil = performance.now() + 1500;
        else if (f.kind === 'red') explodeChain(f.x, f.y);
      }
    }
  }

  function explodeChain(startX, startY) {
    const R = Y_EXP_RADIUS, R2 = R * R;
    const queue = [{ x: startX, y: startY }];
    const seenCenters = new Set();
    while (queue.length) {
      const { x: cx, y: cy } = queue.shift();
      const key = cx.toFixed(3) + ',' + cy.toFixed(3);
      if (seenCenters.has(key)) continue;
      seenCenters.add(key);

      spawnBlastFX(cx, cy);

      const dxp = state.pac.x - cx, dyp = state.pac.y - cy;
      if (dxp * dxp + dyp * dyp <= R2) {
        damagePlayer(BLAST_DAMAGE);
        if (BLAST_STUN_MS > 0) state.stunUntil = performance.now() + BLAST_STUN_MS;
      }

      for (const g2 of state.foods) {
        if (!g2.alive) continue;
        const dx = g2.x - cx, dy = g2.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 <= R2) {
          const wasRed = g2.kind === 'red';
          g2.alive = false;
          if (wasRed) queue.push({ x: g2.x, y: g2.y });
        }
      }
    }
  }

  function physics(dt) {
    if (!state.playing) return;
    const SPEED = 10;
    tryMove(state.pac, state.pac.vx * SPEED * dt, state.pac.vy * SPEED * dt);
    eatFoods();
    stepGhosts(dt);
  }

  function dirIndexFromVector(dx, dy) {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ay >= ax) return dy < 0 ? 0 : 2;
    return dx > 0 ? 1 : 3;
  }

  function findNearestWhiteWithin(gh, radius) {
    const r2 = radius * radius;
    let bestIdx = -1, bestD2 = Infinity;
    for (let i = 0; i < state.foods.length; i++) {
      const f = state.foods[i];
      if (!f.alive || f.kind !== 'white') continue;
      const dx = f.x - gh.x, dy = f.y - gh.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const dirIdx = dirIndexFromVector(dx, dy);
      if (!gh.paintMask[dirIdx]) continue;
      if (d2 < bestD2) { bestD2 = d2; bestIdx = i; }
    }
    return bestIdx;
  }

  function stepGhosts(dt) {
    const now = performance.now() / 1000;
    for (const gh of state.ghosts) {
      let tgt = gh.paintTarget != null && gh.paintTarget >= 0 ? state.foods[gh.paintTarget] : null;
      const hasValid = tgt && tgt.alive && tgt.kind === 'white' && Math.hypot(tgt.x - gh.x, tgt.y - gh.y) <= GIVEUP_RADIUS;
      if (!hasValid) { gh.paintTarget = findNearestWhiteWithin(gh, SEEK_RADIUS); tgt = gh.paintTarget >= 0 ? state.foods[gh.paintTarget] : null; }

      if (tgt) {
        let dx = tgt.x - gh.x, dy = tgt.y - gh.y;
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) { dx /= len; dy /= len; tryMove(gh, dx * GO_SPEED_TPS * dt, dy * GO_SPEED_TPS * dt); }
      } else {
        const driftSpeed = GHOST_SPEED_TPS * 0.35;
        const w = 0.6;
        const dx = Math.cos(gh.phase + now * w);
        const dy = Math.sin(gh.phase + now * w);
        tryMove(gh, dx * driftSpeed * dt, dy * driftSpeed * dt);
      }

      if (tgt) {
        const dist = Math.hypot(tgt.x - gh.x, tgt.y - gh.y);
        const canPaint = gh.lastPaint + PAINT_INTERVAL <= now;
        if (dist <= PAINT_TOUCH_DIST && canPaint) {
          if (Math.random() <= PAINT_PROB) tgt.kind = pickPaintColor(gh);
          gh.lastPaint = now; gh.paintTarget = -1;
        }
      }
    }
  }

  function damagePlayer(amount) {
    state.hp = Math.max(0, state.hp - amount);
    state.score -= amount * SCORE_CFG.HP_PENALTY_PER_DAMAGE;
    if (state.score < SCORE_CFG.MIN) state.score = SCORE_CFG.MIN;
    if (state.hp <= 0) endPlay(false, true);
  }

  // FX
  function spawnBlastFX(cx, cy) {
    state.fx.blasts.push({ x: cx, y: cy, t0: nowMs() });
    for (let i = 0; i < BLAST_SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 6 + Math.random() * 8;
      const vx = Math.cos(a) * spd;
      const vy = Math.sin(a) * spd;
      state.fx.sparks.push({ x: cx, y: cy, vx, vy, t0: nowMs() });
    }
    state.fx.shakeUntil = Math.max(state.fx.shakeUntil, nowMs() + BLAST_SHAKE_MS);
  }
  function stepFX(dt) {
    const aliveSparks = [];
    const TTL = BLAST_SPARK_LIFE;
    for (const s of state.fx.sparks) {
      const age = nowMs() - s.t0;
      if (age > TTL) continue;
      s.x += s.vx * dt; s.y += s.vy * dt;
      aliveSparks.push(s);
    }
    state.fx.sparks = aliveSparks;

    const aliveBlasts = [];
    for (const b of state.fx.blasts) if (nowMs() - b.t0 <= BLAST_RING_LIFE) aliveBlasts.push(b);
    state.fx.blasts = aliveBlasts;
  }
  function getShakeOffset() {
    if (nowMs() > state.fx.shakeUntil) return { dx: 0, dy: 0 };
    return { dx: (Math.random() * 2 - 1) * BLAST_SHAKE_MAG, dy: (Math.random() * 2 - 1) * BLAST_SHAKE_MAG };
  }

  // rendering
  function drawBackground() {
    g.clearRect(0, 0, els.game.width, els.game.height);
    g.save();
    const sh = getShakeOffset();
    g.translate(sh.dx, sh.dy);

    const s = state.moduleSize;
    const M = 24;
    const N = state.map.length;

    g.fillStyle = '#0d1422';
    g.fillRect(0, 0, els.game.width, els.game.height);

    g.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    g.lineWidth = 1;

    for (let r = 0; r <= N; r++) {
      g.beginPath(); g.moveTo(M, M + r * s); g.lineTo(M + N * s, M + r * s); g.stroke();
    }
    for (let c = 0; c <= N; c++) {
      g.beginPath(); g.moveTo(M + c * s, M); g.lineTo(M + c * s, M + N * s); g.stroke();
    }
    g.restore();
  }

  function drawFoods() {
    const s = state.moduleSize;
    const M = 24;
    for (const f of state.foods) {
      if (!f.alive) continue;
      g.beginPath();
      const rad = Math.max(2, s * 0.45);
      g.arc(M + f.x * s, M + f.y * s, rad, 0, Math.PI * 2);
      if (f.kind === 'red') g.fillStyle = '#ff4d4d';
      else if (f.kind === 'yellow') g.fillStyle = '#ffd24a';
      else g.fillStyle = '#e6edf3';
      g.fill();
    }
  }

  function drawPac(dt) {
    const s = state.moduleSize;
    const M = 24;
    const x = M + state.pac.x * s;
    const y = M + state.pac.y * s;

    const stunned = performance.now() < state.stunUntil;

    state.pac.pulseT += dt;
    const scale = 1 + 0.05 * Math.sin(state.pac.pulseT * 6);
    const R = state.pac.r * scale;

    g.beginPath();
    g.arc(x, y, R, 0, Math.PI * 2);
    g.fillStyle = stunned ? '#888' : '#28a81fff';
    g.fill();

    g.beginPath();
    g.arc(x - R * 0.35, y - R * 0.35, R * 0.18, 0, Math.PI * 2);
    g.fillStyle = stunned ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)';
    g.fill();

    if (stunned) {
      g.beginPath();
      g.arc(x, y, R + 15, 0, Math.PI * 2);
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.stroke();
    }
  }

  function drawGhosts() {
    const s = state.moduleSize;
    const M = 24;
    const R = Math.max(6, state.moduleSize * 0.9);

    for (const gh of state.ghosts) {
      const x = M + gh.x * s;
      const y = M + gh.y * s;

      g.fillStyle = gh.color;
      g.beginPath();
      g.arc(x, y, R, Math.PI, 0, false);
      g.lineTo(x + R, y + R * 0.9);
      g.lineTo(x - R, y + R * 0.9);
      g.closePath();
      g.fill();

      g.fillStyle = '#fff';
      g.beginPath(); g.arc(x - R * 0.35, y - R * 0.2, R * 0.18, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + R * 0.15, y - R * 0.2, R * 0.18, 0, Math.PI * 2); g.fill();
    }
  }

  function drawFX() {
    const s = state.moduleSize;
    const M = 24;
    for (const b of state.fx.blasts) {
      const age = nowMs() - b.t0;
      const k = Math.min(1, age / BLAST_RING_LIFE);
      const rTiles = Y_EXP_RADIUS * (0.35 + 0.85 * k);
      const R = rTiles * s;
      g.beginPath();
      g.arc(M + b.x * s, M + b.y * s, R, 0, Math.PI * 2);
      g.strokeStyle = `rgba(255, 210, 74, ${1 - k})`;
      g.lineWidth = BLAST_RING_WIDTH;
      g.stroke();
    }
    for (const sp of state.fx.sparks) {
      const age = nowMs() - sp.t0;
      const k = Math.min(1, age / BLAST_SPARK_LIFE);
      const alpha = 1 - k;
      const x = M + sp.x * s, y = M + sp.y * s;
      g.beginPath();
      g.arc(x, y, Math.max(1, s * 0.12 * (1 + 0.6 * (1 - k))), 0, Math.PI * 2);
      g.fillStyle = `rgba(255,220,120,${alpha})`;
      g.fill();
    }
  }

  // countdown / play
  function startCountdown() {
    lastTs = null;
    if (els.sampleCard) els.sampleCard.style.display = 'none';
    els.startBtn.style.display = 'none';
    els.continueBtn.style.display = 'none';
    els.restartBtn.style.display = 'none';
    els.overlayMsg.textContent = 'เตรียมตัว';
    let n = 3;
    els.countText.textContent = n;
    state.countdownTimer = setInterval(() => {
      n -= 1;
      if (n > 0) {
        els.countText.textContent = n;
      } else {
        clearInterval(state.countdownTimer);
        state.countdownTimer = null;
        els.countText.textContent = 'GO!';
        setTimeout(() => {
          els.overlay.classList.add('hidden');
          beginPlay();
        }, 250);
      }
    }, 1000);
  }

  function beginPlay() {
    state.playing = true;
    state.timeLeft = BASE_TIME_SEC;
    state.timeMax = BASE_TIME_SEC;
    state.timerFrozen = false;
    if (els.sampleCard) els.sampleCard.style.display = 'none';
    startScanLoop();
  }

  // end screens
  function autoContinueFromEnd() {
    els.overlay.classList.add('hidden');
    if (!state.lastEndWasWin) {
      state.continues += 1;
      state.timeLeft += EXTRA_TIME_ON_CONTINUE;
      state.timeMax += EXTRA_TIME_ON_CONTINUE;
      state.timerFrozen = false;
      state.playing = true;
      startScanLoop();
    } else {
      state.timerFrozen = true;
      state.playing = true;
      stopScanLoop();
    }
  }

  function endPlay(win, dead = false) {
    state.playing = false;
    stopScanLoop();
    els.overlay.classList.remove('hidden');
    state.lastEndWasWin = !!win;

    if (els.sampleCard) els.sampleCard.style.display = '';

    els.startBtn.style.display = 'none';
    els.continueBtn.style.display = 'none';
    els.restartBtn.style.display = 'none';
    els.saveYesBtn.style.display = 'none';
    els.saveNoBtn.style.display = 'none';
    els.saveForm.style.display = 'none';

    if (dead) {
      els.countText.textContent = 'GAME OVER';
      els.overlayMsg.innerHTML = 'พลังชีวิตหมดแล้ว ไม่สามารถเล่นต่อได้' +
        `<br>Score: <b><span style="color:#4caf50">${state.score}</span></b>`;
      els.restartBtn.style.display = '';
      return;
    }

    if (win) {
      els.countText.textContent = "WIN!!";
      els.overlayMsg.innerHTML = `QR ถูกทำลายแล้ว<br>Score: <b><span style="color:#4caf50">${state.score}</span></b>`;

      // ซ่อน input กรอกชื่อ
      els.playerNameInput.style.display = "none";
      els.saveForm.querySelector("button").style.display = "none";

      els.saveYesBtn.style.display = "";
      els.saveNoBtn.style.display = "";
      els.saveForm.style.display = "none";
      els.saveNoBtn.textContent = "ไม่บันทึกและเริ่มใหม่";

      els.saveNoBtn.onclick = () => {
        els.saveYesBtn.style.display = "none";
        els.saveNoBtn.style.display = "none";
        els.saveForm.style.display = "none";
        buildQR();
      };

      els.saveYesBtn.onclick = async () => {
        try {
          const displayName = `${nickname || "anonymous"}`;
          console.log("🚀 Sending score:", {
            name: displayName,
            score: state.score,
            uuid,
          });

          const ok = await sendScore(displayName, state.score, uuid);
          console.log("📦 Response from server:", ok);

          await loadScores((rows) =>
            renderScores(rows, els.boardList, els.boardEmpty)
          );

          els.saveForm.style.display = "none";
          buildQR();
        } catch (err) {
          console.error("❌ Error saving score:", err);
          alert("บันทึกคะแนนไม่สำเร็จ 😢");
        }
      };

      return;
    }


    els.countText.textContent = 'TIME UP';
    els.overlayMsg.innerHTML = 'เวลาหมด — จะต่อเวลาอีก 10 วินาทีหรือเริ่มใหม่?' +
      `<br>Score (ชั่วคราว): <b><span style="color:#f44336">${state.score}</span></b>`;
    els.continueBtn.style.display = '';
    els.restartBtn.style.display = '';
  }

  // scan QR image from current alive dots
  function scanCurrentQR() {
    const N = state.map.length;
    if (!N) return;

    const aliveSet = new Set();
    for (const f of state.foods) {
      if (!f.alive) continue;
      const r = Math.floor(f.y - 0.5 + 1e-6);
      const c = Math.floor(f.x - 0.5 + 1e-6);
      aliveSet.add(r + ',' + c);
    }

    const QZ = 2, mpx = 3;
    const W = (N + QZ * 2) * mpx;
    if (scanCan.width !== W || scanCan.height !== W) { scanCan.width = W; scanCan.height = W; }

    const ctx = scanCtx;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = '#000';
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (aliveSet.has(r + ',' + c))
          ctx.fillRect((QZ + c) * mpx, (QZ + r) * mpx, mpx, mpx);

    try {
      const imgData = ctx.getImageData(0, 0, W, W);
      const res = jsQR(imgData.data, W, W);
      const ok = !!res && typeof res.data === 'string' && res.data === state.originalText;
      state.isScannable = ok;
      updateScanBadge(ok);
      if (!ok && state.playing) endPlay(true);
    } catch {
      state.isScannable = false;
      updateScanBadge(false);
      if (state.playing) endPlay(true);
    }
  }

  // main loop
  function loop(ts) {
    if (lastTs === null) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    dt = Math.min(dt, 0.1);

    stepFX(dt);
    stepControls();
    physics(dt);
    drawBackground();
    drawFoods();
    drawGhosts();
    drawFX();
    drawPac(dt);

    if (state.playing && !state.timerFrozen) {
      state.timeLeft -= dt;
      state.score -= SCORE_CFG.TIME_DECAY_PER_SEC * dt;
      if (state.score < SCORE_CFG.MIN) state.score = SCORE_CFG.MIN;
      if (state.timeLeft <= 0) { state.timeLeft = 0; endPlay(!state.isScannable); }
    }

    updateStats();
    requestAnimationFrame(loop);
  }

  // wire UI
  els.makeBtn.addEventListener('click', buildQR);
  els.startBtn.addEventListener('click', startCountdown);

  els.continueBtn.addEventListener('click', () => {
    els.overlay.classList.add('hidden');
    if (els.sampleCard) els.sampleCard.style.display = 'none';
    lastTs = null;
    if (!state.lastEndWasWin) {
      state.continues += 1;
      state.timeLeft += EXTRA_TIME_ON_CONTINUE;
      state.timeMax += EXTRA_TIME_ON_CONTINUE;
      state.timerFrozen = false;
      state.playing = true;
      startScanLoop();
    } else {
      state.timerFrozen = true;
      state.playing = true;
      stopScanLoop();
    }
  });

  els.restartBtn.addEventListener('click', buildQR);

  // joystick
  const JOY_R = 60, STICK_R = 28;
  function setStickPos(dx, dy) {
    const len = Math.hypot(dx, dy), max = JOY_R - STICK_R, k = len > max ? max / len : 1;
    joyStick.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }
  function setInput(dx, dy) {
    const max = JOY_R - STICK_R;
    state.input.vx = Math.max(-1, Math.min(1, dx / max));
    state.input.vy = Math.max(-1, Math.min(1, dy / max));
  }
  function resetStick() { joyStick.style.transform = 'translate(0,0)'; state.input.vx = 0; state.input.vy = 0; }
  function getJoyCenter() { const rect = els.joy.getBoundingClientRect(); return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }; }
  function startJoy(evt) { evt.preventDefault(); const p = evt.touches ? evt.touches[0] : evt; const { cx, cy } = getJoyCenter(); setStickPos(p.clientX - cx, p.clientY - cy); setInput(p.clientX - cx, p.clientY - cy); }
  function moveJoy(evt) { evt.preventDefault(); const p = evt.touches ? evt.touches[0] : evt; const { cx, cy } = getJoyCenter(); setStickPos(p.clientX - cx, p.clientY - cy); setInput(p.clientX - cx, p.clientY - cy); }
  function endJoy(evt) { evt.preventDefault(); resetStick(); }

  els.joy.addEventListener('touchstart', startJoy, { passive: false });
  els.joy.addEventListener('touchmove', moveJoy, { passive: false });
  els.joy.addEventListener('touchend', endJoy, { passive: false });
  els.joy.addEventListener('mousedown', startJoy);
  window.addEventListener('mousemove', e => { if (e.buttons & 1) moveJoy(e); });
  window.addEventListener('mouseup', endJoy);

  els.pauseBtn.addEventListener('click', () => {
    state.playing = !state.playing;
    els.pauseBtn.textContent = state.playing ? 'พัก' : 'เล่นต่อ';
    if (state.playing) startScanLoop(); else stopScanLoop();
  });

  els.rebuildBtn.addEventListener('click', buildQR);

  document.addEventListener('touchmove', e => {
    if (e.target.closest('#joystick') || e.target.closest('#game')) e.preventDefault();
  }, { passive: false });

  // visibility
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopScanLoop();
    else if (state.playing && !state.timerFrozen) startScanLoop();
  });
  window.addEventListener('beforeunload', () => stopScanLoop());

  // scores
  els.refreshBoardBtn?.addEventListener('click', () => loadScores(rows => renderScores(rows, els.boardList, els.boardEmpty)));

  // init
  (function init() {
    buildQR();
    loadScores(rows => renderScores(rows, els.boardList, els.boardEmpty));
    requestAnimationFrame(loop);
  })();

  // public API? ไม่ต้อง export อะไรเพิ่ม
}
