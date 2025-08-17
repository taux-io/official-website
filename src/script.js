// TauX 網站基本 JavaScript 功能

document.addEventListener('DOMContentLoaded', function() {
    // 導航菜單功能
    initMobileNavigation();
    
    // 滾動時自動隱藏導航
    initScrollNavigation();
    
    // 表單處理
    initContactForm();
    
    // 載入動畫
    initAnimations();
    
    // 閱讀進度條（所有頁面）
    initReadingProgress();

    // 彩蛋：Logo 點擊旋轉、TAUX 模式、X-Grid 覆蓋
    initLogoSpin();
    initTauMode();
    initGridOverlayToggle();
});

// 行動裝置導航功能
function initMobileNavigation() {
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            this.classList.toggle('active');
            navMenu.classList.toggle('active');
            const expanded = this.classList.contains('active');
            this.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            
            // 防止背景滾動
            if (navMenu.classList.contains('active')) {
                document.body.classList.add('nav-open');
            } else {
                document.body.classList.remove('nav-open');
            }
        });
        
        // 點擊菜單項目後關閉菜單
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.classList.remove('nav-open');
            });
        });
    }
}

// 滾動時自動隱藏導航
function initScrollNavigation() {
    const navigation = document.querySelector('.main-navigation');
    const navMenu = document.querySelector('.nav-menu');
    
    if (!navigation) return;
    
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateNavigation() {
        const currentScrollY = window.scrollY;
        
        if (currentScrollY > 100) { // 滾動超過 100px 後才開始隱藏
            const menuActive = navMenu ? navMenu.classList.contains('active') : false;
            if (currentScrollY > lastScrollY && !menuActive) {
                // 向下滾動且菜單未開啟時隱藏
                navigation.classList.add('hidden');
            } else {
                // 向上滾動時顯示
                navigation.classList.remove('hidden');
            }
        } else {
            // 在頂部時總是顯示
            navigation.classList.remove('hidden');
        }
        
        lastScrollY = currentScrollY;
        ticking = false;
    }

    function requestTick() {
        if (!ticking) {
            requestAnimationFrame(updateNavigation);
            ticking = true;
        }
    }

    window.addEventListener('scroll', requestTick, { passive: true });

    // 處理觸摸設備的滾動
    let touchStartY = 0;
    let touchEndY = 0;

    window.addEventListener('touchstart', (e) => {
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
        touchEndY = e.changedTouches[0].screenY;
        requestTick();
    }, { passive: true });
}

// 聯絡表單處理
function initContactForm() {
    const contactForm = document.querySelector('#contact-form');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // 這裡可以添加表單驗證和提交邏輯
            const formData = new FormData(this);
            
            // 顯示提交成功訊息
            showMessage('感謝您的聯絡！我們會盡快回覆您。', 'success');
            
            // 重置表單
            this.reset();
        });
    }
}

// 載入動畫
function initAnimations() {
    // 檢查瀏覽器是否支援 Intersection Observer
    if ('IntersectionObserver' in window) {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, observerOptions);
        
        // 觀察需要動畫的元素
        const animateElements = document.querySelectorAll('.service-item, .benefit-item, .core-component, .value-item');
        animateElements.forEach(el => {
            observer.observe(el);
        });
    }
}

