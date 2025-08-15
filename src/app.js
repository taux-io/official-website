/**
 * TauX 官方網站 AngularJS 應用程式
 * 主模組定義與配置
 */

// 主應用模組
var tauxApp = angular.module('tauxApp', ['ngRoute']);

// 路由配置
tauxApp.config(['$routeProvider', function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'templates/home.html',
            controller: 'HomeController'
        })
        .when('/aeo-guide', {
            templateUrl: 'templates/aeo-guide.html',
            controller: 'AeoGuideController'
        })
        .otherwise({
            redirectTo: '/'
        });
}]);

// 主控制器
tauxApp.controller('MainController', ['$scope', '$location', function($scope, $location) {
    $scope.nav = {
        currentPath: '/',
        isMenuOpen: false
    };
    
    $scope.messages = [];
    
    // 導航控制
    $scope.toggleMobileMenu = function() {
        $scope.nav.isMenuOpen = !$scope.nav.isMenuOpen;
    };
    
    $scope.scrollToSection = function(sectionId) {
        var element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
        $scope.nav.isMenuOpen = false;
    };
    
    // 監聽路由變化
    $scope.$on('$routeChangeSuccess', function() {
        $scope.nav.currentPath = $location.path();
        $scope.nav.isMenuOpen = false;
    });
    
    // 訊息系統
    $scope.showMessage = function(text, type) {
        var message = {
            text: text,
            type: type || 'info',
            show: true
        };
        $scope.messages.push(message);
        
        setTimeout(function() {
            message.show = false;
            $scope.$apply();
            
            setTimeout(function() {
                var index = $scope.messages.indexOf(message);
                if (index > -1) {
                    $scope.messages.splice(index, 1);
                    $scope.$apply();
                }
            }, 300);
        }, 3000);
    };
}]);

// 首頁控制器
tauxApp.controller('HomeController', ['$scope', function($scope) {
    // 服務項目資料
    $scope.services = {
        list: [
            {
                icon: 'fas fa-code',
                title: '軟體開發',
                description: '專業的網站與手機應用程式開發服務',
                features: ['網站建置', '手機 App', '系統整合', '資料庫設計'],
                price: '客製報價'
            },
            {
                icon: 'fas fa-video',
                title: '短影片製作',
                description: '創意短影片內容製作與後製服務',
                features: ['腳本撰寫', '拍攝製作', '後製剪輯', '平台優化'],
                price: '專案報價'
            },
            {
                icon: 'fas fa-chart-line',
                title: '數位行銷',
                description: '全方位數位行銷策略規劃與執行',
                features: ['社群媒體', 'SEO 優化', '廣告投放', '數據分析'],
                price: '月費制'
            },
            {
                icon: 'fas fa-search',
                title: 'AEO 優化',
                description: '答案引擎優化，讓 AI 主動推薦您的內容',
                features: ['內容結構化', 'Schema 標記', 'AI 優化', '效果追蹤'],
                price: '專業諮詢'
            }
        ]
    };
    
    // FAQ 資料
    $scope.faqs = {
        list: [
            {
                question: '什麼是 AEO 答案引擎優化？',
                answer: 'AEO (Answer Engine Optimization) 是針對 AI 搜尋引擎和語音助手優化內容的策略，讓您的網站能夠被 ChatGPT、Claude 等 AI 工具直接引用和推薦。',
                isOpen: false
            },
            {
                question: '軟體開發需要多長時間？',
                answer: '開發時間依專案複雜度而定，一般網站需要 2-8 週，手機 App 需要 3-12 週。我們會在需求確認後提供詳細的時程規劃。',
                isOpen: false
            },
            {
                question: '你們提供哪些數位行銷服務？',
                answer: '我們提供完整的數位行銷服務，包括社群媒體經營、SEO 優化、Google 廣告投放、內容行銷、數據分析等。',
                isOpen: false
            },
            {
                question: '短影片製作的流程是什麼？',
                answer: '流程包括：需求討論 → 腳本撰寫 → 拍攝規劃 → 實際拍攝 → 後製剪輯 → 成品交付。整個過程約需 1-3 週時間。',
                isOpen: false
            }
        ]
    };
    
    $scope.toggleFAQ = function(index) {
        $scope.faqs.list[index].isOpen = !$scope.faqs.list[index].isOpen;
    };
    
    // 聯絡表單
    $scope.contact = {
        form: {},
        isSubmitting: false
    };
    
    $scope.submitContactForm = function() {
        if ($scope.contactForm.$valid) {
            $scope.contact.isSubmitting = true;
            
            // 模擬表單提交
            setTimeout(function() {
                $scope.contact.isSubmitting = false;
                $scope.contact.form = {};
                $scope.contactForm.$setPristine();
                $scope.contactForm.$setUntouched();
                $scope.$parent.showMessage('感謝您的訊息！我們會盡快回覆。', 'success');
                $scope.$apply();
            }, 2000);
        }
    };
}]);

