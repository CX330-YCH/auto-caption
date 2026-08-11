# Python 字幕引擎架构与扩展约束

本文档描述 Python 引擎当前职责边界和新增 Provider 时必须遵守的规则。它是开发文档，不改变现有用户命令行。

## 当前结构

现有 Gummy、Vosk、SOSV 和 GLM 均已迁移到统一架构：

```text
engine/
├── cli.py                     # CLI 参数和脱敏配置对象
├── main.py                    # Server、Registry、Session 装配入口
├── core/
│   ├── audio.py               # AudioFrame/Pipeline/CaptureWorker
│   ├── events.py              # 统一内部事件
│   ├── provider.py            # RecognitionProvider 生命周期
│   ├── session.py             # 音频、事件、翻译和关闭策略
│   └── worker.py              # 通用有界后台任务池
├── providers/
│   ├── registry.py            # Provider 注册和运行时构建
│   ├── gummy.py
│   ├── glm.py
│   ├── sosv.py
│   └── vosk.py
├── services/
│   └── translation.py         # Provider 无关的有界翻译服务
└── protocol/
    ├── ndjson.py              # NDJSON 解码
    ├── output.py              # 内部事件到旧 command 协议
    └── server.py              # Electron TCP 命令服务
```

旧 `audio2text/` 目录、各识别类的 `translate()` 循环、全局无界音频队列和 `utils.server` 兼容层已经删除。仓库中只有一套活动 Provider 实现。

以下节点尚未创建：

- `providers/fun_asr.py`：Fun-ASR 是新功能，不属于现有模型迁移，必须在配置、能力和在线测试同时落地时新增。
- `services/hotwords.py`：远端热词资源语义和用户操作流程尚未实现，不创建无调用方空壳。

## 依赖方向

```text
cli.py ──> typed options
main.py ──> ProviderRegistry ──> ProviderRuntime
                               ├─ RecognitionProvider
                               ├─ AudioPipeline
                               └─ TranslationService

AudioCaptureWorker ──> bounded Queue[AudioFrame]
RecognitionSession ──> Provider ──> internal events
internal events ──> ProtocolEventSink ──> stdout NDJSON
```

`core` 不得依赖具体 ASR SDK、stdout 协议、Electron、云服务或平台音频实现。Provider 不得直接写 stdout、读取全局音频队列或创建翻译线程。

## 核心接口

### AudioFrame 与音频采集

每一帧显式携带 PCM 字节、采样率、声道数、样本宽度、格式和单调捕获时间。

`AudioCaptureWorker` 负责：

- 打开平台音频源。
- 可选录制原始 WAV。
- 通过 Provider 对应的 `AudioPipeline` 转换数据。
- 写入容量为 `max(10, chunk_rate × 5)` 的有界音频队列。
- 采集异常时输出经过净化的错误类型并请求停止。

队列满时采集线程施加背压并定期检查停止状态，不无限积压内存。

### RecognitionProvider

所有 Provider 遵循相同生命周期：

```python
class RecognitionProvider:
    def start(self) -> None: ...
    def accept_audio(self, frame: AudioFrame) -> None: ...
    def stop(self) -> None: ...
```

Provider 通过容量有限的内部事件队列上报结果。`accept_audio()` 不返回协议字典，也不包含 Session 循环。

### 统一事件

- `CaptionPartial`：同一句可更新结果，禁止触发客户端翻译。
- `CaptionFinal`：固化结果；同一个 `caption_id` 在一个 Session 内最多提交一次翻译。
- `ProviderReady`：Provider 可以接收音频。
- `ProviderInfo`：非错误状态信息。
- `ProviderStopped`：Provider 已结束。
- `ProviderError`：经过分类和脱敏的错误；`fatal` 表示 Session 必须停止。
- `UsageUpdated`：用量变化，不携带凭据。

`CaptionPartial` 和 `CaptionFinal` 可携带 Provider 已产生的翻译。Gummy 使用该字段承载服务端翻译；其他 Provider 的最终字幕由统一 TranslationService 异步翻译。

内部 partial/final 目前都由 `ProtocolEventSink` 映射为现有 `command: "caption"`，外部协议没有新增字段。未来若要暴露 final，必须进行带版本的协议设计。

### RecognitionSession

Session 负责：

1. 启动 Provider 后启动音频采集。
2. 从有界队列读取 `AudioFrame` 并交给 Provider。
3. 发布 Provider 的同步或异步事件。
4. partial 只更新字幕；final 按 `caption_id` 去重后提交翻译。
5. fatal Provider 错误请求终止进程任务。
6. 无论正常或异常，都停止 Provider、冲刷事件、关闭翻译服务和音频设备。

Session 捕获的异常只输出 Provider 名和异常类型，不直接回显可能包含凭据的异常文本。

## ProviderRegistry

`main.py` 不再使用四套 `main_<provider>()` 和 `if/elif` 装配。Registry 根据 `ProviderConfig.name` 选择唯一 builder，并返回：

- Provider 实例。
- 对应音频 Pipeline。
- 对应 TranslationService。

