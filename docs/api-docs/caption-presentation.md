# 公共字幕呈现方案

本文档说明新增字幕显示方式时应复用的增量数据模型和精确换行组件。目标是让窗口、预览或后续显示器共享相同的字幕生命周期与 Chromium 实际排版结果，而不是各自实现一套 Provider 判断或字符数估算。

## 增量字幕模型

公共模型位于 `src/shared/captions.ts`，核心类型为 `IncrementalCaptionCollection`。输入和输出统一使用 `CaptionItem`：

```ts
interface CaptionItem {
  captionId: string
  index: number
  time_s: string
  time_t: string
  text: string
  translation: string
  phase: 'partial' | 'final' | 'unknown'
}
```

调用方通过 `upsert(item)` 写入字幕，并消费返回的 `CaptionCollectionChange[]`。一次写入可能返回两项变化：先把旧自定义引擎留下的 `unknown` 活跃句隐式固化，再插入新句。显示层和 IPC 分发层必须按返回顺序处理全部变化。

模型保证以下语义：

- 同一 `captionId` 的 partial 原地更新，不重复追加记录。
- final 固化后，延迟到达的 partial 不会重新打开或覆盖该句。
- 新字幕出现时，上一条仍为 partial/unknown 的活跃字幕会固化，兼容没有 lifecycle 元数据的旧引擎。
- 已到达的异步翻译在后续原文更新时保留；`updateTranslation` 始终按稳定 ID 关联。
- `replace`、`clear` 和 `findPosition` 可供完整状态同步、清空和索引查询复用。

新增显示方式应读取该模型已经规范化的 `CaptionItem[]`，不得根据 `time_s`、文本内容或 Provider 名称再次推断字幕身份和生命周期。

## 精确换行

精确换行的纯函数位于 `src/renderer/src/captions/visualLines.ts`，可复用组件位于 `src/renderer/src/components/caption/`：

- `segmentGraphemes`：按 Unicode grapheme cluster 分段，避免拆开代理对、组合附加符和 emoji 序列。
- `measureVisualLines`：在隐藏镜像文本节点上使用 DOM `Range.getClientRects()` 读取 Chromium 实际生成的 inline box，并返回视觉行文本。
- `buildVisualLines`：把测量位置转换为显式视觉行，同时保留输入中的硬换行和空行。
- `ExactCaptionText`：同步字体、字号、字重和容器宽度，合并一帧内的重复测量；在宽度和字体加载变化后自动重测。
- `CaptionViewport`：统一原文/译文、行数、阴影和拖动区域；当前字幕窗口与样式预览共同使用。

新增 Vue 字幕显示方式优先直接组合 `CaptionViewport`。如果布局只需要单段文字，可单独使用 `ExactCaptionText`；如果需要非 Vue 渲染器，则复用 `measureVisualLines`，并保证测量镜像与最终文本拥有完全相同的可用宽度和排版属性。

不要用固定字符数、canvas 平均字宽或字符串长度预测换行。中文、拉丁文、emoji、组合字符、不同字体 fallback 和 Chromium 的断行规则都会使这些估算与实际显示漂移。

## 当前边界

- 精确换行只负责得到稳定视觉行；本次没有实现逐行滚动动画。
- `lineBreak` 关闭时保留单行、显示文本尾部的既有行为。
- 工具栏采用绝对定位覆盖层，不参与字幕测量宽度；鼠标离开后自动隐藏，进入或键盘聚焦时显示。
- 生命周期协议和旧引擎兼容规则以 [字幕引擎进程协议](./caption-engine.md) 为准；IPC 字段以 [Electron IPC API](./electron-ipc.md) 为准。
