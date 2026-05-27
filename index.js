/* global SillyTavern */

const EXTENSION_ID = 'ST-StoryPhone';
const EXTENSION_ALIAS = 'ST-PhoningPhone';
const STORAGE_PREFIX = 'st_story_phone';

const DEFAULT_PROFILE = {
    id: 'default',
    displayName: 'Default Story Phone',
    targetPhoneOwner: '{{char}}',
    phoneOwnerLabel: '目标角色',
    theme: 'phoning_y2k',
    friends: [
        { id: 'best_friend', name: '好友', role: '普通好友', visibility: 'public', knows: [], doesNotKnow: [], relations: [] },
        { id: 'classmate', name: '同学', role: '同班同学', visibility: 'public', knows: [], doesNotKnow: [], relations: [] },
    ],
    currentChar: {
        id: 'char',
        name: '{{char}}',
        knows: [],
        doesNotKnow: [],
    },
    publicChannels: [
        { id: 'forum', name: '论坛', audience: 'profiled_forum_readers' },
        { id: 'moments', name: '朋友圈', audience: 'configured_visibility' },
    ],
    phoneApps: ['wechat', 'moments', 'forum', 'calendar', 'memo', 'target_phone'],
    forum: {
        name: '论坛',
        tone: '真实克制，不狗血，不全校磕CP',
        defaultBoard: '校园生活',
    },
    calendar: {
        futureThreads: [],
    },
    visibilityDefaults: {
        phoneEvents: 'user_only',
        forumPosts: 'public',
        moments: 'public',
        npcChats: 'visible_to_npc',
        targetPhone: 'visible_to_char',
    },
};

const EVENT_SOURCES = {
    MAIN_CHAT: 'main_chat',
    WECHAT: 'phone_wechat',
    MOMENTS: 'phone_moments',
    FORUM: 'phone_forum',
    CALENDAR: 'phone_calendar',
    MEMO: 'phone_memo',
    TARGET_PHONE: 'target_phone',
};

const TASK_LABELS = {
    moments: '朋友圈',
    forum: '论坛',
    npc_chat: '微信聊天',
    target_phone: '查看目标角色手机',
    delayed_reply: '延迟回复',
};

function nowIso() {
    return new Date().toISOString();
}

function safeJsonParse(text, fallback) {
    try {
        return JSON.parse(text);
    } catch {
        return fallback;
    }
}

function clampText(text, max = 1200) {
    if (!text) return '';
    const value = String(text);
    return value.length > max ? `${value.slice(0, max)}...` : value;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function uniqueArray(values) {
    return [...new Set(asArray(values).filter(Boolean))];
}

function normalizeSpeakerId(id) {
    if (!id) return 'user';
    const value = String(id);
    if (value === 'character') return 'char';
    return value;
}

function plainText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
}

function normalizeVisibility(input, fallback = {}) {
    if (typeof input === 'object' && input !== null && 'system' in input) {
        return {
            system: true,
            user: Boolean(input.user),
            char: Boolean(input.char),
            npcs: uniqueArray(input.npcs),
            public: Boolean(input.public),
        };
    }

    const visibility = typeof input === 'string' ? input : fallback.visibility || 'user_only';
    const actorId = fallback.actorId || fallback.actor || null;
    const targetId = fallback.targetId || fallback.target || null;
    const npcs = uniqueArray([fallback.npcId, actorId, targetId].filter((id) => id && id !== 'user' && id !== 'char' && id !== 'system'));
    const isChar = actorId === 'char' || targetId === 'char' || fallback.isChar;

    if (visibility === 'public') return { system: true, user: true, char: true, npcs, public: true };
    if (visibility === 'system_only') return { system: true, user: false, char: false, npcs: [], public: false };
    if (visibility === 'visible_to_char') return { system: true, user: Boolean(fallback.user ?? true), char: true, npcs: [], public: false };
    if (visibility === 'visible_to_npc') return { system: true, user: Boolean(fallback.user ?? true), char: Boolean(isChar), npcs, public: false };
    return { system: true, user: Boolean(fallback.user ?? true), char: false, npcs: [], public: false };
}

function visibilityToLegacyLabel(visibility) {
    if (!visibility) return 'user_only';
    if (visibility.public) return 'public';
    if (visibility.char && !visibility.npcs?.length) return 'visible_to_char';
    if (visibility.npcs?.length && !visibility.public) return 'visible_to_npc';
    if (visibility.user) return 'user_only';
    return 'system_only';
}

function isVisibleToSpeaker(event, speakerId) {
    const id = normalizeSpeakerId(speakerId);
    const visibility = normalizeVisibility(event?.visibility);
    if (id === 'system') return true;
    if (id === 'user') return visibility.user;
    if (id === 'char') return visibility.char || visibility.public;
    return visibility.public || visibility.npcs.includes(id);
}

function contentNeedles(text) {
    return plainText(text)
        .replace(/\s+/g, ' ')
        .split(/[。！？!?；;，,\n]/)
        .map((part) => part.trim())
        .filter((part) => part.length >= 8)
        .slice(0, 20);
}

function getContext() {
    if (!globalThis.SillyTavern?.getContext) return {};
    return globalThis.SillyTavern.getContext() || {};
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

class StorageManager {
    constructor() {
        this.memory = {};
    }

    getKey(scope) {
        return `${STORAGE_PREFIX}:${scope || 'global'}`;
    }

    load(scope, fallback) {
        const key = this.getKey(scope);
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return structuredClone(fallback);
            return { ...structuredClone(fallback), ...safeJsonParse(raw, fallback) };
        } catch {
            return this.memory[key] || structuredClone(fallback);
        }
    }

    save(scope, value) {
        const key = this.getKey(scope);
        this.memory[key] = value;
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch {
            // localStorage may be unavailable in hardened WebViews; in-memory storage keeps the session usable.
        }
    }
}

class ContextCollector {
    collect() {
        const context = getContext();
        const character = this.getCurrentCharacter(context);
        const chat = asArray(context.chat);
        return {
            character,
            characterSummary: this.summarizeCharacter(character, context),
            worldInfoSummary: this.summarizeWorldInfo(context),
            recentHistory: this.summarizeHistory(chat),
            persona: this.summarizePersona(context),
            status: this.summarizeStatus(context),
            chatId: this.getChatId(context, character),
        };
    }

    getCurrentCharacter(context) {
        const id = context.characterId ?? context.character_id ?? context.chid;
        const characters = context.characters || {};
        if (Array.isArray(characters)) return characters[id] || {};
        return characters[id] || context.character || {};
    }

    getChatId(context, character) {
        return [
            context.chatId || context.chat_id || context.chatMetadata?.file_name || 'chat',
            character?.avatar || character?.name || context.name2 || 'character',
        ].join('::');
    }

    summarizeCharacter(character, context) {
        return {
            id: String(context.characterId ?? context.character_id ?? context.chid ?? character?.id ?? 'char'),
            name: character?.name || context.name2 || '当前角色',
            description: clampText(character?.description || character?.data?.description || ''),
            personality: clampText(character?.personality || character?.data?.personality || ''),
            scenario: clampText(character?.scenario || character?.data?.scenario || ''),
            extensions: character?.extensions || character?.data?.extensions || {},
        };
    }

