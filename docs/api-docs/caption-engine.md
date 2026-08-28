# 字幕引擎进程协议

本文档定义字幕引擎与 Electron 主进程之间的本地通信约定。自定义字幕引擎也必须遵循本约定。

## 协议边界

通信分为两个单向通道：

- 字幕引擎到 Electron：字幕引擎的标准输出（stdout）。
- Electron 到字幕引擎：连接到启动参数 `-p/--port` 指定端口的 TCP Socket。

两个方向都使用 UTF-8 NDJSON：每条消息是一个 JSON 对象，并以单个换行符 `\n` 结束。`\r\n` 输入也可以被解析。空行被忽略。

`python main.py --hotword-service` 是 Electron 主进程专用的一次性热词管理模式：它只从 stdin 读取一份私有 envelope、向 stdout 写一份响应后退出，不启动音频、TCP Server 或 RecognitionSession，也不属于本文公开的自定义字幕引擎协议。该模式的输入限制为 1 MiB，凭据不出现在命令行和响应中。

```text
JSON object + "\n" + JSON object + "\n" + ...
```

协议读取方必须把 stdout 数据块和 TCP `recv()` 返回值视为任意字节片段，维护跨块缓冲；不得假设一次读取恰好等于一条消息。实现必须支持：

- 一条 JSON 被拆到多个数据块中。
- UTF-8 多字节字符在任意字节位置被拆分。
- 多条 JSON 合并在同一个数据块中。
- 单条非法消息后继续解析下一条合法消息。

当前实现对单条未分帧消息设置 1 MiB 安全上限。超过上限的当前行会被丢弃，读取方从下一个换行符恢复。错误日志只记录错误类型和行号，不回显原始协议内容。

为兼容现有自定义引擎，Electron 在 stdout 关闭时仍尝试解析最后一条没有换行符的完整 JSON；新引擎不得依赖该兼容行为。Python TCP 端同样只会在连接关闭时尝试解析末尾未换行的完整 JSON。

## 消息 envelope

现有 `command` envelope 保持不变。每条消息必须是 JSON 对象，并包含字符串类型的 `command`：

```js
{
  command: string
}
```

未知 `command` 会被记录并忽略。已知命令如果缺少必需字段，会被拒绝且不进入字幕、翻译或窗口消息流程。

## 标准输出事件

> 方向：字幕引擎进程 → Electron 主进程

字幕引擎不得把普通调试文本写入 stdout。调试信息应写入 stderr，或使用下列日志事件。每次写入一条完整事件后必须立即刷新 stdout。Electron 使用增量 UTF-8 解码器完整接收 stderr；Python traceback、SDK 自有日志和多行诊断都会写入本次 Debug JSONL，不再按任意进程数据块截断字符或丢弃热词子进程 stderr。

### `connect`

```js
{
  command: "connect",
  content: ""
}
```

字幕引擎的 TCP Socket 服务已准备好，Electron 可以开始连接。

### `kill`

```js
{
  command: "kill",
  content: ""
}
```

通知 Electron 强制结束当前字幕引擎进程。

### `caption`

```js
{
  command: "caption",
  event_version: 1,
  phase: "partial" | "final",
  index: number,
  time_s: string,
  time_t: string,
  text: string,
  translation: string
}
```

字幕引擎产生的字幕数据。`index` 必须是有限数值，并且在一次引擎进程运行期间稳定标识同一句字幕；其余内容字段必须是字符串。同一句的中间结果和最终结果必须复用 `index`，不同句不得复用。

`event_version: 1` 与 `phase` 是一组版本化的生命周期字段，必须同时出现：`partial` 表示同一句仍可继续更新，`final` 表示该句已经固化。内置引擎始终发送这两个字段。服务端可以校正 `time_s`/`time_t`，时间字段不得用作字幕身份；延迟到达的 `partial` 也不得把已经 `final` 的句子重新打开或覆盖。Provider 自带的翻译（当前为 Gummy）会直接写入 `translation`；包括 Fun-ASR 在内的其他 Provider 只在 final 后通过独立 `translation` 消息补充一次翻译。

为兼容旧自定义引擎，`event_version` 和 `phase` 可以整组省略。Electron 会把这种事件标记为 `unknown`，仍按稳定 `index` 更新；当另一个新 `index` 首次出现时，上一条尚未固化的 `unknown` 字幕会被隐式转为 `final`。只提供其中一个字段、使用未知版本或未知 phase 的消息会被拒绝。兼容层的删除条件是公开协议未来发布带明确迁移期的新主版本。

Electron 为每次引擎启动分配单调递增的运行 ID，并将 `运行 ID:index` 组合为应用内部 `captionId`。因此引擎重启后可以从原有 `index` 起点重新计数，而不会覆盖上一次运行保留的字幕。

