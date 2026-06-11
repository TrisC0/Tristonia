/* ===== Tristonia Design System — JS ===== */
(function () {
    'use strict';

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    /* ---------- Custom Cursor ---------- */
    if (!isTouch) {
        const dot = document.createElement('div');
        dot.className = 'cursor-dot';
        const ring = document.createElement('div');
        ring.className = 'cursor-ring';
        document.body.appendChild(dot);
        document.body.appendChild(ring);

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ringX = mouseX, ringY = mouseY;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
        });

        function loop() {
            ringX += (mouseX - ringX) * 0.18;
            ringY += (mouseY - ringY) * 0.18;
            ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
            requestAnimationFrame(loop);
        }
        loop();

        // Hover states
        const hoverSelectors = 'a, button, [data-cursor="hover"], .card, .app-card, .value-card, .nav-link, .t-nav__link';
        document.querySelectorAll(hoverSelectors).forEach(el => {
            el.addEventListener('mouseenter', () => ring.classList.add('is-hover'));
            el.addEventListener('mouseleave', () => ring.classList.remove('is-hover'));
        });
    }

    /* ---------- Loader fade ---------- */
    window.addEventListener('load', () => {
        const loader = document.querySelector('.page-loader');
        if (loader) {
            setTimeout(() => loader.classList.add('hidden'), 350);
            setTimeout(() => loader.remove(), 1400);
        }
        document.body.classList.add('is-loaded');
        // Trigger initial reveal
        revealInView();
        // First-frame split text
        document.querySelectorAll('.split-line[data-autoplay="true"]').forEach((el, i) => {
            setTimeout(() => el.classList.add('is-visible'), 250 + i * 80);
        });
    });

    /* ---------- IntersectionObserver reveals ---------- */
    const revealNodes = () => document.querySelectorAll('.reveal:not(.is-visible), .split-line:not(.is-visible):not([data-autoplay])');
    let io;
    function revealInView() {
        if (prefersReducedMotion) {
            document.querySelectorAll('.reveal, .split-line').forEach(el => el.classList.add('is-visible'));
            return;
        }
        if (io) io.disconnect();
        io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
        revealNodes().forEach(el => io.observe(el));
    }

    /* ---------- Card magnetic light follow ---------- */
    document.addEventListener('mousemove', (e) => {
        document.querySelectorAll('.card, .app-card').forEach(card => {
            const rect = card.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            card.style.setProperty('--mx', `${x}%`);
            card.style.setProperty('--my', `${y}%`);
        });
    });

    /* ---------- Magnetic buttons ---------- */
    document.querySelectorAll('[data-magnetic]').forEach(el => {
        const strength = parseFloat(el.dataset.magneticStrength || '0.25');
        el.addEventListener('mousemove', (e) => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'translate(0,0)';
        });
    });

    /* ---------- Active nav highlight ---------- */
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.t-nav__link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === path || (path === '' && href === 'index.html')) {
            link.classList.add('is-active');
        }
    });

    /* ---------- Expose helpers ---------- */
    window.__tristonia = { revealInView };
})();