    summarizeWorldInfo(context) {
        const names = context.world_names || context.worldInfo?.selectedWorlds || context.worldInfoSettings?.world_info || [];
        const entries = context.worldInfo?.entries || context.world_info?.entries || [];
        return {
            worlds: asArray(names).slice(0, 12),
            activeEntries: asArray(entries).slice(0, 20).map((entry) => ({
                key: clampText(entry.key || entry.keys || entry.comment || '', 160),
                content: clampText(entry.content || entry.entry || '', 400),
            })),
        };
    }

    summarizeHistory(chat) {
        return chat.slice(-18).map((message) => ({
            name: message.name || (message.is_user ? 'User' : 'Character'),
            role: message.is_system ? 'system' : message.is_user ? 'user' : 'assistant',
            text: clampText(message.mes || message.text || '', 500),
        }));
    }

    summarizePersona(context) {
        const persona = context.power_user?.persona || context.persona || {};
        return {
            name: context.name1 || persona.name || '用户',
            description: clampText(persona.description || context.persona_description || context.power_user?.persona_description || ''),
        };
    }

    summarizeStatus(context) {
        return {
            chatName: context.chat?.name || context.chatMetadata?.name || '',
            mainApi: context.main_api || context.extensionSettings?.main_api || '',
            model: context.chatCompletionSettings?.model || context.textgenerationwebui_settings?.model || '',
        };
    }
}

class KnowledgeTimelineAuditor {
    constructor(state) {
        this.state = state;
    }

    get profile() {
        return this.state.profile || DEFAULT_PROFILE;
    }

    get storyClock() {
        return this.state.storyClock || { storyDay: this.state.time || '未设定', timeText: '', orderIndex: 0 };
    }

    getNpcProfile(speakerId) {
        const id = normalizeSpeakerId(speakerId);
        if (id === 'char') return this.profile.currentChar || {};
        return asArray(this.profile.friends).find((friend) => friend.id === id || friend.name === id) || {};
    }

    canSee(event, speakerId) {
        return isVisibleToSpeaker(event, speakerId);
    }

    eventToFact(event) {
        return {
            id: event.id,
            source: event.source,
            type: event.type,
            actor: event.actor,
            target: event.target,
            content: event.content,
            timestamp: event.timestamp,
            consequences: event.consequences || [],
            status: event.status,
            injectToMain: event.injectToMain,
        };
    }

    buildContextForSpeaker(speakerId) {
        const id = normalizeSpeakerId(speakerId);
        const allEvents = asArray(this.state.eventLog);
        const visible = allEvents.filter((event) => this.canSee(event, id));
        const hidden = allEvents.filter((event) => !this.canSee(event, id));
        const facts = asArray(this.state.knowledgeGraph);
        const visibleFacts = facts.filter((fact) => this.canSee(fact, id));
        const hiddenFacts = facts.filter((fact) => !this.canSee(fact, id));
        const speakerProfile = this.getNpcProfile(id);

        return {
            speakerId: id,
            speakerProfile,
            storyClock: this.storyClock,
            visibleMainEvents: visible.filter((event) => event.source === EVENT_SOURCES.MAIN_CHAT).map((event) => this.eventToFact(event)),
            visiblePhoneEvents: visible.filter((event) => event.source !== EVENT_SOURCES.MAIN_CHAT).map((event) => this.eventToFact(event)),
            knownFacts: [
                ...visibleFacts,
                ...asArray(speakerProfile.knows).map((fact) => ({ source: 'profile.knows', content: fact, visibility: normalizeVisibility('public') })),
            ],
            unknownFacts: asArray(speakerProfile.doesNotKnow).map((fact) => ({ source: 'profile.doesNotKnow', content: fact })),
            forbiddenFacts: [
                ...hidden.map((event) => ({
                    id: event.id,
                    source: event.source,
                    type: event.type,
                    content: event.content,
                    reason: 'speaker_visibility_boundary',
                })),
                ...hiddenFacts.map((fact) => ({
                    id: fact.id,
                    source: 'knowledgeGraph',
                    type: fact.type || 'fact',
                    content: fact.content || fact.summary || plainText(fact),
                    reason: 'fact_visibility_boundary',
                })),
                ...asArray(speakerProfile.doesNotKnow).map((fact) => ({
                    source: 'profile.doesNotKnow',
                    type: 'npc_scope_error',
                    content: fact,
                    reason: 'profile_explicit_unknown',
                })),
            ],
        };
    }

    resolveVisibleContext(speakerId) {
        return this.buildContextForSpeaker(speakerId);
    }

    buildPromptWithVisibilityBoundary(speakerId, taskType, payload = {}) {
        const context = this.resolveVisibleContext(speakerId);
        return [
            '【Knowledge & Timeline Consistency Boundary】',
            `speakerId: ${context.speakerId}`,
            `taskType: ${taskType}`,
            `当前剧情时间: ${JSON.stringify(context.storyClock)}`,
            `当前事件顺序 orderIndex: ${context.storyClock.orderIndex}`,
            `当前请求: ${JSON.stringify(payload)}`,
            '规则：模型只能使用【该角色可见信息】。禁止把【禁止提及的信息】当成角色知道的内容。',
            '规则：system 可以知道全部，但 speaker 不能引用没有合法传播链的信息。',
            '规则：不得提前泄露未来事件，不得让 NPC 在事件发生前知道结果。',
            '规则：system_only/user_only/其他NPC私聊不能被 speaker 直接提及，除非可见信息中已有明确传播链。',
            `【该角色可见主对话事件】${JSON.stringify(context.visibleMainEvents.slice(-20))}`,
            `【该角色可见手机事件】${JSON.stringify(context.visiblePhoneEvents.slice(-20))}`,
            `【该角色知道的信息】${JSON.stringify(context.knownFacts.slice(-30))}`,
            `【该角色不知道的信息】${JSON.stringify(context.unknownFacts.slice(-30))}`,
            `【禁止提及的信息】${JSON.stringify(context.forbiddenFacts.slice(-30))}`,
        ].join('\n');
    }

    auditKnowledgeConsistency(generatedContent, speakerId, context = this.buildContextForSpeaker(speakerId)) {
        const text = plainText(generatedContent);
        const issues = [];
        const clock = this.storyClock;

        context.forbiddenFacts.forEach((fact) => {
            contentNeedles(fact.content).forEach((needle) => {
                if (needle && text.includes(needle)) {
                    issues.push({
                        type: fact.type === 'npc_scope_error' ? 'npc_scope_error' : 'forbidden_knowledge',
                        detail: `speaker ${context.speakerId} 提到了不可见信息：${clampText(needle, 120)}`,
                        suggestedFix: '删除该信息，或改写为角色只基于自己可见事实做出的模糊反应。',
                    });
                }
            });
        });

        const futureEvents = asArray(this.state.eventLog).filter((event) => {
            const order = Number(event.timestamp?.orderIndex ?? 0);
            return order > Number(clock.orderIndex ?? 0) && text.includes(clampText(event.content, 80));
        });
        futureEvents.forEach((event) => {
            issues.push({
                type: 'timeline_error',
                detail: `生成内容引用了未来事件：${event.id}`,
                suggestedFix: '移除未来结果，只保留当前时间点已经发生或合理预期的信息。',
            });
        });

        if (/system_only|系统全局信息|禁止提及的信息/.test(text)) {
            issues.push({
                type: 'visibility_error',
                detail: '生成内容泄露了边界提示或 system_only 标记。',
                suggestedFix: '用角色自然语言重写，不暴露系统标签、审计字段或隐藏摘要。',
            });
        }

        return {
            ok: issues.length === 0,
            issues,
            safeContentSuggestion: issues.length
                ? '请只根据可见信息重写，避开禁止事实、未来事件和系统边界标签。'
                : null,
        };
    }

