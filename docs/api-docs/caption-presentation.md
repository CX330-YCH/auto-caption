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
- `measureVisualLineSlices`：在隐藏镜像文本节点上使用 DOM `Range.getClientRects()` 读取 Chromium 实际生成的 inline box，并返回每行文本及其 UTF-16 `start/end`；`measureVisualLines` 是只取文本的公共薄封装。
- `buildVisualLineSlices`：把测量位置转换为显式视觉行范围，同时保留输入中的硬换行和空行。
- `ExactCaptionText`：同步字体、字号、字重和容器宽度，合并一帧内的重复测量；区分内容更新和布局更新，并在宽度、字体加载变化后自动重测。布局重测即使换行结果未变也会回报行数据，调用方因此可以在同一次有效测量中原子地重置布局状态。
- `captionGeometry.ts`：集中规范逐行模式的 1–4 行容量、`1.6` 行高和轨道块高度，避免预览与字幕窗口各自估算。
- `captionTracks.ts`：从规范化 `CaptionItem[]` 构建原文/译文 segment，按句边界或连续策略组合逻辑文本，把视觉行范围映射为稳定的 `captionId + captionOffset` 锚点，并提供有界轨道窗口；尾部纯增长、尾部重写、生命周期变化、追加、历史变化和清空拥有不同的更新分类。
- `rollingTrackState.ts`：维护独立于测量裁剪锚点的单调展示下界。内容更新只能向后推进下界，不能让已经滚出的视觉行重新进入；原文和译文各有自己的状态。只有明确的布局重排会重置该下界。
- `RollingCaptionTrack`：单条轨道的唯一测量、固定 N 行容量和 500 ms FLIP 动画实现；只有尾部纯增长或追加产生的新视觉行可以动画，partial 重写、生命周期变化和历史译文补写不会冒充新字幕滚动。
- `RollingCaptionViewport`：只组合原文和译文两个 `RollingCaptionTrack`，两轨共享断句策略但独立测量、截取和滚动。
- `CaptionViewport`：按 `styles.displayMode` 在原有整句显示和逐行滚动之间选择，统一原文/译文、行数、阴影和拖动区域；字幕窗口与样式预览共同使用。

新增 Vue 字幕显示方式优先扩展 `CaptionViewport` 的呈现分派，并继续消费规范化的 `CaptionItem[]`。如果布局只需要单段文字，可单独使用 `ExactCaptionText`；如果需要非 Vue 渲染器，则复用 `measureVisualLines`，并保证测量镜像与最终文本拥有完全相同的可用宽度和排版属性。

不要用固定字符数、canvas 平均字宽或字符串长度预测换行。中文、拉丁文、emoji、组合字符、不同字体 fallback 和 Chromium 的断行规则都会使这些估算与实际显示漂移。

## 两种内置方式

- `static`：保留原有按最近字幕条数显示的方式；`lineBreak` 关闭时保持单行并显示文本尾部。
- `rolling`：始终使用精确换行；自动折出的完整行两端对齐，显式断句行和轨道末行保持左对齐；原文和译文各自建立 `lineNumber` 个固定视觉行槽并独立滚动，内容不足时从底部显示并保留空槽，异步译文不会占用原文行额度。partial 缩短或重写只更新仍位于当前展示下界之后的行，不会用已经滚出的历史行填补空槽；若一次重写暂时没有文本越过下界，轨道会保留空槽，直到后续增长或下一条字幕到达。
- 公共 `CaptionViewport` 在四边提供 `10px` 安全边距。滚动轨道的隐藏测量镜像与显示行共享扣除边距后的内容宽度，字幕窗口和样式预览不会因边距产生不同换行。
- `RollingCaptionLine.breakKind` 区分 `soft`（相邻视觉行偏移连续）、`hard`（中间消耗显式换行符）和 `end`（轨道末行）。只有包含多个 Unicode grapheme 的 `soft` 行应用 `text-align-last: justify`，避免把单字符行、短句、空行和实时增长的末行强行拉伸。
- `captionBoundaryMode: sentence`：每个规范化 `CaptionItem` 边界插入硬换行，保持原有逐句呈现。
- `captionBoundaryMode: continuous`：字幕边界使用语言感知连接符而不是硬换行；下一条字幕利用上一行剩余宽度。原文和译文同时切换，但仍是两个独立轨道。
- 轨道从最近 segment 开始测量，不足 `lineNumber + 2` 个安全视觉行时向前扩展；达到目标后以实测行首锚点裁剪。该测量锚点只控制隐藏 DOM 的性能窗口，不参与“哪些行已经滚出”的展示语义。每轨最多测量 256 个 segment 和 16384 个 UTF-16 code unit，避免字幕记录增长导致隐藏 DOM 无界。
- 显示与断句方式属于持久化样式配置；V3→V4 默认 `static`，V4→V5 默认 `sentence`，V5→V6 只增加默认关闭的 Debug Mode，升级不会改变字幕行为。
- 工具栏采用绝对定位覆盖层，不参与字幕测量宽度或对称安全边距；鼠标离开后自动隐藏，进入或键盘聚焦时显示。
- Renderer 报告字幕根节点的向上取整内容高度；主进程验证消息来源与 `22–16384px` 数值范围后，把原生窗口最小/最大高度锁定为该值。窗口因此只允许横向调整，宽度重排后再由相同测量链更新高度。
- 生命周期协议和旧引擎兼容规则以 [字幕引擎进程协议](./caption-engine.md) 为准；IPC 字段以 [Electron IPC API](./electron-ipc.md) 为准。
