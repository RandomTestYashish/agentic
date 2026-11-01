/* Agentic — telco AI assistant prototype */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const plain = (s) => String(s).replace(/\*\*/g, '');
  const rand = (a, b) => a + Math.random() * (b - a);

  const NAME = 'Yashish';
  const KEY = 'agentic_onboarded_v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };
  store.del(KEY); // onboarding plays on every fresh load of the prototype

  // Account state the assistant reads and changes
  const S = { dailyLeft: 1.1, dailyTotal: 2, extraGB: 0, recharged: false, hellotunes: true, spam: true, billPaid: false };

  const ITEMS = {
    d19: { kind: 'data', name: '1 GB data pack', price: 19, gb: 1, validity: '1 day' },
    d49: { kind: 'data', name: '6 GB data pack', price: 49, gb: 6, validity: '1 day' },
    d161: { kind: 'data', name: '12 GB data pack', price: 161, gb: 12, validity: '30 days' },
    d361: { kind: 'data', name: '50 GB data pack', price: 361, gb: 50, validity: '30 days' },
    p399: { kind: 'plan', name: '₹399 Unlimited', price: 399, data: '2.5 GB/day', validity: '28 days', perks: ['Unlimited 5G', 'Unlimited calls'] },
    p449: { kind: 'plan', name: '₹449 Unlimited', price: 449, data: '3 GB/day', validity: '28 days', perks: ['Unlimited 5G', 'Xstream Play'] },
    p979: { kind: 'plan', name: '₹979 Unlimited', price: 979, data: '2 GB/day', validity: '84 days', perks: ['Unlimited 5G', 'Apple Music'] },
    p3599: { kind: 'plan', name: '₹3599 Annual', price: 3599, data: '2 GB/day', validity: '365 days', perks: ['Unlimited 5G', 'Xstream Play'] },
    r649: { kind: 'roam', name: 'UAE roaming pack', price: 649, gb: 2, validity: '7 days', mins: 100 },
    r1199: { kind: 'roam', name: 'UAE roaming pack', price: 1199, gb: 5, validity: '10 days', mins: 200 },
    bill: { kind: 'bill', name: 'October postpaid bill', price: 749, validity: 'Due 5 Nov' },
  };

  /* ---------------- Elements ---------------- */
  const phone = $('#phone'), device = $('#device');
  const home = $('#home'), onboard = $('#onboard'), agent = $('#agent');
  const chat = $('#chatScroll'), msgs = $('#messages'), greet = $('#greet');
  const composer = $('#composer'), input = $('#input');
  const toastEl = $('#toast');
  phone.appendChild(toastEl);

  /* ---------------- Orb (assembled from Figma layers) ---------------- */
  const ORB = `<div class="orb"><div class="orb-glow"><img src="assets/orb-glow.svg" alt=""></div><div class="orb-clip"><div class="orb-frame">
    <div class="of o-base"><img src="assets/orb-base.svg" alt=""></div>
    <div class="of o-f1"><img src="assets/orb-f1.svg" alt=""></div>
    <div class="of o-f2"><img src="assets/orb-f2.svg" alt=""></div>
    <div class="of o-f3"><img src="assets/orb-f3.svg" alt=""></div>
    <div class="of o-f4"><img src="assets/orb-f4.svg" alt=""></div>
    <div class="of o-v2"><img src="assets/orb-v2.svg" alt=""></div>
    <div class="of o-v3"><img src="assets/orb-v3.svg" alt=""></div>
  </div></div><div class="orb-star"><img src="assets/orb-star.svg" alt=""></div></div>`;
  $$('[data-orb]').forEach((el) => {
    el.innerHTML = ORB;
    const n = +el.dataset.orb;
    if (n !== 120) $('.orb', el).style.transform = `scale(${n / 120})`;
  });
  const agentOrb = $('#agentOrb .orb');
  $$('.uname').forEach((e) => (e.textContent = NAME));

  /* ---------------- Device fit ---------------- */
  function fit() {
    if (innerWidth <= 500) { device.style.transform = ''; return; }
    const k = Math.min(1, (innerHeight - 32) / 836, (innerWidth - 32) / 399);
    device.style.transform = k < 1 ? `scale(${k})` : '';
  }
  addEventListener('resize', fit); fit();
  // On real phones the Figma home (375 wide) zooms to the screen width, so there is no side gap
  const homeZoom = () => (innerWidth <= 500 ? phone.offsetWidth / 375 : 1);
  const fitHome = () => phone.style.setProperty('--home-zoom', homeZoom());
  addEventListener('resize', fitHome); fitHome();
  const setDock = () => phone.style.setProperty('--dock-x', `${16 - (phone.offsetWidth / 2 - 60)}px`);
  addEventListener('resize', setDock); setDock();

  /* ---------------- Toast ---------------- */
  let toastT;
  function toast(t) {
    toastEl.textContent = t;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 1900);
  }

  /* ---------------- Home ---------------- */
  const PHRASES = ['What do you need today?', 'Check my data balance', 'Recharge my ₹399 pack', 'Why is my bill high?', 'Fix my slow internet'];
  let pi = 0;
  setInterval(() => {
    if (!home.classList.contains('active') || document.hidden) return;
    const box = $('#amaText');
    const cur = box.querySelector('span:not(.out)');
    pi = (pi + 1) % PHRASES.length;
    const nx = document.createElement('span');
    nx.className = 'in'; nx.textContent = PHRASES[pi];
    box.appendChild(nx);
    void nx.offsetWidth;            // start from below
    nx.classList.remove('in');      // rise into place
    if (cur) { cur.classList.add('out'); setTimeout(() => cur.remove(), 850); }
  }, 3000);

  // The home screen is a static replica of the Figma frame; only the Agentic pill is interactive.



  /* ---------------- Screen transitions ---------------- */
  let pendingAsk = null;
  function originOf(el) {
    const p = phone.getBoundingClientRect(), r = (el || $('#amaPill')).getBoundingClientRect();
    const k = p.width / phone.offsetWidth || 1;
    return { x: (r.left + r.width / 2 - p.left) / k, y: (r.top + r.height / 2 - p.top) / k };
  }
  function play(el, cls) {
    return new Promise((res) => {
      el.classList.add(cls);
      const done = () => { el.classList.remove(cls); el.removeEventListener('animationend', on); res(); };
      const on = (e) => { if (e.target === el) done(); };
      el.addEventListener('animationend', on);
      setTimeout(done, 900);
    });
  }
  function setOrigin(el, o) { el.style.setProperty('--ox', o.x + 'px'); el.style.setProperty('--oy', o.y + 'px'); }

  // Rects in the phone's own (unscaled) coordinates
  function pRect(el) {
    const p = phone.getBoundingClientRect(), r = el.getBoundingClientRect(), k = p.width / phone.offsetWidth || 1;
    return { x: (r.left - p.left) / k, y: (r.top - p.top) / k, w: r.width / k, h: r.height / k };
  }
  function centered(el, size) {
    const r = pRect(el);
    return { x: r.x + r.w / 2 - size / 2, y: r.y + r.h / 2 - size / 2, w: size };
  }
  // The AI blob itself carries the user between screens
  const flyEl = $('#flyOrb');
  function fly(from, to, ms = 1100) {
    flyEl.classList.add('on', 'still');
    const k0 = from.w / 120, k1 = to.w / 120, N = 60, T = ms / 1000, frames = [];
    const lift = Math.min(90, Math.hypot(to.x - from.x, to.y - from.y) * 0.35);
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * T;
      const p = spring(t, 110, 11);                      // underdamped: overshoots, then settles (bounce)
      const q = Math.min(1, spring(t, 200, 26));          // path progress for the arc
      const x = lerp(from.x, to.x, p), y = lerp(from.y, to.y, p) - lift * Math.sin(Math.PI * q);
      const sc = lerp(k0, k1, Math.min(p, 1.12));
      frames.push({ transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${sc.toFixed(4)})` });
    }
    const anim = flyEl.animate(frames, { duration: ms, easing: 'linear', fill: 'forwards' });
    return anim.finished.then(() => { flyEl.classList.remove('on', 'still'); anim.cancel(); });
  }
  const pill = $('#amaPill');
  const starRect = () => centered($('#amaStar'), 18);
  let moving = false;

  // The Agentic pill itself expands into the full screen (no extra element), then the agent screen fades in over it
  const EASE_INOUT = 'cubic-bezier(.65, 0, .35, 1)', EASE_OUT = 'cubic-bezier(.16, 1, .3, 1)';
  const header = $('.home-header');
  function pillClip() {
    const r = pRect(pill), W = phone.offsetWidth, H = phone.offsetHeight;
    return { open: 'inset(0px 0px 0px 0px round 0px)', closed: `inset(${r.y}px ${W - r.x - r.w}px ${H - r.y - r.h}px ${r.x}px round 20px)` };
  }
  function pillToFull() {
    const c = pillClip();
    const z = homeZoom(), h = pRect(header);   // the header is zoomed, so convert phone px into its units
    Object.assign(pill.style, { position: 'absolute', left: `${-h.x / z}px`, top: `${-h.y / z}px`, width: phone.offsetWidth / z + 'px', height: phone.offsetHeight / z + 'px', borderRadius: '0', clipPath: c.closed, zIndex: 1 });
    header.style.zIndex = 90;
    pill.classList.add('expanding');
    return c;
  }
  function pillReset() {
    pill.removeAttribute('style');
    header.style.zIndex = '';
    pill.classList.remove('expanding', 'blushed');
    pill.getAnimations().forEach((a) => a.cancel());
  }
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Damped spring (seconds -> progress). One physical curve drives each motion, so speed never jumps.
  function spring(t, k = 170, c = 20) {
    const w0 = Math.sqrt(k), z = c / (2 * Math.sqrt(k));
    if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t));
  }
  const easeInOut = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, p) => a + (b - a) * p;
  function rrPath(x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    const f = (n) => n.toFixed(2);
    return `path('M${f(x + r)},${f(y)} H${f(x + w - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w)},${f(y + r)} V${f(y + h - r)} A${f(r)},${f(r)} 0 0 1 ${f(x + w - r)},${f(y + h)} H${f(x + r)} A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + h - r)} V${f(y + r)} A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)} Z')`;
  }
  // Keyframes for the pill growing into a soft blob that swallows the screen
  function blobFrames(dir) {
    const z = homeZoom(), r0 = pRect(pill);
    const r = { x: r0.x / z, y: r0.y / z, w: r0.w / z, h: r0.h / z }, W = phone.offsetWidth / z, H = phone.offsetHeight / z, m = 140;
    const cover = { x: -m, y: -m, w: W + 2 * m, h: H + 2 * m };
    const N = 60, T = 1.25, frames = [];
    for (let i = 0; i <= N; i++) {
      let p = dir === 'open' ? spring((i / N) * T, 42, 11.5) : 1 - easeInOut(i / N);
      p = Math.max(0, p);
      const x = lerp(r.x, cover.x, p), y = lerp(r.y, cover.y, p), w = lerp(r.w, cover.w, p), h = lerp(r.h, cover.h, p);
      frames.push({ clipPath: rrPath(x, y, w, h, lerp(20, 180, Math.min(1, p * 1.6))) });
    }
    return frames;
  }
  async function openAgent(opts = {}) {
    if (moving) return;
    moving = true;
    pendingAsk = opts.ask || null;
    const target = !store.get(KEY) ? onboard : agent;
    target.classList.add('active', 'preparing');           // pre-render, invisible
    const openFrames = blobFrames('open');                  // measure the pill before it leaves the header layout
    pillToFull();
    pill.style.clipPath = openFrames[0].clipPath;
    await nextFrame();
    const grow = pill.animate(openFrames, { duration: 1150, easing: 'linear', fill: 'forwards' });
    setTimeout(() => pill.classList.add('blushed'), 300);
    await sleep(620);
    if (target === agent && !hasMsgs()) { agent.classList.add('intro'); setTimeout(() => agent.classList.remove('intro'), 1600); }
    target.classList.remove('preparing');
    const fade = target.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.33, 0, .2, 1)' });
    await Promise.all([grow.finished, fade.finished]);
    pillReset();
    moving = false;
    if (target === agent && pendingAsk) { const a = pendingAsk; pendingAsk = null; send(a); }
  }
  $('#agreeBtn').addEventListener('click', async () => {
    if (moving) return;
    moving = true;
    store.set(KEY, '1');
    const from = pRect($('.topbar-orb', onboard));
    $('#agreeBtn').animate([{ transform: 'scale(1)' }, { transform: 'scale(.96)', offset: .4 }, { transform: 'scale(1)' }], { duration: 300, easing: EASE_OUT });
    onboard.classList.add('leaving');
    agent.classList.add('active', 'orb-hidden', 'intro', 'flown');
    setTimeout(() => agent.classList.remove('intro', 'flown'), 1700);
    onboard.classList.add('orb-hidden');
    const to = pRect($('#agentOrb'));
    const fadeIn = agent.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 160, easing: EASE_OUT, fill: 'both' });
    // onboarding stays opaque underneath; the agent screen fades in over it
    fadeIn.finished.then(() => onboard.classList.remove('active', 'orb-hidden', 'leaving'));
    await fly(from, to, 1100);
    agent.classList.remove('orb-hidden');
    agent.classList.add('land-ping'); setTimeout(() => agent.classList.remove('land-ping'), 1200);
    await fadeIn.finished; fadeIn.cancel();
    moving = false;
    if (pendingAsk) { const a = pendingAsk; pendingAsk = null; send(a); }
  });
  async function closeOverlay(el) {
    if (moving) return;
    moving = true;
    stopSpeaking(); closeVoice(true); closeSheet(); cancelRec();
    input.blur();
    const closeFrames = blobFrames('close');
    pillToFull();
    pill.style.clipPath = 'none';
    pill.classList.add('instant', 'blushed');
    void pill.offsetWidth;
    pill.classList.remove('instant');
    await nextFrame();
    const fade = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'cubic-bezier(.4, 0, .6, 1)', fill: 'both' });
    const shrink = pill.animate(closeFrames, { duration: 700, delay: 160, easing: 'linear', fill: 'forwards' });
    setTimeout(() => pill.classList.remove('blushed'), 360);
    await fade.finished;
    el.classList.remove('active'); fade.cancel();
    await shrink.finished;
    pillReset();
    pill.classList.add('landed');
    setTimeout(() => pill.classList.remove('landed'), 700);
    moving = false;
  }
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeOverlay(b.closest('.screen'))));

  /* ---------------- Docking (landing -> chat layout) ---------------- */
  function flip(els, mutate) {
    const first = els.map((e) => e.getBoundingClientRect());
    mutate();
    els.forEach((e, i) => {
      const last = e.getBoundingClientRect();
      const dx = first[i].left - last.left, dy = first[i].top - last.top;
      if (!dx && !dy) return;
      e.style.transition = 'none';
      e.style.transform = `translate(${dx}px, ${dy}px)`;
      e.getBoundingClientRect();
      e.style.transition = 'transform .75s cubic-bezier(.32,.72,0,1)';
      e.style.transform = '';
    });
  }
  const greetParts = () => [...greet.children];
  const isDocked = () => agent.classList.contains('docked');
  const hasMsgs = () => msgs.children.length > 0;
  const settle = () => { agent.classList.add('orb-moving'); clearTimeout(settle.t); settle.t = setTimeout(() => agent.classList.remove('orb-moving'), 800); };
  function dock() { if (!isDocked()) { settle(); flip(greetParts(), () => agent.classList.add('docked')); } }
  function undock() { if (isDocked() && !hasMsgs()) { settle(); flip(greetParts(), () => agent.classList.remove('docked')); } }

  /* ---------------- Composer ---------------- */
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    const has = input.value.trim().length > 0;
    composer.classList.toggle('has-text', has);
    agent.classList.toggle('typing', has);
    composer.style.borderRadius = input.scrollHeight > 30 ? '24px' : '';
  }
  input.addEventListener('input', () => { autosize(); if (input.value.trim()) dock(); });
  input.addEventListener('blur', () => setTimeout(() => { if (!input.value.trim() && document.activeElement !== input) undock(); }, 150));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); composer.requestSubmit(); }
  });
  composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) { stopGen(); return; }
    const t = input.value.trim();
    if (!t) return;
    input.value = ''; autosize();
    send(t);
  });

  /* ---------------- Scrolling ---------------- */
  let stick = true;
  chat.addEventListener('scroll', () => {
    const gap = chat.scrollHeight - chat.scrollTop - chat.clientHeight;
    stick = gap < 90;
    agent.classList.toggle('scrolled', chat.scrollTop > 6 && isDocked());
    $('#jumpBtn').classList.toggle('show', !stick && hasMsgs());
  });
  function toBottom(force) { if (force || stick) chat.scrollTo({ top: chat.scrollHeight, behavior: force ? 'smooth' : 'auto' }); }
  $('#jumpBtn').addEventListener('click', () => { stick = true; toBottom(true); });

  /* ---------------- Messaging ---------------- */
  let busy = false, gen = null, lastUser = '';
  function setBusy(b) { busy = b; composer.classList.toggle('busy', b); agentOrb.classList.toggle('fast', b); }
  function stopGen() { if (gen) gen.stopped = true; }

  function addUser(text, opts = {}) {
    const w = document.createElement('div');
    w.className = 'msg-user';
    w.innerHTML = `<div class="bubble${opts.voice ? ' voice-b' : ''}">${esc(text)}</div><div class="status shimmer-text">Sending...</div>`;
    msgs.appendChild(w);
    agent.classList.add('has-msgs');
    stick = true; toBottom(true);
    const st = $('.status', w);
    setTimeout(() => { st.classList.remove('shimmer-text'); st.textContent = 'Delivered'; }, 650);
    return w;
  }

  async function send(text) {
    if (busy) { toast('Wait for the reply, or tap stop'); return; }
    stopSpeaking();
    dock();
    lastUser = text;
    addUser(text);
    agentOrb.classList.remove('gulp'); void agentOrb.offsetWidth; agentOrb.classList.add('gulp');
    await sleep(380);
    await runBot(route(text), { q: text });
  }

  const ACTIONS = `<div class="msg-actions">
    <button class="ma" data-act="up" aria-label="Good response"><img src="assets/thumb-up.svg" alt=""></button>
    <button class="ma" data-act="down" aria-label="Bad response"><img src="assets/thumb-down.svg" alt=""></button>
    <button class="ma" data-act="copy" aria-label="Copy"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E4146" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg></button>
    <button class="ma ma-listen" data-act="listen" aria-label="Listen"><svg class="spk" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E4146" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg><span class="eq"><b></b><b></b><b></b><b></b></span><span class="lbl">Listen</span></button>
    <button class="ma" data-act="regen" aria-label="Regenerate"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3E4146" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg></button>
  </div>`;

  async function streamInto(el, text, g) {
    const parts = text.split(/(\*\*.+?\*\*)/).filter(Boolean);
    el.classList.add('caret');
    for (const part of parts) {
      const bold = /^\*\*.+\*\*$/.test(part);
      const node = bold ? document.createElement('strong') : document.createTextNode('');
      el.appendChild(node);
      const words = (bold ? part.slice(2, -2) : part).split(/(\s+)/);
      for (const w of words) {
        if (g.stopped) { el.classList.remove('caret'); return false; }
        node.textContent += w;
        if (w.trim()) { toBottom(); await sleep(rand(16, 38)); }
      }
    }
    el.classList.remove('caret');
    return true;
  }

  async function runBot(resp, opts = {}) {
    const instant = !!opts.instant;
    const g = (gen = { stopped: false });
    if (!instant) setBusy(true);
    const w = document.createElement('div');
    w.className = 'msg-bot';
    w.dataset.q = opts.q || '';
    // Figma thinking state: a ring loader, starting with "Thinking about it...", then the task-specific steps
    const steps = instant ? (resp.steps || ['Thinking…']) : ['🤔 Thinking about it...', ...(resp.steps || [])];
    const split = (s) => { const m = s.match(/^(\S+)\s(.*)$/); return m ? [m[1], m[2]] : ['', s]; };
    const [e0, t0] = split(steps[0]);
    w.innerHTML = `<div class="thinking"><span class="t-orb" aria-hidden="true">${ORB.replace('class="orb"', 'class="orb fast"')}</span><span class="t-txt shimmer-text">${esc(t0)}</span></div>${instant ? '' : '<div class="skeleton"><i></i><i></i><i></i></div>'}`;
    if (opts.before) msgs.insertBefore(w, opts.before); else msgs.appendChild(w);
    toBottom();
    const th = $('.thinking', w);
    if (!instant) {
      await sleep(rand(800, 1100));
      for (let i = 1; i < steps.length && !g.stopped; i++) {
        const [e, t] = split(steps[i]);
        const tx = $('.t-txt', th);
        tx.classList.add('swap');
        await sleep(220);
        tx.textContent = t; tx.classList.remove('swap');
        await sleep(rand(850, 1150));
      }
      $('.skeleton', w)?.remove();
    } else {
      const [e, t] = split(steps[steps.length - 1]);
      $('.t-txt', th).textContent = t;
    }
    $('.t-txt', th).classList.remove('shimmer-text'); th.classList.add('done'); $('.t-orb .orb', th)?.classList.remove('fast');

    const body = document.createElement('div');
    body.className = 'bot-body';
    w.appendChild(body);
    let finished = true;
    for (const b of resp.blocks) {
      if (g.stopped) { finished = false; break; }
      if (b.p != null) {
        const p = document.createElement('p'); body.appendChild(p);
        if (instant) p.innerHTML = md(b.p); else if (!(await streamInto(p, b.p, g))) { finished = false; break; }
      } else if (b.ul || b.ol) {
        const l = document.createElement(b.ul ? 'ul' : 'ol'); body.appendChild(l);
        for (const it of b.ul || b.ol) {
          const li = document.createElement('li'); l.appendChild(li);
          if (instant) li.innerHTML = md(it); else if (!(await streamInto(li, it, g))) { finished = false; break; }
        }
        if (!finished) break;
      } else if (b.html) {
        const c = document.createElement('div');
        c.className = 'pop'; c.innerHTML = b.html; body.appendChild(c);
        toBottom();
        if (!instant) await sleep(260);
        if (b.after) await b.after(c, g);
        toBottom();
        if (!instant) await sleep(200);
      }
    }
    if (!finished) {
      const p = document.createElement('p');
      p.style.cssText = 'font-size:13px;color:#696B6F;font-style:italic';
      p.textContent = 'You stopped this response.';
      body.appendChild(p);
    }
    w.insertAdjacentHTML('beforeend', ACTIONS);
    if (finished && (resp.choices || resp.follow)) {
      const items = resp.choices || resp.follow;
      const row = !!resp.choices;
      w.insertAdjacentHTML('beforeend', `<div class="follow${row ? ' row' : ''}">${row ? '' : `<div class="follow-title">${resp.followTitle || 'Suggested follow-ups'}</div>`}${items.map((x) => `<button class="chip" data-ask="${esc(x)}">${esc(x)}</button>`).join('')}</div>`);
    }
    toBottom();
    if (resp.then && finished) setTimeout(resp.then, instant ? 0 : 350);
    if (!instant) setBusy(false);
    gen = null;
    return w;
  }

  /* ---------------- Cards ---------------- */
  const usageCard = () => {
    const usedPct = Math.round((1 - S.dailyLeft / S.dailyTotal) * 100);
    return `<div class="card">
      <div class="card-over">USAGE</div>
      <div><div class="kp-key">Daily Data</div><div class="kp-val">${S.dailyLeft} GB of ${S.dailyTotal} GB left</div><div class="bar"><i data-w="${100 - usedPct}"></i></div></div>
      ${S.extraGB ? `<div><div class="kp-key">Data top-up</div><div class="kp-val">${S.extraGB} GB left</div><div class="bar"><i data-w="100"></i></div></div>` : ''}
      <div><div class="kp-key">5G Data</div><div class="kp-val">Unlimited</div><div class="bar"><i data-w="100" style="opacity:.35"></i></div></div>
      <div><div class="kp-key">Daily SMS</div><div class="kp-val">100 of 100 left</div><div class="bar"><i data-w="100"></i></div><div class="hint">Auto-renews every day at midnight</div></div>
      <div class="card-actions"><button class="btn btn-secondary" data-act="track">Track Data Usage</button><button class="btn btn-primary" data-ask="Buy more data">Buy Data</button></div>
    </div>`;
  };
  const growBars = (el) => { requestAnimationFrame(() => $$('.bar > i', el).forEach((i) => (i.style.width = i.dataset.w + '%'))); };

  const packCard = (id, best) => {
    const it = ITEMS[id];
    return `<div class="pack${best ? ' best' : ''}">
      ${best ? '<span class="pack-badge">BEST MATCH</span>' : ''}
      <div class="pack-row"><div class="pack-price">₹${it.price}</div><div class="pk">${it.gb} GB<small>Data</small></div><div class="pk">${it.validity}<small>Validity</small></div></div>
      <div class="pack-foot"><button class="tlink" data-act="details" data-id="${id}">View Details <img src="assets/chevron.svg" width="16" height="16" alt=""></button><button class="btn btn-secondary" data-act="buy" data-id="${id}">Buy</button></div>
    </div>`;
  };
  const planCard = (id, best) => {
    const it = ITEMS[id];
    return `<div class="plan${best ? ' best' : ''}">
      <div class="plan-top"><span class="plan-price">₹${it.price}</span>${best ? '<span class="pack-badge">MY PICK</span>' : ''}</div>
      <div class="plan-meta"><div class="pk">${it.data}<small>Data</small></div><div class="pk">${it.validity}<small>Validity</small></div></div>
      <div class="plan-perks">${it.perks.map((p) => `<span class="perk">${p}</span>`).join('')}</div>
      <button class="btn ${best ? 'btn-primary' : 'btn-secondary'}" data-act="buy" data-id="${id}">Recharge</button>
    </div>`;
  };
  const successCard = (title, sub) => `<div class="success-card"><span class="sc-ic"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><b>${title}</b><span>${sub}</span></div></div>`;

  /* ---------------- Response engine ---------------- */
  const has = (t, re) => re.test(t);
  function route(q, v = 0) {
    const t = q.toLowerCase();
    const hi = has(t, /\b(kitna|bacha|hai|karo|kya|mera|meri|nahi|chal|kyun|zyada|batao)\b/);
    if (has(t, /^(hi|hii|hello|hey|namaste|yo)\b/) && t.length < 24) return R.greet();
    if (has(t, /(thank|thanks|thx|shukriya|dhanyavad|that'?s all|no,? thank)/)) return R.thanks();
    if (has(t, /not now|later|no thanks|skip/)) return R.notNow();
    if (has(t, /hellotune/) && has(t, /off|stop|deactivat|cancel|remove|turn/)) return R.hellotunesOff();
    if (has(t, /complaint|ticket|raise/)) return R.ticket();
    if (has(t, /test again|run test|retest/)) return R.network(hi, true);
    if (has(t, /restart.*router|reboot/)) return R.router();
    if (has(t, /pay bill|pay .*749|bill pay/)) return R.payBill();
    if (has(t, /auto.?pay/)) return R.autopay();
    if (has(t, /difference|compare|vs/)) return R.compare();
    if (has(t, /top.?up|add.*(gb|data)|buy.*data|data pack|more data|add a/)) return R.packs(v);
    if (has(t, /roam|international|abroad|travel|dubai|uae|trip/)) return R.roaming();
    if (has(t, /399/) && has(t, /recharg|renew|pack/)) return R.recharge399();
    if (has(t, /recharg|plan|validity|expir|renew/)) return R.plans(v);
    if (has(t, /bill|charge|deduct|zyada|expensive|high/)) return R.bill(v);
    if (has(t, /slow|network|signal|speed|internet|net |call drop|buffer|5g/)) return R.network(hi);
    if (has(t, /data|balance|usage|left|bacha|kitna|\bgb\b/)) return R.usage(hi, v);
    if (has(t, /service|subscription|active|ott/)) return R.services();
    if (has(t, /spam|fraud|scam|block/)) return R.spam();
    if (has(t, /wi-?fi|broadband|fiber|fibre|router|xstream/)) return R.wifi();
    if (has(t, /e-?sim|sim|port/)) return R.sim();
    return R.fallback(q);
  }

  const R = {
    greet: () => ({
      steps: ['👋 Saying hello…'],
      blocks: [{ p: `Hey ${NAME}! 👋 I can check your data, recharge your number, explain your bill or fix network issues. What would you like to do?` }],
      say: `Hey ${NAME}! I can check your data, recharge, explain your bill or fix network issues. What would you like to do?`,
      follow: ['How much data do I have left?', 'Recharge my number', 'My internet is slow'],
    }),

    usage: (hi, v) => {
      const pct = Math.round((1 - S.dailyLeft / S.dailyTotal) * 100);
      const lead = hi
        ? `Maine aapka account check kar liya. Aaj ke **${S.dailyTotal} GB** mein se **${S.dailyLeft} GB** data bacha hai — yeh raat 12 baje reset hoga.`
        : [`I've checked your account, ${NAME}.`, `All right, here's your usage, ${NAME}.`][v % 2];
      const blocks = hi ? [{ p: lead }] : [{ p: lead }, { p: `You've used **${pct}%** of today's data — **${S.dailyLeft} GB** of ${S.dailyTotal} GB is left, and it resets at midnight.` }];
      if (S.extraGB) blocks.push({ p: `You also have **${S.extraGB} GB** from your top-up.` });
      blocks.push({ html: usageCard(), after: (el) => growBars(el) });
      if (!S.recharged) blocks.push({ p: hi ? 'Dhyaan dein: aapka **₹399 pack aaj expire** ho raha hai.' : 'Heads up: your **₹399 pack expires today**, so your data stops at midnight unless you recharge.' });
      blocks.push({ p: hi ? '**Kya main top-up add kar doon?**' : '**Want me to add a top-up?**' });
      return {
        steps: ['🤔 Checking current usage…', '📶 Reading today’s data meter…'],
        blocks,
        say: hi ? `Aaj ke ${S.dailyTotal} GB mein se ${S.dailyLeft} GB data bacha hai. Kya main top-up add kar doon?` : `You have ${S.dailyLeft} GB of today's ${S.dailyTotal} GB left. It resets at midnight. Want me to add a top-up?`,
        choices: S.recharged ? ['Yes, add a top-up', 'Not now'] : ['Yes, add a top-up', 'Recharge ₹399 pack', 'Not now'],
      };
    },

    packs: (v) => ({
      steps: ['🔍 Finding the best add-on for you…', '💡 Comparing 4 data packs…'],
      blocks: [
        { p: [`Here are data packs that work with your current plan. You use about **1.9 GB a day**, so **12 GB for ₹161** is the best match.`, `Based on your usage, the **12 GB pack at ₹161** gives you the most value. Here are your options:`][v % 2] },
        { html: packCard('d161', true) },
        { p: 'Other options:' },
        { html: `<div style="display:flex;flex-direction:column;gap:12px">${packCard('d49')}${packCard('d361')}</div>` },
        { p: '**Confirm and I’ll add it right now** — it activates in about 2 mins.' },
      ],
      say: 'The best match is 12 GB for 161 rupees, valid for 30 days. Tap buy and I will add it right away.',
    }),

    plans: (v) => ({
      steps: ['📋 Checking your current plan…', '✨ Finding plans that fit your usage…'],
      blocks: [
        { p: S.recharged ? 'Your ₹399 plan is active till **28 Nov**. If you want to switch, these plans fit how you use data:' : `Your **₹399** pack expires **today**. You use about 1.9 GB a day, so here are plans that fit:` },
        { html: `<div class="hscroll">${planCard('p449', true)}${planCard('p399')}${planCard('p979')}${planCard('p3599')}</div>` },
        { p: [`**My pick:** ₹449 gives you **3 GB/day** plus Xstream Play for just ₹50 more than your current plan.`, `**My pick:** ₹449 — an extra 0.5 GB every day and Xstream Play, for ₹50 more.`][v % 2] },
      ],
      say: 'Your 399 pack expires today. My pick is the 449 plan with 3 GB a day and Xstream Play, for just 50 rupees more.',
      follow: ['What’s the difference between ₹399 and ₹449?', 'Set up auto-pay', 'Just renew ₹399'],
    }),

    recharge399: () => ({
      steps: ['📋 Pulling up your ₹399 plan…'],
      blocks: [
        { p: `Sure, ${NAME}! Here’s your current plan — same benefits, renewed for another 28 days.` },
        { html: `<div class="hscroll" style="overflow:visible">${planCard('p399', false).replace('btn-secondary', 'btn-primary').replace('>Recharge<', '>Pay ₹399<')}</div>` },
        { p: '**Confirm and I’ll recharge right now** — it activates instantly.' },
      ],
      say: 'Here is your 399 plan. Confirm the payment and I will recharge instantly.',
    }),

    compare: () => ({
      steps: ['⚖️ Comparing both plans…'],
      blocks: [
        { html: `<div class="card"><div class="card-over">₹399 vs ₹449</div><div class="rows">
          <div class="r"><span>Daily data</span><b>2.5 GB · 3 GB</b></div>
          <div class="r"><span>Validity</span><b>28 days · 28 days</b></div>
          <div class="r"><span>Unlimited 5G</span><b>Yes · Yes</b></div>
          <div class="r"><span>Xstream Play</span><b>— · Included</b></div>
          <div class="r total"><span>Cost per GB</span><b>₹5.7 · ₹5.3</b></div></div></div>` },
        { p: 'With ₹449 you get **14 GB more** per cycle and it’s cheaper per GB. If you often run out by evening, it’s worth it.' },
      ],
      say: 'The 449 plan gives you half a GB more every day plus Xstream Play, and it is cheaper per GB.',
      choices: ['Recharge with ₹449', 'Just renew ₹399'],
    }),

    autopay: () => ({
      steps: ['🔐 Setting up UPI auto-pay…'],
      blocks: [{ html: successCard('Auto-pay is on', 'UPI · Airtel Payments Bank · renews ₹399 every 28 days') }, { p: 'Done! I’ll recharge your plan **automatically on the expiry date**, and remind you a day before.' }],
      say: 'Auto-pay is on. I will renew your plan automatically and remind you a day before.',
    }),

    bill: (v) => ({
      steps: ['🧾 Opening your October bill…', '🔎 Comparing with your last 3 bills…'],
      blocks: [
        { p: [`Your October postpaid bill is **₹749**, which is **₹150 more** than usual. Here’s what changed:`, `I found why — your bill is **₹749**, up **₹150** from your usual ₹599:`][v % 2] },
        { html: `<div class="card"><div class="card-over">OCTOBER BILL</div><div class="rows">
          <div class="r"><span>Plan rental</span><b>₹599</b></div>
          <div class="r"><span>International roaming (2 days)<span class="flag">New</span></span><b>₹99</b></div>
          <div class="r"><span>Hellotunes ${S.hellotunes ? '<span class="flag">Auto-renewed</span>' : ''}</span><b>₹51</b></div>
          <div class="r total"><span>Total (incl. taxes)</span><b>₹749</b></div></div>
          <div class="card-actions"><button class="btn btn-secondary" data-act="toast" data-msg="Full bill PDF would open here">View Bill</button><button class="btn btn-primary" data-act="buy" data-id="bill">Pay ₹749</button></div></div>` },
        { p: 'The extra charges come from two things:' },
        { ul: ['**Roaming** used on 12–13 Oct while you were travelling.', `**Hellotunes** renews at ₹51/month${S.hellotunes ? ' — I can turn it off for you.' : ' — already turned off.'}`] },
      ],
      say: 'Your October bill is 749 rupees, 150 more than usual, because of 2 days of roaming and a Hellotunes subscription.',
      choices: S.hellotunes ? ['Turn off Hellotunes', 'Pay bill ₹749'] : ['Pay bill ₹749'],
    }),

    hellotunesOff: () => {
      S.hellotunes = false;
      return {
        steps: ['⚙️ Deactivating Hellotunes…'],
        blocks: [{ html: successCard('Hellotunes turned off', 'No more ₹51 monthly charge') }, { p: 'Done — **Hellotunes** is off. You won’t be charged ₹51 from next month, and your callers will hear the normal ringtone.' }],
        say: 'Done. Hellotunes is off and you will not be charged 51 rupees from next month.',
      };
    },

    payBill: () => ({
      steps: ['🔐 Opening secure payment…'],
      blocks: [{ p: 'Opening a secure payment for **₹749**.' }],
      say: 'Opening a secure payment for 749 rupees.',
      then: () => openPay('bill'),
    }),

    network: (hi, again) => ({
      steps: again ? ['⚡ Running the speed test again…'] : ['📡 Checking towers near you…', '⚡ Running a quick speed test…'],
      blocks: [
        { html: `<div class="card"><div class="card-over">NETWORK CHECK</div><div class="diag">
          <div class="dg wait"><span class="ic"></span><span>Outage in your area</span></div>
          <div class="dg wait"><span class="ic"></span><span>SIM &amp; account status</span></div>
          <div class="dg wait"><span class="ic"></span><span>Signal strength</span></div>
          <div class="dg wait"><span class="ic"></span><span>Speed test</span></div></div>
          <div class="speed-wrap" style="display:none"><div class="speed"><b class="sp">0.0</b><span>Mbps download</span></div><div class="gauge"><i></i></div><div class="hint">Typical in your area: 40–60 Mbps</div></div></div>`,
          after: async (el, g) => {
            const rows = $$('.dg', el);
            const res = [['ok', 'No outage nearby'], ['ok', 'SIM & account are fine'], ['warn', 'Weak indoors (−108 dBm)'], ['warn', 'Slower than usual']];
            for (let i = 0; i < rows.length; i++) {
              rows[i].classList.remove('wait');
              await sleep(g && !g.stopped ? 650 : 0);
              rows[i].classList.add(res[i][0]);
              rows[i].lastElementChild.textContent = res[i][1];
            }
            const sw = $('.speed-wrap', el); sw.style.display = 'block'; sw.classList.add('pop');
            const target = again ? 11.2 : 8.4, sp = $('.sp', el), t0 = performance.now();
            await new Promise((r) => { const tick = (n) => { const k = Math.min(1, (n - t0) / 900); sp.textContent = (target * (1 - Math.pow(1 - k, 3))).toFixed(1); k < 1 ? requestAnimationFrame(tick) : r(); }; requestAnimationFrame(tick); });
            $('.gauge i', el).style.left = (target / 60) * 100 + '%';
          } },
        { p: hi ? 'Aapka SIM aur account theek hai, aur area mein koi outage nahi hai. Speed kam hone ki wajah **indoor signal weak** hona hai.' : `Your SIM and account are fine and there’s no outage. The slowdown is due to **weak indoor signal** — you’re getting **${again ? '11.2' : '8.4'} Mbps**, below the usual 40+ Mbps here.` },
        { p: 'Try these, in order:' },
        { ol: ['Turn **Airplane mode** on and off to reconnect to the strongest tower.', 'Set **5G/LTE preferred** in Settings → Mobile network.', 'Turn on **Wi-Fi Calling** for clearer calls indoors.'] },
      ],
      say: 'There is no outage and your SIM is fine. The slowdown is due to weak indoor signal. Try turning airplane mode on and off first.',
      choices: ['Raise a complaint', 'Run test again'],
    }),

    ticket: () => {
      const id = 'AT-' + Math.floor(400000 + Math.random() * 99999);
      return {
        steps: ['📝 Creating your complaint…', '📍 Sharing your location with the network team…'],
        blocks: [
          { html: `<div class="ticket"><small>Complaint registered</small><span class="tid">${id}</span><small>Weak indoor signal · Sector 44, Gurugram</small></div>` },
          { p: 'Done! The **network team will call you within 24 hours**. I’ll update you here as soon as there’s progress.' },
        ],
        say: `Your complaint is registered. The network team will call you within 24 hours.`,
      };
    },

    router: () => ({
      steps: ['🔁 Sending restart to your router…'],
      blocks: [{ html: successCard('Router restarting', 'Back online in about 2 minutes') }, { p: 'Done! Your router is restarting — it’ll be back in about **2 minutes**. Devices will reconnect automatically.' }],
      say: 'Your router is restarting and will be back in about 2 minutes.',
    }),

    roaming: () => ({
      steps: ['🌍 Checking roaming packs for the UAE…'],
      blocks: [
        { p: 'Have a great trip! International roaming is **active** on your number. Packs for the UAE:' },
        { html: `<div style="display:flex;flex-direction:column;gap:12px">${['r649', 'r1199'].map((id, i) => { const it = ITEMS[id]; return `<div class="pack${i === 0 ? ' best' : ''}">${i === 0 ? '<span class="pack-badge">POPULAR</span>' : ''}<div class="pack-row"><div class="pack-price">₹${it.price}</div><div class="pk">${it.gb} GB<small>Data</small></div><div class="pk">${it.mins} min<small>Calls</small></div><div class="pk">${it.validity}<small>Validity</small></div></div><div class="pack-foot"><span class="hint" style="margin:0">Starts when you land</span><button class="btn btn-secondary" data-act="buy" data-id="${id}">Buy</button></div></div>`; }).join('')}</div>` },
        { p: '**Tip:** buy before you fly — the pack activates automatically when you land.' },
      ],
      say: 'Roaming is active. The popular UAE pack is 649 rupees for 7 days with 2 GB data and 100 minutes.',
    }),

    services: () => ({
      steps: ['🗂️ Fetching your active services…'],
      blocks: [
        { p: 'You have **3 active services** and nothing is due right now:' },
        { html: `<div class="card"><div class="svc-list">
          <div class="svc-i"><span class="svc-ic">📱</span><span class="svc-t">Prepaid · 98765 43210<small>${S.recharged ? '₹399 · valid till 28 Nov' : '₹399 · expires today'}</small></span><img src="assets/chevron.svg" width="20" alt=""></div>
          <div class="svc-i"><span class="svc-ic">📶</span><span class="svc-t">Xstream Fiber · 100 Mbps<small>Online · 6 devices</small></span><img src="assets/chevron.svg" width="20" alt=""></div>
          <div class="svc-i"><span class="svc-ic">🎵</span><span class="svc-t">Hellotunes<small>₹51/month</small></span><button class="toggle${S.hellotunes ? ' on' : ''}" data-act="toggle" data-k="hellotunes" aria-label="Hellotunes"></button></div>
          <div class="svc-i"><span class="svc-ic">🛡️</span><span class="svc-t">Spam alerts<small>Free</small></span><button class="toggle${S.spam ? ' on' : ''}" data-act="toggle" data-k="spam" aria-label="Spam alerts"></button></div>
        </div></div>` },
      ],
      say: 'You have 3 active services: your prepaid number, Xstream Fiber and Hellotunes. Nothing is due right now.',
      follow: ['How much data do I have left?', 'Is my Wi-Fi working?'],
    }),

    spam: () => ({
      steps: ['🛡️ Checking spam protection…'],
      blocks: [
        { p: '**Airtel Spam Shield** is on. In the last 30 days it flagged **27 spam calls** and **41 SMS** for you.' },
        { ul: ['Calls marked “Suspected Spam” are safe to ignore.', 'Never share OTPs — Airtel will never ask for them.', 'Report a number by long-pressing it in your call log.'] },
      ],
      say: 'Spam Shield is on. It flagged 27 spam calls and 41 messages in the last 30 days.',
      follow: ['Show my active services'],
    }),

    wifi: () => ({
      steps: ['📶 Checking your Xstream Fiber…'],
      blocks: [{ p: 'Your **Xstream Fiber (100 Mbps)** is online. **6 devices** are connected and the last speed test was **94 Mbps**.' }],
      say: 'Your Xstream Fiber is online with 6 devices connected. The last speed test was 94 Mbps.',
      choices: ['Restart my router', 'My internet is slow'],
    }),

    sim: () => ({
      steps: ['🔎 Checking eSIM eligibility…'],
      blocks: [
        { p: 'Good news — your phone supports **eSIM**. Switching takes about 5 minutes:' },
        { ol: ['Send **eSIM <your email>** to 121 by SMS.', 'Reply **1** to confirm within 60 seconds.', 'Scan the QR code we email you in Settings → Mobile data.'] },
      ],
      say: 'Your phone supports eSIM. Send eSIM followed by your email to 121 to begin.',
    }),

    thanks: () => ({
      steps: ['😊 Wrapping up…'],
      blocks: [
        { p: `Happy to help, ${NAME}!` },
        { html: `<div style="display:flex;flex-direction:column;gap:12px"><div style="font-size:16px;line-height:24px">Is this conversation helpful?<br><b style="font-weight:600">How would you rate it?</b></div>
          <div class="rating">${['😡', '😕', '😐', '🙂', '😍'].map((e, i) => `<button class="rate" data-act="rate" data-v="${i + 1}" aria-label="Rate ${i + 1}">${e}</button>`).join('')}</div></div>` },
      ],
      say: `Happy to help, ${NAME}! How would you rate this conversation?`,
    }),

    notNow: () => ({
      steps: ['👌 Got it…'],
      blocks: [{ p: 'No problem. I’ll **remind you when you’re down to 200 MB**, so you’re never caught off guard.' }, { p: 'Is there anything else I can help you with?' }],
      say: 'No problem. I will remind you when you are down to 200 MB.',
      choices: ['Yes', 'No, thank you'],
    }),

    fallback: (q) => ({
      steps: ['🤔 Thinking…', '📚 Looking through your account…'],
      blocks: [
        { p: `I’m not fully sure about “${q.length > 40 ? q.slice(0, 40) + '…' : q}” yet — I’m still learning. Here’s what I can do for you right now:` },
        { ul: ['Check **data, balance and validity**', '**Recharge** or buy a data pack', 'Explain your **bill** and charges', 'Fix **slow internet** or call drops', 'Plan **international roaming**'] },
      ],
      say: 'I am still learning that one. I can check your data, recharge, explain your bill, or fix network issues.',
      follow: ['How much data do I have left?', 'Why is my bill high?', 'Going to Dubai next week'],
    }),

    paid: (it) => {
      const blocks = [];
      if (it.kind === 'data') { S.extraGB += it.gb; blocks.push({ html: successCard(`${it.gb} GB added`, `₹${it.price} · valid ${it.validity}`) }, { p: `Done! **${it.gb} GB** has been added to your number. It activates in **about 2 minutes** and is valid for ${it.validity}.` }); }
      if (it.kind === 'plan') { S.recharged = true; blocks.push({ html: successCard(`${it.name} activated`, `${it.data} · ${it.validity}`) }, { p: `You’re all set! Your **${it.name}** plan is active for **${it.validity}**. Enjoy ${it.data} and unlimited 5G.` }); }
      if (it.kind === 'roam') blocks.push({ html: successCard('Roaming pack booked', `${it.gb} GB · ${it.mins} min · ${it.validity}`) }, { p: 'Booked! The pack **starts automatically when you land** in the UAE. Have a safe trip ✈️' });
      if (it.kind === 'bill') { S.billPaid = true; blocks.push({ html: successCard('Bill paid', '₹749 · October') }, { p: 'Your October bill of **₹749** is paid. The receipt is in your email.' }); }
      return { steps: ['⚡ Confirming with the network…'], blocks, say: plain(blocks[1].p), choices: ['How much data do I have left?', 'No, thank you'] };
    },
  };

  /* ---------------- Sheets ---------------- */
  const sheet = $('#sheet'), sheetBody = $('#sheetBody'), backdrop = $('#sheetBackdrop');
  function openSheet(html) { sheetBody.innerHTML = html; sheet.classList.add('show'); backdrop.classList.add('show'); }
  function closeSheet() { sheet.classList.remove('show'); backdrop.classList.remove('show'); }
  backdrop.addEventListener('click', closeSheet);

  let payItem = null;
  function openPay(id) {
    const it = ITEMS[id]; payItem = it;
    const label = { data: 'Confirm data pack', plan: 'Confirm recharge', roam: 'Confirm roaming pack', bill: 'Pay bill' }[it.kind];
    const meta = it.kind === 'plan' ? `${it.data} · ${it.validity}` : it.kind === 'bill' ? it.validity : `${it.gb} GB · ${it.validity}`;
    openSheet(`<h3>${label}</h3><p class="sub">${it.name} · ${meta} · 98765 43210</p>
      <div class="pay-sum"><span>Amount to pay</span><b>₹${it.price}</b></div>
      <button class="pay-m sel" data-act="pm"><span class="pm-ic" style="color:#292C31">UPI</span><span class="pm-t">Airtel Payments Bank<small>yashish@airtel</small></span><span class="radio"></span></button>
      <button class="pay-m" data-act="pm"><span class="pm-ic">💳</span><span class="pm-t">HDFC Credit Card<small>•••• 4242</small></span><span class="radio"></span></button>
      <button class="pay-m" data-act="pm"><span class="pm-ic">👛</span><span class="pm-t">Airtel Wallet<small>Balance ₹1,240</small></span><span class="radio"></span></button>
      <button class="btn btn-primary btn-lg" data-act="pay">Pay ₹${it.price}</button>`);
  }
  async function doPay(btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Processing payment…';
    await sleep(1600);
    const txn = 'AT' + Math.random().toString(36).slice(2, 10).toUpperCase();
    sheetBody.innerHTML = `<div class="pay-done"><div class="confetti">${Array.from({ length: 24 }, (_, i) => `<i style="left:50%;background:${['#D42D1F', '#EE6A43', '#F6C3B5', '#8A2A19', '#FFB547'][i % 5]};--x:${rand(-170, 170)}px;--y:${rand(-120, 200)}px;--r:${rand(-400, 400)}deg;animation-delay:${rand(0, 0.15)}s"></i>`).join('')}</div>
      <svg class="check-anim" viewBox="0 0 84 84"><circle cx="42" cy="42" r="38" fill="none" stroke="#1F8A4C" stroke-width="5"/><path d="M26 43l11 11 21-23" fill="none" stroke="#1F8A4C" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <h3>Payment successful</h3><p>₹${payItem.price} paid · Txn ${txn}</p></div>`;
    await sleep(1700);
    closeSheet();
    await sleep(300);
    await runBot(R.paid(payItem));
  }
  function openUsage() {
    const days = [['Fri', 1.6], ['Sat', 1.9], ['Sun', 2], ['Mon', 1.2], ['Tue', 1.8], ['Wed', 2], ['Today', 2 - S.dailyLeft]];
    openSheet(`<h3>Data usage</h3><p class="sub">Last 7 days · daily limit 2 GB</p>
      <div class="chart">${days.map(([d, g], i) => `<div class="col${i < 6 && g < 1.5 ? ' dim' : ''}"><i data-h="${(g / 2) * 100}"></i><span>${d}</span></div>`).join('')}</div>
      <div class="rows" style="margin-top:16px"><div class="r"><span>Average per day</span><b>1.7 GB</b></div><div class="r"><span>Days you hit the limit</span><b>2 of 7</b></div></div>
      <button class="btn btn-primary btn-lg" data-act="closesheet" data-ask="Buy more data">Get more data</button>`);
    requestAnimationFrame(() => requestAnimationFrame(() => $$('.chart i', sheetBody).forEach((i) => (i.style.height = i.dataset.h + '%'))));
  }

  /* ---------------- Speech (Listen + voice mode) ---------------- */
  const synth = window.speechSynthesis;
  let voices = [];
  const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
  if (synth) { loadVoices(); synth.onvoiceschanged = loadVoices; }
  function pickVoice() {
    return voices.find((v) => /en-IN/i.test(v.lang)) || voices.find((v) => /Samantha|Google UK English Female|Karen|Moira/i.test(v.name)) || voices.find((v) => /^en/i.test(v.lang));
  }
  function speak(text, { onboundary } = {}) {
    return new Promise((res) => {
      if (!synth) return res(false);
      const u = new SpeechSynthesisUtterance(text);
      const v = pickVoice(); if (v) u.voice = v;
      u.rate = 1.03; u.pitch = 1;
      u.onend = () => res(true); u.onerror = () => res(false);
      if (onboundary) u.onboundary = onboundary;
      synth.speak(u);
    });
  }
  let listenBtn = null, listenRun = 0;
  function stopSpeaking() {
    listenRun++;
    if (synth) synth.cancel();
    if (listenBtn) { listenBtn.classList.remove('playing'); $('.lbl', listenBtn).textContent = 'Listen'; listenBtn = null; }
    $$('.bot-body .speaking').forEach((e) => e.classList.remove('speaking'));
  }
  async function listen(btn) {
    if (btn.classList.contains('playing')) { stopSpeaking(); return; }
    stopSpeaking();
    if (!synth) { toast('Read-aloud is not supported in this browser'); return; }
    const run = listenRun; listenBtn = btn;
    btn.classList.add('playing'); $('.lbl', btn).textContent = 'Stop';
    const parts = $$('.bot-body > p, .bot-body li', btn.closest('.msg-bot'));
    for (const el of parts) {
      if (run !== listenRun) return;
      el.classList.add('speaking');
      await speak(el.textContent);
      el.classList.remove('speaking');
    }
    if (run === listenRun) stopSpeaking();
  }

  /* ---------------- Voice mode ---------------- */
  const voice = $('#voice'), vStatus = $('#voiceStatus'), vYou = $('#vtYou'), vAi = $('#vtAi');
  const vWrap = $('#voiceOrbWrap'), vOrb = $('#voiceOrb .orb'), bars = $$('#voiceBars i');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let vState = 'off', rec = null, finalText = '', micStream = null, actx = null, analyser = null, abuf = null, raf = 0, lvl = 0;
  let vTimerStart = 0, vTimerI = 0, simI = 0, simTimer = 0, speakTimer = 0, voiceRun = 0;
  const DEMOS = ['How much data do I have left?', 'Why is my bill high?', 'My internet is slow', 'Recharge my number'];

  function setV(state, label) {
    vState = state;
    voice.classList.remove('listening', 'thinking', 'speaking', 'idle');
    voice.classList.add(state);
    vOrb.classList.toggle('fast', state === 'thinking');
    vStatus.textContent = label;
    vStatus.classList.toggle('shimmer-text', state !== 'idle');
    $('#voiceMain').setAttribute('aria-label', { listening: 'Stop listening', thinking: 'Thinking', speaking: 'Stop speaking', idle: 'Start talking' }[state]);
  }

  async function startMic() {
    if (analyser || !navigator.mediaDevices?.getUserMedia) return;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaStreamSource(micStream);
      analyser = actx.createAnalyser(); analyser.fftSize = 512;
      abuf = new Uint8Array(analyser.fftSize);
      src.connect(analyser);
    } catch { analyser = null; }
  }
  function stopMic() {
    micStream?.getTracks().forEach((t) => t.stop()); micStream = null;
    actx?.close().catch(() => {}); actx = null; analyser = null;
  }
  function meter(t) {
    let target = 0;
    if (vState === 'listening') {
      if (analyser) {
        analyser.getByteTimeDomainData(abuf);
        let s = 0; for (let i = 0; i < abuf.length; i++) { const d = (abuf[i] - 128) / 128; s += d * d; }
        target = Math.min(1, Math.sqrt(s / abuf.length) * 5);
      } else target = simI ? 0.35 + 0.35 * Math.abs(Math.sin(t / 90)) * Math.random() : 0.06 + 0.04 * Math.sin(t / 300);
    } else if (vState === 'speaking') target = 0.25 + 0.45 * Math.abs(Math.sin(t / 110)) * (0.6 + Math.random() * 0.4);
    else if (vState === 'thinking') target = 0.12;
    lvl += (target - lvl) * 0.3;
    vWrap.style.setProperty('--lvl', lvl.toFixed(3));
    bars.forEach((b, i) => {
      const f = [0.45, 0.7, 0.9, 1, 0.9, 0.7, 0.45][i];
      b.style.height = 6 + Math.max(0, lvl * 30 * f * (0.7 + 0.3 * Math.sin(t / 70 + i * 1.3))) + 'px';
    });
    raf = requestAnimationFrame(meter);
  }

  function openVoice() {
    if (busy) { toast('Wait for the reply, or tap stop'); return; }
    stopSpeaking(); input.blur();
    voice.classList.add('open'); voice.setAttribute('aria-hidden', 'false');
    vTimerStart = Date.now();
    clearInterval(vTimerI);
    vTimerI = setInterval(() => { const s = Math.floor((Date.now() - vTimerStart) / 1000); $('#voiceTimer').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 500);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(meter);
    startListening();
  }
  async function startListening() {
    const run = ++voiceRun;
    clearInterval(simTimer); clearInterval(speakTimer); simI = 0;
    if (synth) synth.cancel();
    finalText = ''; vYou.innerHTML = ''; vAi.innerHTML = '';
    vYou.dataset.ph = 'Go ahead, I’m listening…';
    setV('listening', 'Listening…');
    await startMic();
    if (run !== voiceRun) return;
    if (SR) {
      try {
        rec = new SR();
        rec.lang = 'en-IN'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          let fin = '', int = '';
          for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; r.isFinal ? (fin += r[0].transcript) : (int += r[0].transcript); }
          finalText = fin;
          vYou.innerHTML = esc(fin) + `<span class="interim">${esc(int)}</span>`;
        };
        rec.onerror = (e) => { if (/not-allowed|service-not-allowed|network/.test(e.error)) { rec = null; simulate(run); } };
        rec.onend = () => {
          if (run !== voiceRun || vState !== 'listening' || !rec) return;
          rec = null;
          const t = (finalText || vYou.textContent).trim();
          if (t) think(t); else setV('idle', 'I didn’t catch that. Tap the mic to try again.');
        };
        rec.start();
        setTimeout(() => { if (run === voiceRun && vState === 'listening' && rec && !vYou.textContent.trim()) { try { rec.abort(); } catch {} rec = null; setV('idle', 'I didn’t catch that. Tap the mic to try again.'); } }, 9000);
        return;
      } catch { rec = null; }
    }
    simulate(run);
  }
  function simulate(run) {
    vStatus.textContent = 'Listening… (demo voice)';
    const phrase = DEMOS[Math.floor(Math.random() * DEMOS.length)];
    let i = 0;
    setTimeout(() => {
      if (run !== voiceRun || vState !== 'listening') return;
      simI = 1;
      simTimer = setInterval(() => {
        i += 1;
        vYou.innerHTML = esc(phrase.slice(0, i)) + `<span class="interim">${i < phrase.length ? esc(phrase.slice(i, i + 3)) : ''}</span>`;
        if (i >= phrase.length) { clearInterval(simTimer); simI = 0; setTimeout(() => run === voiceRun && vState === 'listening' && think(phrase), 450); }
      }, 55);
    }, 700);
  }
  async function think(text) {
    const run = ++voiceRun;
    clearInterval(simTimer); simI = 0;
    vYou.textContent = text;
    setV('thinking', 'Thinking…');
    const resp = route(text);
    // Mirror the exchange into the chat behind the overlay
    dock(); lastUser = text;
    addUser(text, { voice: true });
    runBot(resp, { instant: true, q: text });
    await sleep(1300);
    if (run !== voiceRun) return;
    speakVoice(resp, run);
  }
  async function speakVoice(resp, run) {
    setV('speaking', 'Speaking…');
    const words = resp.say.split(/\s+/);
    vAi.innerHTML = words.map((w) => `<span>${esc(w)}</span> `).join('');
    const spans = $$('span', vAi);
    let idx = 0, gotBoundary = false;
    const mark = (n) => { for (let i = 0; i < spans.length; i++) spans[i].classList.toggle('on', i < n); };
    const starts = []; let pos = 0; words.forEach((w) => { starts.push(pos); pos += w.length + 1; });
    clearInterval(speakTimer);
    speakTimer = setInterval(() => { if (!gotBoundary) { idx = Math.min(words.length, idx + 1); mark(idx); } }, 330);
    const ok = await speak(resp.say, { onboundary: (e) => { if (e.name && e.name !== 'word') return; gotBoundary = true; let n = 0; while (n < starts.length && starts[n] <= e.charIndex) n++; mark(n); } });
    if (!ok) await new Promise((r) => { const w = setInterval(() => { if (idx >= words.length || run !== voiceRun) { clearInterval(w); r(); } }, 100); });
    clearInterval(speakTimer);
    if (run !== voiceRun) return;
    mark(words.length);
    setV('idle', 'Tap the mic to ask something else');
  }
  function closeVoice(silent) {
    if (!voice.classList.contains('open')) return;
    voiceRun++;
    try { rec?.abort(); } catch {}
    rec = null;
    clearInterval(simTimer); clearInterval(speakTimer); clearInterval(vTimerI); simI = 0;
    if (synth) synth.cancel();
    stopMic();
    cancelAnimationFrame(raf);
    vState = 'off';
    voice.classList.remove('open'); voice.setAttribute('aria-hidden', 'true');
    if (!silent) setTimeout(() => toBottom(true), 100);
  }
  /* ---------------- Inline voice input (mic in the composer) ---------------- */
  const wave = $('#wave'), wctx = wave.getContext('2d'), liveTx = $('#liveTx');
  let recState = 'off', recRec = null, recFinal = '', recRaf = 0, recRun = 0, recSim = 0, recHist = [], recTick = 0;
  function drawWave(t) {
    // level from the mic, or a speech-like pattern when the mic is unavailable
    let lv = 0;
    if (analyser) {
      analyser.getByteTimeDomainData(abuf);
      let sum = 0; for (let i = 0; i < abuf.length; i++) { const d = (abuf[i] - 128) / 128; sum += d * d; }
      lv = Math.min(1, Math.sqrt(sum / abuf.length) * 6);
    } else lv = recSim ? 0.25 + 0.75 * Math.abs(Math.sin(t / 140)) * Math.random() : 0.08 + 0.06 * Math.random();
    if (t - recTick > 55) { recTick = t; recHist.push(lv); if (recHist.length > 46) recHist.shift(); }
    const W = wave.width, H = wave.height, n = 46, gap = W / n, bw = gap * 0.42;
    wctx.clearRect(0, 0, W, H);
    const g = wctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#F59A6E'); g.addColorStop(0.45, '#D42D1F'); g.addColorStop(1, '#8A2A19');
    wctx.fillStyle = g;
    for (let i = 0; i < n; i++) {
      const v = recHist[recHist.length - n + i] ?? 0.04;
      const x = i * gap + (gap - bw) / 2, edge = Math.min(1, Math.min(i, n - 1 - i) / 8);
      const h = Math.max(bw, (0.08 + v * 0.92) * H * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + t / 900))) * edge + bw * (1 - edge));
      wctx.globalAlpha = 0.2 + 0.8 * edge;
      wctx.beginPath(); wctx.roundRect(x, (H - h) / 2, bw, h, bw / 2); wctx.fill();
    }
    wctx.globalAlpha = 1;
    recRaf = requestAnimationFrame(drawWave);
  }
  async function startRec() {
    if (busy) { toast('Wait for the reply, or tap stop'); return; }
    stopSpeaking(); input.blur();
    const run = ++recRun;
    recState = 'recording'; recFinal = ''; recHist = []; liveTx.innerHTML = '';
    agent.classList.add('recording');
    cancelAnimationFrame(recRaf); recRaf = requestAnimationFrame(drawWave);
    await startMic();
    if (run !== recRun) return;
    const simulate = () => {
      const phrase = DEMOS[Math.floor(Math.random() * DEMOS.length)];
      let i = 0;
      setTimeout(() => {
        if (run !== recRun || recState !== 'recording') return;
        recSim = setInterval(() => {
          i += 1;
          liveTx.innerHTML = esc(phrase.slice(0, i)) + `<span class="interim">${esc(phrase.slice(i, i + 4))}</span>`;
          if (i >= phrase.length) { clearInterval(recSim); recSim = 0; recFinal = phrase; setTimeout(() => run === recRun && recState === 'recording' && finishRec(), 700); }
        }, 60);
      }, 600);
    };
    if (SR) {
      try {
        recRec = new SR();
        recRec.lang = 'en-IN'; recRec.interimResults = true; recRec.continuous = false;
        recRec.onresult = (e) => {
          let fin = '', int = '';
          for (let i = 0; i < e.results.length; i++) { const r = e.results[i]; r.isFinal ? (fin += r[0].transcript) : (int += r[0].transcript); }
          recFinal = fin;
          liveTx.innerHTML = esc(fin) + `<span class="interim">${esc(int)}</span>`;
        };
        recRec.onerror = (e) => { if (/not-allowed|service-not-allowed|network/.test(e.error)) { recRec = null; simulate(); } };
        recRec.onend = () => { if (run === recRun && recState === 'recording' && recRec) finishRec(); };
        recRec.start();
        setTimeout(() => { if (run === recRun && recState === 'recording' && recRec && !liveTx.textContent.trim()) { try { recRec.abort(); } catch {} recRec = null; simulate(); } }, 6000);
        return;
      } catch { recRec = null; }
    }
    simulate();
  }
  function stopRecAudio() {
    try { recRec?.abort(); } catch {}
    recRec = null; clearInterval(recSim); recSim = 0;
    cancelAnimationFrame(recRaf); stopMic();
  }
  async function finishRec() {
    if (recState !== 'recording') return;
    const run = recRun;
    const text = (recFinal || liveTx.textContent).trim();
    stopRecAudio();
    recState = 'transcribing';
    agent.classList.remove('recording'); agent.classList.add('transcribing');
    await sleep(1200);
    if (run !== recRun) return;
    agent.classList.remove('transcribing'); recState = 'off';
    if (text) send(text); else toast('I didn’t catch that. Tap the mic and try again.');
  }
  function cancelRec() {
    recRun++; stopRecAudio(); recState = 'off';
    agent.classList.remove('recording', 'transcribing');
  }
  $('#micBtn').addEventListener('click', startRec);
  $('#recStop').addEventListener('click', () => {
    if (recRec) { try { recRec.stop(); } catch {} setTimeout(finishRec, 250); } else finishRec();
  });
  $('#agentOrb').addEventListener('click', openVoice);
  $('#voiceClose').addEventListener('click', () => closeVoice());
  $('#voiceEnd').addEventListener('click', () => closeVoice());
  $('#voiceType').addEventListener('click', () => { closeVoice(); setTimeout(() => input.focus(), 50); });
  $('#voiceMain').addEventListener('click', () => {
    if (vState === 'listening') {
      if (rec) { try { rec.stop(); } catch {} }
      else { const t = vYou.textContent.trim(); if (t) think(t); else { voiceRun++; clearInterval(simTimer); simI = 0; setV('idle', 'Tap the mic to start talking'); } }
    } else if (vState === 'speaking') { voiceRun++; clearInterval(speakTimer); if (synth) synth.cancel(); $$('span', vAi).forEach((s) => s.classList.add('on')); setV('idle', 'Tap the mic to ask something else'); }
    else if (vState === 'idle') startListening();
  });

  /* ---------------- New chat ---------------- */
  $('#newChat').addEventListener('click', () => {
    if (busy) stopGen();
    stopSpeaking();
    msgs.innerHTML = '';
    agent.classList.remove('has-msgs', 'scrolled');
    $('#jumpBtn').classList.remove('show');
    flip(greetParts(), () => agent.classList.remove('docked'));
    agent.classList.add('intro'); setTimeout(() => agent.classList.remove('intro'), 1300);
    chat.scrollTop = 0;
  });

  /* ---------------- Global click delegation ---------------- */
  phone.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-ask],[data-toast],[data-open-agent]');
    if (!t) return;
    if (t.dataset.toast) { toast(t.dataset.toast); return; }
    if (t.hasAttribute('data-open-agent')) { openAgent({ from: t }); return; }
    const act = t.dataset.act;
    if (act) {
      switch (act) {
        case 'buy': openPay(t.dataset.id); return;
        case 'details': { const it = ITEMS[t.dataset.id]; toast(`${it.gb} GB · ${it.validity} · works on 4G & 5G`); return; }
        case 'track': openUsage(); return;
        case 'pm': $$('.pay-m', sheetBody).forEach((x) => x.classList.remove('sel')); t.classList.add('sel'); return;
        case 'pay': doPay(t); return;
        case 'closesheet': closeSheet(); break;
        case 'toast': toast(t.dataset.msg); return;
        case 'toggle': {
          const k = t.dataset.k; S[k] = !S[k]; t.classList.toggle('on', S[k]);
          toast(`${k === 'hellotunes' ? 'Hellotunes' : 'Spam alerts'} turned ${S[k] ? 'on' : 'off'}`); return;
        }
        case 'rate': {
          const r = t.closest('.rating'); if (r.classList.contains('chosen')) return;
          r.classList.add('chosen'); t.classList.add('sel');
          const p = document.createElement('p'); p.className = 'pop'; p.style.marginTop = '4px';
          p.textContent = +t.dataset.v >= 4 ? 'Thanks for rating! 🙌 Glad I could help.' : 'Thanks for telling me. I’ll use this to get better.';
          r.parentElement.appendChild(p); toBottom(); return;
        }
        case 'up': case 'down': {
          const row = t.parentElement;
          const was = t.classList.contains('active');
          $$('[data-act="up"],[data-act="down"]', row).forEach((x) => x.classList.remove('active'));
          if (!was) { t.classList.add('active'); toast(act === 'up' ? 'Thanks for the feedback!' : 'Thanks — I’ll try to do better'); }
          return;
        }
        case 'copy': {
          const txt = $('.bot-body', t.closest('.msg-bot')).innerText.trim();
          (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast('Copied to clipboard'), () => toast('Copied'));
          return;
        }
        case 'listen': listen(t); return;
        case 'regen': {
          const m = t.closest('.msg-bot');
          if (busy) { toast('Wait for the reply, or tap stop'); return; }
          if (m !== msgs.lastElementChild) { toast('Only the latest answer can be regenerated'); return; }
          const q = m.dataset.q; if (!q) { toast('Nothing to regenerate'); return; }
          stopSpeaking(); m.remove();
          runBot(route(q, 1 + Math.floor(Math.random() * 3)), { q });
          return;
        }
      }
    }
    if (t.dataset.ask) {
      if (agent.classList.contains('active')) send(t.dataset.ask);
      else openAgent({ ask: t.dataset.ask, from: t });
    }
  });
  pill.addEventListener('click', () => openAgent({ from: pill }));

  /* ---------------- Deep links (used by the case study): ?ask=..., ?chat, ?mic, ?voice ---------------- */
  const deep = new URLSearchParams(location.search);
  if (deep.has('ask') || deep.has('chat') || deep.has('mic') || deep.has('voice')) {
    store.set(KEY, '1');
    setTimeout(async () => {
      await openAgent({ ask: deep.get('ask') || null });
      if (deep.has('mic')) setTimeout(startRec, 400);
      if (deep.has('voice')) setTimeout(openVoice, 400);
    }, 350);
  }

})();
