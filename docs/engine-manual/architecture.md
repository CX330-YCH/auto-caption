# Python 字幕引擎架构与扩展约束

本文档描述 Python 引擎当前职责边界和新增 Provider 时必须遵守的规则。它是开发文档，不改变现有用户命令行。

## 当前结构

现有 Gummy、Vosk、SOSV、GLM 和 Fun-ASR 均通过统一架构运行：

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
│   ├── fun_asr.py
│   ├── glm.py
│   ├── sosv.py
│   └── vosk.py
├── services/
│   ├── hotwords.py            # 运行时热词配置与一次性远端管理服务
│   └── translation.py         # Provider 无关的有界翻译服务
└── protocol/
    ├── ndjson.py              # NDJSON 解码
    ├── output.py              # 内部事件到旧 command 协议
    └── server.py              # Electron TCP 命令服务
```

旧 `audio2text/` 目录、各识别类的 `translate()` 循环、全局无界音频队列和 `utils.server` 兼容层已经删除。仓库中只有一套活动 Provider 实现。

`services/hotwords.py` 分离两种职责：`HotwordRuntimeConfig` 只把已验证的热词表 ID 和上下文构造成 Fun-ASR 任务启动参数；`HotwordService` 只在一次性管理模式中调用官方 `VocabularyService`。Provider 不负责资源 CRUD，远端管理也不进入 RecognitionSession。

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

Electron HotwordService ──stdin──> main.py --hotword-service
                               └─> VocabularyService ──> 阿里云远端资源
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

`CaptionPartial` 和 `CaptionFinal` 可携带 Provider 已产生的翻译。Gummy 使用该字段承载服务端翻译；包括 Fun-ASR 在内的其他 Provider 的最终字幕由统一 TranslationService 异步翻译。

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

`main.py` 不再使用按 Provider 复制的 `main_<provider>()` 和 `if/elif` 装配。Registry 根据 `ProviderConfig.name` 选择唯一 builder，并返回：

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

### Fun-ASR Realtime

- 使用阿里云官方 DashScope Python SDK 的 `Recognition.start()`、`send_audio_frame()` 和 `stop()`，不在 Provider 内复制底层 WebSocket 任务协议。
- 输入经共享 Pipeline 规范化为 16 kHz、单声道、PCM16；默认 `chunk_rate=10`，即约 100 ms 一帧。
- SDK callback 中的 `sentence_end` 映射为 partial/final；心跳被忽略；服务端毫秒时间戳映射为任务起点上的字幕时间；duration 用量映射为 `UsageUpdated`。
- API Key 可来自 `-fkey` 或 `DASHSCOPE_API_KEY`。Workspace ID、API Key 和专属 Endpoint 必须属于同一地域；配置层只接受官方北京或新加坡 WSS 主机和固定 inference 路径。
- 非主动关闭连接最多重连 3 次，退避为 0.25、0.5、1 秒；重连期间最多保留约 5 秒（50 帧）新音频，溢出时丢弃最旧帧并上报信息事件。回调带连接 generation，旧连接迟到事件会被忽略。
- generation 使用 `connecting → active → failed/closing → closed` 状态机。`on_error` 先到时会原子声明失败，后续 `on_close` 和 Session `stop()` 只执行幂等清理，不重复重连或上报。鉴权、权限、参数、欠费和模型不可用属于永久错误并立即 fatal；限流、超时、网络与 5xx 才重试，未知 SDK 错误仍受三次上限约束。
- `stop()` 只对仍处于活动状态的 SDK task 发送 `finish-task` 并等待剩余结果和 `task-finished`。task-failed 后不再调用 SDK `stop()`；DashScope SDK 1.26.7 的失败任务 silence timer 由版本隔离适配器取消，避免 PyInstaller 子进程额外存活约 23 秒。预期的 `InvalidParameter` 仅形成隐藏 `ProviderDebug`。Session 再冲刷统一事件，`ProviderStopped` 只发布一次。
- fatal `ProviderError` 将共享状态切换为 stop，Session 依次关闭 Provider、翻译服务、音频流和 TCP Server 后正常退出，不再主动输出 `kill`。Electron 仅在停止超时等异常路径强杀；POSIX 打包引擎作为独立进程组启动，macOS/Linux 强杀对整个组发送 `SIGKILL`，Windows 继续使用 `taskkill /T /F`。
- `HotwordRuntimeConfig` 在每个新 SDK client 的 `Recognition(...)` 构造参数中传入预编译 `vocabulary_id`，并在 `start()` 传入 `raw_input.context`；重连任务重复构造和传入。不能把新版预编译词表误传给 SDK 的旧 `phrase_id` 接口。热词表目标模型必须与识别模型一致，上下文合计最多 400 字符且没有权重。
- Fun-ASR 不提供集成翻译，final 由统一翻译服务提交一次。

## 独立热词服务

热词实现分为两级：

- 一级是 V2 持久配置中的 `vocabularyId`、`targetModel` 和 `contextTerms`，只在用户应用配置后影响后续识别任务。
- 二级是远端热词管理器，支持 list/query/create/update/delete；update 按官方语义完整替换词表。修改和删除前先查询资源并校验 `target_model`。

Electron 主进程从已应用配置取得 Workspace、Endpoint、模型和 API Key，重新验证 Renderer 请求后启动一次性 Python worker。API Key 仅写入子进程 stdin，不进入 Renderer、argv 或日志。worker 只返回规范化数据或错误码；输入/输出均有 1 MiB 上限，主进程限制单个在途操作并设置 20 秒超时。创建、更新、删除只能由 UI 用户操作触发，删除前显示目标账号语义、Workspace、地域、模型和资源 ID 并二次确认。因 SDK 不返回账号 ID，界面将目标账号明确表示为“已应用 API Key 的所属账号”，不显示密钥或账号标识。

## 翻译服务与后台任务

Vosk、SOSV、GLM 和 Fun-ASR 的 final 通过统一翻译服务调用已有 Google/Ollama 实现：

- 固定 2 个 daemon worker。
- 最多等待 32 条翻译任务。
- 队列满时跳过最新翻译并输出 `warn`，不删除原字幕。
- 任务异常只输出异常类型。

通用 `BoundedWorkerPool` 同时为翻译和 GLM 识别请求提供容量限制。Provider 不得自行创建无界线程或无界任务队列。

现有翻译函数的网络取消、有限结果冲刷和外部稳定 ID 关联仍是后续独立改造事项。

## Electron 配置 V3

Electron 持久化、主进程、IPC 和渲染进程共享 `src/shared/config/` 中的 V3 分层模型：

```text
ConfigDocumentV3
├── application          # 语言、主题、颜色、窗口布局
├── engine
│   ├── activeEngineId   # 当前内置 Provider 或自定义引擎 ID
│   ├── common           # 语言、音频、翻译、录音、启动超时
│   ├── providers        # 五个内置 Provider 的专属配置
│   └── customEngines    # 命名自定义引擎列表
└── caption              # 字幕样式
```

`AllConfig` 是主进程中的配置所有者，只接受 `schemaVersion: 3`。Renderer 通过 application、engine、caption 三个完整层级交换配置，主进程重新校验后才更新内存；运行态 `engineEnabled` 与 PID、端口、日志不进入磁盘配置。

引擎启动参数由纯函数 `EngineCommandBuilder` 从 `EngineConfig` 构建，`CaptionEngine` 不再读取扁平 controls 或拼装各 Provider 字段。Builder 内部使用 Provider 参数注册表，共用音频、录音、端口和目标语言参数只生成一次。

完整 V2 会显式迁移到 V3；旧 `custom.enabled` 状态转换为 `activeEngineId` 与命名条目。无版本和其他不支持的版本仍被拒绝并使用默认 V3。完整字段、范围和凭据限制见 [`config-v3.md`](../api-docs/config-v3.md)。

## Renderer 能力目录

字幕引擎设置不再在 `EngineControl.vue` 中按 Provider 编写表单分支。Renderer 使用独立目录描述引擎能力、语言和字段：

```text
src/renderer/src/engines/
├── catalog.ts                 # 注册、公共字段合成、默认值和统一校验
├── form.ts                    # V3 配置路径读写、草稿复制和可见性判断
├── types.ts                   # capability、字段和校验描述类型
└── providers/
    ├── gummy.ts
    ├── fun_asr.ts
    ├── vosk.ts
    ├── sosv.ts
    ├── glm.ts
    └── shared.ts              # 语言描述辅助函数
