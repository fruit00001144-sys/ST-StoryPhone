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
        panel.style.left = '50%';
        panel.style.top = '52%';
        panel.style.transform = 'translate(-50%, -50%)';
        panel.style.zIndex = '2147483647';
        panel.style.width = 'min(360px, calc(100vw - 28px))';
        panel.style.height = 'min(690px, calc(100vh - 86px))';
        panel.style.overflow = 'hidden';
        panel.style.border = '5px solid #fff2a8';
        panel.style.borderRadius = '38px';
        panel.style.padding = '0';
        panel.style.background = 'radial-gradient(circle at 20% 10%, rgba(255,211,229,.9), transparent 28%), radial-gradient(circle at 85% 0%, rgba(216,255,229,.9), transparent 30%), linear-gradient(145deg, #bfefff, #ffd3e5 56%, #fff9df)';
        panel.style.color = '#24314f';
        panel.style.boxShadow = '0 22px 58px rgba(54,80,120,.38), inset 0 0 0 2px rgba(255,255,255,.65)';
        panel.style.fontFamily = 'Verdana, sans-serif';
        panel.innerHTML = [
            '<div style="height:42px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 16px;font-size:11px;font-weight:900;letter-spacing:.08em;">',
            '<span>STORY 5G</span>',
            '<span style="width:74px;height:22px;border-radius:999px;background:rgba(36,49,79,.86);box-shadow:inset 16px 0 0 rgba(255,255,255,.16);"></span>',
            '<button id="st-story-phone-fallback-close" type="button" style="justify-self:end;width:30px;height:24px;border:2px solid #24314f;border-radius:8px;background:#fff9df;font-weight:900;">×</button>',
            '</div>',
            '<div style="height:calc(100% - 54px);margin:0 12px 12px;border:3px solid rgba(36,49,79,.22);border-radius:28px;background:linear-gradient(90deg,rgba(255,255,255,.24) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.24) 1px,transparent 1px),linear-gradient(180deg,#f8fdff,#fff5fb 52%,#fffbea);background-size:18px 18px,18px 18px,auto;overflow:auto;padding:14px;box-sizing:border-box;">',
            '<div style="border:2px solid rgba(36,49,79,.14);border-radius:24px;padding:18px;background:radial-gradient(circle at top right,rgba(113,207,255,.45),transparent 34%),linear-gradient(135deg,rgba(255,211,229,.78),rgba(216,255,229,.78));box-shadow:inset 0 0 0 2px rgba(255,255,255,.5);">',
            '<div style="font-family:Georgia,serif;font-size:34px;line-height:.92;font-weight:900;letter-spacing:-.06em;text-shadow:2px 2px 0 #fff;">Phoning<br>Phone</div>',
            '<div style="margin-top:10px;font-size:12px;font-weight:900;">ST-StoryPhone fallback shell</div>',
            '<div style="margin-top:8px;font-size:12px;">完整主体加载中；这里先作为可用手机桌面。</div>',
            '</div>',
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;">',
            appButtonHtml('微信', 'chat'),
            appButtonHtml('朋友圈', 'moments'),
            appButtonHtml('论坛', 'forum'),
            appButtonHtml('日历', 'calendar'),
            appButtonHtml('备忘录', 'memo'),
            appButtonHtml('目标手机', 'phone'),
            '</div>',
            '<div id="st-story-phone-fallback-view" style="margin-top:14px;border:2px solid rgba(36,49,79,.14);border-radius:18px;background:rgba(255,255,255,.72);padding:12px;font-size:13px;line-height:1.5;">点一个应用开始。后台生成接口未接入时，不会把内容写入主聊天。</div>',
            '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">',
            '<button id="st-story-phone-fallback-load" type="button" style="border:2px solid #24314f;border-radius:10px;background:#fff9df;font-weight:900;box-shadow:3px 3px 0 #24314f;padding:7px 10px;">重试完整手机</button>',
            '<button id="st-story-phone-fallback-bubble" type="button" style="border:2px solid #24314f;border-radius:10px;background:#fff;font-weight:900;box-shadow:2px 2px 0 rgba(36,49,79,.6);padding:7px 10px;">显示气泡</button>',
            '</div>',
            '</div>',
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
        Array.prototype.forEach.call(panel.querySelectorAll('[data-stp-app]'), function (button) {
            button.addEventListener('click', function () {
                var view = document.getElementById('st-story-phone-fallback-view');
                var label = button.getAttribute('data-stp-app');
                if (view) {
                    view.innerHTML = '<strong>' + label + '</strong><p>这个模块已经在手机壳里打开。完整主体可用后会接入剧情状态、可见性审计和后台生成。</p>';
                }
            });
        });
        return panel;
    }

    function appButtonHtml(label, icon) {
        return '<button type="button" data-stp-app="' + label + '" style="min-height:82px;border:2px solid rgba(36,49,79,.16);border-radius:22px;background:rgba(255,255,255,.72);color:#24314f;font-weight:900;box-shadow:0 6px 0 rgba(36,49,79,.08);"><span style="display:block;width:38px;margin:0 auto 7px;padding:7px 0;border-radius:13px;background:#bfefff;font-size:11px;">' + icon + '</span>' + label + '</button>';
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
        script.src = APP_SCRIPT + '?v=0.1.9';
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
            version: '0.1.9',
        };
        console.info(EXTENSION_ID + ' launcher loaded');
    });
})();