API Key 字段在 `CliOptions` 和 `ProviderConfig` 的 `repr` 中隐藏。未知或重复 Provider 名会被明确拒绝。

新增 Provider 时必须注册 builder，不能在 `main.py` 增加新的完整流程副本。

## 当前 Provider 行为

### Vosk

- 输入：16 kHz、单声道、PCM16。
- 同步返回 partial/final。
- partial 去重并复用同句 ID/起始时间。
- final 由统一翻译服务处理。

### SOSV

- 输入：16 kHz、单声道、PCM16。
- Sherpa-ONNX backend 封装 VAD、离线识别和标点模型。
- 周期性解码产生 partial；VAD 完整片段产生 final。
- Provider 不再包含 stdout、共享队列或翻译线程。

### GLM

- 输入：16 kHz、单声道、PCM16。
- 保留原 RMS VAD 分段阈值和 15 秒 HTTP 超时。
- 识别请求使用 2 个 worker、最多 8 条等待任务。
- 只允许 HTTP/HTTPS endpoint；错误不回显响应正文或凭据。
- 停止时取消未开始的请求、有限等待正在执行的请求，超时后丢弃迟到结果。

### Gummy

- 输入：音频设备原始采样率，经 Pipeline 合并为单声道 PCM16。
- 使用 SDK `is_sentence_end` 区分 partial/final。
- 保留服务端翻译并随 caption 事件输出，不调用客户端翻译服务。
- SDK usage 在关闭时映射为 `UsageUpdated`。
- 可重试音频发送错误最多累计 5 次；超过上限产生 fatal ProviderError，由 Session 统一终止。

## 翻译服务与后台任务

Vosk、SOSV 和 GLM 的 final 通过统一翻译服务调用已有 Google/Ollama 实现：

- 固定 2 个 daemon worker。
- 最多等待 32 条翻译任务。
- 队列满时跳过最新翻译并输出 `warn`，不删除原字幕。
- 任务异常只输出异常类型。

通用 `BoundedWorkerPool` 同时为翻译和 GLM 识别请求提供容量限制。Provider 不得自行创建无界线程或无界任务队列。

现有翻译函数的网络取消、有限结果冲刷和外部稳定 ID 关联仍是后续独立改造事项。

## Electron 配置 V2

Electron 持久化、主进程、IPC 和渲染进程现在共享 `src/shared/config/` 中的 V2 分层模型：

```text
ConfigDocumentV2
├── application          # 语言、主题、颜色、窗口布局
├── engine
│   ├── provider         # 当前内置 Provider
│   ├── common           # 语言、音频、翻译、录音、启动超时
│   ├── providers        # Gummy/Vosk/SOSV/GLM 专属配置
│   └── custom           # 自定义可执行文件和命令
└── caption              # 字幕样式
```

`AllConfig` 是主进程中的配置所有者，只接受 `schemaVersion: 2`。Renderer 通过 application、engine、caption 三个完整层级交换配置，主进程重新校验后才更新内存；运行态 `engineEnabled` 与 PID、端口、日志不进入磁盘配置。

引擎启动参数由纯函数 `EngineCommandBuilder` 从 `EngineConfig` 构建，`CaptionEngine` 不再读取扁平 controls 或拼装各 Provider 字段。Builder 内部使用 Provider 参数注册表，共用音频、录音、端口和目标语言参数只生成一次。

本阶段按明确决策不提供旧无版本配置迁移：旧文件被拒绝，本次运行使用默认 V2，退出时写回 V2。完整字段、范围和凭据限制见 [`config-v2.md`](../api-docs/config-v2.md)。

## 兼容性

- `main.py` 路径、全部 CLI 参数、默认值和 Provider 名称保持不变。
- Electron/Python 的 `caption`、`translation`、`info`、`warn`、`error`、`usage` 和 `kill` command 结构不变。
- Vosk、SOSV 和 GLM 的 final 使用统一客户端翻译；Gummy 继续使用服务端翻译。
- `-d 1` 现在按参数声明正确启用终端字幕显示；迁移前入口把整数错误地与字符串比较，导致该参数不生效。
- 直接导入旧 `audio2text.*Recognizer` 的未文档化内部路径不再支持。应用公开扩展点仍是命令行和进程协议。
- Electron 内部配置 IPC 已由扁平 `Controls` 切换为 V2 application/engine/caption 分层对象；该 IPC 不作为第三方公开扩展点。

## 新 Provider 接入顺序

1. 定义能力和配置，不把供应商字段追加到 Session。
2. 使用伪造 SDK 客户端固化生命周期、partial/final、错误、停止和 usage。
3. 实现只接受 `AudioFrame`、只产生统一事件的 Provider。
4. 在 Registry 注册 Provider/Pipeline/TranslationService builder。
5. 验证外部 command 协议和错误脱敏。
6. 对需要网络的 Provider 增加有界重试、停止冲刷和显式在线测试。

Fun-ASR 和热词属于后续功能阶段，不能通过复制 Gummy 或在 `main.py` 增加条件分支接入。
