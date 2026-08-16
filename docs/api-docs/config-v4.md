# 配置文件 V4

Auto Caption 的持久化配置位于 Electron `userData/config.json`。当前版本接受 `schemaVersion: 4`，磁盘、主进程、IPC 和渲染进程共享 `ConfigDocumentV4`。

## 文档结构

以下为分层结构示意，不可直接作为完整配置复制；`engine.providers` 的供应商字段以及 `caption.styles` 中除新增加的 `displayMode` 外的字体、颜色、阴影等字段均为节省篇幅省略：

```json
{
  "schemaVersion": 4,
  "application": {
    "language": "zh",
    "theme": "system",
    "accentColor": "#1677ff",
    "layout": {
      "leftBarWidth": 8,
      "captionWindowWidth": 900
    }
  },
  "engine": {
    "activeEngineId": "gummy",
    "common": {
      "sourceLanguage": "en",
      "targetLanguage": "zh",
      "audioSource": 0,
      "translation": {
        "enabled": true,
        "provider": "ollama",
        "model": "qwen2.5:0.5b",
        "url": "http://localhost:11434",
        "apiKey": ""
      },
      "recording": {
        "enabled": false,
        "path": "<Desktop>"
      },
      "startTimeoutSeconds": 30
    },
    "providers": {},
    "customEngines": []
  },
  "caption": {
    "styles": {
      "displayMode": "static"
    }
  }
}
```

`application` 保存应用外观和窗口布局；`engine.common` 保存 Provider 共用设置；`engine.providers` 保存供应商专属字段；`engine.customEngines` 保存命名自定义进程；`caption.styles` 保存字幕呈现方式和样式。

`engineEnabled`、字幕记录、软件日志、进程 PID 和端口属于运行状态，不写入配置文件。

## 字幕显示方式

`caption.styles.displayMode` 是必需字段，只接受：

- `static`：原有整句显示。`lineNumber` 表示保留的最近字幕条数，`lineBreak` 决定长字幕是否换行。
- `rolling`：逐行滚动。复用 Chromium 精确换行结果，`lineNumber` 表示可见视觉行数；为了形成稳定视觉行，该模式始终启用精确换行，忽略 `lineBreak`。

默认值为 `static`，因此新安装和旧配置迁移后都保持原有显示行为，只有用户在字幕样式设置中明确切换后才启用逐行滚动。

## 校验

- `schemaVersion` 必须严格等于 `4`；完整 V2 和 V3 会先执行显式迁移。
- `displayMode` 必须为 `static` 或 `rolling`；Renderer 发送的 caption 层会由主进程重新校验。
- `language` 只能为 `zh`、`en` 或 `ja`；`theme` 只能为 `light`、`dark` 或 `system`。
- 颜色、窗口尺寸、Provider、翻译、Fun-ASR、热词和字幕样式数值范围延续 V3 规则。
- V4 对象中的未知扩展字段会在解析和同层更新时保留；已知字段始终严格校验。

## 旧配置迁移

- V3→V4：保留 application、engine、caption 和未知扩展字段，在 `caption.styles` 写入 `displayMode: "static"`。
- V2→V4：先执行既有 V2→V3 命名自定义引擎迁移，再执行 V3→V4 显示方式迁移。
- 无版本、V1、结构不完整和未来版本配置仍被拒绝，本次运行使用 V4 默认配置。

迁移不会自动选择逐行滚动，避免升级后改变用户当前字幕窗口行为。

## 凭据

本次版本只增加字幕显示方式，不改变 Gummy、GLM、Fun-ASR 或翻译 API Key 的存储、传递和脱敏规则，也不新增远端请求或付费资源。
