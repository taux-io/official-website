// TauX Interactivity (Anthropic-style, minimal)

document.addEventListener('DOMContentLoaded', () => {
    initMobileNavigation();
    initScrollNavigation();
    initScrollAnimations();
    initEasterEggs();
});

// Mobile Navigation
function initMobileNavigation() {
    const hamburger = document.getElementById('hamburger');
    const mobileMenu = document.getElementById('mobileMenuOverlay');
    const closeBtn = document.getElementById('mobileMenuClose');
    const mobileLinks = document.querySelectorAll('.mobile-link');

    if (!hamburger || !mobileMenu) return;

    function toggleMenu() {
        const isExpanded = hamburger.getAttribute('aria-expanded') === 'true';
        hamburger.setAttribute('aria-expanded', !isExpanded);

        // Toggle specific bar transforms for hamburger animation
        const bars = hamburger.querySelectorAll('span');
        if (!isExpanded) {
            // Open state
            bars[0].classList.add('rotate-45', 'translate-y-2');
            bars[1].classList.add('opacity-0');
            bars[2].classList.add('-rotate-45', '-translate-y-2');

            mobileMenu.classList.remove('translate-x-full');
            document.body.classList.add('overflow-hidden');
        } else {
            // Closed state
            bars[0].classList.remove('rotate-45', 'translate-y-2');
            bars[1].classList.remove('opacity-0');
            bars[2].classList.remove('-rotate-45', '-translate-y-2');

            mobileMenu.classList.add('translate-x-full');
            document.body.classList.remove('overflow-hidden');
        }
    }

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Force close
            if (hamburger.getAttribute('aria-expanded') === 'true') {
                toggleMenu();
            }
        });
    }

    mobileLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (hamburger.getAttribute('aria-expanded') === 'true') {
                toggleMenu();
            }
        });
    });

    // Close on outside click (optional, but good UX)
    document.addEventListener('click', (e) => {
        if (hamburger.getAttribute('aria-expanded') === 'true' &&
            !mobileMenu.contains(e.target) &&
            !hamburger.contains(e.target)) {
            toggleMenu();
        }
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
