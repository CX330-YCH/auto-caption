# 配置文件 V9

Auto Caption 的持久化配置位于 Electron `userData/config.json`。V9 当时接受 `schemaVersion: 9`，磁盘、主进程、控制窗口 IPC 和 Renderer 共享 `ConfigDocumentV9`；当前版本会把它显式迁移到 V10。

V9 在 V8 腾讯实时语音翻译 Provider 上增加 AppID、SecretID、SecretKey。以下片段只展示腾讯相关字段，其余 application、caption、识别 Provider 和翻译 Provider 字段仍是完整配置的必需部分：

```json
{
  "schemaVersion": 9,
  "engine": {
    "activeEngineId": "tencent_speech_translate",
    "common": {
      "sourceLanguage": "zh"
    },
    "providers": {
      "tencentSpeech": {
        "appId": "<appid>",
        "secretId": "<secret-id>",
        "secretKey": "<secret-key>",
        "model": "hunyuan-translation-lite",
        "vadSilenceMs": 1000,
        "maxSpeakTimeMs": 10000,
        "hotwords": {
          "entries": []
        }
      }
    },
    "translation": {
      "enabled": true,
      "common": {
        "targetLanguage": "en"
      }
    }
  }
}
```

## 腾讯凭据

- 设置页使用普通文本输入框编辑 `appId`、`secretId`、`secretKey`，启动腾讯 Provider 前三项都必须为非空。
- `appId` 最长 64 个字符，非空时只能包含数字；SecretID 和 SecretKey 最长 256 个字符。
- 三项随完整配置以明文写入 `config.json` 并进入控制窗口 Renderer，不使用密码输入框，也不读取 `TENCENTCLOUD_*` 环境变量。
- Electron 通过 `-tcappid`、`-tcsecretid`、`-tcsecretkey` 传给 Python。独立运行 `engine/main.py` 时也必须显式提供这三个参数。
- 软件命令日志、stderr 诊断和 Debug 配置快照会隐藏 SecretID、SecretKey；AppID 不是签名密钥，不做日志掩码。
- 配置文件和操作系统进程参数仍包含明文凭据。应限制本机账号、配置目录和进程查看权限，并避免把 `config.json`、命令输出或真实凭据提交到版本控制。

## Provider 约束

- `model` 只接受 `hunyuan-translation-lite` 或 `hunyuan-translation`。
- 腾讯 Provider 必须启用翻译；它在同一 WebSocket 响应中返回原文和译文，不调用 Google/Ollama TranslationSession。
- `vadSilenceMs` 范围为 500–2000，默认 1000；`maxSpeakTimeMs` 范围为 5000–90000，默认 10000。
- 两个断句参数只在源语言为 `zh`、`en`、`zh_en` 时发送；其他源语言使用服务端默认值。
- `hotwords.entries` 是以后接入请求级临时热词的配置边界。当前版本必须为空数组，Renderer 不显示编辑器，主进程和 Python CLI 也不会发送热词。

目标语言必须属于当前源语言的允许集合：

| 源语言 | 允许的目标语言 |
| --- | --- |
| `zh`、`en` | `zh`、`en`、`ja`、`ko`、`yue`、`id`、`th` |
| `zh_en` | `zh_en`、`zh`、`en`、`ja`、`ko`、`yue`、`id`、`th` |
| `ja`、`ko`、`yue` | `zh`、`en`、`ja`、`ko`、`yue` |
| `id` | `zh`、`en`、`id` |
| `th` | `zh`、`en`、`th` |
| `ru` | `zh`、`en`、`ru` |

Renderer 会在源语言变化时重新筛选并归一化目标语言；主进程仍会重新校验语言对和所有腾讯字段，不能依赖 Renderer 输入可信。

## V8 迁移与回滚

迁移顺序为 V2→V3→V4→V5→V6→V7→V8→V9。V8→V9 在 `engine.providers.tencentSpeech` 增加空的 `appId`、`secretId`、`secretKey`，保留当前引擎、翻译选择、其他 Provider 配置和未知扩展字段。迁移不会读取或导入环境变量；原来依赖环境变量的用户需要在设置页重新填写凭据。

V9 不改变现有 Electron IPC 通道或 Python stdout/TCP command envelope，但新增三个 Python CLI 参数。旧应用不能读取 V9，回滚前必须恢复升级前的 V8 配置备份，并按旧版本要求重新提供环境变量。

接口凭据和签名要求来源：[腾讯云实时语音翻译（WebSocket）](https://cloud.tencent.com/document/product/1093/127565)。
