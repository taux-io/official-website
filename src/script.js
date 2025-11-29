// Jules-Inspired Interactivity

document.addEventListener('DOMContentLoaded', () => {
    initMobileNavigation();
    initScrollNavigation();
    initReadingProgress();
    initScrollAnimations(); // <-- New animation function
    initLogoSpin();
    initEasterEggs();
});

// Mobile Navigation (Hamburger Menu)
function initMobileNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', () => {
        const isActive = hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        hamburger.setAttribute('aria-expanded', isActive);
        document.body.classList.toggle('nav-open', isActive);
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.classList.remove('nav-open');
        });
    });
}

// Hide Nav on Scroll
function initScrollNavigation() {
    const nav = document.querySelector('.main-navigation');
    if (!nav) return;
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 100 && window.scrollY > lastScrollY) {
            nav.classList.add('hidden');
        } else {
            nav.classList.remove('hidden');
        }
        lastScrollY = window.scrollY;
    }, { passive: true });
}

// Reading Progress Bar
function initReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        progressBar.style.width = `${scrollPercent}%`;
    }, { passive: true });
}

// **NEW** Scroll-triggered Animations
function initScrollAnimations() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    const elementsToAnimate = document.querySelectorAll('.hero-title, .hero-description, .section-title, .section-subtitle, .content-block, .benefit-item, .core-component, .comparison-item, .final-cta');
    elementsToAnimate.forEach(el => observer.observe(el));

    // Add CSS for the animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .fade-in-up {
            animation: fadeInUp 0.8s ease-out forwards;
            opacity: 0; /* Start hidden */
        }
    `;
    document.head.appendChild(style);
}

// Logo Spin on Click
function initLogoSpin() {
    const logo = document.querySelector('.logo-text');
    if (!logo) return;
    logo.addEventListener('click', (e) => {
        e.preventDefault();
        logo.style.transition = 'transform 0.7s cubic-bezier(0.25, 1, 0.5, 1)';
        logo.style.transform = `rotate(${Math.random() > 0.5 ? '' : '-'}360deg)`;
        setTimeout(() => {
            logo.style.transition = '';
            logo.style.transform = '';
        }, 700);
    });
}

// Easter Eggs (Konami Code Style)
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