    summarizeForMainChat(speakerId = 'char') {
        const context = this.buildContextForSpeaker(speakerId);
        const visibleEvents = context.visiblePhoneEvents
            .filter((event) => event.status !== 'expired' && event.injectToMain !== false)
            .slice(-12)
            .map((event) => `- [${event.source}/${event.type}] ${event.content}`);
        const forbidden = context.forbiddenFacts.slice(-12).map((fact) => `- ${clampText(fact.content, 140)}`);

        if (!visibleEvents.length && !forbidden.length) return '';
        return [
            '[StoryPhone hidden speaker-filtered context]',
            `当前主对话 speaker=${speakerId}。只能使用该 speaker 合理可见的信息。`,
            '【speaker 可见手机事件】',
            ...visibleEvents,
            '【speaker 禁止知道/禁止提及】',
            ...forbidden,
            '不要让 speaker 提及 forbiddenFacts；不要把其他NPC私聊、user_only、system_only 当成已知事实。',
        ].join('\n');
    }
}

class VisibilityManager extends KnowledgeTimelineAuditor {}

class SharedStoryState {
    constructor(storage, scope) {
        this.storage = storage;
        this.scope = scope;
        this.data = storage.load(scope, this.createDefault());
        this.migrate();
    }

    createDefault() {
        return {
            version: 1,
            time: '',
            location: '',
            phase: '',
            storyClock: {
                storyDay: '未设定',
                timeText: '未设定',
                orderIndex: 0,
            },
            relationship: {},
            mainEvents: [],
            phoneEvents: [],
            eventLog: [],
            pendingEvents: [],
            knowledgeGraph: [],
            phone: {
                chats: {},
                moments: [],
                forumPosts: [],
                calendar: [],
                memos: [],
                targetPhone: {
                    messages: [],
                    memos: [],
                    calendar: [],
                },
            },
            settings: {
                fallbackEnabled: false,
                injectIntoMainContext: true,
                minimized: false,
            },
            profile: DEFAULT_PROFILE,
        };
    }

    get value() {
        return this.data;
    }

    save() {
        this.storage.save(this.scope, this.data);
    }

    migrate() {
        const defaults = this.createDefault();
        this.data.storyClock = this.data.storyClock || defaults.storyClock;
        this.data.eventLog = asArray(this.data.eventLog);
        this.data.pendingEvents = asArray(this.data.pendingEvents);
        this.data.phoneEvents = asArray(this.data.phoneEvents);
        this.data.mainEvents = asArray(this.data.mainEvents);
        this.data.knowledgeGraph = asArray(this.data.knowledgeGraph);
        this.data.settings = { ...defaults.settings, ...(this.data.settings || {}) };
        this.data.phone = { ...defaults.phone, ...(this.data.phone || {}) };
        this.data.profile = { ...DEFAULT_PROFILE, ...(this.data.profile || {}) };
        if (!this.data.storyClock.storyDay && this.data.time) this.data.storyClock.storyDay = this.data.time;
        this.save();
    }

    setProfile(profile) {
        const merged = { ...DEFAULT_PROFILE, ...(profile || {}) };
        merged.friends = asArray(merged.friends).map((friend) => ({
            knows: [],
            doesNotKnow: [],
            relations: [],
            ...friend,
        }));
        this.data.profile = merged;
        this.save();
    }

    nextTimestamp() {
        const next = {
            storyDay: this.data.storyClock?.storyDay || this.data.time || '未设定',
            timeText: this.data.storyClock?.timeText || this.data.time || '未设定',
            orderIndex: Number(this.data.storyClock?.orderIndex || 0) + 1,
        };
        this.data.storyClock = next;
        this.data.time = [next.storyDay, next.timeText].filter(Boolean).join(' ');
        return { ...next };
    }

    createEvent(event) {
        const timestamp = event.timestamp || this.nextTimestamp();
        const visibility = normalizeVisibility(event.visibility, event);
        return {
            id: event.id || `event_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            source: event.source || EVENT_SOURCES.MAIN_CHAT,
            type: event.type || 'event',
            actor: event.actor || 'system',
            target: event.target ?? null,
            content: clampText(event.content || event.summary || event.title || '', 1800),
            timestamp,
            visibility,
            consequences: asArray(event.consequences),
            status: event.status || 'active',
            injectToMain: event.injectToMain,
            meta: event.meta || {},
        };
    }

    addEvent(event) {
        const next = this.createEvent(event);
        this.data.eventLog.push(next);
        if (next.source === EVENT_SOURCES.MAIN_CHAT) this.data.mainEvents.push(next);
        this.save();
        return next;
    }

    addPendingEvent(event, trigger = {}) {
        const pending = this.createEvent({ ...event, status: 'pending' });
        this.data.pendingEvents.push({
            ...pending,
            trigger: {
                afterTurns: Number(trigger.afterTurns || 0),
                afterTime: trigger.afterTime || null,
                triggerWhen: trigger.triggerWhen || null,
            },
        });
        this.save();
        return pending;
    }

    resolvePendingEvents(reason = '') {
        const currentOrder = Number(this.data.storyClock?.orderIndex || 0);
        const activated = [];
        this.data.pendingEvents = this.data.pendingEvents.filter((event) => {
            const trigger = event.trigger || {};
            const baseOrder = Number(event.timestamp?.orderIndex || 0);
            const afterTurnsMet = trigger.afterTurns ? currentOrder - baseOrder >= Number(trigger.afterTurns) : false;
            const triggerTextMet = trigger.triggerWhen ? reason.includes(trigger.triggerWhen) : false;
            // TODO: SillyTavern does not expose a canonical story-time parser here; afterTime is kept as testable metadata.
            const afterTimeMet = false;
            if (!afterTurnsMet && !triggerTextMet && !afterTimeMet) return true;
            activated.push({ ...event, status: 'active', timestamp: this.nextTimestamp() });
            return false;
        });
        activated.forEach((event) => this.data.eventLog.push(event));
        this.save();
        return activated;
    }

    getCharId() {
        return this.data.profile?.currentChar?.id || 'char';
    }

    isCharId(idOrName) {
        const value = String(idOrName || '');
        const currentChar = this.data.profile?.currentChar || {};
        return value === 'char' || value === currentChar.id || value === currentChar.name || value === this.data.profile?.targetPhoneOwner;
    }

    addPhoneEvent(event) {
        const source = event.source || EVENT_SOURCES.WECHAT;
        const actor = event.actor || event.actorId || 'user';
        const target = event.target ?? event.targetId ?? null;
        const isChar = this.isCharId(actor) || this.isCharId(target);
        const normalizedVisibility = normalizeVisibility(event.visibility, {
            ...event,
            actorId: actor,
            targetId: isChar ? 'char' : target,
            isChar,
        });
        const logged = this.addEvent({
            ...event,
            source,
            actor,
            target: isChar ? 'char' : target,
            content: event.content || event.summary || event.title || '',
            visibility: normalizedVisibility,
        });
        const next = {
            id: logged.id,
            at: nowIso(),
            ...event,
            visibility: visibilityToLegacyLabel(logged.visibility),
            summary: event.summary || logged.content,
            eventId: logged.id,
        };
        this.data.phoneEvents.push(next);
        this.save();
        return next;
    }

    addKnowledge(fact) {
        this.data.knowledgeGraph.push({
            id: `fact_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            at: nowIso(),
            visibility: 'user_only',
            ...fact,
        });
        this.save();
    }

    upsertCalendar(item) {
        const entry = { id: item.id || `cal_${Date.now()}`, ...item };
        const index = this.data.phone.calendar.findIndex((existing) => existing.id === entry.id);
        if (index >= 0) this.data.phone.calendar[index] = entry;
        else this.data.phone.calendar.push(entry);
        this.addPhoneEvent({ source: EVENT_SOURCES.CALENDAR, type: 'calendar_edit', actor: 'user', summary: `日历更新：${entry.title}`, visibility: 'user_only' });
        this.save();
    }

    addMemo(text) {
        const memo = { id: `memo_${Date.now()}`, text, at: nowIso(), visibility: 'user_only' };
        this.data.phone.memos.unshift(memo);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, type: 'memo_add', actor: 'user', summary: `新增备忘录：${clampText(text, 80)}`, visibility: 'user_only' });
        this.save();
        return memo;
    }

    deleteMemo(id) {
        this.data.phone.memos = this.data.phone.memos.filter((memo) => memo.id !== id);
        this.addPhoneEvent({ source: EVENT_SOURCES.MEMO, type: 'memo_delete', actor: 'user', summary: '删除了一条备忘录', visibility: 'user_only' });
        this.save();
    }
}

