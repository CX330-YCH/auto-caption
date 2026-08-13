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

字幕引擎不得把普通调试文本写入 stdout。调试信息应写入 stderr，或使用下列日志事件。每次写入一条完整事件后必须立即刷新 stdout。

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
  index: number,
  time_s: string,
  time_t: string,
  text: string,
  translation: string
}
```

字幕引擎产生的字幕数据。`index` 必须是有限数值，其余列出的字段必须是字符串。

Python 内部已经区分 `CaptionPartial` 和 `CaptionFinal`，但为保持现有协议兼容，两者目前都映射为 `caption`。同一句的 partial/final 复用 `index` 和 `time_s`；外部协议暂不提供 final 标记。Provider 自带的翻译（当前为 Gummy）会直接写入 `translation`；包括 Fun-ASR 在内的其他 Provider 只在 final 后通过独立 `translation` 消息补充一次翻译。

Fun-ASR 的 `sentence_end: false/true` 分别映射为内部 partial/final。服务端 `begin_time`/`end_time` 毫秒偏移会基于本次任务起始时间转换为协议中的 `time_s`/`time_t`，不会用回调到达时间冒充音频时间；缺少 partial 结束时间时才以已发送音频时长作为保守上界。服务端心跳不形成 stdout 消息；任务用量映射为 `usage`，失败映射为已脱敏的 `error`，外部 command envelope 没有变化。

每个 Fun-ASR 连接 generation 都维护独立生命周期状态。同一 generation 的 `on_error`、随后到达的 `on_close` 以及 Session 最后的 `stop()` 只允许触发一次重连或一次最终失败。收到服务端 task-failed 后不会再向已失效 SDK task 发送 `stop()`；SDK 因该竞态产生的预期 `InvalidParameter` 只进入隐藏的 `debug` 诊断，不形成用户错误。鉴权、权限、参数和模型不可用等永久失败立即终止；限流、超时、网络和 5xx 等暂时失败才进入最多三次的指数退避重连。未知 SDK/传输错误仍受相同重试上限约束。

Fun-ASR 的预编译热词表 ID 和上下文术语是任务启动参数，不新增 stdout/TCP command。每次有界重连产生新任务时都会重新传入；上下文按一条 `user/input_text` 消息发送，最多 400 字符。

### `translation`

```js
{
  command: "translation",
  time_s: string,
  text: string,
  translation: string
}
```

异步翻译结果。现有实现通过 `time_s` 关联字幕；该字段和文本字段必须是字符串。

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
    generation: 1,
    retryable: false,
    statusCode: 401,
    code: "InvalidApiKey",
    serviceMessage: "...",
    requestId: "..."
  }
}
```

除 `version` 外的诊断字段均可缺省。`serviceMessage` 和所有 `details` 在 Python 与 Electron 两层再次脱敏；API Key、Token、密码或 Authorization 不得写入协议或日志。

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