### `caption_remove`

```js
{
  command: "caption_remove",
  event_version: 1,
  index: number
}
```

撤回当前引擎运行中尚未固化的字幕。`index` 必须是有限数值，并与先前 `caption.index` 相同。Electron 使用运行 ID 组合出内部 `captionId`，从控制窗口、字幕窗口和内存日志同步移除；找不到目标时安全忽略。此命令是为 Apple Speech volatile 结果修订新增的向后兼容事件；旧自定义引擎无需实现，已经 final 的字幕不得撤回。

Fun-ASR 的 `sentence_end: false/true` 分别映射为内部 partial/final。服务端 `begin_time`/`end_time` 毫秒偏移会基于本次任务起始时间转换为协议中的 `time_s`/`time_t`，不会用回调到达时间冒充音频时间；缺少 partial 结束时间时才以已发送音频时长作为保守上界。服务端心跳不形成 stdout 消息；任务用量映射为 `usage`，失败映射为已脱敏的 `error`，外部 command envelope 没有变化。

每个 Fun-ASR 连接 generation 都维护独立生命周期状态。同一 generation 的 `on_error`、随后到达的 `on_close` 以及 Session 最后的 `stop()` 只允许触发一次重连或一次最终失败。收到服务端 task-failed 后不会再向已失效 SDK task 发送 `stop()`；SDK 因该竞态产生的预期 `InvalidParameter` 只进入隐藏的 `debug` 诊断，不形成用户错误。鉴权、权限、参数和模型不可用等永久失败立即终止；限流、超时、网络和 5xx 等暂时失败才进入最多三次的指数退避重连。未知 SDK/传输错误仍受相同重试上限约束。

Fun-ASR 的预编译热词表 ID 和上下文术语是任务启动参数，不新增 stdout/TCP command。每次有界重连产生新任务时都会重新传入；上下文按一条 `user/input_text` 消息发送，最多 400 字符。

### `translation`

```js
{
  command: "translation",
  caption_id?: number,
  time_s: string,
  text: string,
  translation: string
}
```

异步翻译结果。新引擎应提供 `caption_id`，其值必须与对应 `caption.index` 相同，Electron 会优先通过运行 ID 与该字段关联原句。为兼容旧自定义引擎，`caption_id` 暂时可省略；缺失时 Electron 才回退到 `time_s`，该兼容层的删除条件是公开协议下一个明确废弃旧翻译格式的版本。`time_s`、`text` 和 `translation` 继续为必需字符串字段。

内置实现现在由独立 `TranslationProvider`/Registry/Session 生成该消息；Google 与 Ollama Provider 返回统一 `TranslationResult`，协议层负责序列化。此内部重构没有修改上述公开字段、CLI 参数或旧自定义引擎兼容规则。

### `print`、`debug`、`info`、`warn`、`error`、`usage`

这些事件共用以下结构：

```js
{
  command: "info",
  content: string
}
```

- `print`：输出普通引擎文本，不计入应用日志。
- `debug`：只写入本次软件启动的完整 Debug 日志文件，不进入原有日志记录页，也不弹出通知。
- `info`：引擎提示信息。
- `warn`：引擎警告信息。
- `error`：引擎错误信息，并在前端显示错误消息。
- `usage`：引擎结束时的计费或资源消耗信息。

`content` 必须是字符串，且不得包含 API Key、Token 或密码。

内置引擎可以在 `debug` 上附加 `details` 对象；也可以在 `error` 上附加以下版本化诊断。Electron 仅将诊断写入完整 Debug 日志，用户通知仍只显示 `content`：

```js
{
  command: "error",
  content: "Fun-ASR task failed (InvalidApiKey).",
  diagnostic: {
    version: 1,
    provider: "fun_asr",
    operation: "fun_asr.callback.on_error",
    generation: 1,
    retryable: false,
    statusCode: 401,
    code: "InvalidApiKey",
    serviceMessage: "...",
    requestId: "...",
    sdkResult: { "...": "SDK callback fields" },
    errorType: "RuntimeError",
    errorModule: "builtins",
    errorMessage: "...",
    errorArgs: ["..."],
    errorAttributes: { "...": "..." },
    stackTrace: "Traceback ...",
    cause: { "...": "nested exception diagnostic" }
  }
}
```

除 `version` 外的诊断字段均可缺省。内置 Gummy、Fun-ASR、GLM、Vosk 和 SOSV，以及音频采集、翻译服务、热词 SDK、Provider 启停和 Session 清理路径，都使用同一诊断序列化规则：普通异常保留类型、模块、消息、参数、自定义属性、完整 traceback、cause/context；SDK 回调对象保留可序列化公开字段和实例属性；二进制音频仅记录类型和长度。Debug Mode 不以性能为由缩减内容；为防止失控对象耗尽内存，Python 与 Electron 的单个字符串最多保留 32 MiB、单个集合最多 4096 项、嵌套最多 16 层，并明确写入截断标记。