// 顯示訊息功能
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    messageDiv.textContent = message;
    
    // 添加訊息樣式
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
    `;
    
    // 添加動畫 CSS
    if (!document.querySelector('#message-animations')) {
        const style = document.createElement('style');
        style.id = 'message-animations';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(messageDiv);
    
    // 3秒後自動移除訊息
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

// 主題切換功能（如果需要）
function initThemeToggle() {
    const themeToggle = document.querySelector('#theme-toggle');
    
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('dark-theme');
            
            // 保存主題偏好到 localStorage
            const isDark = document.body.classList.contains('dark-theme');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
        
        // 載入保存的主題設定
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }
}

// 效能優化：圖片懶載入
function initLazyLoading() {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('lazy');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        const lazyImages = document.querySelectorAll('img[data-src]');
        lazyImages.forEach(img => imageObserver.observe(img));
    }
}

// AEO 指南頁面專用功能
if (window.location.pathname.includes('aeo-guide.html')) {
    document.addEventListener('DOMContentLoaded', function() {
        // 延遲執行確保樣式載入完成
        setTimeout(() => {
            generateTableOfContents();
        }, 100);
    });
}

// 生成目錄
function generateTableOfContents() {
    // 等待一下確保頁面完全載入
    setTimeout(() => {
        const headings = document.querySelectorAll('.guide-section h2');
        if (headings.length === 0) return;
        
        // 檢查是否已經有目錄存在
        const existingToc = document.querySelector('.table-of-contents');
        if (existingToc) {
            existingToc.remove();
        }
        
        const tocContainer = document.createElement('div');
        tocContainer.className = 'table-of-contents';
        
        const tocTitle = document.createElement('h3');
        tocTitle.textContent = '目錄';
        
        // 設定目錄標題顏色的函數
        function setTocTitleColor() {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                tocTitle.style.color = '#ffffff';
                tocTitle.style.borderBottom = '2px solid #4a5568';
            } else {
                tocTitle.style.color = '#1a1a1a';
                tocTitle.style.borderBottom = '2px solid #e5e7eb';
            }
        }
        
        // 初始設定
        setTocTitleColor();
        
        // 監聽深色模式切換
        if (window.matchMedia) {
            const mq = window.matchMedia('(prefers-color-scheme: dark)');
            if (mq.addEventListener) {
                mq.addEventListener('change', setTocTitleColor);
            } else if (mq.addListener) {
                mq.addListener(setTocTitleColor);
            }
        }
        
        tocContainer.appendChild(tocTitle);
        
        const tocList = document.createElement('ul');
        
        headings.forEach((heading, index) => {
            const id = `section-${index + 1}`;
            heading.id = id;
            
            const tocItem = document.createElement('li');
            const tocLink = document.createElement('a');
            tocLink.href = `#${id}`;
            tocLink.textContent = heading.textContent;
            tocItem.appendChild(tocLink);
            tocList.appendChild(tocItem);
        });
        
        tocContainer.appendChild(tocList);
        
        // 插入到第一個 section 之前
        const firstSection = document.querySelector('.guide-section');
        if (firstSection) {
            firstSection.parentNode.insertBefore(tocContainer, firstSection);
        }
    }, 200);
}

// 閱讀進度指示器
function initReadingProgress() {
    const progressBar = document.createElement('div');
    progressBar.className = 'reading-progress';
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 3px;
        background: var(--accent-color);
        z-index: 10001;
        transition: width 0.1s ease;
    `;
    
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        
        progressBar.style.width = scrollPercent + '%';
    }, { passive: true });
}

// 彩蛋：Logo 點擊旋轉 1 週期（1 turn）
function initLogoSpin() {
    const logo = document.querySelector('.logo-text');
    if (!logo) return;
    logo.addEventListener('click', () => {
        logo.classList.add('spin-1turn');
        setTimeout(() => logo.classList.remove('spin-1turn'), 700);
    });
}

// 彩蛋：TAUX 鍵序切換 tau-mode，並保存偏好
function initTauMode() {
    const root = document.documentElement;
    const saved = localStorage.getItem('tauMode') === 'on';
    if (saved) root.classList.add('tau-mode');

    let keyBuffer = '';
    document.addEventListener('keydown', (e) => {
        // 避免在輸入場景觸發
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;

        const k = e.key && e.key.length === 1 ? e.key.toUpperCase() : '';
        if (!k) return;
        keyBuffer = (keyBuffer + k).slice(-8);

        let tauToggled = false;
        if (keyBuffer.endsWith('TAUX')) {
            const on = !root.classList.contains('tau-mode');
            root.classList.toggle('tau-mode', on);
            localStorage.setItem('tauMode', on ? 'on' : 'off');
            tauToggled = true;
        }

        // X-Grid 切換（若本次已觸發 TAUX，則略過 X 切換）
        if (!tauToggled && k === 'X') {
            toggleGridOverlay();
        }
    });
}

// 彩蛋：X 鍵切換 Grid Overlay
function initGridOverlayToggle() {
    // 建立 overlay 容器（延後建立）
    // 熱鍵監聽已在 initTauMode 內一併處理 X 鍵
    // 此處確保首次呼叫 toggle 時有節點
    window.toggleGridOverlay = toggleGridOverlay;
}

function toggleGridOverlay() {
    let grid = document.querySelector('.x-grid');
    if (!grid) {
        grid = document.createElement('div');
        grid.className = 'x-grid';
        document.body.appendChild(grid);
    }
    grid.classList.toggle('active');
}
