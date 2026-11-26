'use strict';

/* ===========================================================
   Packet Dungeon – herní logika
   Autor: Jakub Steinz
   =========================================================== */

(() => {
  // ---------- konstanty ----------
  const W = 960, H = 600;          // logická velikost plátna
  const WALL = 48;                 // tloušťka zdí
  const DOOR_W = 96;               // šířka dveří
  const ROOMS_PER_FLOOR = 5;       // 5. místnost = boss
  const FLOORS = 3;
  const STORE_KEY = 'packetDungeon.runs.v1';
  const FLOOR_THEMES = [
    { floor: '#141a2b', grid: '#1c2440', wall: '#0a0e1a', neon: '#38bdf8', name: 'LAN' },
    { floor: '#1d1530', grid: '#2a1f45', wall: '#0e0a1a', neon: '#a78bfa', name: 'WAN' },
    { floor: '#2a1418', grid: '#3d1d24', wall: '#140a0c', neon: '#fb7185', name: 'Internet' },
  ];

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);

  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupCanvas();

  // ---------- ovládání ----------
  const keys = new Set();
  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  addEventListener('keydown', e => {
    if (GAME_KEYS.includes(e.code) && state === 'play') e.preventDefault();
    if ((e.code === 'KeyP' || e.code === 'Escape') && (state === 'play' || state === 'pause')) {
      togglePause();
      return;
    }
    keys.add(e.code);
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => {
    keys.clear();
    if (state === 'play') togglePause();
  });

  // ---------- ukládání statistik (měření pokroku) ----------
  function loadRuns() {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function saveRuns(runs) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(runs.slice(-100))); } catch { /* plné úložiště */ }
  }

  function sumStats(runs) {
    const t = {};
    for (const c in CATEGORIES) t[c] = { asked: 0, correct: 0 };
    for (const r of runs) {
      for (const c in r.cats) {
        if (!t[c]) continue;
        t[c].asked += r.cats[c].asked;
        t[c].correct += r.cats[c].correct;
      }
    }
    return t;
  }

  // slabší témata dostanou vyšší váhu → hra se adaptuje na hráče
  function categoryWeights() {
    const t = sumStats(loadRuns());
    const w = {};
    for (const c in t) {
      const acc = t[c].asked ? t[c].correct / t[c].asked : 0.5;
      w[c] = 0.5 + (1 - acc) * 2;
    }
    return w;
  }

  const pct = (c, a) => (a ? Math.round((c / a) * 100) : 0);

  // ---------- stav hry ----------
  let state = 'menu';
  let run, room, player;
  let tears = [], enemies = [], shots = [], packets = [], pickups = [], particles = [];
  let boss = null;
  let shake = 0;
  let clock = 0;

  function newRun(cats) {
    run = {
      cats,
      weights: categoryWeights(),
      floor: 1,
      room: 1,
      stats: {},
      time: 0,
      kills: 0,
      recent: [],
    };
    for (const c of cats) run.stats[c] = { asked: 0, correct: 0 };
    player = { x: W / 2, y: H - 90, r: 16, speed: 240, hp: 6, maxHp: 6, inv: 0, cd: 0, lookX: 0, lookY: 1 };
    enterRoom();
    showOverlay(null);
    state = 'play';
  }

  function enterRoom() {
    tears = []; enemies = []; shots = []; packets = []; pickups = []; particles = [];
    boss = null;
    player.x = W / 2;
    player.y = H - WALL - 40;
    player.inv = 1;

    const isBoss = run.room === ROOMS_PER_FLOOR;
    room = { isBoss, answered: false, counted: false, doorOpen: false, question: null, intro: 1.6 };

    if (isBoss) {
      const hp = 18 + run.floor * 8;
      boss = { x: W / 2, y: WALL + 80, r: 46, hp, maxHp: hp, shield: true, vuln: 0, cd: 2.5, dir: 1, flash: 0 };
    } else {
      const count = run.floor + Math.floor((run.room - 1) / 2);
      for (let i = 0; i < count; i++) {
        const type = run.floor >= 2 && Math.random() < 0.35 ? 'trojan' : 'bug';
        spawnEnemy(type, WALL + 60 + Math.random() * (W - 2 * WALL - 120), WALL + 50 + Math.random() * 180);
      }
    }
    askQuestion();
    updateHud();
  }

  function spawnEnemy(type, x, y) {
    const f = run.floor;
    if (type === 'bug') {
      enemies.push({ type, x, y, r: 15, hp: 2 + f, speed: 70 + f * 18, t: Math.random() * 10, hit: 0 });
    } else {
      enemies.push({ type, x, y, r: 18, hp: 3 + f, speed: 45, t: Math.random() * 10, cd: 1.5 + Math.random(), hit: 0,
        tx: x, ty: y });
    }
  }

  function askQuestion() {
    const q = getQuestion(run.floor, run.cats, run.weights, run.recent);
    run.recent.push(q.text);
    if (run.recent.length > 15) run.recent.shift();
    room.question = q;
    room.counted = false;
    spawnPackets(q);
    showQuestion(q);
  }

  const PACKET_FONT = '600 15px "JetBrains Mono", Consolas, monospace';

  function spawnPackets(q) {
    packets = [];
    ctx.font = PACKET_FONT;
    const top = room.isBoss ? H * 0.42 : WALL + 40;
    const bottom = room.isBoss ? H - WALL - 30 : H * 0.62;
    for (const label of q.options) {
      const w = Math.max(72, ctx.measureText(label).width + 30), h = 36;
      let x, y, tries = 0;
      do {
        x = WALL + w / 2 + 8 + Math.random() * (W - 2 * WALL - w - 16);
        y = top + Math.random() * (bottom - top);
        tries++;
      } while (tries < 60 && (
        Math.hypot(x - player.x, y - player.y) < 160 ||
        packets.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 12 && Math.abs(p.y - y) < 48)
      ));
      const a = Math.random() * Math.PI * 2;
      const s = 35 + run.floor * 12;
      packets.push({ x, y, w, h, vx: Math.cos(a) * s, vy: Math.sin(a) * s, label,
        correct: label === q.correct, bob: Math.random() * 6, top });
    }
  }

  // ---------- hlavní smyčka ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    clock += dt;
    if (state === 'play') update(dt);
    if (run) draw();
    else drawIdle();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function update(dt) {
    run.time += dt;
    if (room.intro > 0) room.intro -= dt;
    if (shake > 0) shake -= dt;
    updatePlayer(dt);
    if (state !== 'play') return;
    updateTears(dt);
    updateEnemies(dt);
    updateShots(dt);
    updatePackets(dt);
    updateBoss(dt);
    updatePickups();
    updateParticles(dt);
    checkRoom();
  }

  function updatePlayer(dt) {
    const p = player;
    let mx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    let my = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
    const len = Math.hypot(mx, my) || 1;
    mx /= len; my /= len;
    p.x += mx * p.speed * dt;
    p.y += my * p.speed * dt;

    const inDoor = room.doorOpen && Math.abs(p.x - W / 2) < DOOR_W / 2 - p.r + 4;
    p.x = clamp(p.x, WALL + p.r, W - WALL - p.r);
    p.y = clamp(p.y, inDoor ? WALL - 40 : WALL + p.r, H - WALL - p.r);
    if (inDoor && p.y < WALL - 6) {
      nextRoom();
      return;
    }

    // střelba šipkami
    const sx = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
    const sy = (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0);
    p.cd -= dt;
    if (sx || sy) {
      const l = Math.hypot(sx, sy);
      p.lookX = sx / l; p.lookY = sy / l;
      if (p.cd <= 0) {
        const speed = 430;
        tears.push({ x: p.x + p.lookX * 14, y: p.y + p.lookY * 14,
          vx: p.lookX * speed + mx * 60, vy: p.lookY * speed + my * 60, r: 6, life: 0.85,
          bit: Math.random() < 0.5 ? '0' : '1' });
        p.cd = 0.27;
      }
    } else if (mx || my) {
      p.lookX = mx; p.lookY = my;
    }
    if (p.inv > 0) p.inv -= dt;
  }

  function updateTears(dt) {
    for (let i = tears.length - 1; i >= 0; i--) {
      const t = tears[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      let dead = t.life <= 0 || t.x < WALL || t.x > W - WALL || t.y < WALL || t.y > H - WALL;

      if (!dead) {
        for (const pk of packets) {
          if (circleRect(t.x, t.y, t.r, pk.x, pk.y, pk.w, pk.h)) {
            hitPacket(pk);
            dead = true;
            break;
          }
        }
      }
      if (!dead && boss && Math.hypot(t.x - boss.x, t.y - boss.y) < boss.r + t.r + (boss.shield ? 14 : 0)) {
        if (boss.shield) {
          burst(t.x, t.y, '#93c5fd', 4);
        } else {
          boss.hp -= 1;
          boss.flash = 0.08;
          burst(t.x, t.y, '#fdba74', 5);
          if (boss.hp <= 0) killBoss();
        }
        dead = true;
      }
      if (!dead) {
        for (const e of enemies) {
          if (Math.hypot(t.x - e.x, t.y - e.y) < e.r + t.r) {
            e.hp -= 1;
            e.hit = 0.1;
            e.x += t.vx * 0.03;
            e.y += t.vy * 0.03;
            dead = true;
            break;
          }
        }
      }
      if (dead) {
        burst(t.x, t.y, '#7dd3fc', 3);
        tears.splice(i, 1);
      }
    }
    for (let i = enemies.length - 1; i >= 0; i--) {
      if (enemies[i].hp <= 0) {
        const e = enemies[i];
        burst(e.x, e.y, e.type === 'bug' ? '#ef4444' : '#a855f7', 14);
        enemies.splice(i, 1);
        run.kills++;
      }
    }
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      e.t += dt;
      if (e.hit > 0) e.hit -= dt;
      if (e.type === 'bug') {
        const a = Math.atan2(player.y - e.y, player.x - e.x) + Math.sin(e.t * 4) * 0.5;
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
      } else {
        // trojan: pomalu bloudí a střílí
        if (Math.hypot(e.tx - e.x, e.ty - e.y) < 10) {
          e.tx = WALL + 40 + Math.random() * (W - 2 * WALL - 80);
          e.ty = WALL + 40 + Math.random() * (H - 2 * WALL - 80);
        }
        const a = Math.atan2(e.ty - e.y, e.tx - e.x);
        e.x += Math.cos(a) * e.speed * dt;
        e.y += Math.sin(a) * e.speed * dt;
        e.cd -= dt;
        if (e.cd <= 0) {
          const b = Math.atan2(player.y - e.y, player.x - e.x);
          const s = 170 + run.floor * 25;
          shots.push({ x: e.x, y: e.y, vx: Math.cos(b) * s, vy: Math.sin(b) * s, r: 7 });
          e.cd = 2.2 - run.floor * 0.2;
        }
      }
      // nepřátelé se nepřekrývají
      for (const o of enemies) {
        if (o === e) continue;
        const d = Math.hypot(o.x - e.x, o.y - e.y);
        if (d > 0 && d < e.r + o.r) {
          const push = (e.r + o.r - d) / 2;
          e.x -= ((o.x - e.x) / d) * push;
          e.y -= ((o.y - e.y) / d) * push;
        }
      }
      e.x = clamp(e.x, WALL + e.r, W - WALL - e.r);
      e.y = clamp(e.y, WALL + e.r, H - WALL - e.r);
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r - 4) hurtPlayer();
    }
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < WALL || s.x > W - WALL || s.y < WALL || s.y > H - WALL) {
        shots.splice(i, 1);
        continue;
      }
      if (Math.hypot(player.x - s.x, player.y - s.y) < player.r + s.r - 3) {
        shots.splice(i, 1);
        hurtPlayer();
      }
    }
  }

  function updatePackets(dt) {
    for (const p of packets) {
      p.bob += dt * 3;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const minX = WALL + p.w / 2, maxX = W - WALL - p.w / 2;
      const minY = Math.max(WALL + p.h / 2, p.top - 20), maxY = H - WALL - p.h / 2;
      if (p.x < minX || p.x > maxX) { p.vx *= -1; p.x = clamp(p.x, minX, maxX); }
      if (p.y < minY || p.y > maxY) { p.vy *= -1; p.y = clamp(p.y, minY, maxY); }
    }
    // pakety se od sebe odráží
    for (let i = 0; i < packets.length; i++) {
      for (let j = i + 1; j < packets.length; j++) {
        const a = packets[i], b = packets[j];
        const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            const s = Math.sign(a.x - b.x) || 1;
            a.x += (s * ox) / 2; b.x -= (s * ox) / 2;
            [a.vx, b.vx] = [b.vx, a.vx];
          } else {
            const s = Math.sign(a.y - b.y) || 1;
            a.y += (s * oy) / 2; b.y -= (s * oy) / 2;
            [a.vy, b.vy] = [b.vy, a.vy];
          }
        }
      }
    }
  }

  function updateBoss(dt) {
    if (!boss) return;
    if (boss.flash > 0) boss.flash -= dt;
    const speed = boss.shield ? 90 + run.floor * 25 : 30;
    boss.x += boss.dir * speed * dt;
    if (boss.x < WALL + boss.r + 30 || boss.x > W - WALL - boss.r - 30) {
      boss.dir *= -1;
      boss.x = clamp(boss.x, WALL + boss.r + 30, W - WALL - boss.r - 30);
    }

    if (boss.shield) {
      boss.cd -= dt;
      if (boss.cd <= 0) {
        const base = Math.atan2(player.y - boss.y, player.x - boss.x);
        const n = 2 + run.floor;
        const spread = 0.22;
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * spread;
          const s = 180 + run.floor * 30;
          shots.push({ x: boss.x, y: boss.y + 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 8 });
        }
        boss.cd = 2.4 - run.floor * 0.35;
      }
      if (packets.length === 0) askQuestion();
    } else {
      // štít je dole – boss je omráčený a zranitelný
      boss.vuln -= dt;
      if (boss.vuln <= 0) {
        boss.shield = true;
        boss.cd = 1.2;
        askQuestion();
      }
    }
  }

  function updatePickups() {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (Math.hypot(player.x - p.x, player.y - p.y) < player.r + 14 && player.hp < player.maxHp) {
        player.hp = Math.min(player.maxHp, player.hp + 2);
        burst(p.x, p.y, '#f43f5e', 12);
        pickups.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function checkRoom() {
    if (!room.doorOpen && room.answered && enemies.length === 0 && !boss) {
      room.doorOpen = true;
      if (room.isBoss || Math.random() < 0.3) pickups.push({ x: W / 2, y: H / 2 });
      burst(W / 2, WALL, '#4ade80', 20);
    }
  }

  // ---------- herní události ----------
  function hitPacket(pk) {
    const q = room.question;
    if (!room.counted) {
      room.counted = true;
      const s = run.stats[q.cat];
      s.asked++;
      if (pk.correct) s.correct++;
    }

    if (pk.correct) {
      for (const p of packets) burst(p.x, p.y, p === pk ? '#4ade80' : '#64748b', p === pk ? 24 : 8);
      packets = [];
      setFeedback(`✔ Správně! ${q.explain}`, 'good');
      if (boss) {
        boss.shield = false;
        boss.vuln = 6;
        burst(boss.x, boss.y, '#93c5fd', 30);
      } else {
        room.answered = true;
      }
    } else {
      // špatná odpověď se změní ve virus
      packets.splice(packets.indexOf(pk), 1);
      burst(pk.x, pk.y, '#ef4444', 16);
      spawnEnemy('bug', pk.x, pk.y);
      shake = 0.2;
      setFeedback(`✘ „${pk.label}“ není správně – paket se změnil ve virus! Zkus jiný.`, 'bad');
    }
    updateHud();
  }

  function killBoss() {
    burst(boss.x, boss.y, '#fb923c', 60);
    shake = 0.4;
    boss = null;
    packets = [];
    shots = [];
    room.answered = true;
    setFeedback(run.floor === FLOORS
      ? 'Firewall padl! Projdi dveřmi a dokonči hru.'
      : 'Firewall padl! Dveře vedou do dalšího patra.', 'good');
  }

  function hurtPlayer() {
    if (player.inv > 0) return;
    player.hp -= 1;
    player.inv = 1.1;
    shake = 0.25;
    burst(player.x, player.y, '#38bdf8', 10);
    if (player.hp <= 0) endRun(false);
  }

  function nextRoom() {
    if (room.isBoss) {
      if (run.floor === FLOORS) { endRun(true); return; }
      run.floor++;
      run.room = 1;
    } else {
      run.room++;
    }
    enterRoom();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 220;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.3 + Math.random() * 0.4, color,
        size: 2 + Math.random() * 3 });
    }
  }

  // ---------- konec běhu ----------
  function endRun(won) {
    state = 'end';
    keys.clear();
    const runs = loadRuns();
    const before = sumStats(runs);
    const record = {
      date: new Date().toISOString(),
      won,
      floor: run.floor,
      room: run.room,
      time: Math.round(run.time),
      kills: run.kills,
      cats: run.stats,
    };
    runs.push(record);
    saveRuns(runs);
    renderEnd(record, before, runs.length);
    showOverlay('end');
  }

  function renderEnd(r, before, runCount) {
    let asked = 0, correct = 0;
    for (const c in r.cats) { asked += r.cats[c].asked; correct += r.cats[c].correct; }

    $('end-title').textContent = r.won ? '🏆 Prošel jsi celý Internet!' : '💀 Konec běhu';
    $('end-summary').innerHTML =
      (r.won
        ? `Porazil jsi všechny ${FLOORS} Firewally za ${formatTime(r.time)}. `
        : `Došel jsi do <b>patra ${r.floor}, místnosti ${r.room}</b> za ${formatTime(r.time)}. `) +
      `Odpověděl jsi správně napoprvé na <b>${correct} z ${asked}</b> otázek (${pct(correct, asked)} %). ` +
      `Toto byl tvůj ${runCount}. pokus.`;

    const rows = Object.keys(r.cats).filter(c => r.cats[c].asked > 0).map(c => {
      const now = pct(r.cats[c].correct, r.cats[c].asked);
      const b = before[c];
      let diff = '<span class="muted">první pokus</span>';
      if (b.asked > 0) {
        const d = now - pct(b.correct, b.asked);
        diff = d > 0 ? `<span class="up">▲ +${d} %</span>` : d < 0 ? `<span class="down">▼ ${d} %</span>` : '<span class="muted">= 0 %</span>';
      }
      return `<tr><td><span class="dot" style="background:${CATEGORIES[c].color}"></span>${CATEGORIES[c].name}</td>
        <td>${r.cats[c].correct}/${r.cats[c].asked}</td><td>${now} %</td><td>${diff}</td></tr>`;
    });
    $('end-table').innerHTML = rows.length
      ? `<table><thead><tr><th>Téma</th><th>Správně</th><th>Úspěšnost</th><th>Oproti průměru</th></tr></thead><tbody>${rows.join('')}</tbody></table>`
      : '<p class="muted">V tomto běhu jsi neodpověděl na žádnou otázku.</p>';
  }

  // ---------- obrazovka pokroku ----------
  function renderStats() {
    const runs = loadRuns();
    const box = $('stats-body');
    if (!runs.length) {
      box.innerHTML = '<p class="muted">Zatím nemáš odehraný žádný běh. Zahraj si a vrať se sem!</p>';
      return;
    }
    const total = sumStats(runs);
    let asked = 0, correct = 0;
    for (const c in total) { asked += total[c].asked; correct += total[c].correct; }
    const wins = runs.filter(r => r.won).length;
    const best = Math.max(...runs.map(r => (r.floor - 1) * ROOMS_PER_FLOOR + r.room));

    const k = Math.min(3, Math.floor(runs.length / 2));
    const first = sumStats(runs.slice(0, k));
    const lastRuns = sumStats(runs.slice(-k));

    const rows = Object.keys(CATEGORIES).map(c => {
      const t = total[c];
      const acc = pct(t.correct, t.asked);
      let trend = '<span class="muted">–</span>';
      if (k > 0 && first[c].asked && lastRuns[c].asked) {
        const d = pct(lastRuns[c].correct, lastRuns[c].asked) - pct(first[c].correct, first[c].asked);
        trend = d > 0 ? `<span class="up">▲ +${d} %</span>` : d < 0 ? `<span class="down">▼ ${d} %</span>` : '<span class="muted">= 0 %</span>';
      }
      const level = !t.asked ? 'nehráno' : acc >= 85 ? 'Expert' : acc >= 65 ? 'Pokročilý' : acc >= 40 ? 'Učeň' : 'Nováček';
      return `<tr><td><span class="dot" style="background:${CATEGORIES[c].color}"></span>${CATEGORIES[c].name}</td>
        <td>${t.asked}</td>
        <td><div class="bar"><div style="width:${acc}%;background:${CATEGORIES[c].color}"></div></div>${acc} %</td>
        <td>${trend}</td><td>${level}</td></tr>`;
    });

    const recent = runs.slice(-15);
    const bars = recent.map((r, i) => {
      let a = 0, cr = 0;
      for (const c in r.cats) { a += r.cats[c].asked; cr += r.cats[c].correct; }
      const p = pct(cr, a);
      const n = runs.length - recent.length + i + 1;
      return `<div class="col" title="Pokus ${n}: ${p} % (${cr}/${a})"><div class="fill${r.won ? ' won' : ''}" style="height:${Math.max(p, 3)}%"></div><span>${n}</span></div>`;
    });

    box.innerHTML = `
      <div class="cards">
        <div><b>${runs.length}</b><span>odehraných běhů</span></div>
        <div><b>${asked}</b><span>zodpovězených otázek</span></div>
        <div><b>${pct(correct, asked)} %</b><span>celková úspěšnost</span></div>
        <div><b>${wins}</b><span>výher</span></div>
        <div><b>${best}/${FLOORS * ROOMS_PER_FLOOR}</b><span>nejdál (místnost)</span></div>
      </div>
      <h3>Úspěšnost podle témat</h3>
      <table><thead><tr><th>Téma</th><th>Otázek</th><th>Úspěšnost</th><th title="Prvních ${k} vs. posledních ${k} běhů">Zlepšení</th><th>Úroveň</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>
      <p class="muted small">${k
        ? `„Zlepšení“ porovnává tvých prvních ${k} a posledních ${k} běhů.`
        : '„Zlepšení“ se ukáže, až odehraješ aspoň 2 běhy.'}</p>
      <h3>Úspěšnost v posledních bězích</h3>
      <div class="chart">${bars.join('')}</div>`;
  }

  // ---------- UI ----------
  function showOverlay(id) {
    for (const o of document.querySelectorAll('.overlay')) o.classList.toggle('hidden', o.id !== id);
  }

  function togglePause() {
    if (state === 'play') { state = 'pause'; keys.clear(); showOverlay('pause'); }
    else if (state === 'pause') { state = 'play'; showOverlay(null); }
  }

  function showQuestion(q) {
    const cat = CATEGORIES[q.cat];
    $('q-cat').textContent = cat.name;
    $('q-cat').style.background = cat.color;
    $('q-text').textContent = q.text;
    if (!room.isBoss || !boss || boss.shield) {
      setFeedback(room.isBoss
        ? 'Firewall má štít. Sestřel paket se správnou odpovědí a štít spadne!'
        : 'Sestřel paket se správnou odpovědí. Pozor – špatný paket se změní ve virus.', 'info');
    }
  }

  function setFeedback(text, kind) {
    const el = $('feedback');
    el.textContent = text;
    el.className = kind;
  }

  function updateHud() {
    let asked = 0, correct = 0;
    for (const c in run.stats) { asked += run.stats[c].asked; correct += run.stats[c].correct; }
    $('score').textContent = `Správně: ${correct}/${asked}`;
  }

  function buildTopicPicker() {
    const box = $('topic-list');
    box.innerHTML = Object.entries(CATEGORIES).map(([id, c]) =>
      `<label><input type="checkbox" value="${id}" checked><span class="dot" style="background:${c.color}"></span>${c.name}</label>`
    ).join('');
  }

  function selectedTopics() {
    return [...document.querySelectorAll('#topic-list input:checked')].map(i => i.value);
  }

  function start() {
    const cats = selectedTopics();
    if (!cats.length) {
      $('topic-warning').textContent = 'Vyber aspoň jedno téma.';
      return;
    }
    $('topic-warning').textContent = '';
    newRun(cats);
  }

  buildTopicPicker();
  $('btn-start').addEventListener('click', start);
  $('btn-stats').addEventListener('click', () => { renderStats(); showOverlay('stats'); });
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-quit').addEventListener('click', () => endRun(false));
  $('btn-again').addEventListener('click', () => newRun(run.cats));
  $('btn-end-stats').addEventListener('click', () => { renderStats(); showOverlay('stats'); });
  $('btn-end-menu').addEventListener('click', () => { run = null; state = 'menu'; showOverlay('menu'); });
  $('btn-stats-back').addEventListener('click', () => showOverlay(state === 'end' ? 'end' : 'menu'));
  $('btn-reset').addEventListener('click', () => {
    if (confirm('Opravdu smazat všechny uložené výsledky?')) {
      localStorage.removeItem(STORE_KEY);
      renderStats();
    }
  });

  // ---------- vykreslování ----------
  function theme() { return FLOOR_THEMES[(run ? run.floor : 1) - 1]; }

  function drawIdle() {
    drawRoom(FLOOR_THEMES[0], false);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10);
    const th = theme();
    drawRoom(th, room.doorOpen);
    for (const p of pickups) drawHeartPickup(p);
    for (const p of packets) drawPacket(p);
    if (boss) drawBoss(boss);
    for (const e of enemies) e.type === 'bug' ? drawBug(e) : drawTrojan(e);
    for (const s of shots) drawShot(s);
    for (const t of tears) drawTear(t);
    drawPlayer(player);
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawHud(th);
    if (room.intro > 0) drawIntro(th);
  }

  function drawRoom(th, doorOpen) {
    ctx.fillStyle = th.wall;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.floor;
    ctx.fillRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL);

    // mřížka podlahy
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = WALL; x <= W - WALL; x += 48) { ctx.moveTo(x, WALL); ctx.lineTo(x, H - WALL); }
    for (let y = WALL; y <= H - WALL; y += 48) { ctx.moveTo(WALL, y); ctx.lineTo(W - WALL, y); }
    ctx.stroke();

    // "plošné spoje" ve zdech
    ctx.strokeStyle = th.neon + '33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 70; x < W; x += 110) {
      ctx.moveTo(x, H); ctx.lineTo(x, H - 20); ctx.lineTo(x + 20, H - 32);
    }
    for (let y = 90; y < H - 40; y += 120) {
      ctx.moveTo(0, y); ctx.lineTo(18, y); ctx.lineTo(30, y + 14);
      ctx.moveTo(W, y); ctx.lineTo(W - 18, y); ctx.lineTo(W - 30, y + 14);
    }
    ctx.stroke();

    // neonový okraj
    ctx.strokeStyle = th.neon;
    ctx.lineWidth = 2;
    ctx.shadowColor = th.neon;
    ctx.shadowBlur = 12;
    ctx.strokeRect(WALL, WALL, W - 2 * WALL, H - 2 * WALL);
    ctx.shadowBlur = 0;

    // dveře
    const dx = W / 2 - DOOR_W / 2;
    if (doorOpen) {
      ctx.fillStyle = '#020617';
      ctx.fillRect(dx, 0, DOOR_W, WALL + 2);
      ctx.strokeStyle = '#4ade80';
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 16 + Math.sin(clock * 5) * 6;
      ctx.lineWidth = 3;
      ctx.strokeRect(dx, -4, DOOR_W, WALL + 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▲', W / 2, WALL / 2 + 8 + Math.sin(clock * 6) * 3);
    } else {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(dx, 4, DOOR_W, WALL - 4);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(dx + (i * DOOR_W) / 6, 6);
        ctx.lineTo(dx + (i * DOOR_W) / 6, WALL);
        ctx.stroke();
      }
    }
  }

  function drawHud(th) {
    // srdíčka
    for (let i = 0; i < player.maxHp / 2; i++) {
      const v = clamp(player.hp - i * 2, 0, 2);
      drawHeart(WALL + 14 + i * 30, WALL / 2, 11, v);
    }
    ctx.textAlign = 'right';
    ctx.font = '600 15px "JetBrains Mono", Consolas, monospace';
    ctx.fillStyle = th.neon;
    const label = room.isBoss ? 'BOSS' : `${run.room}/${ROOMS_PER_FLOOR - 1}`;
    ctx.fillText(`Patro ${run.floor} · ${th.name} · ${label}`, W - WALL, WALL / 2 + 5);
  }

  function drawIntro(th) {
    const a = Math.min(1, room.intro);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(2,6,23,0.6)';
    ctx.fillRect(0, H / 2 - 50, W, 100);
    ctx.textAlign = 'center';
    ctx.fillStyle = th.neon;
    ctx.font = 'bold 34px "JetBrains Mono", Consolas, monospace';
    ctx.fillText(room.isBoss ? `⚠ FIREWALL – patro ${run.floor}` : `Patro ${run.floor} – ${th.name}`, W / 2, H / 2 + 4);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(room.isBoss ? 'Shoď mu štít správnou odpovědí a pak střílej!' : `Místnost ${run.room}`, W / 2, H / 2 + 32);
    ctx.globalAlpha = 1;
  }

  function drawHeart(x, y, s, value) {
    // value: 0 = prázdné, 1 = půlka, 2 = plné
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.9);
      ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.45);
      ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
      ctx.closePath();
    };
    path();
    ctx.fillStyle = '#334155';
    ctx.fill();
    if (value > 0) {
      ctx.save();
      path();
      ctx.clip();
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(x - s * 1.5, y - s * 1.5, value === 2 ? s * 3 : s * 1.5, s * 3);
      ctx.restore();
    }
    path();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawHeartPickup(p) {
    const y = p.y + Math.sin(clock * 4) * 3;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 14;
    drawHeart(p.x, y, 12, 2);
    ctx.shadowBlur = 0;
  }

  function drawPacket(p) {
    const color = CATEGORIES[room.question.cat].color;
    const x = p.x - p.w / 2, y = p.y - p.h / 2 + Math.sin(p.bob) * 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#0b1222';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, p.w, p.h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    // "hlavička" paketu
    ctx.fillStyle = color;
    ctx.fillRect(x + 6, y + 5, 10, 3);
    ctx.fillRect(x + 6, y + p.h - 8, 10, 3);
    ctx.fillStyle = '#f8fafc';
    ctx.font = PACKET_FONT;
    ctx.textAlign = 'center';
    ctx.fillText(p.label, p.x + 6, y + p.h / 2 + 5);
  }

  function drawPlayer(p) {
    if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + p.r - 2, p.r * 0.9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // anténa – je to přece síťová karta :)
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x + 6, p.y - p.r + 2);
    ctx.lineTo(p.x + 10, p.y - p.r - 9);
    ctx.stroke();
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(p.x + 10, p.y - p.r - 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // oči se dívají směrem střelby
    const ex = p.lookX * 4, ey = p.lookY * 4;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x + side * 6 + ex * 0.5, p.y - 2 + ey * 0.5, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x + side * 6 + ex, p.y - 2 + ey, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTear(t) {
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#bae6fd';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0c4a6e';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t.bit, t.x, t.y + 3.5);
  }

  function drawShot(s) {
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#fb923c';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawBug(e) {
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(a);
    // nožičky
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      const wig = Math.sin(e.t * 18 + i) * 4;
      ctx.beginPath();
      ctx.moveTo(i * 6, 0); ctx.lineTo(i * 6 + wig, -e.r - 4);
      ctx.moveTo(i * 6, 0); ctx.lineTo(i * 6 - wig, e.r + 4);
      ctx.stroke();
    }
    ctx.fillStyle = e.hit > 0 ? '#fff' : '#ef4444';
    ctx.beginPath();
    ctx.ellipse(0, 0, e.r, e.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(-e.r, 0); ctx.lineTo(e.r * 0.5, 0);
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(e.r * 0.6, -4, 3, 0, Math.PI * 2);
    ctx.arc(e.r * 0.6, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrojan(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.hit > 0 ? '#fff' : '#7e22ce';
    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + e.t;
      const r = e.r + Math.sin(e.t * 3 + i) * 2;
      i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const a = Math.atan2(player.y - e.y, player.x - e.x);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * 3, Math.sin(a) * 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBoss(b) {
    const w = b.r * 2.4, h = b.r * 1.7;
    const x = b.x - w / 2, y = b.y - h / 2;
    ctx.fillStyle = b.flash > 0 ? '#fff' : b.shield ? '#c2410c' : '#9a3412';
    ctx.fillRect(x, y, w, h);
    // cihly
    ctx.strokeStyle = '#431407';
    ctx.lineWidth = 2;
    const rows = 4, bh = h / rows;
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      ctx.moveTo(x, y + r * bh); ctx.lineTo(x + w, y + r * bh);
      ctx.stroke();
      const off = r % 2 ? 0 : 18;
      for (let cx = x + off; cx < x + w; cx += 36) {
        ctx.beginPath();
        ctx.moveTo(cx, y + r * bh); ctx.lineTo(cx, y + (r + 1) * bh);
        ctx.stroke();
      }
    }
    ctx.strokeRect(x, y, w, h);
    // oči
    const angry = b.shield;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      ctx.arc(b.x + side * 22, b.y - 4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      if (angry) {
        const a = Math.atan2(player.y - b.y, player.x - b.x);
        ctx.beginPath();
        ctx.arc(b.x + side * 22 + Math.cos(a) * 4, b.y - 4 + Math.sin(a) * 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x + side * 34, b.y - 20); ctx.lineTo(b.x + side * 12, b.y - 12);
        ctx.stroke();
      } else {
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('x', b.x + side * 22, b.y + 1);
      }
    }
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 12px "JetBrains Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('FIREWALL', b.x, b.y + h / 2 - 8);

    // štít
    if (b.shield) {
      ctx.strokeStyle = `rgba(147,197,253,${0.6 + Math.sin(clock * 6) * 0.25})`;
      ctx.fillStyle = 'rgba(59,130,246,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // odpočet zranitelnosti
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 26, -Math.PI / 2, -Math.PI / 2 + (b.vuln / 6) * Math.PI * 2);
      ctx.stroke();
    }

    // životy bosse
    const bw = 300;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(W / 2 - bw / 2, H - WALL + 16, bw, 14);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(W / 2 - bw / 2, H - WALL + 16, (bw * Math.max(0, b.hp)) / b.maxHp, 14);
    ctx.strokeStyle = '#fdba74';
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - bw / 2, H - WALL + 16, bw, 14);
  }

  // ---------- pomocné ----------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const nx = clamp(cx, rx - rw / 2, rx + rw / 2);
    const ny = clamp(cy, ry - rh / 2, ry + rh / 2);
    return Math.hypot(cx - nx, cy - ny) < r;
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    return m ? `${m} min ${s % 60} s` : `${s} s`;
  }
})();
