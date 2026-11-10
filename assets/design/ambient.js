/* ===== Tristonia ambient background =====
   A light 2D particle field for the page heroes. Particles drift around a
   home position on springs, part around the pointer (or a finger), and can
   link up into a constellation. Usage:
       <canvas class="ambient-canvas" data-ambient="constellation"></canvas>
   Variants: constellation | orbs | dust
*/
(function () {
    'use strict';

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PALETTE = ['120,180,255', '196,181,253', '255,141,161', '255,217,125', '114,239,221'];
    const rand = (a, b) => a + Math.random() * (b - a);

    const VARIANTS = {
        constellation: { density: 0.085, max: 110, link: 130, reach: 190, orbs: 0, size: [0.8, 2.0] },
        orbs:          { density: 0.11,  max: 150, link: 0,   reach: 170, orbs: 5, size: [0.6, 1.8] },
        dust:          { density: 0.06,  max: 80,  link: 0,   reach: 160, orbs: 3, size: [0.6, 1.6] },
    };

    function init(canvas) {
        const cfg = VARIANTS[canvas.dataset.ambient] || VARIANTS.dust;
        const host = canvas.parentElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let w = 0, h = 0, dpr = 1, parts = [], orbs = [];
        const ptr = { x: 0, y: 0, on: false, power: 0 };
        let visible = true, raf = 0, last = 0, t = 0;

        function build() {
            const r = host.getBoundingClientRect();
            w = Math.max(1, r.width); h = Math.max(1, r.height);
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const n = Math.min(cfg.max, Math.round((w * h / 10000) * cfg.density * 10));
            parts = [];
            for (let i = 0; i < n; i++) {
                const hx = rand(0, w), hy = rand(0, h);
                parts.push({
                    hx, hy, x: hx, y: hy, vx: 0, vy: 0,
                    z: rand(0.35, 1),                      // depth: nearer ones move and glow more
                    r: rand(cfg.size[0], cfg.size[1]),
                    ph: rand(0, Math.PI * 2), sp: rand(0.15, 0.5),
                    c: PALETTE[i % 2 === 0 ? 1 : (i % 5 === 0 ? 2 : 0)],
                });
            }
            orbs = [];
            for (let i = 0; i < cfg.orbs; i++) {
                const hx = rand(0.1, 0.9) * w, hy = rand(0.05, 0.8) * h;
                orbs.push({
                    hx, hy, x: hx, y: hy, vx: 0, vy: 0,
                    r: rand(0.16, 0.3) * Math.max(w, h * 0.8),
                    ph: rand(0, Math.PI * 2), sp: rand(0.08, 0.2),
                    c: PALETTE[i % 4], a: rand(0.07, 0.13),
                });
            }
        }

        function step(dt) {
            t += dt;
            ptr.power += ((ptr.on ? 1 : 0) - ptr.power) * Math.min(1, dt * 5);
            const cx = ptr.x - w / 2, cy = ptr.y - h / 2;

            for (const p of parts) {
                // Wander target: home + slow orbit + a little parallax away from the pointer
                const tx = p.hx + Math.cos(t * p.sp + p.ph) * 14 * p.z - cx * 0.02 * p.z * ptr.power;
                const ty = p.hy + Math.sin(t * p.sp * 1.3 + p.ph) * 14 * p.z - cy * 0.02 * p.z * ptr.power;
                let ax = (tx - p.x) * 5 - p.vx * 3.2;
                let ay = (ty - p.y) * 5 - p.vy * 3.2;
                if (ptr.power > 0.01) {
                    const dx = p.x - ptr.x, dy = p.y - ptr.y;
                    const d = Math.hypot(dx, dy) || 1;
                    if (d < cfg.reach) {
                        const f = Math.pow(1 - d / cfg.reach, 2) * 900 * p.z * ptr.power;
                        ax += (dx / d) * f; ay += (dy / d) * f;
                    }
                }
                p.vx += ax * dt; p.vy += ay * dt;
                p.x += p.vx * dt; p.y += p.vy * dt;
            }
            for (const o of orbs) {
                const tx = o.hx + Math.cos(t * o.sp + o.ph) * 60;
                const ty = o.hy + Math.sin(t * o.sp * 0.8 + o.ph) * 40;
                let ax = (tx - o.x) * 0.8 - o.vx * 1.4;
                let ay = (ty - o.y) * 0.8 - o.vy * 1.4;
                if (ptr.power > 0.01) {
                    const dx = o.x - ptr.x, dy = o.y - ptr.y;
                    const d = Math.hypot(dx, dy) || 1;
                    const reach = o.r * 1.4;
                    if (d < reach) {
                        const f = (1 - d / reach) * 260 * ptr.power;
                        ax += (dx / d) * f; ay += (dy / d) * f;
                    }
                }
                o.vx += ax * dt; o.vy += ay * dt;
                o.x += o.vx * dt; o.y += o.vy * dt;
            }
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';

            for (const o of orbs) {
                const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
                g.addColorStop(0, `rgba(${o.c},${o.a})`);
                g.addColorStop(1, `rgba(${o.c},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(o.x - o.r, o.y - o.r, o.r * 2, o.r * 2);
            }

            if (cfg.link) {
                ctx.lineWidth = 1;
                const L2 = cfg.link * cfg.link;
                for (let i = 0; i < parts.length; i++) {
                    const a = parts[i];
                    for (let j = i + 1; j < parts.length; j++) {
                        const b = parts[j];
                        const dx = a.x - b.x, dy = a.y - b.y;
                        const d2 = dx * dx + dy * dy;
                        if (d2 > L2) continue;
                        const al = (1 - Math.sqrt(d2) / cfg.link) * 0.3 * Math.min(a.z, b.z);
                        ctx.strokeStyle = `rgba(196,181,253,${al.toFixed(3)})`;
                        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                    }
                }
                // Threads from the pointer to whatever is near it
                if (ptr.power > 0.02) {
                    for (const p of parts) {
                        const d = Math.hypot(p.x - ptr.x, p.y - ptr.y);
                        if (d > cfg.reach * 1.25) continue;
                        const al = (1 - d / (cfg.reach * 1.25)) * 0.4 * ptr.power * p.z;
                        ctx.strokeStyle = `rgba(120,180,255,${al.toFixed(3)})`;
                        ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(p.x, p.y); ctx.stroke();
                    }
                }
            }

            for (const p of parts) {
                const tw = 0.65 + 0.35 * Math.sin(t * (1 + p.sp * 2) + p.ph * 3);
                ctx.fillStyle = `rgba(${p.c},${(0.9 * p.z * tw).toFixed(3)})`;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.z, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalCompositeOperation = 'source-over';
        }

        function frame(now) {
            raf = 0;
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            step(dt);
            draw();
            schedule();
        }
        function schedule() {
            if (!raf && visible && !document.hidden && !reduce) { last = performance.now(); raf = requestAnimationFrame(frame); }
        }

        // The canvas sits under the hero text, so listen on the window and convert
        window.addEventListener('pointermove', (e) => {
            const r = host.getBoundingClientRect();
            ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
            ptr.on = ptr.y > -80 && ptr.y < h + 80;
        }, { passive: true });
        const off = (e) => { if (!e || e.pointerType === 'touch') ptr.on = false; };
        window.addEventListener('pointerup', off, { passive: true });
        window.addEventListener('pointercancel', off, { passive: true });
        document.documentElement.addEventListener('mouseleave', () => off());

        let resizeT = 0;
        new ResizeObserver(() => {
            clearTimeout(resizeT);
            resizeT = setTimeout(() => { build(); if (reduce) draw(); }, 120);
        }).observe(host);
        new IntersectionObserver((es) => { visible = es[0].isIntersecting; schedule(); }).observe(host);
        document.addEventListener('visibilitychange', schedule);

        build();
        if (reduce) draw(); else schedule();
    }

    document.querySelectorAll('canvas[data-ambient]').forEach(init);
})();
