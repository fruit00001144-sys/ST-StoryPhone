import stGetContext from '../../../st-context.js';

export function getSTContext() {
    try {
        if (typeof stGetContext === 'function') return stGetContext() || {};
    } catch (error) {
        console.warn('ST-StoryPhone: failed to read st-context module', error);
    }

    try {
        if (globalThis.SillyTavern?.getContext) return globalThis.SillyTavern.getContext() || {};
    } catch (error) {
        console.warn('ST-StoryPhone: failed to read SillyTavern global context', error);
    }

    return {};
}

export function getCurrentCharacterSummary() {
    const context = getSTContext();
    const id = context.characterId ?? context.character_id ?? context.chid;
    const characters = context.characters || {};
    const character = Array.isArray(characters) ? characters[id] : characters[id];
    const current = character || context.character || {};

    return {
        id: String(id ?? current.id ?? 'char'),
        name: current.name || context.name2 || '当前角色',
        description: current.description || current.data?.description || '',
        personality: current.personality || current.data?.personality || '',
        scenario: current.scenario || current.data?.scenario || '',
        extensions: current.extensions || current.data?.extensions || {},
    };
}

export function getRecentChat(limit = 18) {
    const context = getSTContext();
    return Array.isArray(context.chat)
        ? context.chat.slice(-limit).map((message) => ({
            name: message.name || (message.is_user ? 'User' : 'Character'),
            role: message.is_system ? 'system' : message.is_user ? 'user' : 'assistant',
            text: message.mes || message.text || '',
        }))
        : [];
}

export function getPersonaSummary() {
    const context = getSTContext();
    const persona = context.power_user?.persona || context.persona || {};
    return {
        name: context.name1 || persona.name || '用户',
        description: persona.description || context.persona_description || context.power_user?.persona_description || '',
    };
}

export async function generateQuiet(prompt) {
    const context = getSTContext();
    if (typeof context.generateQuietPrompt !== 'function') {
        return { ok: false, message: '后台生成接口未接入' };
    }

    try {
        const result = await context.generateQuietPrompt({ quietPrompt: prompt });
        return { ok: true, text: typeof result === 'string' ? result : JSON.stringify(result) };
    } catch (error) {
        console.warn('ST-StoryPhone: quiet generation failed', error);
        return { ok: false, message: '后台生成失败' };
    }
}

export function installGenerateInterceptor(getSummary) {
    globalThis.STStoryPhoneGenerationInterceptor = async (chat, contextSize, abort, type) => {
        if (type === 'quiet') return;
        const summary = typeof getSummary === 'function' ? getSummary('char') : '';
        if (!summary) return;
        chat.splice(Math.max(0, chat.length - 1), 0, {
            is_user: false,
            is_system: true,
            name: 'ST-StoryPhone',
            send_date: Date.now(),
            mes: summary,
        });
    };
}
