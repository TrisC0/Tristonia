/* ===== Tristonia Design System — JS ===== */
(function () {
    'use strict';

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    /* A damped spring, stepped with semi-implicit Euler. `s` is {x, v}. */
    function spring(s, target, k, c, dt) {
        s.v += (-k * (s.x - target) - c * s.v) * dt;
        s.x += s.v * dt;
    }

    /* ---------- Shared pointer state (mouse, pen and touch) ---------- */
    const P = { x: innerWidth / 2, y: innerHeight / 2, down: false, seen: false, touch: false, movedAt: 0, target: null };
    function track(e) {
        P.x = e.clientX; P.y = e.clientY;
        P.touch = e.pointerType === 'touch';
        P.target = e.target;
        P.movedAt = performance.now();
        if (!P.seen) { P.seen = true; document.documentElement.classList.add('cursor-ready'); }
    }
    window.addEventListener('pointermove', track, { passive: true });
    window.addEventListener('pointerdown', (e) => {
        track(e); P.down = true;
        if (P.touch && !reduce) ripple(e.clientX, e.clientY);
    }, { passive: true });
    const release = () => { P.down = false; };
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    document.documentElement.addEventListener('mouseleave', () => {
        P.seen = false; document.documentElement.classList.remove('cursor-ready');
    });

    function ripple(x, y) {
        const r = document.createElement('div');
        r.className = 'tap-ripple';
        r.style.translate = `${x}px ${y}px`;
        document.body.appendChild(r);
        r.addEventListener('animationend', () => r.remove());
    }

    /* ---------- Per-frame work, registered by each feature ---------- */
    const tasks = [];

    /* ---------- Custom cursor: dot is exact, ring is on a spring ---------- */
    if (fine) {
        const dot = document.createElement('div');
        dot.className = 'cursor-dot';
        const ring = document.createElement('div');
        ring.className = 'cursor-ring';
        document.body.append(dot, ring);

        const rx = { x: P.x, v: 0 }, ry = { x: P.y, v: 0 };
        let placed = false;
        tasks.push((dt) => {
            if (!P.seen) { placed = false; return; }
            if (!placed || reduce) { rx.x = P.x; ry.x = P.y; rx.v = ry.v = 0; placed = true; }
            spring(rx, P.x, 320, 28, dt);
            spring(ry, P.y, 320, 28, dt);
            dot.style.transform = `translate3d(${P.x}px, ${P.y}px, 0)`;
            // Stretch the ring along its direction of travel
            const speed = Math.hypot(rx.v, ry.v);
            const stretch = clamp(speed / 2600, 0, 0.32);
            const angle = speed > 4 ? Math.atan2(ry.v, rx.v) : 0;
            ring.style.transform = `translate3d(${rx.x}px, ${ry.x}px, 0) rotate(${angle}rad) scale(${1 + stretch}, ${1 - stretch * 0.6})`;
            ring.classList.toggle('is-down', P.down);
        });

        const hoverSel = 'a, button, [data-cursor="hover"], .card, .app-card, .gallery-shot, .principle, label, summary';
        const textSel = 'input, textarea, select';
        document.addEventListener('pointerover', (e) => {
            const t = e.target;
            if (!(t instanceof Element)) return;
            ring.classList.toggle('is-text', !!t.closest(textSel));
            ring.classList.toggle('is-hover', !!t.closest(hoverSel));
        }, { passive: true });
    }

    /* ---------- Ambient glow that trails the pointer / finger ---------- */
    if (!reduce) {
        const glow = document.createElement('div');
        glow.className = 'pointer-glow';
        document.body.appendChild(glow);
        const gx = { x: P.x, v: 0 }, gy = { x: P.y, v: 0 };
        let o = 0;
        tasks.push((dt, now) => {
            spring(gx, P.x, 60, 14, dt);
            spring(gy, P.y, 60, 14, dt);
            // Fades in with movement; on touch it lingers briefly after the finger lifts
            const idle = now - P.movedAt;
            const want = !P.seen && !P.touch ? 0 : P.touch ? (P.down ? 1 : idle < 500 ? 0.6 : 0) : idle < 2600 ? 1 : 0.35;
            o += (want - o) * Math.min(1, dt * 4);
            glow.style.opacity = o.toFixed(3);
            glow.style.transform = `translate3d(${gx.x}px, ${gy.x}px, 0)`;
        });
    }

    /* ---------- Card light follow (works out which card the pointer is on) ---------- */
    const lightSel = '.card, .app-card, .app-feature, .form-card';
    let lightEl = null, lightDirty = false;
    window.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch' || !(e.target instanceof Element)) return;
        lightEl = e.target.closest(lightSel);
        lightDirty = true;
    }, { passive: true });
    tasks.push(() => {
        if (!lightDirty || !lightEl) return;
        lightDirty = false;
        const r = lightEl.getBoundingClientRect();
        lightEl.style.setProperty('--mx', `${((P.x - r.left) / r.width) * 100}%`);
        lightEl.style.setProperty('--my', `${((P.y - r.top) / r.height) * 100}%`);
    });

    /* ---------- Pointer tilt: cards lean towards the cursor on a spring ---------- */
    if (fine && !reduce) {
        const tiltSel = '.app-card, .card, .gallery-shot, [data-tilt]';
        const live = new Map();
        document.querySelectorAll(tiltSel).forEach(el => el.classList.add('tilt'));
        document.addEventListener('pointerover', (e) => {
            if (!(e.target instanceof Element)) return;
            const el = e.target.closest(tiltSel);
            live.forEach((s, k) => { s.on = k === el; });
            if (el && !live.has(el)) {
                el.classList.add('tilt');
                live.set(el, { on: true, rx: { x: 0, v: 0 }, ry: { x: 0, v: 0 }, lift: { x: 0, v: 0 } });
            }
        }, { passive: true });
        document.documentElement.addEventListener('mouseleave', () => live.forEach(s => { s.on = false; }));
        tasks.push((dt) => {
            live.forEach((s, el) => {
                let tx = 0, ty = 0;
                if (s.on) {
                    const r = el.getBoundingClientRect();
                    const max = clamp(1500 / Math.max(r.width, r.height), 2, 6);
                    const nx = clamp((P.x - r.left) / r.width - 0.5, -0.5, 0.5);
                    const ny = clamp((P.y - r.top) / r.height - 0.5, -0.5, 0.5);
                    ty = nx * 2 * max;
                    tx = -ny * 2 * max;
                }
                spring(s.rx, tx, 140, 16, dt);
                spring(s.ry, ty, 140, 16, dt);
                spring(s.lift, s.on ? 1 : 0, 200, 18, dt);
                el.style.setProperty('--rx', s.rx.x.toFixed(3) + 'deg');
                el.style.setProperty('--ry', s.ry.x.toFixed(3) + 'deg');
                el.style.setProperty('--lift', (-6 * s.lift.x).toFixed(2) + 'px');
                el.style.setProperty('--sc', (1 + 0.012 * s.lift.x).toFixed(4));
                const rest = Math.abs(s.rx.x) + Math.abs(s.ry.x) + Math.abs(s.lift.x) + Math.abs(s.rx.v) + Math.abs(s.ry.v) + Math.abs(s.lift.v);
                if (!s.on && rest < 0.01) {
                    ['--rx', '--ry', '--lift', '--sc'].forEach(p => el.style.removeProperty(p));
                    live.delete(el);
                }
            });
        });
    }

    /* ---------- Magnetic buttons: pulled towards the pointer, sprung back ---------- */
    if (fine && !reduce) {
        document.querySelectorAll('[data-magnetic], .btn, .store-btn').forEach(el => {
            const strength = parseFloat(el.dataset.magneticStrength || '0.22');
            const sx = { x: 0, v: 0 }, sy = { x: 0, v: 0 };
            let on = false, rect = null, running = false;
            el.addEventListener('pointerenter', () => { on = true; rect = el.getBoundingClientRect(); if (!running) { running = true; tasks.push(step); } });
            el.addEventListener('pointerleave', () => { on = false; });
            function step(dt) {
                const tx = on ? (P.x - rect.left - rect.width / 2) * strength : 0;
                const ty = on ? (P.y - rect.top - rect.height / 2) * strength : 0;
                spring(sx, tx, 220, 13, dt);
                spring(sy, ty, 220, 13, dt);
                el.style.translate = `${sx.x.toFixed(2)}px ${sy.x.toFixed(2)}px`;
                if (!on && Math.abs(sx.x) + Math.abs(sy.x) + Math.abs(sx.v) + Math.abs(sy.v) < 0.05) {
                    el.style.translate = '';
                    running = false;
                    return false; // unregister
                }
            }
        });
    }

    /* ---------- Nav: sliding highlight, condense on scroll ---------- */
    const nav = document.querySelector('.t-nav');
    const path = window.location.pathname.split('/').pop() || 'index.html';
    let activeLink = null;
    if (nav) {
        nav.querySelectorAll('.t-nav__link').forEach(link => {
            if (link.getAttribute('href') === path) { link.classList.add('is-active'); activeLink = link; }
        });
        const pill = document.createElement('span');
        pill.className = 't-nav__pill';
        nav.prepend(pill);
        nav.classList.add('has-pill');
        const moveTo = (link) => {
            if (!link) { pill.style.opacity = '0'; return; }
            pill.style.opacity = '1';
            pill.style.width = link.offsetWidth + 'px';
            pill.style.transform = `translateX(${link.offsetLeft}px)`;
        };
        nav.querySelectorAll('.t-nav__link').forEach(link => {
            link.addEventListener('pointerenter', () => moveTo(link));
            link.addEventListener('focus', () => moveTo(link));
        });
        nav.addEventListener('pointerleave', () => moveTo(activeLink));
        nav.addEventListener('focusout', () => moveTo(activeLink));
        const settle = () => moveTo(activeLink);
        window.addEventListener('resize', settle);
        window.addEventListener('load', settle);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
        settle();
    }

    /* ---------- Scroll: progress hairline, nav state, velocity for the marquee ---------- */
    const progress = document.createElement('div');
    progress.className = 'scroll-progress';
    document.body.appendChild(progress);
    let lastY = window.scrollY, scrollVel = 0, scrollDirty = true;
    window.addEventListener('scroll', () => { scrollDirty = true; }, { passive: true });
    window.addEventListener('resize', () => { scrollDirty = true; });
    tasks.push((dt) => {
        const y = window.scrollY;
        const inst = (y - lastY) / Math.max(dt, 0.001);
        lastY = y;
        scrollVel += (inst - scrollVel) * Math.min(1, dt * 8);
        if (!scrollDirty) return;
        scrollDirty = false;
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
        if (nav) nav.classList.toggle('is-scrolled', y > 40);
    });

    /* ---------- Marquee: drifts on its own, speeds up and leans with the scroll ---------- */
    if (!reduce) {
        document.querySelectorAll('.marquee-track').forEach(trackEl => {
            let x = 0, half = 0, visible = true, skew = 0;
            const measure = () => { half = trackEl.scrollWidth / 2; };
            trackEl.style.animation = 'none';
            trackEl.style.willChange = 'transform';
            measure();
            window.addEventListener('resize', measure);
            window.addEventListener('load', measure);
            new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(trackEl);
            tasks.push((dt) => {
                if (!visible || !half) return;
                const boost = clamp(Math.abs(scrollVel) / 900, 0, 5);
                x -= (half / 35) * (1 + boost) * dt;
                if (x <= -half) x += half;
                skew += (clamp(-scrollVel / 300, -7, 7) - skew) * Math.min(1, dt * 6);
                trackEl.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) skewX(${skew.toFixed(2)}deg)`;
            });
        });
    }

    /* ---------- Frame loop ---------- */
    let prev = performance.now();
    function frame(now) {
        const dt = Math.min((now - prev) / 1000, 1 / 20);
        prev = now;
        for (let i = tasks.length - 1; i >= 0; i--) {
            if (tasks[i](dt, now) === false) tasks.splice(i, 1);
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* ---------- Loader fade ---------- */
    function loaded() {
        const loader = document.querySelector('.page-loader');
        if (loader) {
            setTimeout(() => loader.classList.add('hidden'), 120);
            setTimeout(() => loader.remove(), 900);
        }
        document.body.classList.add('is-loaded');
        revealInView();
        document.querySelectorAll('.split-line[data-autoplay="true"]').forEach((el, i) => {
            setTimeout(() => el.classList.add('is-visible'), 180 + i * 80);
        });
    }
    if (document.readyState === 'complete') loaded();
    else window.addEventListener('load', loaded);
    // Never leave the loader up if a slow third-party request stalls the load event
    setTimeout(() => { if (!document.body.classList.contains('is-loaded')) loaded(); }, 3500);

    /* ---------- IntersectionObserver reveals ---------- */
    const revealNodes = () => document.querySelectorAll('.reveal:not(.is-visible), .split-line:not(.is-visible):not([data-autoplay])');
    let io;
    function revealInView() {
        if (reduce) {
            document.querySelectorAll('.reveal, .split-line').forEach(el => el.classList.add('is-visible', 'is-settled'));
            return;
        }
        if (io) io.disconnect();
        io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const el = entry.target;
                    el.classList.add('is-visible');
                    // Drop the stagger delay once it has played, so hover states respond at once
                    setTimeout(() => el.classList.add('is-settled'), 1600);
                    io.unobserve(el);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealNodes().forEach(el => io.observe(el));
    }

    /* ---------- Expose helpers ---------- */
    window.__tristonia = { revealInView, pointer: P, spring, reduce };
})();
