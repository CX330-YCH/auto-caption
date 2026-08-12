# 测试与验证基线

本文档说明 Auto Caption 的本地、确定性验证入口。默认测试不得访问真实麦克风、扬声器或付费云端 API。

## 环境要求

- 已安装项目 Node.js 依赖。
- Node.js 22.6 或更高版本，用于内置 TypeScript type stripping。
- Python 字幕引擎虚拟环境已创建，并安装 `engine/requirements.txt` 中的依赖。

Python 测试启动器会优先使用项目虚拟环境：

- Windows：`engine/.venv/Scripts/python.exe`
- macOS/Linux：`engine/.venv/bin/python3`

虚拟环境不存在时，启动器会回退到系统 `python` 或 `python3`。

## 常用命令

运行全部离线测试：

```bash
npm test
```

分别运行 Node.js 和 Python 测试：

```bash
npm run test:node
npm run test:python
```

运行不产生发布包的日常验证：

```bash
npm run verify
```

执行应用构建：

```bash
npm run build
```

`npm run build` 会执行类型检查并生成 Electron 构建输出，但不会打包安装程序。

## ESLint 债务基线

`eslint-suppressions.json` 精确记录建立基线时已经存在的 ESLint 违规。它的作用是冻结既有债务，而不是关闭规则：

- 已登记的旧违规暂时不阻断验证。
- 新增违规仍会使 `npm run lint` 失败。
- 修复旧违规后，应使用 ESLint 的 `--prune-suppressions` 清理失效记录。
- 不得为了让检查通过而无说明地增加 suppression 数量。

第一阶段登记了 84 个既有违规，主要是缺少显式返回类型和历史 `any` 使用。它们应在独立的代码质量变更中逐步清理，不与新功能混改。

## 当前覆盖范围

Node.js 测试覆盖：

- V2 分层配置默认值、严格版本拒绝、嵌套字段校验、Fun-ASR 热词模型/上下文约束和未知扩展字段保留。
- 从 V2 `EngineConfig` 为 Gummy、Vosk、SOSV、GLM、Fun-ASR 及自定义引擎生成启动参数，并验证 Fun-ASR Endpoint/Workspace、热词 ID、目标模型和可重复上下文参数。
- Renderer 引擎目录的 Provider 唯一注册、能力驱动字段组合、嵌套草稿路径读写、条件可见性、Provider 启动要求、默认值归一化和语言默认值。
- 字幕时间字符串解析、毫秒换算和当前跨日行为。
- 命令行与配置对象中的 API Key 日志脱敏。
- 现有 Python/Electron NDJSON 协议夹具的基本结构。
- Electron 独立进程协议组件的 NDJSON 跨块缓冲、多消息合并、CRLF 与空行处理。
- stdout UTF-8 字符跨字节块、非法 JSON 恢复、单行上限和流关闭兼容行为。
- Electron 到 Python 命令的换行分帧，以及事件 envelope 和已知事件字段校验。
- 旧协议中间字幕复用 `index` 和 `time_s` 的关联方式。
- 翻译事件通过 `time_s` 关联字幕的当前行为。
- 热词管理请求和 `text | weight | lang` 编辑格式的纯 TypeScript 校验，以及热词 UI 三语键结构一致性。

Python 测试覆盖：

- 单声道音频保持不变。
- 多声道 PCM16 音频合并为单声道。
- 相同采样率路径的声道合并。
- 48kHz 到 16kHz 重采样后的帧数。
- 非法交错声道数据的拒绝行为。
- Python TCP 协议解码器的任意 `recv()` 分块、多消息、CRLF 和空行处理。
- TCP UTF-8 字符跨块、非法 UTF-8/JSON 恢复、单行上限和连接关闭兼容行为。
- `AudioFrame` 元数据校验和 `AudioPipeline` 帧构造。
- `RecognitionProvider` 生命周期及 `RecognitionSession` 的音频队列调度和资源关闭。
- partial 不触发翻译、重复 final 只提交一次翻译。
- Provider 异常文本脱敏和 fatal stop 请求。
- Vosk 适配器的 partial 去重、partial/final ID 关联和 16 kHz 单声道 PCM16 输入约束。
- 内部事件到现有 `caption`、`info`、`error`、`usage` 协议的映射。
- 翻译后台队列的容量上限和过载警告。
- CLI 默认值、现有 Provider 参数解析和凭据字段 `repr` 脱敏。
- ProviderRegistry 的完整注册集合、重复注册和未知 Provider 拒绝。
- `AudioCaptureWorker` 的 Pipeline 转换、有界入队和关闭信号。
- SOSV backend partial/final 映射、重复 partial 抑制和输入格式约束。
- GLM VAD 分段、异步 final、WAV 请求内容、URL 校验和错误正文脱敏。
- Gummy SDK callback 的 partial/final、服务端翻译、usage 和累计发送失败策略。
- Fun-ASR SDK callback 的 partial/final/heartbeat/usage 映射、服务端时间戳、final 去重、有界重连、缓冲溢出、错误脱敏、停止冲刷和 16 kHz 单声道 PCM16 输入约束；任务启动与重连会重复传入热词表 ID 和上下文。测试使用伪造 SDK 客户端，不建立网络连接。
- `HotwordRuntimeConfig` 的模型/上下文限制、基于伪造 `VocabularyClient` 的完整 CRUD、修改前模型检查，以及一次性 worker 的错误脱敏。测试不创建、更新或删除真实云资源。

## 本阶段未覆盖范围

- 真实音频设备和平台驱动。
- Electron 窗口、热词管理 IPC/子进程超时和浏览器交互集成。
- Ant Design Vue 通用引擎字段控件的浏览器交互、视觉布局和键盘可访问性。
- Electron `userData/config.json` 的真实磁盘读写和旧配置被 V2 默认值替换的桌面端流程。
- Python 子进程启动、超时、停止和强杀。
- Electron 与真实 Python 子进程之间的端到端 Socket/stdio 集成。
- 真实 Vosk/SOSV 模型文件以及实际 Gummy、GLM、Fun-ASR 或其他在线 Provider；阿里云远端热词表的 list/create/update/delete 也未执行。
- Ollama、OpenAI、Google 或阿里云付费 API。
- Windows、macOS、Linux 打包安装程序。

这些范围需要在后续阶段通过可注入的 Provider、进程适配器、固定音频回放和显式启用的在线测试逐步覆盖。