class ProfileManager {
    constructor(state) {
        this.state = state;
    }

    resolve(collected) {
        const extensions = collected.characterSummary?.extensions || {};
        const profile = extensions[EXTENSION_ID] || extensions[EXTENSION_ALIAS] || this.state.value.profile || DEFAULT_PROFILE;
        const charName = collected.characterSummary?.name || '当前角色';
        const resolved = JSON.parse(JSON.stringify({ ...DEFAULT_PROFILE, ...profile }));
        resolved.targetPhoneOwner = String(resolved.targetPhoneOwner || '{{char}}').replaceAll('{{char}}', charName);
        resolved.currentChar = {
            ...DEFAULT_PROFILE.currentChar,
            ...(resolved.currentChar || {}),
            id: resolved.currentChar?.id || 'char',
            name: String(resolved.currentChar?.name || '{{char}}').replaceAll('{{char}}', charName),
        };
        this.state.setProfile(resolved);
        return resolved;
    }

    importJson(text) {
        const profile = safeJsonParse(text, null);
        if (!profile || typeof profile !== 'object') throw new Error('Profile JSON 格式无效');
        this.state.setProfile({ ...DEFAULT_PROFILE, ...profile });
        return this.state.value.profile;
    }
}

class BackgroundGenerator {
    constructor(state, collector) {
        this.state = state;
        this.collector = collector;
    }

    async generateWithContext(taskType, payload = {}) {
        const context = getContext();
        const collected = this.collector.collect();
        const speakerId = this.resolveSpeakerId(taskType, payload);
        const auditor = new KnowledgeTimelineAuditor(this.state.value);
        const speakerContext = auditor.resolveVisibleContext(speakerId);
        const quietPrompt = this.buildPrompt(taskType, payload, collected, speakerContext);

        if (typeof context.generateQuietPrompt === 'function') {
            const first = await this.generateAndAudit(context, quietPrompt, taskType, speakerId, speakerContext);
            if (first.ok) return first;
            const retryPrompt = [
                quietPrompt,
                '【上一次生成被审计器拦截】',
                JSON.stringify(first.audit.issues),
                '请重新生成，严格避开 forbiddenFacts、未来事件、system_only/user_only 越界信息。只输出 JSON。',
            ].join('\n\n');
            const second = await this.generateAndAudit(context, retryPrompt, taskType, speakerId, speakerContext);
            if (second.ok) return second;
            return {
                ok: false,
                message: '本次生成疑似越界，已拦截。请刷新或重试。',
                items: [],
                audit: second.audit,
            };
        }

        if (!this.state.value.settings.fallbackEnabled) {
            return {
                ok: false,
                message: '后台生成接口未接入',
                items: [],
            };
        }

        const fallback = this.templateFallback(taskType, payload);
        fallback.visibilityContext = speakerContext;
        return fallback;
    }

    resolveSpeakerId(taskType, payload) {
        if (payload.speakerId) return normalizeSpeakerId(payload.speakerId);
        if (payload.npcId || payload.actorId) return normalizeSpeakerId(payload.npcId || payload.actorId);
        if (taskType === 'target_phone') return 'char';
        if (taskType === 'npc_chat') return normalizeSpeakerId(payload.npcId || payload.target || 'user');
        if (taskType === 'forum' || taskType === 'moments') return 'system';
        return 'user';
    }

    async generateAndAudit(context, quietPrompt, taskType, speakerId, speakerContext) {
        const result = await context.generateQuietPrompt({ quietPrompt });
        const parsed = this.parseGeneratedResult(taskType, result);
        const audit = new KnowledgeTimelineAuditor(this.state.value)
            .auditKnowledgeConsistency(JSON.stringify(parsed.items), speakerId, speakerContext);
        return { ...parsed, ok: parsed.ok && audit.ok, audit, visibilityContext: speakerContext };
    }

