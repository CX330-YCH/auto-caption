# 配置文件 V5

> 本文保留用于说明历史格式；当前格式为 [配置文件 V7](./config-v7.md)。应用会把完整 V5 依次迁移到 V6、V7。

Auto Caption 的持久化配置位于 Electron `userData/config.json`。V5 使用 `schemaVersion: 5`，当时磁盘、主进程、IPC 和渲染进程共享 `ConfigDocumentV5`。

## 文档结构

以下为分层结构示意，不可直接作为完整配置复制；字体、颜色、阴影和各 Provider 专属字段为节省篇幅省略：

```json
{
  "schemaVersion": 5,
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
    "common": {},
    "providers": {},
    "customEngines": []
  },
  "caption": {
    "styles": {
      "displayMode": "static",
      "captionBoundaryMode": "sentence"
    }
  }
}
```

`application` 保存应用外观和窗口布局；`engine.common` 保存 Provider 共用设置；`engine.providers` 保存供应商专属字段；`engine.customEngines` 保存命名自定义进程；`caption.styles` 保存字幕呈现方式和样式。运行状态、字幕记录、软件日志、PID 和端口不写入配置文件。

## 字幕显示与断句边界

`caption.styles.displayMode` 是必需字段：

- `static`：原有整句显示；`lineNumber` 表示最近字幕条数，`lineBreak` 决定长字幕是否换行。
- `rolling`：逐行滚动；始终按 Chromium 实际布局精确换行，原文和译文分别保留 `lineNumber` 个视觉行。

`caption.styles.captionBoundaryMode` 也是必需字段，只在逐行滚动中改变排版：

- `sentence`：跟随 `CaptionItem` 断句边界强制换行。
- `continuous`：不在 `CaptionItem` 边界强制换行；下一条字幕接在上一条末尾，原文和译文分别作为连续文本轨道按实际宽度换行。

一个 `captionBoundaryMode` 同时作用于原文和译文，但两条轨道的文本、行额度、异步更新和滚动动画保持独立。连续模式在拉丁文本片段之间补必要空格，CJK 片段直接相接；字幕文本自身的硬换行始终保留。

默认值为 `displayMode: static`、`captionBoundaryMode: sentence`，因此新安装和旧配置迁移均保持既有行为。

## 校验

- V5 文档中的 `schemaVersion` 严格等于 `5`；当前应用会把完整 V2、V3、V4、V5 按顺序显式迁移到 V6。
- `displayMode` 只能是 `static` 或 `rolling`。
- `captionBoundaryMode` 只能是 `sentence` 或 `continuous`。
- Renderer 发送的完整 caption 层由主进程重新校验。
- 语言、主题、颜色、窗口尺寸、Provider、翻译、Fun-ASR、热词和其他字幕样式继续使用既有严格范围。
- V5 同层未知扩展字段会被保留，已知字段始终严格校验。

## 旧配置迁移

- V4→V5：保留全部分层配置和未知扩展字段，在 `caption.styles` 写入 `captionBoundaryMode: "sentence"`。
- V3→V5：先写入 V4 的 `displayMode: "static"`，再执行 V4→V5。
- V2→V5：先迁移命名自定义引擎到 V3，再依次执行 V3→V4→V5。
- 无版本、V1、结构不完整和未来版本配置仍被拒绝，本次运行使用 V6 默认配置。

迁移不会自动启用逐行滚动、连续排版或 Debug Mode，避免升级改变字幕窗口行为。向旧版程序回滚前，应恢复升级前配置备份；旧程序会把 V6 视为未来版本。

## IPC、协议和凭据

V5 当时沿用 application、engine、caption 三个完整层级的 IPC，不新增通道。Python stdout NDJSON、本地 TCP command、字幕 partial/final、翻译关联和 CLI 参数不变。该版本不改变 API Key 的存储、传递和脱敏规则，也不新增远端请求或付费资源。
