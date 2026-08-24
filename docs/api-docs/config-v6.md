# 配置文件 V6

Auto Caption 的持久化配置位于 Electron `userData/config.json`。当前版本接受 `schemaVersion: 6`，磁盘、主进程、IPC 和 Renderer 共享 `ConfigDocumentV6`。

V6 保留原有 `application`、`engine`、`caption` 分层，并在应用配置中增加诊断设置：

```json
{
  "schemaVersion": 6,
  "application": {
    "language": "zh",
    "theme": "system",
    "accentColor": "#1677ff",
    "layout": {
      "leftBarWidth": 8,
      "captionWindowWidth": 900
    },
    "diagnostics": {
      "debugMode": false
    }
  },
  "engine": {},
  "caption": {}
}
```

`application.diagnostics.debugMode` 必须是布尔值，默认 `false`，在通用设置修改后立即生效。开启时 Electron、Renderer 和内置 Python 引擎记录完整的脱敏异常、协议事件、每帧音频元数据、队列延迟/深度以及 Provider、翻译和进程指标。日志可能包含识别文本、翻译文本、本地路径、模型名称和服务端错误正文。

Debug Mode 绝不记录 API Key、Token、密码、Authorization、Cookie 或 PCM/其他二进制正文。二进制值只保存类型与长度。自由文本和结构化对象都会在 Python 与 Electron 边界再次脱敏。

迁移顺序为 V2→V3→V4→V5→V6。V5→V6 保留全部已知配置和同层未知扩展字段，只增加：

```json
"diagnostics": { "debugMode": false }
```

无版本、结构不完整及未来版本配置仍被拒绝，本次运行使用 V6 默认配置。向旧版应用回滚前应恢复升级前配置备份；旧版程序会把 V6 视为未来版本。