    buildPrompt(taskType, payload, collected, speakerContext) {
        const state = this.state.value;
        const phoneEventsSummary = state.phoneEvents.slice(-20).map((event) => ({
            type: event.type,
            at: event.at,
            visibility: event.visibility,
            summary: event.summary || event.content || event.title,
        }));
        const boundary = new KnowledgeTimelineAuditor(state)
            .buildPromptWithVisibilityBoundary(speakerContext.speakerId, taskType, payload);
        const isSystemSpeaker = speakerContext.speakerId === 'system';
        const safeSharedState = {
            time: state.time,
            location: state.location,
            phase: state.phase,
            relationship: state.relationship,
            storyClock: state.storyClock,
            eventLogSize: state.eventLog.length,
            mainEvents: isSystemSpeaker
                ? state.mainEvents.slice(-12).map((event) => ({ id: event.id, source: event.source, content: event.content, visibility: event.visibility }))
                : speakerContext.visibleMainEvents.slice(-12),
            phoneEvents: isSystemSpeaker ? phoneEventsSummary : speakerContext.visiblePhoneEvents.slice(-12),
            pendingEvents: isSystemSpeaker ? state.pendingEvents.slice(-12) : [],
            knowledgeGraph: isSystemSpeaker ? state.knowledgeGraph.slice(-20) : speakerContext.knownFacts.slice(-20),
        };

        return [
            '你正在为 SillyTavern 扩展 ST-StoryPhone 生成手机内内容。',
            '结果只返回给手机界面，不写入主聊天。必须克制真实，避免狗血、全员磕CP、NPC全知全能。',
            '请严格输出 JSON，不要 Markdown。格式：{"items":[...],"summary":"..."}。',
            boundary,
            `任务类型：${taskType} / ${TASK_LABELS[taskType] || taskType}`,
            `当前请求：${JSON.stringify(payload)}`,
            `当前角色卡摘要：${JSON.stringify(collected.characterSummary)}`,
            `世界书摘要：${JSON.stringify(collected.worldInfoSummary)}`,
            `最近主对话历史：${JSON.stringify(collected.recentHistory)}`,
            `用户 persona：${JSON.stringify(collected.persona)}`,
            `sharedStoryState（已按 speaker 分区/过滤）：${JSON.stringify(safeSharedState)}`,
            `phoneEvents摘要（speaker=${speakerContext.speakerId} 时仅可使用可见项）：${JSON.stringify(safeSharedState.phoneEvents)}`,
            `speaker 可见上下文：${JSON.stringify({
                speakerId: speakerContext.speakerId,
                visibleMainEvents: speakerContext.visibleMainEvents.slice(-12),
                visiblePhoneEvents: speakerContext.visiblePhoneEvents.slice(-12),
                knownFacts: speakerContext.knownFacts.slice(-12),
            })}`,
            `speaker 禁止知道的信息：${JSON.stringify(speakerContext.forbiddenFacts.slice(-12))}`,
            '可见性规则：system 永远知道全部；speaker 只能知道其可见信息。system_only/user_only/其他NPC私聊不得被角色直接引用。',
            '生成要求：内容应像真实手机信息流。每个 item 至少包含 title/content/actor/visibility，可按任务增加 comments/likes/time/board。',
        ].join('\n\n');
    }

    parseGeneratedResult(taskType, raw) {
        const text = typeof raw === 'string' ? raw.trim() : JSON.stringify(raw || {});
        const jsonStart = text.indexOf('{');
        const jsonEnd = text.lastIndexOf('}');
        const parsed = jsonStart >= 0 && jsonEnd >= jsonStart
            ? safeJsonParse(text.slice(jsonStart, jsonEnd + 1), null)
            : null;

        if (parsed && Array.isArray(parsed.items)) {
            return { ok: true, taskType, items: parsed.items, summary: parsed.summary || '' };
        }

        return {
            ok: true,
            taskType,
            items: [{ title: TASK_LABELS[taskType] || taskType, content: text, actor: '系统生成', visibility: 'user_only' }],
            summary: clampText(text, 160),
        };
    }

    templateFallback(taskType, payload) {
        const label = TASK_LABELS[taskType] || taskType;
        return {
            ok: true,
            taskType,
            summary: `${label} 使用本地占位生成`,
            items: [
                {
                    title: `${label}占位内容`,
                    actor: payload.npcName || '系统',
                    content: '已开启 fallback，因此这里显示本地模板内容。接入 generateQuietPrompt 后会由当前模型生成。',
                    visibility: payload.visibility || 'user_only',
                    time: '刚刚',
                },
            ],
        };
    }
}

class ContextInjector {
    constructor(state) {
        this.state = state;
    }

    attach() {
        globalThis.STStoryPhoneGenerationInterceptor = async (chat, contextSize, abort, type) => {
            if (type === 'quiet') return;
            if (!this.state?.value?.settings?.injectIntoMainContext) return;
            const summary = new KnowledgeTimelineAuditor(this.state.value).summarizeForMainChat('char');
            if (!summary) return;

            const note = {
                is_user: false,
                is_system: true,
                name: EXTENSION_ID,
                send_date: Date.now(),
                mes: summary,
            };
            const insertAt = Math.max(0, chat.length - 1);
            chat.splice(insertAt, 0, structuredClone(note));
        };
    }
}

class PhoneUI {
    constructor(state, collector, profileManager, generator) {
        this.state = state;
        this.collector = collector;
        this.profileManager = profileManager;
        this.generator = generator;
        this.activeApp = 'home';
        this.selectedNpc = null;
        this.root = null;
        this.screen = null;
    }

    mount() {
        if (document.getElementById('st-story-phone')) return;
        this.root = createElement('section', 'stp-phone-shell', '');
        this.root.id = 'st-story-phone';
        this.root.innerHTML = `
            <div class="stp-phone">
                <div class="stp-phone-top">
                    <span class="stp-signal">STORY 5G</span>
                    <span class="stp-camera"></span>
                    <button class="stp-mini" type="button" title="最小化">_</button>
                </div>
                <div class="stp-screen" role="region" aria-label="StoryPhone"></div>
            </div>
            <button class="stp-bubble" type="button" title="打开 StoryPhone">Phone</button>
        `;
        document.body.appendChild(this.root);
        this.screen = this.root.querySelector('.stp-screen');
        this.root.querySelector('.stp-mini').addEventListener('click', () => this.toggleMinimized(true));
        this.root.querySelector('.stp-bubble').addEventListener('click', () => this.toggleMinimized(false));
        this.bindEvents();
        this.toggleMinimized(Boolean(this.state.value.settings.minimized));
        this.render();
    }

    bindEvents() {
        const context = getContext();
        const events = context.eventSource;
        const types = context.event_types || {};
        if (!events?.on) return;
        const refresh = () => {
            const collected = this.collector.collect();
            this.profileManager.resolve(collected);
            this.render();
        };
        [types.CHAT_CHANGED, types.MESSAGE_RECEIVED, types.MESSAGE_SENT, types.PERSONA_CHANGED, types.CHARACTER_EDITED]
            .filter(Boolean)
            .forEach((type) => events.on(type, refresh));
    }

    toggleMinimized(minimized) {
        this.state.value.settings.minimized = minimized;
        this.state.save();
        this.root.classList.toggle('stp-is-minimized', minimized);
    }

    render() {
        if (!this.screen) return;
        const collected = this.collector.collect();
        const profile = this.profileManager.resolve(collected);
        this.root.style.setProperty('--stp-owner', `"${profile.displayName || 'StoryPhone'}"`);

        if (this.activeApp === 'home') this.renderHome(profile);
        if (this.activeApp === 'wechat') this.renderWechat(profile);
        if (this.activeApp === 'moments') this.renderMoments();
        if (this.activeApp === 'forum') this.renderForum(profile);
        if (this.activeApp === 'calendar') this.renderCalendar();
        if (this.activeApp === 'memos') this.renderMemos();
        if (this.activeApp === 'target') this.renderTargetPhone(profile);
        if (this.activeApp === 'settings') this.renderSettings();
    }

    setApp(app) {
        this.activeApp = app;
        this.render();
    }

    nav(title) {
        const bar = createElement('div', 'stp-nav');
        const back = createElement('button', 'stp-pixel-button', 'Home');
        back.type = 'button';
        back.addEventListener('click', () => this.setApp('home'));
        const heading = createElement('strong', '', title);
        bar.append(back, heading);
        return bar;
    }