// AEO 指南控制器
tauxApp.controller('AeoGuideController', ['$scope', function($scope) {
    $scope.guide = {
        readingProgress: 0,
        tocItems: [
            { id: 'what-is-aeo', title: '什麼是 AEO 答案引擎優化' },
            { id: 'aeo-vs-seo', title: 'AEO 與 SEO 的關鍵差異' },
            { id: 'aeo-principles', title: 'AEO 優化的核心原則' },
            { id: 'implementation-steps', title: 'AEO 優化實施步驟' },
            { id: 'best-practices', title: 'AEO 優化最佳實踐' },
            { id: 'tools-resources', title: 'AEO 優化工具與資源' },
            { id: 'future-trends', title: 'AEO 的未來發展趨勢' }
        ]
    };
    
    // 閱讀進度計算
    function updateReadingProgress() {
        var winHeight = window.innerHeight;
        var docHeight = document.documentElement.scrollHeight - winHeight;
        var scrollTop = window.pageYOffset;
        var scrolled = (scrollTop / docHeight) * 100;
        
        $scope.guide.readingProgress = Math.min(100, Math.max(0, scrolled));
        $scope.$apply();
    }
    
    // 綁定滾動事件
    window.addEventListener('scroll', updateReadingProgress);
    
    // 控制器銷毀時移除事件監聽
    $scope.$on('$destroy', function() {
        window.removeEventListener('scroll', updateReadingProgress);
    });
}]);

// 主控制器
tauxApp.controller('MainController', ['$scope', '$location', '$timeout', function($scope, $location, $timeout) {
    console.log('MainController 已載入');
    
    // 導航狀態
    $scope.nav = {
        isMenuOpen: false,
        currentPath: $location.path()
    };
    
    // 監聽路由變化
    $scope.$on('$routeChangeSuccess', function(event, current, previous) {
        $scope.nav.currentPath = $location.path();
        $scope.nav.isMenuOpen = false; // 路由變化時關閉菜單
    });
    
    // 切換行動菜單
    $scope.toggleMobileMenu = function() {
        $scope.nav.isMenuOpen = !$scope.nav.isMenuOpen;
    };
    
    // 平滑滾動到錨點
    $scope.scrollToSection = function(sectionId, event) {
        if (event) {
            event.preventDefault();
        }
        
        $timeout(function() {
            const element = document.getElementById(sectionId);
            if (element) {
                const offsetTop = element.offsetTop - 80; // 考慮導航欄高度
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        }, 100);
    };
    
    // 訊息系統
    $scope.messages = [];
    
    $scope.showMessage = function(text, type = 'info', duration = 3000) {
        const message = {
            id: Date.now(),
            text: text,
            type: type,
            show: true
        };
        
        $scope.messages.push(message);
        
        $timeout(function() {
            message.show = false;
            $timeout(function() {
                const index = $scope.messages.indexOf(message);
                if (index > -1) {
                    $scope.messages.splice(index, 1);
                }
            }, 300); // 等待動畫完成
        }, duration);
    };
    
    // 主題切換
    $scope.theme = {
        isDark: localStorage.getItem('theme') === 'dark'
    };
    
    $scope.toggleTheme = function() {
        $scope.theme.isDark = !$scope.theme.isDark;
        localStorage.setItem('theme', $scope.theme.isDark ? 'dark' : 'light');
        document.body.classList.toggle('dark-theme', $scope.theme.isDark);
    };
    
    // 初始化主題
    if ($scope.theme.isDark) {
        document.body.classList.add('dark-theme');
    }
}]);

// 首頁控制器
tauxApp.controller('HomeController', ['$scope', '$timeout', function($scope, $timeout) {
    console.log('HomeController 已載入');
    
    // 聯絡表單
    $scope.contact = {
        form: {
            name: '',
            email: '',
            message: ''
        },
        isSubmitting: false
    };
    
    // 服務項目數據
    $scope.services = [
        {
            icon: '💻',
            title: '軟體平台開發',
            description: '客製化軟體解決方案，從概念到上線的完整開發服務',
            features: ['Web 應用程式', '手機 App', '企業系統', 'API 整合']
        },
        {
            icon: '🎬',
            title: '短影片製作',
            description: '專業短影片策劃與製作，提升品牌數位影響力',
            features: ['腳本撰寫', '拍攝製作', '後製剪輯', '平台優化']
        },
        {
            icon: '📊',
            title: '數位行銷整合',
            description: 'AI 驅動的行銷策略，精準觸及目標客群',
            features: ['SEO 優化', 'AEO 答案引擎優化', '社群經營', '數據分析']
        }
    ];
    
    // FAQ 數據
    $scope.faqs = [
        {
            question: '🚀 如何開始合作？需要準備什麼資料？',
            answer: '聯絡我們進行免費諮詢，討論您的需求和目標。我們會根據專案性質提供詳細的合作流程說明。',
            isOpen: false
        },
        {
            question: '💰 專案費用如何計算？',
            answer: '費用依專案複雜度、時程和需求而定。我們提供透明的報價流程，確保您了解每項成本。',
            isOpen: false
        },
        {
            question: '⏱️ 一般專案需要多長時間？',
            answer: '開發時程依專案規模而異，從 2-4 週的小型專案到 3-6 個月的大型平台都有。我們會在初期評估時提供詳細時程規劃。',
            isOpen: false
        }
    ];
    
    // 切換 FAQ
    $scope.toggleFaq = function(faq) {
        faq.isOpen = !faq.isOpen;
    };
    
    // 提交聯絡表單
    $scope.submitContactForm = function() {
        if ($scope.contactForm.$valid) {
            $scope.contact.isSubmitting = true;
            
            // 模擬 API 請求
            $timeout(function() {
                $scope.contact.isSubmitting = false;
                $scope.showMessage('感謝您的聯絡！我們會盡快回覆您。', 'success');
                
                // 重置表單
                $scope.contact.form = {
                    name: '',
                    email: '',
                    message: ''
                };
                $scope.contactForm.$setPristine();
                $scope.contactForm.$setUntouched();
            }, 1500);
        }
    };
    
    // 初始化動畫
    $timeout(function() {
        $scope.initAnimations();
    }, 100);
    
    // 動畫功能
    $scope.initAnimations = function() {
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
            
            const animateElements = document.querySelectorAll('.service-item, .faq-item, .benefit-item');
            animateElements.forEach(el => {
                observer.observe(el);
            });
        }
    };
}]);

