(function () {
    'use strict';

    var EXTENSION_ID = 'ST-StoryPhone';
    var currentScript = document.currentScript && document.currentScript.src ? document.currentScript.src : '';
    var APP_SCRIPT = currentScript ? currentScript.replace(/index\.js(?:\?.*)?$/, 'app.js') : './app.js';

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function makeBubble() {
        var old = document.getElementById('st-story-phone-launcher');
        if (old) return old;
        var saved = {};
        try {
            saved = JSON.parse(localStorage.getItem('st_story_phone_launcher_pos') || '{}');
        } catch (_) {
            saved = {};
        }

        var button = document.createElement('button');
        button.id = 'st-story-phone-launcher';
        button.type = 'button';
        button.textContent = '📱';
        button.title = '打开 ST-StoryPhone';
        button.setAttribute('aria-label', '打开 ST-StoryPhone');
        button.style.position = 'fixed';
        button.style.left = typeof saved.left === 'number' ? saved.left + 'px' : '18px';
        button.style.top = typeof saved.top === 'number' ? saved.top + 'px' : '120px';
        button.style.zIndex = '2147483647';
        button.style.width = '48px';
        button.style.height = '48px';
        button.style.border = '3px solid #fff7b8';
        button.style.borderRadius = '16px';
        button.style.background = 'linear-gradient(145deg, #bfefff, #ffd3e5)';
        button.style.color = '#24314f';
        button.style.fontWeight = '900';
        button.style.fontSize = '22px';
        button.style.boxShadow = '0 12px 28px rgba(54, 80, 120, 0.26)';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Verdana, sans-serif';
        button.style.pointerEvents = 'auto';
        button.style.touchAction = 'none';

        document.body.appendChild(button);
        makeDraggable(button, openPhone);
        button.addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (button.__stpSuppressClick) {
                button.__stpSuppressClick = false;
                return;
            }
            openPhone();
        }, true);
        return button;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function makeDraggable(element, onTap) {
        var startX = 0;
        var startY = 0;
        var startLeft = 0;
        var startTop = 0;
        var moved = false;
        var pointerId = null;

        function savePosition() {
            try {
                localStorage.setItem('st_story_phone_launcher_pos', JSON.stringify({
                    left: parseInt(element.style.left, 10) || 18,
                    top: parseInt(element.style.top, 10) || 120,
                }));
            } catch (_) {
                // Ignore storage failures in private or restricted browser modes.
            }
        }

        function onPointerDown(event) {
            pointerId = event.pointerId;
            moved = false;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = element.offsetLeft;
            startTop = element.offsetTop;
            element.setPointerCapture?.(pointerId);
            event.preventDefault();
        }

        function onPointerMove(event) {
            if (pointerId !== event.pointerId) return;
            var dx = event.clientX - startX;
            var dy = event.clientY - startY;
            if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
            if (!moved) return;
            var maxLeft = Math.max(0, window.innerWidth - element.offsetWidth - 4);
            var maxTop = Math.max(0, window.innerHeight - element.offsetHeight - 4);
            element.style.left = clamp(startLeft + dx, 4, maxLeft) + 'px';
            element.style.top = clamp(startTop + dy, 54, maxTop) + 'px';
            event.preventDefault();
        }

        function onPointerUp(event) {
            if (pointerId !== event.pointerId) return;
            element.releasePointerCapture?.(pointerId);
            pointerId = null;
            savePosition();
            element.__stpSuppressClick = moved;
            if (!moved && typeof onTap === 'function') {
                setTimeout(function () {
                    if (!element.__stpSuppressClick) onTap();
                    element.__stpSuppressClick = false;
                }, 0);
            }
            event.preventDefault();
        }

        element.addEventListener('pointerdown', onPointerDown);
        element.addEventListener('pointermove', onPointerMove);
        element.addEventListener('pointerup', onPointerUp);
        element.addEventListener('pointercancel', onPointerUp);
    }

    function makeFallbackPhone() {
        var old = document.getElementById('st-story-phone-fallback');
        if (old) {
            old.style.display = old.style.display === 'none' ? 'block' : 'none';
            return old;
        }

        var panel = document.createElement('section');
        panel.id = 'st-story-phone-fallback';
        panel.style.position = 'fixed';
        panel.style.left = '12px';
        panel.style.top = '110px';
        panel.style.zIndex = '2147483647';
        panel.style.width = 'min(340px, calc(100vw - 24px))';
        panel.style.maxHeight = 'calc(100vh - 160px)';
        panel.style.overflow = 'auto';
        panel.style.border = '4px solid #fff7b8';
        panel.style.borderRadius = '28px';
        panel.style.padding = '14px';
        panel.style.background = 'linear-gradient(145deg, #bfefff, #ffd3e5 55%, #fff9df)';
        panel.style.color = '#24314f';
        panel.style.boxShadow = '0 18px 44px rgba(54,80,120,.32)';
        panel.style.fontFamily = 'Verdana, sans-serif';
        panel.innerHTML = [
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">',
            '<strong>ST-StoryPhone</strong>',
            '<button id="st-story-phone-fallback-close" type="button">关闭</button>',
            '</div>',
            '<p style="font-weight:800;">小手机入口已加载。这里先提供一个最小可用手机面板。</p>',
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0;">',
            '<button type="button">微信</button><button type="button">朋友圈</button><button type="button">论坛</button>',
            '<button type="button">日历</button><button type="button">备忘录</button><button type="button">目标手机</button>',
            '</div>',
            '<button id="st-story-phone-fallback-load" type="button">打开完整手机</button>',
            '<button id="st-story-phone-fallback-bubble" type="button">重新显示气泡</button>',
            '<p id="st-story-phone-fallback-status" style="font-size:12px;">如果完整手机打不开，说明主体脚本还需要继续适配你的 ST 版本。</p>',
        ].join('');
        document.body.appendChild(panel);
        document.getElementById('st-story-phone-fallback-close').addEventListener('click', function () {
            panel.style.display = 'none';
        });
        document.getElementById('st-story-phone-fallback-load').addEventListener('click', loadFullApp);
        document.getElementById('st-story-phone-fallback-bubble').addEventListener('click', function () {
            makeBubble();
            showToast('Phone 气泡已显示，可拖动');
        });
        return panel;
    }

    function openPhone() {
        makeFallbackPhone();
        loadFullApp();
    }

    function mountDiagnosticsPanel() {
        var host = document.getElementById('extensions_settings') ||
            document.getElementById('extensions_settings2') ||
            document.querySelector('#extensions_settings, .extensions_settings, [id*="extensions_settings"]');
        if (!host || document.getElementById('st-story-phone-diagnostics')) return;

        var panel = document.createElement('div');
        panel.id = 'st-story-phone-diagnostics';
        panel.style.margin = '10px 0';
        panel.style.padding = '10px';
        panel.style.border = '2px solid #71cfff';
        panel.style.borderRadius = '12px';
        panel.style.background = '#fff9df';
        panel.style.color = '#24314f';
        panel.style.fontWeight = '800';
        panel.innerHTML = 'ST-StoryPhone launcher loaded. 如果主页面没有 Phone 气泡，请点这里：<button id="st-story-phone-force-bubble" type="button">显示/打开 Phone</button>';
        host.prepend(panel);

        var force = document.getElementById('st-story-phone-force-bubble');
        if (force) {
            force.addEventListener('click', function () {
                makeBubble();
                makeFallbackPhone();
                showToast('Phone 已放到左上角');
            });
        }
    }

    function showToast(text) {
        var old = document.getElementById('st-story-phone-toast');
        if (old) old.remove();

        var toast = document.createElement('div');
        toast.id = 'st-story-phone-toast';
        toast.textContent = text;
        toast.style.position = 'fixed';
        toast.style.right = '16px';
        toast.style.bottom = '164px';
        toast.style.zIndex = '100000';
        toast.style.maxWidth = '260px';
        toast.style.padding = '10px 12px';
        toast.style.border = '2px solid #24314f';
        toast.style.borderRadius = '14px';
        toast.style.background = '#fff9df';
        toast.style.color = '#24314f';
        toast.style.fontWeight = '800';
        toast.style.boxShadow = '4px 4px 0 #24314f';
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 3000);
    }

    function loadFullApp() {
        if (window.__STStoryPhoneAppLoaded) {
            if (window.STStoryPhoneDebug && window.STStoryPhoneDebug.resetUi) {
                window.STStoryPhoneDebug.resetUi();
            } else {
                makeFallbackPhone();
            }
            return;
        }

        window.__STStoryPhoneAppLoaded = true;
        var script = document.createElement('script');
        script.type = 'module';
        script.src = APP_SCRIPT + '?v=0.1.5';
        script.onload = function () {
            showToast('ST-StoryPhone 已打开');
            var launcher = document.getElementById('st-story-phone-launcher');
            if (launcher) launcher.remove();
            setTimeout(function () {
                if (!document.getElementById('st-story-phone') && !window.STStoryPhoneDebug) {
                    makeFallbackPhone();
                    showToast('完整手机未挂载，已打开最小手机面板');
                }
            }, 1200);
        };
        script.onerror = function (error) {
            window.__STStoryPhoneAppLoaded = false;
            console.error('ST-StoryPhone full app failed to load:', error);
            showToast('手机主体加载失败，但气泡已工作。请看控制台错误。');
        };
        document.head.appendChild(script);
    }

    ready(function () {
        var bubble = makeBubble();
        mountDiagnosticsPanel();
        setInterval(mountDiagnosticsPanel, 2000);
        window.STStoryPhoneLauncher = {
            load: loadFullApp,
            bubble: makeBubble,
            fallback: makeFallbackPhone,
            diagnostics: mountDiagnosticsPanel,
            version: '0.1.8',
        };
        console.info(EXTENSION_ID + ' launcher loaded');
    });
})();