```

每个 Provider 定义以下内容：

- 稳定 Provider ID 和三语名称键。
- 源语言选择方式、翻译模式、录音和热词能力。
- 支持的源/目标语言及其角色。
- 仅属于该 Provider 的字段描述、帮助链接、默认值和启动校验。

`catalog.ts` 根据能力补齐语言、音频、翻译、录音和超时字段。`EngineFieldRenderer.vue` 统一渲染普通控件；`EngineSelector.vue` 负责内置 Provider、命名自定义引擎、创建入口和删除确认；`EngineControl.vue` 维护一份草稿并按字段 section 分组。外部翻译配置仅在启用翻译且用户展开“配置翻译引擎”时显示，折叠状态不持久化。Fun-ASR 专属字段和热词能力仍由目录元数据驱动。

新增普通 Provider 的前端流程是：先扩展 V3 Provider 类型和主进程校验，再新增一个 `providers/<name>.ts` 定义并在目录注册。常规字段不得在 `EngineControl.vue` 增加 Provider `v-if`。热词远端资源管理器等包含列表编辑、远端创建/删除和确认流程的交互应使用专用组件，并由 capability 明确声明；不得把这类状态压成普通文本字段。

Provider 的启动前要求同样由目录字段校验提供，`EngineStatus.vue` 不再维护本地模型名单。目录和嵌套表单工具均为无 Vue 依赖的纯 TypeScript，可由 Node 单元测试验证。

## 兼容性

- `main.py` 路径、全部 CLI 参数、默认值和 Provider 名称保持不变。
- Electron/Python 的 `caption`、`translation`、`info`、`warn`、`error`、`usage` 和 `kill` command 结构不变。
- Vosk、SOSV、GLM 和 Fun-ASR 的 final 使用统一客户端翻译；Gummy 继续使用服务端翻译。
- `-d 1` 现在按参数声明正确启用终端字幕显示；迁移前入口把整数错误地与字符串比较，导致该参数不生效。
- 直接导入旧 `audio2text.*Recognizer` 的未文档化内部路径不再支持。应用公开扩展点仍是命令行和进程协议。
- Electron 内部配置 IPC 使用 V3 application/engine/caption 分层对象；该 IPC 不作为第三方公开扩展点。

## 新 Provider 接入顺序

1. 定义能力和配置，不把供应商字段追加到 Session。
2. 使用伪造 SDK 客户端固化生命周期、partial/final、错误、停止和 usage。
3. 实现只接受 `AudioFrame`、只产生统一事件的 Provider。
4. 在 Registry 注册 Provider/Pipeline/TranslationService builder。
5. 验证外部 command 协议和错误脱敏。
6. 对需要网络的 Provider 增加有界重试、停止冲刷和显式启用的在线测试。

Fun-ASR 与两级热词已按上述顺序完成离线可验证纵向接入；真实账号、地域、设备、计费和远端 CRUD 链路仍需在有凭据时由用户显式执行在线验收。后续 Provider 的热词能力应继续复用独立服务边界，不能通过复制识别循环、在 `main.py` 增加 Provider 条件分支或向通用表单塞入临时资源状态接入。
