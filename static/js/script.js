// TauX Interactivity (Anthropic-style, minimal)

document.addEventListener('DOMContentLoaded', () => {
    initMenu();
    initScrollNavigation();
    initLocaleSwitcherDismiss();
    initEasterEggs();
});

// Full-screen menu. One overlay, and however many triggers the markup declares:
// the hamburger on small screens, the Explore item on large ones, and the
// home page's hero call to action.
//
// FOUND BY THE MARKUP RATHER THAN LISTED HERE. This was `[hamburger, trigger]`,
// which meant adding a third trigger was two edits in two files with nothing
// reporting the second one missing — the button would simply render and do
// nothing. `aria-controls` already has to name the overlay for the trigger to
// be correct for assistive technology, so the relationship is declared in the
// markup either way; reading it back is free and cannot drift.
//
// `menuClose` lives inside the overlay and carries no `aria-controls`, so it
// does not match here and keeps its own close-only handler below.
function initMenu() {
    const overlay = document.getElementById('menuOverlay');
    const hamburger = document.getElementById('hamburger');
    const closeBtn = document.getElementById('menuClose');

    if (!overlay) return;

    const triggers = Array.from(
        document.querySelectorAll('[aria-controls="menuOverlay"]')
    ).filter((t) => t !== closeBtn);
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
        // Before the focus call below, and before the classes: inert blocks
        // focus() outright, so lifting it has to come first or the close
        // button never receives focus and a keyboard user opens the menu into
        // nothing.
        overlay.removeAttribute('inert');
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
        // After the focus restore. Making an element inert while focus is
        // inside it drops focus to the body, and the line above would then be
        // undoing damage this line had just caused.
        overlay.setAttribute('inert', '');
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
        closeLocaleSwitchers();
    }, { passive: true });
}

// THE LOCALE SWITCHER IS A NATIVE <details>, AND THAT IS WHY IT NEEDED THIS.
//
// A <details> stays open until something closes it. The nav is `fixed` and
// slides away on scroll down — so the panel travelled with it, hung over the
// page, and came back still open. Reported from a real page, not a probe:
// nothing here measures "is a menu stuck".
//
// The close is an ENHANCEMENT, never the mechanism. Without script the switcher
// still opens, still closes on a second click, still navigates — decision #13's
// precedent is nineteen elements left permanently invisible because visibility
// depended on a script running, and the switcher is how a reader who cannot
// read this page reaches one they can. It must not need JS to work.
//
// Three ways out, because a menu you cannot dismiss is the actual complaint:
// scrolling away, clicking elsewhere, and Escape.
function closeLocaleSwitchers(except) {
    for (const d of document.querySelectorAll('details.locale-switcher[open]')) {
        if (d !== except) d.open = false;
    }
}

function initLocaleSwitcherDismiss() {
    // `closest` rather than `contains`: a click on the summary's ▾ span is
    // inside the details and must not immediately re-close what it just opened.
    document.addEventListener('click', (e) => {
        closeLocaleSwitchers(e.target.closest('details.locale-switcher'));
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const open = document.querySelector('details.locale-switcher[open]');
        if (!open) return;
        closeLocaleSwitchers();
        // Focus goes back to the control that opened it, or the reader is left
        // somewhere with no visible focus ring.
        open.querySelector('summary')?.focus();
    });
}

// Scroll-triggered reveals were removed here deliberately.
//
// The previous implementation set opacity-0 from JS on every `section h1,
// section h2, section p, article, blockquote, details` and cleared it from an
// IntersectionObserver. Two problems, one cosmetic and one not:
//
//   Fast scrolling outran the observer. It reports the state at delivery time,
//   so an element that entered and left the viewport between two deliveries
//   was only ever seen as non-intersecting and stayed hidden permanently — a
//   full programmatic scroll of the homepage left 19 elements invisible, and a
//   trackpad fling or the End key does the same thing.
//
//   More importantly it made body copy visible only if JavaScript ran. On a
//   site whose value is its written content and its standing in search, that
//   is not a dependency worth having for a fade.
//
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
