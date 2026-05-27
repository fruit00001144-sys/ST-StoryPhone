(function () {
    'use strict';

    var EXTENSION_ID = 'ST-StoryPhone';
    var APP_SCRIPT = '/scripts/extensions/third-party/ST-StoryPhone/app.js';

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

        var button = document.createElement('button');
        button.id = 'st-story-phone-launcher';
        button.type = 'button';
        button.textContent = 'Phone';
        button.title = '打开 ST-StoryPhone';
        button.setAttribute('aria-label', '打开 ST-StoryPhone');
        button.style.position = 'fixed';
        button.style.right = '18px';
        button.style.bottom = '84px';
        button.style.zIndex = '99999';
        button.style.width = '72px';
        button.style.height = '72px';
        button.style.border = '4px solid #fff7b8';
        button.style.borderRadius = '24px';
        button.style.background = 'linear-gradient(145deg, #bfefff, #ffd3e5)';
        button.style.color = '#24314f';
        button.style.fontWeight = '900';
        button.style.boxShadow = '0 12px 28px rgba(54, 80, 120, 0.26)';
        button.style.cursor = 'pointer';
        button.style.fontFamily = 'Verdana, sans-serif';

        document.body.appendChild(button);
        return button;
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
            }
            return;
        }

        window.__STStoryPhoneAppLoaded = true;
        var script = document.createElement('script');
        script.type = 'module';
        script.src = APP_SCRIPT + '?v=0.1.3';
        script.onload = function () {
            showToast('ST-StoryPhone 已打开');
            var launcher = document.getElementById('st-story-phone-launcher');
            if (launcher) launcher.remove();
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
        bubble.addEventListener('click', loadFullApp);
        window.STStoryPhoneLauncher = {
            load: loadFullApp,
            bubble: makeBubble,
            version: '0.1.3',
        };
        console.info(EXTENSION_ID + ' launcher loaded');
    });
})();
