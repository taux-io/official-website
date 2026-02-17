// Jules-Inspired Interactivity

document.addEventListener('DOMContentLoaded', () => {
    initMobileNavigation();
    initScrollNavigation();
    initReadingProgress();
    initScrollAnimations();
    initLogoSpin();
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

// Hide Nav on Scroll (Updated for Tailwind classes)
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

// Reading Progress Bar
function initReadingProgress() {
    let progressBar = document.querySelector('.reading-progress');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'reading-progress fixed top-0 left-0 h-1 bg-google-blue z-[1003] transition-all duration-100';
        progressBar.style.width = '0%';
        document.body.appendChild(progressBar);
    }

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        progressBar.style.width = `${scrollPercent}%`;
    }, { passive: true });
}

// Scroll-triggered Animations
function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.remove('opacity-0', 'translate-y-8');
                entry.target.classList.add('opacity-100', 'translate-y-0');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    // Select semantic elements and key areas
    const elementsToAnimate = document.querySelectorAll('section h1, section h2, section p, article, blockquote, .faq-content details');

    elementsToAnimate.forEach(el => {
        el.classList.add('transition-all', 'duration-700', 'ease-out', 'opacity-0', 'translate-y-8'); // Initial state
        observer.observe(el);
    });
}

// Logo Spin on Click
function initLogoSpin() {
    const logo = document.querySelector('a[title^="τ"]'); // Select by title attribute prefix
    if (!logo) return;
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        // Use Tailwind utility or inline style for specific animation
        logo.style.transition = 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)';
        logo.style.transform = `rotate(${Math.random() > 0.5 ? '' : '-'}360deg)`;
        setTimeout(() => {
            logo.style.transition = '';
            logo.style.transform = '';
            window.location.href = '/'; // Navigate after spin
        }, 700);
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
