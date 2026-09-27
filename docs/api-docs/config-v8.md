# 配置文件 V8

> 本页记录历史 V8 结构。当前版本为 [配置文件 V9](config-v9.md)。

V8 使用 `schemaVersion: 8`，当时磁盘、主进程、IPC 和 Renderer 共享 `ConfigDocumentV8`。

V8 在 V7 独立翻译配置之上增加腾讯实时语音翻译 Provider。以下片段只展示新增字段，其余 application、caption、识别 Provider 和翻译 Provider 字段仍是完整配置的必需部分：

```json
{
  "schemaVersion": 8,
  "engine": {
    "activeEngineId": "tencent_speech_translate",
    "common": {
      "sourceLanguage": "zh"
    },
    "providers": {
      "tencentSpeech": {
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

## 腾讯 Provider 约束

- `model` 只接受 `hunyuan-translation-lite` 或 `hunyuan-translation`。
- 腾讯 Provider 必须启用翻译；它在同一 WebSocket 响应中返回原文和译文，不调用 Google/Ollama TranslationSession。
- `vadSilenceMs` 范围为 500–2000，默认 1000；表示达到该静音时长后断句。
- `maxSpeakTimeMs` 范围为 5000–90000，默认 10000；表示持续说话时强制结束单句的最长时长。
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

Renderer 会在源语言变化时重新筛选并归一化目标语言；主进程仍会重新校验语言对，不能依赖 Renderer 输入可信。

## 凭据与进程环境

腾讯凭据不属于持久化配置，也不经过 Renderer IPC 或命令行参数。Electron 从自身进程环境读取以下三个非空值并传给 Python 子进程：

- `TENCENTCLOUD_APP_ID`
- `TENCENTCLOUD_SECRET_ID`
- `TENCENTCLOUD_SECRET_KEY`

缺少任一变量时主进程拒绝启动，并使用三语通知说明原因。启动命令、普通日志、错误消息、Debug JSONL 和配置对象 `repr` 不得包含 SecretID 或 SecretKey。

## V7 迁移

迁移顺序为 V2→V3→V4→V5→V6→V7→V8。V7→V8 只向 `engine.providers` 增加上述腾讯默认配置，保留当前引擎、翻译选择、其他 Provider 配置和未知扩展字段。无版本、结构不完整及未来版本配置继续被拒绝，本次运行使用 V8 默认配置。

V8 不改变现有 Electron IPC 通道或 Python stdout/TCP command envelope。腾讯引擎新增自己的 Python CLI 参数，但旧引擎的参数、默认停止时限和行为不变。旧应用不能读取 V8，回滚前必须恢复升级前的 V7 配置备份。

接口参数和语言矩阵来源：[腾讯云实时语音翻译（WebSocket）](https://cloud.tencent.com/document/product/1093/127565)。
