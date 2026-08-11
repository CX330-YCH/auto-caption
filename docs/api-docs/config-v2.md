# 配置文件 V2

Auto Caption 的持久化配置位于 Electron `userData/config.json`。当前只接受 `schemaVersion: 2`，磁盘、主进程、IPC 和渲染进程共享同一套分层类型。

## 文档结构

以下是分层结构示意，`caption.styles` 为节省篇幅省略了具体样式字段，不可直接作为完整配置复制：

```json
{
  "schemaVersion": 2,
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
    "provider": "gummy",
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
      }
    },
    "custom": {
      "enabled": false,
      "executable": "",
      "command": ""
    }
  },
  "caption": {
    "styles": {}
  }
}
```

`application` 只保存应用外观和窗口布局；`engine.common` 保存所有 Provider 共用的音频、语言、翻译、录音和超时配置；`engine.providers` 保存供应商专属字段；`engine.custom` 保存自定义进程配置；`caption` 保存字幕显示配置。

`engineEnabled`、字幕记录、软件日志、进程 PID 和端口属于运行状态，不写入配置文件。

## 校验

- `schemaVersion` 必须严格等于 `2`。
- `language` 只能为 `zh`、`en` 或 `ja`；`theme` 只能为 `light`、`dark` 或 `system`。
- 颜色必须是六位十六进制颜色；边栏宽度为 6–12；字幕窗口宽度为 480–10000。
- `provider` 只能为 `gummy`、`vosk`、`sosv` 或 `glm`；音频源只能为 `0` 或 `1`；启动超时为 10–120 秒。
- 翻译和 GLM URL 只能为空（仅允许翻译 URL）或使用 HTTP/HTTPS。
- 字幕样式数值按当前 UI 的滑块范围校验。
- 来自渲染进程的 application、engine 和 caption 配置在主进程重新校验；拒绝日志只记录配置分类和异常类型，不输出字段值或密钥。

V2 对象中的未知扩展字段会在解析和同层更新时保留，便于后续 V2 增量扩展；已知字段始终按上述类型与范围校验。

## 旧配置行为

本阶段按项目决策不提供 V1 或无版本配置迁移。缺少 `schemaVersion: 2`、版本更高、JSON 损坏或字段不合法时，整个文件会被拒绝，本次运行使用 V2 默认配置；应用退出时默认配置会写回 `config.json`。旧配置值不会自动复制、备份或恢复。

## 凭据

Gummy、GLM 和翻译 API Key 仍按既有行为保存在用户目录的 JSON 文件中。主进程不会把配置内容写入日志，生成的进程命令日志继续进行参数脱敏。本阶段没有引入系统安全存储；这是后续独立安全改造事项。