`serviceMessage`、`sdkResult`、异常属性、stderr 和所有 `details` 在 Python 与 Electron 两层再次脱敏。实际命令行中的 API Key、环境变量 Key、Token、密码、Authorization、Cookie 和其他凭据不得写入协议或日志；因此这里的“完整”指凭据脱敏及有界保护后的完整诊断，而不是原样保存秘密或音频正文。

### Debug Mode 指标

内置引擎接受 `--debug-mode 0|1`。运行中 Electron 可以通过现有 TCP command envelope 发送 `{ "command": "debug_mode", "content": "enabled" | "disabled" }` 即时切换；`stop` 语义不变。该命令只发送给内置引擎，不强加给旧自定义引擎。

Debug Mode 开启后，Python 使用以下可选事件发送有界结构化指标：

```json
{
  "command": "metric",
  "event_version": 1,
  "provider": "fun_asr",
  "category": "audio.queue",
  "name": "snapshot",
  "fields": {
    "depth": 4,
    "capacity": 50
  }
}
```

指标覆盖音频读取/转换/入队耗时、队列深度和满队列等待、帧龄、`accept_audio` 耗时、Provider event 队列、Fun-ASR 重连缓冲、GLM 请求池、翻译任务池及 Apple Speech helper 写入/输出状态。每帧只记录格式、字节数、音频时长和时间信息，不传输 PCM 正文。

### 大诊断分块

超过 512 KiB 的内置引擎错误诊断不再塞入单条 `error`。Python 先输出若干 `diagnostic_chunk`，每块包含 `event_version: 1`、`id/index/count/content`，内容是 Base64 JSON；随后 `error.diagnostic_ref` 携带总字节数和 SHA-256。Electron 在 32 MiB、256 块的安全上限内重组并校验，成功后恢复为原 `diagnostic`；缺块、长度或哈希不一致会显式写入 `diagnostic_incomplete`。小诊断和旧 `error.diagnostic` 格式保持不变。

## Apple Speech 私有辅助协议

该协议只用于内置 `apple_speech` Provider，不是自定义字幕引擎扩展点。Swift 可执行文件支持 `probe`、`model-status --locale`、`model-install --locale`、`model-release --locale` 和 `transcribe --locale --sample-rate --channels`。除 `transcribe` 从 stdin 持续读取原始 PCM16 外，命令不接收 stdin。stdout 始终为 UTF-8 NDJSON：

```js
{
  protocolVersion: 1,
  type: "capability" | "model-status" | "model-progress" |
        "ready" | "transcript" | "error",
  payload: object
}
```

`transcript.payload.phase` 为 `partial`、`final` 或 `revoke`，并携带稳定整数 `id`；partial/final 同时带 `text`、`startSeconds` 和 `endSeconds`。`model-status` 与模型进度同时带系统级 `systemInstalled`、模块 `state/phase`、`reservedLocales` 和保留上限，进度可带 0–1 的 `fractionCompleted`。系统返回的下划线 locale 在 Electron 边界规范为 BCP-47 连字符格式。任何普通调试输出必须写 stderr。主进程和 Python Provider 都校验 `protocolVersion === 1`，不兼容时拒绝使用。

## TCP 命令

> 方向：Electron 主进程 → 字幕引擎进程

每条 TCP 命令采用以下结构，并以 `\n` 结束：

```js
{
  command: string,
  content: string
}
```

Electron 发送命令时只记录命令名，不记录 `content`，避免后续扩展把敏感参数写入日志。

### `stop`

实际传输内容：

```text
{"command":"stop","content":""}\n
```

命令当前字幕引擎停止监听并结束任务。Python 端收到该命令后把共享运行状态切换为 `stop`，随后关闭客户端 Socket。

## 兼容性说明

- `command` 名称和现有字段没有改名或删除，原有自定义引擎事件保持兼容。
- `debug` 是新增的可选命令；`error.diagnostic` 和 `debug.details` 是可选附加字段。旧自定义引擎无需产生这些字段，新 Electron 会忽略它不认识的附加字段。
- 新版 Electron 发出的 TCP JSON 末尾新增明确的换行帧边界。JSON 解析器会把该换行视为空白，因此通常兼容原先直接对单次读取调用 `json.loads` 的自定义引擎；自定义实现仍应尽快改为增量 NDJSON 解码。
- 末尾无换行消息仅作为连接/流关闭时的旧实现兼容，不支持在长连接中连续发送多条无分隔 JSON。
- 本阶段没有新增协议版本字段；这是对既有 `command` 协议分帧规则的明确化和容错修复，而不是新的业务消息版本。
