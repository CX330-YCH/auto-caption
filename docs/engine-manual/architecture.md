# Python 字幕引擎架构与迁移约束

本文档描述 Python 引擎的目标职责边界、当前迁移状态和新增 Provider 时必须遵守的规则。它是开发文档，不改变用户命令行用法。

## 当前迁移状态

第三阶段采用纵向切片，不一次性重写所有识别引擎：

```text
engine/
├── main.py                    # 现有 CLI 和迁移期装配入口
├── core/
│   ├── audio.py               # AudioFrame、AudioSource、AudioPipeline
│   ├── events.py              # 统一内部事件
│   ├── provider.py            # RecognitionProvider 生命周期
│   └── session.py             # 音频队列、事件和翻译策略
├── providers/
│   └── vosk.py                # 第一条已迁移 Provider
├── services/
│   └── translation.py         # Provider 无关的有界翻译服务
├── protocol/
│   ├── ndjson.py              # NDJSON 解码
│   ├── output.py              # 内部事件到旧 command 协议
│   └── server.py              # Electron TCP 命令服务
├── audio2text/
│   ├── gummy.py               # 待迁移旧实现
│   ├── glm.py                 # 待迁移旧实现
│   └── sosv.py                # 待迁移旧实现
└── utils/
    └── server.py              # protocol.server 的临时兼容导入
```

以下推荐节点尚未创建：

- `cli.py`：等 Provider registry 和配置对象稳定后再从 `main.py` 提取，避免本阶段同时改写所有引擎装配。
- `providers/fun_asr.py`：尚未授权功能接入，也没有可验证实现，因此不创建空壳。
- `services/hotwords.py`：远端热词资源语义和能力校验尚未落地，因此不创建无调用方抽象。

## 依赖方向

```text
main.py
  ├─ core.session
  ├─ providers.vosk
  ├─ services.translation
  └─ protocol.output

providers.vosk ──> core
services.translation ──> core events
protocol.output ──> core events
core ──> Python 标准库
```

`core` 不得依赖具体 ASR SDK、stdout 协议、Electron、云服务或平台音频实现。Provider 不得直接写 stdout、读取全局音频队列或启动翻译线程。

## 核心接口

### AudioFrame

每一帧必须显式携带：

- PCM 字节。
- 采样率。
- 声道数。
- 样本宽度。
- 捕获时的单调时钟值。
- 格式名称；当前为 `pcm_s16le`。

`AudioPipeline` 把平台音频块转换为 `AudioFrame`。Vosk 路径输出 16 kHz、单声道、PCM16；Provider 会在接收前再次验证这些条件。

### RecognitionProvider

所有新 Provider 遵循相同生命周期：

```python
class RecognitionProvider:
    def start(self) -> None: ...
    def accept_audio(self, frame: AudioFrame) -> None: ...
    def stop(self) -> None: ...
```

Provider 通过内部事件队列上报结果。`accept_audio()` 不返回业务字典，也不得包含 Session 循环。

### 统一事件

- `CaptionPartial`：同一句的可更新中间结果，禁止触发翻译。
- `CaptionFinal`：固化结果；同一个 `caption_id` 在一个 Session 中最多提交一次翻译。
- `ProviderReady`：Provider 已可接收音频。
- `ProviderStopped`：Provider 已结束，用于保持现有生命周期日志。
- `ProviderError`：分类后的 Provider 错误，`fatal` 表示 Session 必须请求停止。
- `UsageUpdated`：用量变化，不携带凭据。

内部 partial/final 目前都会由 `ProtocolEventSink` 映射为现有 `command: "caption"`，从而保持 Electron 协议兼容。外部协议尚无 final 标记；未来如需暴露，必须单独进行带版本的协议设计。

### RecognitionSession

Session 是 Provider 无关的策略层，负责：

1. 启动 Provider，确认 ready 事件后再启动音频采集线程。
2. 从有界音频队列读取 `AudioFrame`。
3. 将音频交给 Provider，并发布统一事件。
4. partial 只更新字幕；final 按稳定 `caption_id` 去重后提交翻译。
5. Provider 异常只输出经过净化的异常类型，不回显可能含凭据的异常文本。
6. 无论正常停止或异常，都依次停止 Provider、冲刷事件、关闭翻译服务和音频设备。

Vosk 音频队列最多缓存 `max(10, chunk_rate × 5)` 帧。队列满时采集端等待并定期检查停止状态，不无限积压内存。

## 翻译服务

Vosk Provider 不再选择翻译后端或创建翻译线程。Session 仅在 `CaptionFinal` 后调用 `TranslationService.submit()`。

当前兼容服务继续调用已有 Google/Ollama 函数，但调度改为：

- 固定 2 个 daemon worker。
- 最多等待 32 条翻译任务。
- 队列满时丢弃最新任务并通过 `warn` 明确报告。
- 原字幕已经先发布，翻译失败或过载不会删除字幕。

现有翻译函数的网络超时、取消和稳定字幕关联仍有历史限制；这些应在独立的 TranslationService 深化阶段处理。

## Vosk 迁移的兼容面

- CLI 参数及 `-e vosk` 选择方式不变。
- Vosk model path 去除包围双引号的行为不变。
- partial 继续复用当前 `index` 和 `time_s`；非空 final 使用相同值后递增 index。
- stdout 仍输出现有 `caption`、`translation` 和 `info` 消息。
- Vosk SDK 只存在于 `providers/vosk.py`；原 `audio2text/vosk.py` 已移除，应用入口不再调用旧 `translate()` 循环。

Vosk Google 翻译现在通过统一服务使用其正确函数签名；旧 Vosk 代码向 Google 函数传入多余参数、会在线程中失败，这是本次迁移中被消除的旧路径缺陷。

## 后续迁移顺序

一次只迁移一个 Provider，并对每个 Provider 重复以下流程：

1. 用固定输入和伪造 SDK 客户端固化当前 partial/final 行为。
2. 把 SDK 调用移入 `providers/<name>.py`，只产生统一事件。
3. 切换到 `RecognitionSession`、`AudioPipeline` 和统一翻译服务。
4. 验证外部 command 协议、停止行为和错误脱敏。
5. 删除该 Provider 的旧循环，记录兼容边界和回滚方式。

建议下一条迁移 SOSV；它是本地模型且结果边界相对明确。GLM 存在录音分段和并发 HTTP 请求，应在音频分段事件明确后迁移。Gummy 是异步回调和服务端翻译模型，应在 Session 支持异步事件唤醒及 usage/final 语义后迁移。Fun-ASR 和热词只能在这些边界可验证后作为新功能接入。

当全部旧 Provider 都迁移完成后，才能删除 `audio2text/` 旧目录和 `utils.server` 兼容导入；不得长期维护两套活动实现。
