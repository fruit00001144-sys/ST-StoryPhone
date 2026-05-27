# ST-StoryPhone / ST-PhoningPhone

一个通用 SillyTavern 第三方 UI Extension，把“剧情手机”作为主剧情的第二前端使用，而不是独立手机模拟器。

## 安装

1. 将本仓库推送到 GitHub。
2. 在 SillyTavern 打开 `Extensions -> Install Extension`。
3. 填入仓库 URL 安装。
4. 启用扩展后，聊天界面右下角会出现一台可最小化的小手机。

## 核心设计

- 手机和主对话共享同一套 `SharedStoryState`。
- 所有主对话事件与手机事件都会写入统一的 `sharedStoryState.eventLog`。
- `KnowledgeTimelineAuditor` 通过 `buildContextForSpeaker(speakerId)` 为每个角色生成可见事件、已知事实、未知事实和禁止事实。
- 手机侧的微信、朋友圈、论坛、日历、备忘录、查看目标角色手机都只在手机内交互，不直接写入主聊天。
- 手机事件会写入 `phoneEvents`，并通过隐藏上下文摘要同步给主线生成。
- `VisibilityManager` 区分 `system_only`、`user_only`、`visible_to_char`、`visible_to_npc`、`public`，避免 NPC 全知全能。
- 生成前会加入可见性边界提示；生成后会运行 `auditKnowledgeConsistency()`，越界时自动重试一次，仍失败则拦截。
- 不读取 cookie，不读取 API Key，不访问外部网站，不使用外链资源。

## 后台生成

扩展会尝试调用当前 SillyTavern 环境中的 `generateQuietPrompt()` 后台生成接口。若环境不支持，默认不会 fallback 到主聊天，而是在手机 UI 中显示：

> 后台生成接口未接入

设置面板中保留 fallback 开关，但默认关闭。只有用户主动开启时，才会使用本地模板生成占位内容。

## 角色卡 Profile

不同角色卡可以使用不同手机配置。扩展优先读取：

- 当前角色卡 `extensions.ST-StoryPhone`
- 当前角色卡 `extensions.ST-PhoningPhone`
- 本扩展存储里的 profile
- `profiles/default.json`

角色卡扩展示例：

```json
{
  "extensions": {
    "ST-StoryPhone": {
      "targetPhoneOwner": "目标角色名",
      "currentChar": {
        "id": "char",
        "name": "目标角色名",
        "knows": [],
        "doesNotKnow": []
      },
      "friends": [
        {
          "id": "roommate",
          "name": "室友",
          "visibility": "public",
          "knows": [],
          "doesNotKnow": [],
          "relations": []
        }
      ],
      "publicChannels": [
        { "id": "forum", "name": "论坛", "audience": "profiled_forum_readers" }
      ],
      "forum": {
        "name": "论坛",
        "tone": "真实克制，不狗血，不全校磕CP"
      }
    }
  }
}
```

## 文件结构

- `manifest.json`：SillyTavern 扩展清单。
- `index.js`：极简启动器，安装/启用后立刻在主页面显示 `Phone` 小气泡。
- `app.js`：完整手机界面和所有核心模块，点击小气泡后加载。
- `style.css`：NewJeans / phoning inspired 手机界面。
- `profiles/default.json`：默认通用 profile。

## 可测试接口

扩展启动后会在浏览器全局暴露 `STStoryPhoneKnowledge`，方便调试：

```js
STStoryPhoneKnowledge.buildContextForSpeaker('char')
STStoryPhoneKnowledge.auditKnowledgeConsistency('生成文本', 'best_friend')
STStoryPhoneKnowledge.mockAddEvent({ source: 'phone_wechat', type: 'test', actor: 'user', target: 'best_friend', content: 'hello', visibility: 'visible_to_npc' })
```

注意：SillyTavern 当前扩展拦截器可以在主对话生成前注入 speaker-filtered hidden context；如果要在主对话输出已经显示前强制二次生成，需要 SillyTavern 暴露更细粒度的 post-generation replacement API。本扩展已在代码中保留 TODO，并会记录主对话事件到 `eventLog`。

## 注意

这是 UI Extension，不是 JS-Slash-Runner 脚本。它不会自动向外部服务发送剧情数据，所有生成请求都走当前 SillyTavern 的模型环境。