    renderHome(profile) {
        this.screen.innerHTML = '';
        const hero = createElement('div', 'stp-home-hero');
        hero.innerHTML = `
            <div class="stp-logo">Phoning<br>Phone</div>
            <div class="stp-subtitle">${profile.displayName || EXTENSION_ID}</div>
            <div class="stp-time">${this.state.value.time || '剧情时间未设定'}</div>
        `;
        const grid = createElement('div', 'stp-app-grid');
        [
            ['wechat', '微信', 'chat'],
            ['moments', '朋友圈', 'moments'],
            ['forum', profile.forum?.name || '论坛', 'forum'],
            ['calendar', '日历', 'calendar'],
            ['memos', '备忘录', 'memo'],
            ['target', '查看目标角色手机', 'phone'],
            ['settings', '设置', 'gear'],
        ].forEach(([app, label, icon]) => {
            const button = createElement('button', 'stp-app-icon', '');
            button.type = 'button';
            button.innerHTML = `<span>${icon}</span><b>${label}</b>`;
            button.addEventListener('click', () => this.setApp(app));
            grid.append(button);
        });
        this.screen.append(hero, grid);
    }

    renderWechat(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('微信'));
        const layout = createElement('div', 'stp-chat-layout');
        const list = createElement('div', 'stp-friend-list');
        const friends = asArray(profile.friends);
        if (!this.selectedNpc && friends[0]) this.selectedNpc = friends[0].id;

        friends.forEach((friend) => {
            const item = createElement('button', `stp-friend ${friend.id === this.selectedNpc ? 'active' : ''}`, '');
            item.type = 'button';
            item.innerHTML = `<b>${friend.name}</b><span>${friend.role || 'NPC'}</span>`;
            item.addEventListener('click', () => {
                this.selectedNpc = friend.id;
                this.renderWechat(profile);
            });
            list.append(item);
        });

