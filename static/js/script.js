// TauX Interactivity (Anthropic-style, minimal)

document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initScrollNavigation();
    initScrollAnimations();
    initEasterEggs();
});

// Full-screen menu. One overlay, two triggers: the hamburger on small screens
// and the Guides item on large ones.
function initMenu() {
    const overlay = document.getElementById('menuOverlay');
    const hamburger = document.getElementById('hamburger');
    const trigger = document.getElementById('menuTrigger');
    const closeBtn = document.getElementById('menuClose');

    if (!overlay) return;

    const triggers = [hamburger, trigger].filter(Boolean);
    let lastFocused = null;

    const isOpen = () => overlay.classList.contains('opacity-100');

    function setHamburgerBars(open) {
        if (!hamburger) return;
        const bars = hamburger.querySelectorAll('span');
        if (bars.length < 3) return;
        bars[0].classList.toggle('rotate-45', open);
        bars[0].classList.toggle('translate-y-2', open);
        bars[1].classList.toggle('opacity-0', open);
        bars[2].classList.toggle('-rotate-45', open);
        bars[2].classList.toggle('-translate-y-2', open);
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }

    function open() {
        lastFocused = document.activeElement;
        overlay.classList.remove('opacity-0', 'pointer-events-none');
        overlay.classList.add('opacity-100');
        document.body.classList.add('overflow-hidden');
        triggers.forEach(t => t.setAttribute('aria-expanded', 'true'));
        setHamburgerBars(true);
        if (closeBtn) closeBtn.focus();
    }

    function close() {
        overlay.classList.add('opacity-0', 'pointer-events-none');
        overlay.classList.remove('opacity-100');
        document.body.classList.remove('overflow-hidden');
        triggers.forEach(t => t.setAttribute('aria-expanded', 'false'));
        setHamburgerBars(false);
        // Return focus to whatever opened it, so keyboard users do not land
        // back at the top of the document.
        if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    }

    triggers.forEach(t => {
        t.addEventListener('click', (e) => {
            e.stopPropagation();
            isOpen() ? close() : open();
        });
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            close();
        });
    }

    overlay.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => close());
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) close();
    });
}

// Hide Nav on Scroll
function initScrollNavigation() {
    const nav = document.querySelector('nav[aria-label="Main Navigation"]');
    if (!nav) return;
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100 && window.scrollY > lastScrollY) {
            nav.classList.add('-translate-y-full');
        } else {
            nav.classList.remove('-translate-y-full');
        }
        lastScrollY = window.scrollY;
    }, { passive: true });
}

// Scroll-triggered Animations (subtle, Anthropic-style)
function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('opacity-0', 'translate-y-4');
                entry.target.classList.add('opacity-100', 'translate-y-0');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -30px 0px'
    });

    // Select semantic elements and key areas
    const elementsToAnimate = document.querySelectorAll('section h1, section h2, section p, article, blockquote, details');

    elementsToAnimate.forEach(el => {
        el.classList.add('transition-all', 'duration-700', 'ease-out', 'opacity-0', 'translate-y-4'); // Initial state — subtle 4px shift
        observer.observe(el);
    });
}

// Easter Eggs
function initEasterEggs() {
    let keyBuffer = '';
    const secretCode = 'TAUX';
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        keyBuffer = (keyBuffer + e.key.toUpperCase()).slice(-secretCode.length);
        if (keyBuffer === secretCode) {
            document.body.style.transition = 'transform 0.5s ease';
            document.body.style.transform = 'rotate(360deg)';
            setTimeout(() => document.body.style.transform = '', 500);
            console.log('🎉 TauX Mode Activated! 🎉');
        }
    });
}
