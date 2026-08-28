# 配置文件 V7

Auto Caption 的持久化配置位于 Electron `userData/config.json`。当前版本接受 `schemaVersion: 7`，磁盘、主进程、IPC 和 Renderer 共享 `ConfigDocumentV7`。

V7 把翻译从识别引擎的 `engine.common` 中拆出，形成独立的公共配置、当前 Provider 和 Provider 专属配置。以下片段只展示相关层级，省略的 application、caption 和识别 Provider 字段仍是完整配置的必需部分：

```json
{
  "schemaVersion": 7,
  "engine": {
    "activeEngineId": "vosk",
    "common": {
      "sourceLanguage": "auto",
      "audioSource": 0,
      "recording": { "enabled": false, "path": "" },
      "startTimeoutSeconds": 30
    },
    "providers": {},
    "translation": {
      "enabled": true,
      "activeProviderId": "ollama",
      "common": { "targetLanguage": "zh" },
      "providers": {
        "azure": {
          "endpoint": "https://api.cognitive.microsofttranslator.com",
          "region": "",
          "apiKey": ""
        },
        "google": {},
        "ollama": {
          "model": "qwen2.5:0.5b",
          "url": "http://localhost:11434",
          "apiKey": ""
        }
      }
    },
    "customEngines": []
  }
}
```

`activeProviderId` 只接受 `google`、`ollama` 或 `azure`。当前可运行实现仍为 Google 和 Ollama；Azure Translator 仅预留带语言、能力和字段声明的配置元数据，界面会将它标记为不可用，主进程也会拒绝手工选择后的启动。V7 不会因此访问 Azure、创建资源或产生费用。

Google 没有 Provider 专属字段。Ollama/OpenAI 兼容路径使用自己的 `model`、`url` 和 `apiKey`。翻译开关和目标语言属于 `translation` 公共层，不再由每个识别 Provider 重复保存。Gummy 仍使用服务端集成翻译；其他内置识别 Provider 在 final 后把稳定字幕 ID 交给独立翻译 Session。

## V6 迁移

迁移顺序为 V2→V3→V4→V5→V6→V7。V6 字段按以下规则迁移：

- `engine.common.translation.enabled` → `engine.translation.enabled`。
- `engine.common.translation.provider` → `engine.translation.activeProviderId`。
- `engine.common.targetLanguage` → `engine.translation.common.targetLanguage`。
- 原 `model`、`url`、`apiKey` → `engine.translation.providers.ollama`。
- 原翻译对象中的未知扩展字段保留在新的 `engine.translation` 同层；其他 `engine.common` 扩展字段保持原位。
- 新增空的 Google 配置和默认 Azure 元数据，不改变既有 Google/Ollama 选择。

V6 中除 `google`、`ollama` 外的未知翻译 Provider 会被拒绝，避免静默改用错误服务。无版本、结构不完整及未来版本配置同样被拒绝，本次运行使用 V7 默认配置。旧版应用无法读取 V7，回滚前应恢复升级前配置备份。

## 验证与安全

主进程严格校验 Provider ID、目标语言、HTTP(S) URL、字段类型和长度。翻译 API Key 延续当前明文用户配置存储方式，但不会写入普通日志、异常诊断、命令展示或配置对象 `repr`；这次结构迁移没有扩大凭据暴露范围。

V7 只改变内部配置结构。内置 Python 进程继续接收兼容的 `-t`、`-tm`、`-omn`、`-ourl`、`-okey` 参数，stdout `translation` 消息和 Electron IPC 通道均不变。