        const current = friends.find((friend) => friend.id === this.selectedNpc) || friends[0];
        const chatPane = createElement('div', 'stp-chat-pane');
        if (!current) {
            chatPane.append(createElement('p', 'stp-empty', '暂无好友。可在角色卡 phone profile 中配置 friends。'));
        } else {
            const history = this.state.value.phone.chats[current.id] || [];
            const messages = createElement('div', 'stp-messages');
            history.forEach((message) => {
                const bubble = createElement('div', `stp-message ${message.sender === 'user' ? 'me' : 'npc'}`);
                bubble.textContent = message.content;
                messages.append(bubble);
            });
            const form = createElement('form', 'stp-reply-box');
            form.innerHTML = `
                <input type="text" placeholder="只在手机内发送..." />
                <button class="stp-pixel-button" type="submit">发送</button>
                <button class="stp-pixel-button ghost" type="button" data-generate>生成回复</button>
            `;
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                const input = form.querySelector('input');
                const text = input.value.trim();
                if (!text) return;
                this.pushChat(current, { sender: 'user', content: text, at: nowIso() });
                input.value = '';
                this.renderWechat(profile);
            });
            form.querySelector('[data-generate]').addEventListener('click', () => this.generateNpcReply(current));
            chatPane.append(createElement('h3', '', current.name), messages, form);
        }
        layout.append(list, chatPane);
        wrap.append(layout);
        this.screen.append(wrap);
    }

    pushChat(friend, message) {
        const id = friend.id;
        if (!this.state.value.phone.chats[id]) this.state.value.phone.chats[id] = [];
        this.state.value.phone.chats[id].push(message);
        const isChar = this.state.isCharId(friend.id) || this.state.isCharId(friend.name) || Boolean(friend.isChar);
        const isUserSender = message.sender === 'user';
        const visibility = normalizeVisibility('visible_to_npc', {
            user: true,
            actorId: isUserSender ? 'user' : id,
            targetId: isChar ? 'char' : id,
            isChar,
        });
        this.state.addPhoneEvent({
            source: EVENT_SOURCES.WECHAT,
            type: 'npc_chat',
            actor: isUserSender ? 'user' : id,
            target: isUserSender ? (isChar ? 'char' : id) : 'user',
            actorId: id,
            visibility,
            content: message.content,
            summary: `${friend.name} 微信：${clampText(message.content, 100)}`,
        });
        this.state.save();
    }

    async generateNpcReply(friend) {
        this.setLoading(`正在生成 ${friend.name} 的微信回复...`);
        const result = await this.generator.generateWithContext('npc_chat', {
            npcId: friend.id,
            npcName: friend.name,
            history: this.state.value.phone.chats[friend.id] || [],
        });
        if (!result.ok) return this.showNotice(result.message);
        const content = result.items[0]?.content || result.summary || '（对方暂时没有新消息）';
        this.pushChat(friend, { sender: friend.id, content, at: nowIso() });
        this.renderWechat(this.state.value.profile);
    }

    renderMoments() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('朋友圈'));
        const action = createElement('button', 'stp-wide-action', '生成/刷新朋友圈');
        action.type = 'button';
        action.addEventListener('click', () => this.generateMoments());
        const list = createElement('div', 'stp-card-list');
        this.state.value.phone.moments.forEach((post) => list.append(this.renderSocialCard(post, 'moment')));
        if (!this.state.value.phone.moments.length) list.append(createElement('p', 'stp-empty', '还没有动态。点击刷新会基于主剧情状态后台生成。'));
        wrap.append(action, list);
        this.screen.append(wrap);
    }

    async generateMoments() {
        this.setLoading('正在生成朋友圈...');
        const result = await this.generator.generateWithContext('moments', { visibility: 'public' });
        if (!result.ok) return this.showNotice(result.message);
        const items = result.items.map((item) => ({
            id: `moment_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ...item,
            likes: asArray(item.likes),
            comments: asArray(item.comments),
            visibility: item.visibility || 'public',
        }));
        this.state.value.phone.moments.unshift(...items);
        this.state.addPhoneEvent({ source: EVENT_SOURCES.MOMENTS, type: 'moments_refresh', actor: 'system', visibility: 'public', summary: result.summary || `生成 ${items.length} 条朋友圈` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.MOMENTS,
                type: 'moment_post',
                actor: item.actorId || item.actor || item.author || 'unknown',
                target: null,
                content: `${item.title || ''} ${item.content || ''}`.trim(),
                visibility: item.visibility || 'public',
                summary: `朋友圈动态：${clampText(item.title || item.content, 120)}`,
            });
        });
        this.state.save();
        this.renderMoments();
    }

    renderForum(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav(profile.forum?.name || '论坛'));
        const action = createElement('button', 'stp-wide-action', '刷新论坛帖子');
        action.type = 'button';
        action.addEventListener('click', () => this.generateForum());
        const list = createElement('div', 'stp-card-list');
        this.state.value.phone.forumPosts.forEach((post) => list.append(this.renderSocialCard(post, 'forum')));
        if (!this.state.value.phone.forumPosts.length) list.append(createElement('p', 'stp-empty', '论坛空空的。刷新后会生成克制真实的校园帖子。'));
        wrap.append(action, list);
        this.screen.append(wrap);
    }

    async generateForum() {
        this.setLoading('正在刷新论坛...');
        const result = await this.generator.generateWithContext('forum', {
            board: this.state.value.profile?.forum?.defaultBoard || '校园生活',
            tone: this.state.value.profile?.forum?.tone,
        });
        if (!result.ok) return this.showNotice(result.message);
        const items = result.items.map((item) => ({
            id: `forum_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            ...item,
            likes: asArray(item.likes),
            comments: asArray(item.comments),
            visibility: item.visibility || 'public',
        }));
        this.state.value.phone.forumPosts.unshift(...items);
        this.state.addPhoneEvent({ source: EVENT_SOURCES.FORUM, type: 'forum_refresh', actor: 'system', visibility: 'public', summary: result.summary || `生成 ${items.length} 条论坛帖` });
        items.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.FORUM,
                type: 'forum_post',
                actor: item.actorId || item.actor || item.author || 'anonymous',
                target: item.board || this.state.value.profile?.forum?.defaultBoard || null,
                content: `${item.title || ''} ${item.content || ''}`.trim(),
                visibility: 'public',
                summary: `论坛帖子：${clampText(item.title || item.content, 120)}`,
            });
        });
        this.state.save();
        this.renderForum(this.state.value.profile);
    }

    renderSocialCard(post, source) {
        const card = createElement('article', 'stp-social-card');
        const comments = asArray(post.comments);
        card.innerHTML = `
            <div class="stp-card-meta"><b>${post.actor || post.author || '匿名'}</b><span>${post.time || '刚刚'}</span></div>
            <h3>${post.title || '无标题'}</h3>
            <p>${post.content || ''}</p>
            <div class="stp-chip-row">
                <span>${post.board || post.visibility || 'public'}</span>
                <span>${asArray(post.likes).length} likes</span>
                <span>${comments.length} comments</span>
            </div>
        `;
        const actions = createElement('div', 'stp-inline-actions');
        const like = createElement('button', 'stp-pixel-button ghost', '点赞');
        const comment = createElement('button', 'stp-pixel-button ghost', '评论');
        like.type = 'button';
        comment.type = 'button';
        like.addEventListener('click', () => {
            post.likes = asArray(post.likes);
            post.likes.push('user');
            const sourceName = source === 'forum' ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS;
            const authorId = post.actorId || post.actor || post.author || null;
            this.state.addPhoneEvent({
                source: sourceName,
                type: `${source}_like`,
                actor: 'user',
                target: authorId,
                visibility: post.visibility === 'public' ? 'public' : normalizeVisibility('visible_to_npc', { user: true, actorId: 'user', targetId: authorId }),
                summary: `点赞：${post.title || post.content}`,
            });
            this.state.save();
            this.render();
        });
        comment.addEventListener('click', () => {
            const text = prompt('输入评论（只保存在手机内）：');
            if (!text?.trim()) return;
            post.comments = asArray(post.comments);
            post.comments.push({ actor: 'user', content: text.trim(), at: nowIso() });
            const sourceName = source === 'forum' ? EVENT_SOURCES.FORUM : EVENT_SOURCES.MOMENTS;
            const authorId = post.actorId || post.actor || post.author || null;
            this.state.addPhoneEvent({
                source: sourceName,
                type: `${source}_comment`,
                actor: 'user',
                target: authorId,
                content: text.trim(),
                visibility: post.visibility === 'public' ? 'public' : normalizeVisibility('visible_to_npc', { user: true, actorId: 'user', targetId: authorId }),
                summary: `评论：${clampText(text, 80)}`,
            });
            this.state.save();
            this.render();
        });
        actions.append(like, comment);
        const commentList = createElement('div', 'stp-comment-list');
        comments.slice(-4).forEach((item) => commentList.append(createElement('p', '', `${item.actor || '匿名'}：${item.content || item}`)));
        card.append(actions, commentList);
        return card;
    }

    renderCalendar() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('日历'));
        const form = createElement('form', 'stp-editor');
        form.innerHTML = `
            <input name="time" placeholder="时间，例如 今天 18:00" />
            <input name="title" placeholder="安排 / 暗线" />
            <button class="stp-pixel-button" type="submit">添加</button>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const title = String(data.get('title') || '').trim();
            if (!title) return;
            this.state.upsertCalendar({
                time: String(data.get('time') || '未定').trim(),
                title,
                visibility: 'user_only',
            });
            this.renderCalendar();
        });
        const list = createElement('div', 'stp-card-list compact');
        const currentTime = createElement('div', 'stp-note', `剧情时间：${this.state.value.time || '未设定'} / 地点：${this.state.value.location || '未设定'}`);
        this.state.value.phone.calendar.forEach((item) => list.append(createElement('div', 'stp-list-card', `${item.time || '未定'}｜${item.title}`)));
        if (!this.state.value.phone.calendar.length) list.append(createElement('p', 'stp-empty', '暂无日程。可记录今日安排和未来暗线。'));
        wrap.append(currentTime, form, list);
        this.screen.append(wrap);
    }

    renderMemos() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('备忘录'));
        const form = createElement('form', 'stp-editor');
        form.innerHTML = `
            <textarea name="memo" rows="3" placeholder="新增线索、备忘、用户知道的信息..."></textarea>
            <button class="stp-pixel-button" type="submit">保存线索</button>
        `;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const text = String(new FormData(form).get('memo') || '').trim();
            if (!text) return;
            this.state.addMemo(text);
            this.renderMemos();
        });
        const list = createElement('div', 'stp-card-list compact');
        this.state.value.phone.memos.forEach((memo) => {
            const card = createElement('div', 'stp-list-card memo');
            card.innerHTML = `<p>${memo.text}</p><button class="stp-pixel-button ghost" type="button">删除</button>`;
            card.querySelector('button').addEventListener('click', () => {
                this.state.deleteMemo(memo.id);
                this.renderMemos();
            });
            list.append(card);
        });
        if (!this.state.value.phone.memos.length) list.append(createElement('p', 'stp-empty', '暂无备忘录。'));
        wrap.append(form, list);
        this.screen.append(wrap);
    }

    renderTargetPhone(profile) {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav(`${profile.targetPhoneOwner || profile.phoneOwnerLabel} 的手机`));
        const notice = createElement('div', 'stp-note', '只读模式：你可以查看根据目标角色可见信息生成的消息、备忘录和日历，但不能替目标角色发消息。');
        const action = createElement('button', 'stp-wide-action', '生成目标角色手机内容');
        action.type = 'button';
        action.addEventListener('click', () => this.generateTargetPhone(profile));
        const list = createElement('div', 'stp-card-list');
        const data = this.state.value.phone.targetPhone;
        [...data.messages, ...data.memos, ...data.calendar].forEach((item) => list.append(createElement('div', 'stp-list-card', `${item.title || item.actor || '项目'}：${item.content || item.text || item.time || ''}`)));
        if (!list.children.length) list.append(createElement('p', 'stp-empty', '尚未生成目标角色手机内容。'));
        wrap.append(notice, action, list);
        this.screen.append(wrap);
    }

    async generateTargetPhone(profile) {
        this.setLoading(`正在生成 ${profile.targetPhoneOwner || '目标角色'} 手机...`);
        const result = await this.generator.generateWithContext('target_phone', {
            owner: profile.targetPhoneOwner,
            visibility: 'visible_to_char',
            readonly: true,
        });
        if (!result.ok) return this.showNotice(result.message);
        const normalized = result.items.map((item) => ({ ...item, visibility: item.visibility || 'visible_to_char' }));
        this.state.value.phone.targetPhone.messages.unshift(...normalized);
        normalized.forEach((item) => {
            this.state.addPhoneEvent({
                source: EVENT_SOURCES.TARGET_PHONE,
                type: 'target_phone_item',
                actor: 'char',
                target: null,
                content: `${item.title || ''} ${item.content || item.text || ''}`.trim(),
                visibility: 'visible_to_char',
                summary: `目标角色手机内容：${clampText(item.title || item.content || item.text, 120)}`,
                injectToMain: false,
            });
        });
        this.state.addPhoneEvent({ source: EVENT_SOURCES.TARGET_PHONE, type: 'target_phone_view', actor: 'user', target: 'char', visibility: 'user_only', summary: result.summary || `查看了 ${profile.targetPhoneOwner} 的手机`, injectToMain: false });
        this.state.save();
        this.renderTargetPhone(profile);
    }

    renderSettings() {
        this.screen.innerHTML = '';
        const wrap = createElement('div', 'stp-app');
        wrap.append(this.nav('设置'));
        const settings = this.state.value.settings;
        const panel = createElement('div', 'stp-settings');
        panel.innerHTML = `
            <label><input type="checkbox" data-setting="injectIntoMainContext" ${settings.injectIntoMainContext ? 'checked' : ''}> 手机事件隐藏摘要同步到主对话</label>
            <label><input type="checkbox" data-setting="fallbackEnabled" ${settings.fallbackEnabled ? 'checked' : ''}> 开启本地 fallback（默认关闭）</label>
            <textarea rows="7" placeholder="粘贴角色 phone profile JSON"></textarea>
            <button class="stp-pixel-button" type="button" data-import>导入 Profile</button>
            <button class="stp-pixel-button ghost" type="button" data-export>导出当前状态到控制台</button>
        `;
        panel.querySelectorAll('[data-setting]').forEach((input) => {
            input.addEventListener('change', () => {
                this.state.value.settings[input.dataset.setting] = input.checked;
                this.state.save();
            });
        });
        panel.querySelector('[data-import]').addEventListener('click', () => {
            try {
                this.profileManager.importJson(panel.querySelector('textarea').value);
                this.showNotice('Profile 已导入');
            } catch (error) {
                this.showNotice(error.message);
            }
        });
        panel.querySelector('[data-export]').addEventListener('click', () => {
            console.info(`${EXTENSION_ID} state`, structuredClone(this.state.value));
            this.showNotice('当前状态已输出到浏览器控制台');
        });
        wrap.append(panel);
        this.screen.append(wrap);
    }

    setLoading(text) {
        this.screen.innerHTML = '';
        const loading = createElement('div', 'stp-loading', text);
        this.screen.append(loading);
    }

    showNotice(text) {
        const notice = createElement('div', 'stp-toast', text);
        this.root.append(notice);
        setTimeout(() => notice.remove(), 2400);
        this.render();
    }
}

class MainChatObserver {
    constructor(state, collector) {
        this.state = state;
        this.collector = collector;
        this.seen = new Set(asArray(state.value.eventLog).map((event) => event.meta?.chatMessageKey).filter(Boolean));
    }

    attach() {
        const context = getContext();
        const events = context.eventSource;
        const types = context.event_types || {};
        if (!events?.on) return;
        if (types.MESSAGE_SENT) events.on(types.MESSAGE_SENT, (data) => this.recordMainMessage(data, 'user'));
        if (types.MESSAGE_RECEIVED) events.on(types.MESSAGE_RECEIVED, (data) => this.recordMainMessage(data, 'char'));
    }

    recordMainMessage(data, speaker) {
        const context = getContext();
        const chat = asArray(context.chat);
        const message = typeof data === 'number' ? chat[data] : data?.message || data || chat[chat.length - 1];
        const text = message?.mes || message?.text || message?.content || '';
        if (!text) return;

        const key = [
            speaker,
            message?.send_date || message?.swipe_id || chat.length,
            clampText(text, 80),
        ].join('::');
        if (this.seen.has(key)) return;
        this.seen.add(key);

        const collected = this.collector.collect();
        const actor = speaker === 'user' ? 'user' : 'char';
        this.state.addEvent({
            source: EVENT_SOURCES.MAIN_CHAT,
            type: speaker === 'user' ? 'main_user_message' : 'main_char_message',
            actor,
            target: actor === 'user' ? 'char' : 'user',
            content: text,
            visibility: {
                system: true,
                user: true,
                char: true,
                npcs: [],
                public: false,
            },
            consequences: [],
            status: 'active',
            meta: {
                chatMessageKey: key,
                characterName: collected.characterSummary?.name,
            },
        });
        this.state.resolvePendingEvents(text);
    }
}

class StoryPhoneApp {
    constructor() {
        this.storage = new StorageManager();
        this.collector = new ContextCollector();
        const collected = this.collector.collect();
        this.state = new SharedStoryState(this.storage, collected.chatId);
        this.profileManager = new ProfileManager(this.state);
        this.generator = new BackgroundGenerator(this.state, this.collector);
        this.injector = new ContextInjector(this.state);
        this.mainChatObserver = new MainChatObserver(this.state, this.collector);
        this.ui = new PhoneUI(this.state, this.collector, this.profileManager, this.generator);
    }

    start() {
        this.profileManager.resolve(this.collector.collect());
        this.injector.attach();
        this.mainChatObserver.attach();
        this.ui.mount();
        globalThis.STStoryPhoneKnowledge = {
            buildContextForSpeaker: (speakerId) => new KnowledgeTimelineAuditor(this.state.value).buildContextForSpeaker(speakerId),
            auditKnowledgeConsistency: (generatedContent, speakerId, context) => new KnowledgeTimelineAuditor(this.state.value).auditKnowledgeConsistency(generatedContent, speakerId, context),
            resolveVisibleContext: (speakerId) => new KnowledgeTimelineAuditor(this.state.value).resolveVisibleContext(speakerId),
            buildPromptWithVisibilityBoundary: (speakerId, taskType, payload) => new KnowledgeTimelineAuditor(this.state.value).buildPromptWithVisibilityBoundary(speakerId, taskType, payload),
            mockAddEvent: (event) => this.state.addEvent(event),
            mockAddPendingEvent: (event, trigger) => this.state.addPendingEvent(event, trigger),
        };
    }
}

function bootStoryPhone() {
    if (globalThis.__STStoryPhoneApp) return;
    globalThis.__STStoryPhoneApp = new StoryPhoneApp();
    globalThis.__STStoryPhoneApp.start();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootStoryPhone, { once: true });
} else {
    bootStoryPhone();
}

export function onEnable() {
    bootStoryPhone();
}

export async function onClean() {
    Object.keys(localStorage)
        .filter((key) => key.startsWith(`${STORAGE_PREFIX}:`))
        .forEach((key) => localStorage.removeItem(key));
}
