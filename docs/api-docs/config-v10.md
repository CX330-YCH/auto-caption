# 配置文件 V10

V10 使用 `schemaVersion: 10`。它在 V9 的腾讯云实时语音翻译配置之外，新增两个独立识别 Provider，并继续复用同一组腾讯云 `AppID`、`SecretID`、`SecretKey`：

```json
{
  "schemaVersion": 10,
  "engine": {
    "providers": {
      "tencentSpeech": {
        "appId": "",
        "secretId": "",
        "secretKey": "",
        "model": "hunyuan-translation-lite",
        "vadSilenceMs": 1000,
        "maxSpeakTimeMs": 10000,
        "hotwords": { "entries": [] }
      },
      "tencentRecognition": {
        "model": "16k_zh_en",
        "vadSilenceMs": 1000,
        "maxSpeakTimeMs": 60000
      },
      "tencentRecognitionV2": {
        "model": "16k_zh_en_2.0",
        "vadSilenceMs": 1000,
        "sentenceStrategy": 0
      }
    }
  }
}
```

`tencent_speech_recognition` 对应[实时语音识别 WebSocket](https://cloud.tencent.com/document/product/1093/48982)，支持官方文档列出的通用、大模型和多语种模型。应用会根据 `8k_` 或 `16k_` 模型自动把音频转换为相应采样率的单声道 PCM16，并以约 200 ms 分包。`Hy-ASR-3.0-preview` 仅接受 16 kHz 单声道 PCM，且单次连接最长 60 秒。

`tencent_speech_recognition_v2` 对应[实时语音识别 V2 WebSocket](https://cloud.tencent.com/document/product/1093/131127)，只接受 `16k_zh_en_2.0` 与 `16k_zh_en_speaker_2.0`。后者开启说话人分离并可输出 `speaker_id`。`sentenceStrategy` 为 `0` 时使用 VAD 断句，为 `1` 时使用语义断句。

V9 到 V10 的显式迁移会保留全部旧字段，新增两组默认识别配置。无版本、结构不完整和高于 V10 的配置仍被拒绝。凭据继续以明文存入本机配置并作为 Python 命令行参数传递；日志会脱敏，但操作系统进程参数仍可能被本机其他高权限进程读取。
