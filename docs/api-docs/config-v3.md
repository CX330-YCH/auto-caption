# 配置文件 V3

> 本文保留用于说明历史格式；当前格式为 [配置文件 V7](./config-v7.md)，应用会把完整 V3 依次显式迁移到 V4、V5、V6 和 V7。

Auto Caption 的持久化配置位于 Electron `userData/config.json`。V3 使用 `schemaVersion: 3`，当时磁盘、主进程、IPC 和渲染进程共享同一套分层类型。

## 文档结构

以下是分层结构示意，`caption.styles` 为节省篇幅省略了具体样式字段，不可直接作为完整配置复制：

```json
{
  "schemaVersion": 3,
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
    "providers": {
      "gummy": { "apiKey": "" },
      "vosk": { "modelPath": "" },
      "sosv": { "modelPath": "" },
      "glm": {
        "url": "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions",
        "model": "glm-asr-2512",
        "apiKey": ""
      },
      "funAsr": {
        "model": "fun-asr-realtime",
        "websocketUrl": "",
        "workspaceId": "",
        "apiKey": "",
        "semanticPunctuationEnabled": false,
        "maxSentenceSilenceMs": 1300,
        "heartbeatEnabled": true,
        "hotwords": {
          "vocabularyId": "",
          "targetModel": "fun-asr-realtime",
          "contextTerms": []
        }
      }
    },
    "customEngines": [
      {
        "id": "custom-example",
        "name": "My Caption Engine",
        "executable": "<path-to-executable>",
        "command": "--model example"
      }
    ]
  },
  "caption": {
    "styles": {}
  }
}
```

`application` 只保存应用外观和窗口布局；`engine.common` 保存所有 Provider 共用的音频、语言、翻译、录音和超时配置；`engine.providers` 保存供应商专属字段；`engine.customEngines` 保存用户命名的自定义进程配置；`activeEngineId` 指向内置 Provider ID 或某个自定义引擎 ID；`caption` 保存字幕显示配置。

`engineEnabled`、字幕记录、软件日志、进程 PID 和端口属于运行状态，不写入配置文件。

## 校验

- `schemaVersion` 必须严格等于 `3`；读取完整 V2 时会先执行显式迁移。
- `language` 只能为 `zh`、`en` 或 `ja`；`theme` 只能为 `light`、`dark` 或 `system`。
- 颜色必须是六位十六进制颜色；边栏宽度为 6–12；字幕窗口宽度为 480–10000。
- `activeEngineId` 必须是 `gummy`、`vosk`、`sosv`、`glm`、`fun_asr` 或 `customEngines` 中存在的唯一 ID；自定义引擎名称去除首尾空白后不得为空且不允许重名；音频源只能为 `0` 或 `1`；启动超时为 10–120 秒。
- 翻译和 GLM URL 只能为空（仅允许翻译 URL）或使用 HTTP/HTTPS。
- Fun-ASR 模型只能为 `fun-asr-realtime` 或 `fun-asr-realtime-2025-11-07`；最大句间静音范围为 200–6000 ms。
- Fun-ASR 启动时必须同时提供 Workspace ID 和专属 WebSocket 地址。地址必须使用 WSS、路径必须为 `/api-ws/v1/inference`，并且只能是 `<WorkspaceId>.cn-beijing.maas.aliyuncs.com` 或 `<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com`；主机中的 Workspace ID 必须与配置字段一致。
- `funAsr.hotwords.vocabularyId` 为空时不加载预编译热词；非空时只接受字母、数字、`_`、`-`，且 `targetModel` 必须与 `funAsr.model` 完全一致。
- `contextTerms` 最多 100 个非空且不重复的术语；规范化后以换行连接，总长度不得超过 400 字符。它属于实时上下文，不带权重，也不等同于即时热词。
- 字幕样式数值按当前 UI 的滑块范围校验。
- 来自渲染进程的 application、engine 和 caption 配置在主进程重新校验；拒绝日志只记录配置分类和异常类型，不输出字段值或密钥。

V3 对象中的未知扩展字段会在解析和同层更新时保留，便于后续 V3 增量扩展；已知字段始终按上述类型与范围校验。

## 旧配置行为

V2 会迁移为 V3：`custom.enabled=true` 时创建名为 `Custom Engine` 的条目并选中；关闭时保留原内置 Provider，如果旧自定义路径或命令非空，仍创建未选中的迁移条目。无版本、V1、结构不完整和未来版本配置继续被拒绝，本次运行使用 V3 默认配置。

## 凭据

Gummy、GLM、Fun-ASR 和翻译 API Key 仍按既有行为保存在用户目录的 JSON 文件中。主进程不会把配置内容写入日志，生成的进程命令日志会对 `-k`、`-gkey`、`-fkey` 和翻译凭据参数脱敏；Python 配置对象的 `repr` 也隐藏凭据。热词管理时 API Key 仅由主进程写入一次性 Python 子进程 stdin，不进入 Renderer IPC、进程参数或响应。本阶段没有引入系统安全存储；这是后续独立安全改造事项。
