(function () {
    'use strict';

    var EXTENSION_ID = 'ST-StoryPhone';
    var EXTENSION_VERSION = '0.3.3';
    var MODULE_BASE = new URL('.', import.meta.url).href;
    var APP_SCRIPT = new URL('app.js', MODULE_BASE).href;
    var CORE_SCRIPT = new URL('core.js', MODULE_BASE).href;
    var BRIDGE_SCRIPT = new URL('st-bridge.js', MODULE_BASE).href;
    var corePromise = null;
    var coreInstance = null;

    function getCore() {
        if (coreInstance) return Promise.resolve(coreInstance);
        if (!corePromise) {
            corePromise = import(CORE_SCRIPT + '?v=' + EXTENSION_VERSION).then(function (module) {
                coreInstance = new module.StoryPhoneCore();
                window.STStoryPhoneCore = coreInstance;
                return coreInstance;
            }).catch(function (error) {
                console.error('ST-StoryPhone core failed to load', error);
                return null;
            });
        }
        return corePromise;
    }

    function ready(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback, { once: true });
        } else {
            callback();
        }
    }

    function makeBubble() {
        var old = document.getElementById('st-story-phone-launcher');
        if (old) {
            bindBubbleOpenEvents(old);
            return old;
        }
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
        bindBubbleOpenEvents(button);
        return button;
    }

    function bindBubbleOpenEvents(button) {
        if (button.__stpOpenBound) return;
        button.__stpOpenBound = true;
        button.dataset.stpReady = 'true';
        function openFromEvent(event) {
            event.preventDefault();
            event.stopPropagation();
            if (button.__stpSuppressClick) {
                button.__stpSuppressClick = false;
                return;
            }
            openPhone();
        }
        button.addEventListener('click', openFromEvent, true);
        button.addEventListener('touchend', openFromEvent, true);
        button.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' || event.key === ' ') openFromEvent(event);
        }, true);
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

    function makePanelDraggable(panel, handle) {
        var startX = 0;
        var startY = 0;
        var startLeft = 0;
        var startTop = 0;
        var pointerId = null;
        handle.style.touchAction = 'none';
        handle.style.cursor = 'move';

        handle.addEventListener('pointerdown', function (event) {
            if (event.target && event.target.tagName === 'BUTTON') return;
            pointerId = event.pointerId;
            startX = event.clientX;
            startY = event.clientY;
            startLeft = panel.offsetLeft;
            startTop = panel.offsetTop;
            handle.setPointerCapture?.(pointerId);
            event.preventDefault();
        });

        handle.addEventListener('pointermove', function (event) {
            if (pointerId !== event.pointerId) return;
            var maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth - 4);
            var maxTop = Math.max(0, window.innerHeight - panel.offsetHeight - 4);
            panel.style.left = clamp(startLeft + event.clientX - startX, 4, maxLeft) + 'px';
            panel.style.top = clamp(startTop + event.clientY - startY, 48, maxTop) + 'px';
            event.preventDefault();
        });

        handle.addEventListener('pointerup', function (event) {
            if (pointerId !== event.pointerId) return;
            handle.releasePointerCapture?.(pointerId);
            pointerId = null;
            event.preventDefault();
        });
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
        panel.style.top = '96px';
        panel.style.transform = 'none';
        panel.style.zIndex = '2147483647';
        panel.style.width = 'min(360px, calc(100vw - 28px))';
        panel.style.height = 'min(690px, calc(100vh - 132px))';
        panel.style.overflow = 'hidden';
        panel.style.border = '5px solid #fff2a8';
        panel.style.borderRadius = '38px';
        panel.style.padding = '0';
        panel.style.background = 'radial-gradient(circle at 20% 10%, rgba(255,211,229,.9), transparent 28%), radial-gradient(circle at 85% 0%, rgba(216,255,229,.9), transparent 30%), linear-gradient(145deg, #bfefff, #ffd3e5 56%, #fff9df)';
        panel.style.color = '#24314f';
        panel.style.boxShadow = '0 22px 58px rgba(54,80,120,.38), inset 0 0 0 2px rgba(255,255,255,.65)';
        panel.style.fontFamily = 'Verdana, sans-serif';
        panel.innerHTML = [
            '<div id="st-story-phone-dragbar" style="height:42px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 16px;font-size:11px;font-weight:900;letter-spacing:.08em;">',
            '<span>拖动这里</span>',
            '<span style="width:74px;height:22px;border-radius:999px;background:rgba(36,49,79,.86);box-shadow:inset 16px 0 0 rgba(255,255,255,.16);"></span>',
            '<button id="st-story-phone-fallback-close" type="button" style="justify-self:end;width:30px;height:24px;border:2px solid #24314f;border-radius:8px;background:#fff9df;font-weight:900;">×</button>',
            '</div>',
            '<div id="st-story-phone-fallback-screen" style="height:calc(100% - 54px);margin:0 12px 12px;border:3px solid rgba(36,49,79,.22);border-radius:28px;background:linear-gradient(90deg,rgba(255,255,255,.24) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.24) 1px,transparent 1px),linear-gradient(180deg,#f8fdff,#fff5fb 52%,#fffbea);background-size:18px 18px,18px 18px,auto;overflow:hidden;box-sizing:border-box;">',
            '<div id="st-story-phone-fallback-home" style="height:100%;overflow:auto;padding:14px;box-sizing:border-box;">',
            '<div id="st-story-phone-home-card" style="border:2px solid rgba(36,49,79,.14);border-radius:24px;padding:18px;background:radial-gradient(circle at top right,rgba(113,207,255,.45),transparent 34%),linear-gradient(135deg,rgba(255,211,229,.78),rgba(216,255,229,.78));box-shadow:inset 0 0 0 2px rgba(255,255,255,.5);">',
            '<div style="font-family:Georgia,serif;font-size:34px;line-height:.92;font-weight:900;letter-spacing:-.06em;text-shadow:2px 2px 0 #fff;">Phoning<br>Phone</div>',
            '<div style="margin-top:10px;font-size:12px;font-weight:900;">ST-StoryPhone fallback shell</div>',
            '<div style="margin-top:8px;font-size:12px;">完整主体加载中；这里先作为可用手机桌面。</div>',
            '</div>',
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px;">',
            appButtonHtml('微信', '💬'),
            appButtonHtml('朋友圈', '🫧'),
            appButtonHtml('论坛', '📌'),
            appButtonHtml('日历', '📅'),
            appButtonHtml('备忘录', '📝'),
            appButtonHtml('目标手机', '📱'),
            '</div>',
            '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">',
            '<button id="st-story-phone-fallback-load" type="button" style="border:2px solid #24314f;border-radius:10px;background:#fff9df;font-weight:900;box-shadow:3px 3px 0 #24314f;padding:7px 10px;">重试完整手机</button>',
            '<button id="st-story-phone-fallback-bubble" type="button" style="border:2px solid #24314f;border-radius:10px;background:#fff;font-weight:900;box-shadow:2px 2px 0 rgba(36,49,79,.6);padding:7px 10px;">显示气泡</button>',
            '</div>',
            '</div>',
            '<div id="st-story-phone-fallback-view" style="display:none;height:100%;background:#f5f5f5;color:#111;font-size:13px;line-height:1.5;overflow:hidden;"></div>',
            '</div>',
        ].join('');
        document.body.appendChild(panel);
        getCore();
        makePanelDraggable(panel, document.getElementById('st-story-phone-dragbar'));
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
                var label = button.getAttribute('data-stp-app');
                renderFallbackApp(label);
            });
        });
        return panel;
    }

    function appButtonHtml(label, icon) {
        return '<button type="button" data-stp-app="' + label + '" style="min-height:82px;border:2px solid rgba(36,49,79,.16);border-radius:22px;background:rgba(255,255,255,.72);color:#24314f;font-weight:900;box-shadow:0 6px 0 rgba(36,49,79,.08);"><span style="display:block;width:42px;margin:0 auto 7px;padding:7px 0;border-radius:15px;background:#bfefff;font-size:22px;">' + icon + '</span>' + label + '</button>';
    }

    function renderFallbackApp(label) {
        openFallbackAppShell(label);
        if (label === '微信' || label === '朋友圈') return renderFallbackWechat(label === '朋友圈' ? 'moments' : 'list');
        if (label === '论坛') return renderFallbackForum();
        if (label === '日历') return renderSimpleApp('📅 日历', '今天：剧情时间同步主线。<br>未来暗线：等待主剧情推进，不提前泄露。');
        if (label === '备忘录') return renderMemoApp();
        if (label === '目标手机') return renderSimpleApp('📱 目标手机', '只读模式。这里将展示目标角色可见范围内的消息、备忘录和日历。');
    }

    function openFallbackAppShell(title) {
        var home = document.getElementById('st-story-phone-fallback-home');
        var view = document.getElementById('st-story-phone-fallback-view');
        if (!view) return;
        if (home) home.style.display = 'none';
        view.style.display = 'flex';
        view.style.flexDirection = 'column';
        view.innerHTML = '<div style="height:46px;display:grid;grid-template-columns:44px 1fr 44px;align-items:center;background:#f7f7f7;border-bottom:1px solid #ddd;"><button id="stp-app-close" type="button" style="border:0;background:transparent;font-size:26px;color:#111;">×</button><strong style="text-align:center;font-size:17px;">' + title + '</strong><span></span></div><div id="stp-app-content" style="flex:1;min-height:0;overflow:hidden;background:#ededed;"></div>';
        document.getElementById('stp-app-close').addEventListener('click', closeFallbackApp);
    }

    function closeFallbackApp() {
        var home = document.getElementById('st-story-phone-fallback-home');
        var view = document.getElementById('st-story-phone-fallback-view');
        if (home) home.style.display = 'block';
        if (view) {
            view.style.display = 'none';
            view.innerHTML = '';
        }
    }

    function fallbackContent() {
        return document.getElementById('stp-app-content') || document.getElementById('st-story-phone-fallback-view');
    }

    function renderFallbackWechat(tab) {
        var view = fallbackContent();
        var fallbackState = getPhoneState();
        var chat = normalizeChatHistory(fallbackState.chats.char || []);
        fallbackState.chats.char = chat;
        savePhoneStatePatch({ chats: fallbackState.chats });
        var moments = fallbackState.moments || [];
        var tabs = '<div style="height:52px;display:grid;grid-template-columns:repeat(4,1fr);background:#f7f7f7;border-top:1px solid #ddd;"><button data-stp-wx-tab="list" style="border:0;background:transparent;color:#07c160;">💬<br><small>微信</small></button><button data-stp-wx-tab="contacts" style="border:0;background:transparent;">👥<br><small>通讯录</small></button><button data-stp-wx-tab="discover" style="border:0;background:transparent;">🧭<br><small>发现</small></button><button type="button" style="border:0;background:transparent;">🙂<br><small>我</small></button></div>';
        if (tab === 'list') {
            var rows = [
                ['🐼', '目标角色', '刚刚的消息只在手机内。', '现在'],
                ['🧑‍🎓', '同学A', '你看到论坛那个帖子了吗？', '5月16日'],
                ['📷', '社团号', '活动室开放通知', '5月15日'],
            ];
            view.innerHTML = '<div style="height:calc(100% - 52px);overflow:auto;background:#fff;">' + rows.map(function (r) {
                var target = 'chat';
                return '<button data-stp-wx-tab="' + target + '" style="width:100%;display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #eee;background:#fff;padding:10px;text-align:left;color:#111;"><span style="width:44px;height:44px;border-radius:8px;background:#f4f4f4;display:grid;place-items:center;font-size:24px;">' + r[0] + '</span><span><strong style="display:block;font-size:16px;">' + r[1] + '</strong><small style="color:#999;">' + r[2] + '</small></span><small style="color:#aaa;">' + r[3] + '</small></button>';
            }).join('') + '</div>' + tabs;
            bindWechatTabs();
            return;
        }
        if (tab === 'discover') {
            view.innerHTML = '<div style="height:calc(100% - 52px);overflow:auto;background:#ededed;padding-top:10px;"><button data-stp-wx-tab="moments" style="width:100%;display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #eee;background:#fff;padding:14px;text-align:left;color:#111;"><span style="font-size:24px;">🫧</span><span><strong style="display:block;font-size:16px;">朋友圈</strong><small style="color:#999;">查看剧情世界动态</small></span><span style="color:#bbb;font-size:22px;">›</span></button></div>' + tabs;
            bindWechatTabs();
            return;
        }
        if (tab === 'contacts') {
            view.innerHTML = '<div style="height:calc(100% - 52px);overflow:auto;background:#fff;"><button data-stp-wx-tab="chat" style="width:100%;display:grid;grid-template-columns:48px 1fr auto;gap:10px;align-items:center;border:0;border-bottom:1px solid #eee;background:#fff;padding:10px;text-align:left;color:#111;"><span style="width:44px;height:44px;border-radius:8px;background:#f4f4f4;display:grid;place-items:center;font-size:24px;">🐼</span><span><strong style="display:block;font-size:16px;">目标角色</strong><small style="color:#999;">角色卡主角</small></span><span style="color:#bbb;">›</span></button></div>' + tabs;
            bindWechatTabs();
            return;
        }
        if (tab === 'moments') {
            view.innerHTML = '<div style="height:calc(100% - 52px);overflow:auto;background:#fff;">' +
                moments.map(function (m, i) {
                    return '<article style="display:grid;grid-template-columns:44px 1fr;gap:10px;border-bottom:1px solid #eee;background:#fff;padding:12px;"><div style="width:40px;height:40px;border-radius:6px;background:#f4f4f4;display:grid;place-items:center;font-size:22px;">' + (m.avatar || '👤') + '</div><div><strong style="color:#596b8d;font-size:15px;">' + m.author + '</strong><p style="margin:5px 0 8px;color:#111;font-size:15px;">' + m.text + '</p><small style="color:#aaa;">刚刚</small><button data-like="' + i + '" style="float:right;border:0;background:#f6f6f6;border-radius:4px;padding:2px 8px;">' + (m.liked ? '已赞' : '♡') + '</button><button data-comment="' + i + '" style="float:right;border:0;background:#f6f6f6;border-radius:4px;padding:2px 8px;margin-right:4px;">评论</button><div style="clear:both;margin-top:8px;background:#f3f3f3;border-radius:4px;padding:6px;color:#596b8d;">' + (m.liked ? '<div>我 觉得很赞</div>' : '') + m.comments.map(function (c) { return '<div><b>我：</b>' + c + '</div>'; }).join('') + '</div></div></article>';
                }).join('') + '</div>' + tabs;
            bindWechatTabs();
            Array.prototype.forEach.call(view.querySelectorAll('[data-like]'), function (button) {
                button.addEventListener('click', function () {
                    moments[Number(button.dataset.like)].liked = !moments[Number(button.dataset.like)].liked;
                    savePhoneStatePatch({ moments: moments });
                    addCorePhoneEvent('phone_moments', 'moment_like', 'user', moments[Number(button.dataset.like)].author, '点赞朋友圈：' + moments[Number(button.dataset.like)].text, { public: true, char: false });
                    renderFallbackWechat('moments');
                });
            });
            Array.prototype.forEach.call(view.querySelectorAll('[data-comment]'), function (button) {
                button.addEventListener('click', function () {
                    var text = prompt('评论内容（只保存在手机内）：');
                    if (!text) return;
                    moments[Number(button.dataset.comment)].comments.push(text);
                    savePhoneStatePatch({ moments: moments });
                    addCorePhoneEvent('phone_moments', 'moment_comment', 'user', moments[Number(button.dataset.comment)].author, '评论朋友圈：' + text, { public: true, char: false });
                    renderFallbackWechat('moments');
                });
            });
            return;
        }
        view.innerHTML = '<div style="height:calc(100% - 104px);display:flex;flex-direction:column;gap:10px;overflow:auto;background:#ededed;padding:12px;">' +
            chat.map(function (m) { return '<div style="align-self:' + (m.sender === 'npc' ? 'flex-start' : 'flex-end') + ';display:flex;gap:8px;max-width:90%;"><span style="order:' + (m.sender === 'npc' ? 0 : 2) + ';width:30px;height:30px;border-radius:4px;background:#fff;display:grid;place-items:center;">' + (m.sender === 'npc' ? '👤' : '我') + '</span><span style="background:' + (m.sender === 'npc' ? '#fff' : '#95ec69') + ';border-radius:6px;padding:8px 10px;color:#111;text-align:left;">' + escapeHtml(m.text || m.content || '') + '</span></div>'; }).join('') +
            '</div><form id="stp-demo-chat-form" autocomplete="off" style="height:52px;display:flex;gap:8px;background:#f7f7f7;padding:8px;box-sizing:border-box;"><button type="button">🎙</button><input name="msg" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="" style="flex:1;border:0;border-radius:4px;padding:8px;background:#fff;"><button type="button">😊</button><button>＋</button></form>' + tabs;
        bindWechatTabs();
        document.getElementById('stp-demo-chat-form').addEventListener('submit', function (event) {
            event.preventDefault();
            var text = event.target.msg.value.trim();
            if (!text) return;
            event.target.msg.value = '';
            chat.push({ sender: 'user', text: text, at: Date.now() });
            fallbackState.chats.char = chat;
            savePhoneStatePatch({ chats: fallbackState.chats });
            addCorePhoneEvent('phone_wechat', 'wechat_message', 'user', 'char', text, { char: true, npcs: [] });
            renderFallbackWechat('chat');
        });
    }

    function bindWechatTabs() {
        Array.prototype.forEach.call(document.querySelectorAll('[data-stp-wx-tab]'), function (button) {
            button.addEventListener('click', function () { renderFallbackWechat(button.dataset.stpWxTab); });
        });
    }

    function renderFallbackForum() {
        var view = fallbackContent();
        var fallbackState = getPhoneState();
        var posts = fallbackState.forumPosts || [];
        view.innerHTML = '<div style="height:46px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 12px;font-weight:800;border-bottom:1px solid #e8e8e8;"><span style="color:#1f3f73;">论坛</span><button id="stp-forum-refresh">刷新</button></div><div style="height:calc(100% - 46px);overflow:auto;background:#f2f3f5;">' + posts.map(function (p, i) {
            return '<article style="background:#fff;border-bottom:8px solid #f2f3f5;padding:12px;"><strong style="font-size:16px;color:#1f3f73;">' + p.title + '</strong><p style="color:#222;">' + p.body + '</p>' + p.floors.map(function (f) { return '<div style="border-top:1px solid #eee;padding:8px 0;color:#333;">' + f + '</div>'; }).join('') + '<button data-floor="' + i + '">回复楼层</button></article>';
        }).join('') + '</div>';
        document.getElementById('stp-forum-refresh').addEventListener('click', function () {
            posts.unshift({ title: '新的讨论串正在生成…', body: getApiConfigured() ? '已请求扩展 API。' : '后台生成接口未接入，显示本地占位。', floors: ['1L：先观察，不要默认全员知道。'] });
            savePhoneStatePatch({ forumPosts: posts });
            addCorePhoneEvent('phone_forum', 'forum_refresh', 'system', null, posts[0].title, { public: true });
            renderFallbackForum();
        });
        Array.prototype.forEach.call(view.querySelectorAll('[data-floor]'), function (button) {
            button.addEventListener('click', function () {
                var text = prompt('回复内容（只在论坛内）：');
                if (!text) return;
                var post = posts[Number(button.dataset.floor)];
                post.floors.push((post.floors.length + 1) + 'L：' + text);
                savePhoneStatePatch({ forumPosts: posts });
                addCorePhoneEvent('phone_forum', 'forum_reply', 'user', post.title, text, { public: true });
                renderFallbackForum();
            });
        });
    }

    function renderMemoApp() {
        var view = fallbackContent();
        var fallbackState = getPhoneState();
        var memos = fallbackState.memos || [];
        view.innerHTML = '<div style="height:100%;overflow:auto;background:#f7f2df;padding:14px;color:#111;box-sizing:border-box;"><div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:28px;">备忘录</strong><span>📝</span></div><form id="stp-demo-memo-form" style="display:flex;gap:6px;margin:12px 0;"><input name="memo" placeholder="保存线索..." style="flex:1;border:0;border-radius:10px;padding:10px;background:#fffdf5;"><button style="border:0;background:#ffd84d;border-radius:10px;padding:0 12px;">保存</button></form>' + memos.map(function (m) { return '<p style="background:#fffdf5;border-radius:12px;padding:12px;box-shadow:0 1px 0 rgba(0,0,0,.06);">' + m + '</p>'; }).join('') + '</div>';
        document.getElementById('stp-demo-memo-form').addEventListener('submit', function (event) {
            event.preventDefault();
            var text = event.target.memo.value.trim();
            if (!text) return;
            memos.unshift(text);
            savePhoneStatePatch({ memos: memos });
            addCorePhoneEvent('phone_memo', 'memo_add', 'user', null, text, { user: true });
            renderMemoApp();
        });
    }

    function renderSimpleApp(title, body) {
        var view = fallbackContent();
        if (view) view.innerHTML = '<div style="height:100%;overflow:auto;background:#fff;padding:18px;box-sizing:border-box;color:#111;"><strong style="font-size:24px;">' + title + '</strong><p>' + body + '</p></div>';
    }

    function getApiConfigured() {
        return Boolean(localStorage.getItem('st_story_phone_api_endpoint'));
    }

    function normalizeChatHistory(history) {
        return history.map(function (message) {
            if (typeof message === 'string') return { sender: 'user', text: message, at: Date.now() };
            return {
                sender: message.sender === 'user' ? 'user' : 'npc',
                text: message.text || message.content || '',
                at: message.at || Date.now(),
            };
        });
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, function (char) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
    }

    function getPhoneState() {
        if (coreInstance?.state?.phone) return coreInstance.state.phone;
        return {
            chats: { char: [{ sender: 'npc', text: '这里是手机内消息，不会直接进入主聊天。', at: Date.now() }] },
            moments: [
                { id: 'm1', author: '同学A', avatar: '🌿', text: '今天走廊那边好像有点热闹。', liked: false, comments: [] },
                { id: 'm2', author: '社团号', avatar: '📷', text: '下午活动室开放，借器材记得登记。', liked: true, comments: ['收到'] },
            ],
            forumPosts: [
                { id: 'f1', title: '今天教学楼侧门是不是临时锁了？', body: '有人知道原因吗？别乱传，可能只是后勤维修。', floors: ['1L：我也看到了。', '2L：别上升，等通知吧。'] },
            ],
            memos: [],
            calendar: [],
        };
    }

    function savePhoneStatePatch(patch) {
        if (!coreInstance?.state?.phone) return;
        Object.assign(coreInstance.state.phone, patch);
        coreInstance.save();
    }

    function addCorePhoneEvent(source, type, actor, target, content, visibility) {
        getCore().then(function (core) {
            if (!core) return;
            core.addEvent({ source: source, type: type, actor: actor, target: target, content: content, visibility: visibility });
        });
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
        panel.innerHTML = [
            'ST-StoryPhone launcher loaded. 如果主页面没有 Phone 气泡，请点这里：',
            '<button id="st-story-phone-force-bubble" type="button">显示/打开 Phone</button>',
            '<details style="margin-top:8px;"><summary>StoryPhone API 设置</summary>',
            '<label style="display:block;margin-top:6px;">API URL（OpenAI 兼容可填 base URL 或 /v1/chat/completions）</label>',
            '<input id="st-story-phone-api-endpoint" autocomplete="off" placeholder="例如 http://127.0.0.1:5100/v1" style="width:100%;box-sizing:border-box;border:2px solid #71cfff;border-radius:8px;padding:6px;">',
            '<label style="display:block;margin-top:6px;">API Key（可选，只保存在本地浏览器）</label>',
            '<input id="st-story-phone-api-key" type="password" autocomplete="off" placeholder="sk-..." style="width:100%;box-sizing:border-box;border:2px solid #71cfff;border-radius:8px;padding:6px;">',
            '<label style="display:block;margin-top:6px;">模型名（OpenAI 兼容接口需要）</label>',
            '<input id="st-story-phone-api-model" autocomplete="off" placeholder="例如 gpt-4.1-mini / claude..." style="width:100%;box-sizing:border-box;border:2px solid #71cfff;border-radius:8px;padding:6px;">',
            '<button id="st-story-phone-api-save" type="button" style="margin-top:6px;">保存 API 设置</button> ',
            '<button id="st-story-phone-api-test" type="button" style="margin-top:6px;">测试连接</button>',
            '<p id="st-story-phone-api-status" style="font-size:12px;margin:.4em 0;">不填写时只用本地手机交互；填写后才会把可见上下文发送到你配置的接口。</p>',
            '</details>',
        ].join('');
        host.prepend(panel);

        var force = document.getElementById('st-story-phone-force-bubble');
        if (force) {
            force.addEventListener('click', function () {
                makeBubble();
                makeFallbackPhone();
                showToast('Phone 已放到左上角');
            });
        }
        var endpointInput = document.getElementById('st-story-phone-api-endpoint');
        var keyInput = document.getElementById('st-story-phone-api-key');
        var modelInput = document.getElementById('st-story-phone-api-model');
        var saveApi = document.getElementById('st-story-phone-api-save');
        var testApi = document.getElementById('st-story-phone-api-test');
        var apiStatus = document.getElementById('st-story-phone-api-status');
        if (endpointInput) endpointInput.value = localStorage.getItem('st_story_phone_api_endpoint') || '';
        if (keyInput) keyInput.value = localStorage.getItem('st_story_phone_api_key') || '';
        if (modelInput) modelInput.value = localStorage.getItem('st_story_phone_api_model') || '';
        if (saveApi) {
            saveApi.addEventListener('click', function () {
                var settings = {
                    endpoint: endpointInput.value.trim(),
                    key: keyInput.value.trim(),
                    model: modelInput.value.trim(),
                };
                localStorage.setItem('st_story_phone_api_endpoint', settings.endpoint);
                localStorage.setItem('st_story_phone_api_key', settings.key);
                localStorage.setItem('st_story_phone_api_model', settings.model);
                getCore().then(function (core) {
                    if (core?.setApiSettings) core.setApiSettings(settings);
                });
                showToast(settings.endpoint ? 'StoryPhone API 已保存' : 'StoryPhone API 已关闭');
            });
        }
        if (testApi) {
            testApi.addEventListener('click', function () {
                apiStatus.textContent = '正在测试 API...';
                var settings = {
                    endpoint: endpointInput.value.trim(),
                    key: keyInput.value.trim(),
                    model: modelInput.value.trim(),
                };
                getCore().then(function (core) {
                    if (!core?.testApiConnection) throw new Error('核心模块未加载');
                    core.setApiSettings(settings);
                    return core.testApiConnection();
                }).then(function (result) {
                    apiStatus.textContent = result.message;
                    showToast(result.message);
                }).catch(function (error) {
                    apiStatus.textContent = 'API 测试失败：' + error.message;
                    showToast('API 测试失败');
                });
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
        import(APP_SCRIPT + '?v=' + EXTENSION_VERSION).then(function () {
            showToast('ST-StoryPhone 已打开');
            var launcher = document.getElementById('st-story-phone-launcher');
            if (launcher) launcher.remove();
            setTimeout(function () {
                if (!document.getElementById('st-story-phone') && !window.STStoryPhoneDebug) {
                    makeFallbackPhone();
                    showToast('完整手机未挂载，已打开最小手机面板');
                }
            }, 1200);
        }).catch(function (error) {
            window.__STStoryPhoneAppLoaded = false;
            console.error('ST-StoryPhone full app failed to load:', error);
            showToast('手机主体加载失败，但气泡已工作。请看控制台错误。');
        });
    }

    ready(function () {
        window.STStoryPhoneLauncher = {
            load: loadFullApp,
            bubble: makeBubble,
            fallback: makeFallbackPhone,
            diagnostics: mountDiagnosticsPanel,
            core: function () { return coreInstance; },
            version: EXTENSION_VERSION,
        };
        document.addEventListener('click', function (event) {
            if (event.target?.closest?.('#st-story-phone-launcher')) {
                event.preventDefault();
                event.stopPropagation();
                openPhone();
            }
        }, true);
        makeBubble();
        try {
            mountDiagnosticsPanel();
            setInterval(mountDiagnosticsPanel, 2000);
        } catch (error) {
            console.warn('ST-StoryPhone diagnostics panel failed', error);
        }
        getCore().then(function (core) {
            if (!core) return;
            import(BRIDGE_SCRIPT + '?v=' + EXTENSION_VERSION).then(function (bridge) {
                bridge.installGenerateInterceptor(function (speakerId) {
                    return core.mainContextSummary(speakerId);
                });
            });
        });
        console.info(EXTENSION_ID + ' launcher loaded');
    });
})();