// AEO 指南控制器
tauxApp.controller('AeoGuideController', ['$scope', '$timeout', function($scope, $timeout) {
    console.log('AeoGuideController 已載入');
    
    // 目錄和閱讀進度
    $scope.guide = {
        tableOfContents: [],
        readingProgress: 0,
        isLoading: true
    };
    
    // 初始化指南功能
    $timeout(function() {
        $scope.generateTableOfContents();
        $scope.initReadingProgress();
        $scope.guide.isLoading = false;
    }, 200);
    
    // 生成目錄
    $scope.generateTableOfContents = function() {
        const headings = document.querySelectorAll('.guide-section h2');
        
        if (headings.length === 0) return;
        
        $scope.guide.tableOfContents = [];
        
        headings.forEach((heading, index) => {
            const id = `section-${index + 1}`;
            heading.id = id;
            
            $scope.guide.tableOfContents.push({
                id: id,
                title: heading.textContent,
                element: heading
            });
        });
        
        $scope.$apply();
    };
    
    // 閱讀進度
    $scope.initReadingProgress = function() {
        angular.element(window).on('scroll', function() {
            const scrollTop = window.pageYOffset;
            const docHeight = document.body.scrollHeight - window.innerHeight;
            const scrollPercent = (scrollTop / docHeight) * 100;
            
            $scope.guide.readingProgress = Math.min(Math.max(scrollPercent, 0), 100);
            $scope.$apply();
        });
    };
    
    // 跳轉到章節
    $scope.goToSection = function(sectionId) {
        $scope.scrollToSection(sectionId.replace('#', ''));
    };
    
    // 清理事件監聽器
    $scope.$on('$destroy', function() {
        angular.element(window).off('scroll');
    });
}]);

// 自定義指令：延遲載入
tauxApp.directive('lazyLoad', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            if ('IntersectionObserver' in window) {
                const imageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = attrs.lazyLoad;
                            img.classList.remove('lazy');
                            imageObserver.unobserve(img);
                        }
                    });
                });
                
                imageObserver.observe(element[0]);
            } else {
                // 降級處理
                element[0].src = attrs.lazyLoad;
            }
        }
    };
});

// 自定義指令：滾動動畫
tauxApp.directive('scrollAnimate', function() {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver(function(entries) {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('animate-in');
                        }
                    });
                }, {
                    threshold: 0.1,
                    rootMargin: '0px 0px -50px 0px'
                });
                
                observer.observe(element[0]);
            }
        }
    };
});

// 自定義過濾器：信任 HTML
tauxApp.filter('trustAsHtml', ['$sce', function($sce) {
    return function(text) {
        return $sce.trustAsHtml(text);
    };
}]);

// 應用程式運行配置
tauxApp.run(['$rootScope', '$location', function($rootScope, $location) {
    console.log('TauX AngularJS 應用程式已啟動');
    
    // 全域錯誤處理
    $rootScope.$on('$routeChangeError', function(event, current, previous, rejection) {
        console.error('路由變更錯誤:', rejection);
    });
    
    // 頁面標題管理
    $rootScope.$on('$routeChangeSuccess', function(event, current, previous) {
        if (current.$$route) {
            const path = current.$$route.originalPath;
            if (path === '/aeo-guide') {
                document.title = 'AEO 流量容器專業指南 | TauX 拓思科技';
            } else {
                document.title = 'TauX 拓思科技 | 軟體開發 × 短影片製作 × 數位行銷整合';
            }
        }
    });
}]);
