# Auto Caption 变更记录

本文件记录仓库内每次文件修改的授权、范围、行为、兼容性、验证和风险。记录按时间追加，不覆盖历史。面向用户发布的版本变化仍记录在 `docs/CHANGELOG.md`；两者用途不同，不互相替代。

## 2026-08-11 - 建立项目级开发约束与变更记录制度

### 授权与目标

- 用户授权：要求生成完整的项目级约束并放到仓库根目录。
- 目标：固化本项目的授权边界、架构演进原则、Fun-ASR/热词技术约束、测试要求和变更记录规范，避免通过连续补丁堆积技术债。
- 变更类型：文档、工程治理。

### 修改文件

- `AGENTS.md`
  - 新增全仓库项目级约束。
  - 规定只读请求与写入授权的边界。
  - 规定修改前检查、渐进式重构、目标架构、配置迁移、协议兼容、安全、测试、文档和交付要求。
  - 明确 Fun-ASR、预编译热词、上下文术语和远端热词资源的实现边界。
- `change.md`
  - 新增强制变更流水记录文件。
  - 定义本文件与面向发布的 `docs/CHANGELOG.md` 的职责差异。
  - 记录本次工程治理文档变更。

### 行为变化

- 修改前：仓库根目录没有统一的代理/开发约束，也没有要求每次文件修改保留完整工程记录。
- 修改后：所有后续仓库工作均受根目录 `AGENTS.md` 约束；每次文件修改必须在同一批次追加 `change.md` 记录。
- 本次没有修改应用运行行为、用户界面、字幕引擎、配置或构建逻辑。

### 配置与协议

- 配置版本：无变化。
- Electron IPC：无变化。
- Python/Electron 子进程协议：无变化。
- 命令行参数：无变化。
- 持久化数据结构：无变化。

### 兼容性、迁移与回滚

- 兼容性：纯文档治理变更，不影响现有 Windows、macOS 或 Linux 运行行为。
- 数据迁移：不需要。
- 回滚方式：删除本次新增的 `AGENTS.md` 和 `change.md` 即可恢复修改前状态；执行回滚前仍应确认没有后续记录依赖这两个文件。

### 验证

- `git diff --check`：通过。
- 人工检查：确认约束覆盖全仓库，且 `change.md` 包含本次新增文件、行为、兼容性、验证和风险说明。
- 未执行 `npm run typecheck`、`npm run lint`、`npm run build`：本次只新增 Markdown 文档，不涉及 TypeScript、Vue、Python、依赖或构建配置。

### 风险与后续事项

- 约束本身不会自动改善现有架构；后续实施仍需按阶段建立测试保护、协议解析、Provider 抽象和配置迁移。
- 若未来新增子目录级 `AGENTS.md`，必须与根目录约束保持一致，不能降低安全和记录要求。

### 参考与决策依据

- 项目现有 Electron/Vue/Python 双进程架构。
- 前期对 Fun-ASR Realtime、预编译热词、上下文增强和当前代码扩展点的技术评估。

## 2026-08-11 - 第一阶段：建立可验证基线

### 授权与目标

- 用户授权：要求执行“第一阶段：建立可验证基线”。
- 目标：在不接入新识别引擎、不访问真实音频设备和付费 API、不改变应用运行行为的前提下，建立可重复执行的 Node.js/Python 测试、类型检查、lint 和构建入口。
- 变更类型：测试、构建工具、文档。

### 修改文件

- `package.json`
  - 新增 `test`、`test:node`、`test:python` 和 `verify` 脚本。
  - 未新增、删除或升级任何依赖，因此 `package-lock.json` 无变化。
- `eslint.config.mjs`
  - 将旧版 Vue ESLint 配置改为 ESLint 9 flat config 版本，修复配置加载崩溃。
  - 对 JavaScript 测试文件关闭仅适用于 TypeScript 类型签名的显式返回类型规则。
- `eslint-suppressions.json`
  - 使用 ESLint 9 bulk suppressions 精确冻结基线建立前已经存在的 84 个违规。
  - 保留原规则，使后续新增违规仍会导致 lint 失败。
- `scripts/run-node-tests.mjs`
  - 新增跨平台 Node.js 测试发现和启动器。
  - 使用 Node 内置 test runner 和 TypeScript type stripping，不引入第三方测试框架。
- `scripts/run-python-tests.mjs`
  - 新增跨平台 Python 测试启动器。
  - 优先使用项目 `engine/.venv`，不存在时回退到系统 Python。
- `tests/node/timeCalc.test.mjs`
  - 固化字幕时间解析、毫秒换算、非补零显示和当前跨日不回绕行为。
- `tests/node/utilsFunc.test.mjs`
  - 验证命令行和配置对象 API Key 脱敏，并验证输入对象不会被修改。
- `tests/node/engineProtocolFixture.test.mjs`
  - 验证旧版引擎协议夹具为逐行 JSON。
  - 固化 partial 字幕复用 `index`/`time_s` 以及 translation 通过 `time_s` 关联最新字幕的当前行为。
- `tests/fixtures/engine-events.ndjson`
  - 新增不含密钥和外部数据的确定性旧协议事件夹具。
- `engine/tests/test_audioprcs.py`
  - 新增 PCM16 单/双声道合并、相同采样率、48kHz 到 16kHz 帧数和非法声道数据测试。
  - 通过文件路径直接加载音频处理模块，避免引入字幕引擎其他运行时副作用。
- `engine/tests/fixtures/stereo_s16le.hex`
  - 新增短小、可审查的固定双声道 PCM16 十六进制夹具。
- `docs/testing.md`
  - 新增本地验证命令、环境要求、当前覆盖范围、非目标和 ESLint 债务基线说明。
- `change.md`
  - 追加本阶段完整变更与验证记录。

### 行为变化

- 修改前：没有自动化测试入口；`npm run lint` 在加载 ESLint 配置时崩溃；无法通过单一命令执行离线基线验证。
- 修改后：`npm test` 可运行 9 个 Node.js 测试和 5 个 Python 测试；`npm run verify` 可顺序执行类型检查、lint 和全部离线测试；`npm run build` 可完成 Electron 构建。
- 应用窗口、字幕识别、翻译、配置读写和进程协议运行行为没有修改。
- ESLint 的 84 个既有违规被精确登记而非修复或全局关闭；后续新增违规仍会失败。

### 配置与协议

- 用户持久化配置：无变化。
- Electron IPC：无变化。
- Python/Electron 子进程协议：无变化；仅新增旧协议测试夹具。
- Python 引擎命令行：无变化。
- npm 开发脚本：新增测试和验证命令。
- 依赖与锁文件：无变化。

### 兼容性、迁移与回滚

- 应用兼容性：没有运行时代码变化，不需要用户数据迁移。
- Node 测试要求 Node.js 22.6 或更高版本；应用本身的既有构建要求没有在本阶段调整。
- Python 启动器同时识别 Windows 和 macOS/Linux 虚拟环境路径。
- 回滚方式：删除新增测试、夹具、启动器、测试文档和 suppression 文件，恢复 `package.json` 测试脚本及 `eslint.config.mjs` 对应改动即可；无需回滚业务代码或用户配置。

### 验证

- 修改前 `npm run typecheck`：通过。
- 修改前 `npm run lint`：失败；ESLint flat config 加载旧版 Vue 配置时抛出 `extends` 类型错误。
- 修复 flat config 后首次 `npm run lint`：正常执行并报告 85 个既有违规，其中 1 个来自新增测试辅助函数；测试目录规则调整后，最终基线登记 84 个既有业务代码违规。
- 首次 `npm test`：失败；Node test runner 不接受目录作为显式测试入口。
- 第二次 `npm test`：8/9 个 Node 测试通过，协议夹具测试错误地选择同一句第一条 partial；修正为选择相同 `time_s` 的最新字幕。
- 最终 `npm test`：通过；Node.js 9/9，Python 5/5。
- 最终 `npm run lint`：通过，既有违规由 `eslint-suppressions.json` 精确登记。
- 最终 `npm run typecheck`：通过。
- 最终 `npm run verify`：通过；顺序完成类型检查、lint、9 个 Node.js 测试和 5 个 Python 测试。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 均完成构建。
- `git diff --check`：通过。
- 未执行安装程序打包、真实音频设备、真实识别模型、翻译服务或付费 API 测试：这些不属于本阶段授权范围，且需要平台设备或外部凭据。

### 风险与后续事项

- `eslint-suppressions.json` 中仍有 84 个历史违规，需要在独立质量改进变更中逐步清理，不能在功能接入时顺手混改。
- Node 内置 TypeScript 加载在当前 Node 25 环境会输出 `MODULE_TYPELESS_PACKAGE_JSON` 性能提示，但不影响测试结果；本阶段没有通过添加 `type: module` 改变整个项目模块语义。
- npm 会提示 `.npmrc` 中 Electron mirror 配置在未来 npm 大版本中可能不再支持；本阶段未修改镜像配置。
- 当前协议测试是契约夹具测试，尚未覆盖 Electron stdout 跨数据块解析；该问题应在下一阶段通过独立 decoder 和边界测试处理。
- 当前音频测试只验证纯 PCM 处理，不代表真实音频设备或 ASR 模型已经验证。
- 本次仅在 macOS 环境执行 Electron 普通构建，没有验证 Windows/Linux 安装包。

### 参考与决策依据

- Node.js 内置 test runner 和 type stripping，避免为基线新增第三方测试依赖。
- Python 标准库 `unittest`，避免新增测试依赖。
- ESLint 9 bulk suppressions，用于冻结既有违规并防止新增债务。

## 2026-08-11 - 第二阶段：修复进程协议并建立独立 Electron 协议组件

### 授权与目标

- 用户授权：要求执行“第二阶段：修进程协议，为后续修改做准备”，并进一步建议新增独立的 Electron 组件。
- 目标：在不接入新识别 Provider、不修改引擎选择和字幕业务的前提下，修复 stdout/TCP 把任意数据块误当成完整 JSON 的协议缺陷，并把协议细节从 `CaptionEngine` 中分离。
- 变更类型：修复、最小职责重构、测试、文档、构建配置。
- 明确非目标：不接入 Fun-ASR、不增加热词、不修改 UI、持久化配置、Electron IPC、音频链路、翻译逻辑或现有 `command` 名称。

### 修改文件

- `src/main/engine/protocol/EngineEventDecoder.ts`
  - 新增独立的 Electron stdout 增量 NDJSON 解码器。
  - 使用 UTF-8 流式解码，支持 JSON/多字节字符跨数据块、多条消息合并、CRLF、空行和流关闭时的旧格式尾帧。
  - 对单行设置 1 MiB 上限；非法行不阻断下一行，错误不回显原始消息。
- `src/main/engine/protocol/EngineProtocol.ts`
  - 新增 Electron 进程协议门面，统一管理 decoder 生命周期、基础 `command` envelope 校验和 TCP 命令编码。
  - Electron 发出的命令统一编码为以 `\n` 结尾的 UTF-8 NDJSON 帧。
- `src/main/engine/protocol/messages.ts`
  - 新增引擎消息类型及 `caption`、`translation`、日志内容事件的运行时字段校验。
- `src/main/utils/CaptionEngine.ts`
  - 改为使用独立 `EngineProtocol`，不再自行对每个 stdout 数据块直接 `split`/`JSON.parse`。
  - 在进程关闭时冲刷 decoder 尾帧，在每次启动前重置 decoder。
  - 保持现有事件分发目标不变，但拒绝字段类型不合法的已知事件。
  - TCP 命令增加换行帧边界；命令日志只记录命令名，不再记录完整 `content`。
  - 为本次触及的方法和回调补充准确返回值/参数类型，减少历史 `any`。
- `engine/protocol/__init__.py`
  - 新增 Python 协议包的稳定导出边界。
- `engine/protocol/ndjson.py`
  - 新增基于字节缓冲的 Python NDJSON decoder，正确处理任意 `recv()` 分块和跨块 UTF-8。
  - 支持多消息、CRLF、空行、非法 UTF-8/JSON 后恢复、1 MiB 上限及连接关闭时的旧格式尾帧。
- `engine/utils/server.py`
  - TCP 接收改为增量解码，不再假设一次 `recv()` 等于一条 JSON。
  - 增加消息 envelope 校验和安全错误日志；继续只处理既有 `stop` 命令。
  - 接受客户端后关闭只用于监听的 server socket，客户端 socket 在 `finally` 中关闭。
- `tests/node/engineEventDecoder.test.mjs`
  - 新增 Electron NDJSON 跨块、多消息、UTF-8 字节边界、非法行恢复、尾帧、上限和重置测试。
- `tests/node/engineProtocol.test.mjs`
  - 新增命令换行编码、基础 envelope 和已知事件字段校验测试。
- `engine/tests/test_ndjson.py`
  - 新增 Python decoder 对称边界测试，包括非法 UTF-8 不泄漏输入内容。
- `docs/api-docs/caption-engine.md`
  - 完整明确双向 UTF-8 NDJSON 分帧、读取方缓冲责任、安全上限、错误恢复和兼容规则。
  - 修正文档中 `kill` 示例误写为 `connect` 的错误。
  - 记录每个现有事件的必需字段及 TCP `stop` 的实际传输格式。
- `docs/testing.md`
  - 更新协议测试覆盖范围，并将 stdout 跨块解析从“未覆盖”移出。
  - 保留真实子进程 Socket/stdio 集成为后续未覆盖事项。
- `tsconfig.node.json`
  - 启用仅用于无输出类型检查的 `allowImportingTsExtensions`，使 Node 内置测试可直接加载独立 TypeScript 协议组件，同时保持 Electron Vite 构建通过。
- `eslint-suppressions.json`
  - 仅清理本阶段触及 `CaptionEngine.ts` 后已经失效的 suppression。
  - 历史登记总数由 84 降为 74；没有新增或扩大 suppression。
- `change.md`
  - 追加本阶段的授权、文件、协议行为、兼容性、验证、风险和回滚记录。

### 修改前后行为

- 修改前：Electron 对每次 stdout `data` 事件单独转字符串并按换行解析；一条 JSON 或一个 UTF-8 字符跨块时会解析失败，多条/残缺 TCP JSON 也依赖一次 `recv()` 的偶然边界。
- 修改后：Electron 和 Python 都维护有界 NDJSON 缓冲，以换行确定帧边界，并可在单条非法消息后继续处理后续合法消息。
- 修改前：Electron TCP 命令是没有显式结束标记的 JSON 字符串。
- 修改后：Electron TCP 命令以 `\n` 结束；Python 可在一个 `recv()` 中处理零条、一条或多条完整消息。
- 修改前：任意带 `command` 的解析结果直接进入现有业务方法，已知事件字段未做运行时检查。
- 修改后：基础 envelope 和已知事件字段先验证；不合法事件只记录分类错误，不进入字幕、翻译或窗口错误分发。
- 现有合法 `connect`、`kill`、`caption`、`translation`、`print`、`info`、`warn`、`error`、`usage` 和 `stop` 语义没有变化。

### 配置、接口与协议

- 用户持久化配置及 `schemaVersion`：无变化，不需要迁移。
- Electron IPC：无变化。
- Python 引擎命令行：无变化。
- 字幕/翻译数据结构：合法消息字段无变化。
- 子进程协议 envelope：仍为现有 JSON 对象和字符串 `command`，没有删除、重命名或新增业务命令。
- 子进程协议 framing：双向明确为 UTF-8 NDJSON；Electron 到 Python 的命令新增末尾 `\n`。
- 协议版本字段：未新增。本阶段是既有 `command` 协议的分帧明确化和解析修复，不引入新的业务协议版本；未来新增 partial/final 等业务事件时仍需独立版本设计。
- 依赖与锁文件：没有新增、删除或升级依赖，`package.json` 和 `package-lock.json` 无变化。

### 兼容性、迁移与回滚

- 现有自定义引擎 stdout：合法的一行一条 JSON 完全兼容；流关闭前最后一条完整但无换行的 JSON 仍会被兼容解析。
- 现有自定义引擎 TCP：新版 Electron 增加的换行是合法 JSON 尾随空白，原先对单次数据调用常规 JSON parser 的实现通常仍可接受；依赖任意 TCP 分包边界的实现本身不可靠，应迁移为 NDJSON 增量读取。
- 旧版 Electron 到新版 Python：没有换行的最后一条命令可在连接关闭时解析；长连接中连续的无分隔 JSON 无法可靠兼容，也没有可靠的自动识别方式。
- Windows、macOS、Linux：使用 Node/Python 标准流和 socket 能力，没有新增平台专属分支；本阶段仅在 macOS 完成构建验证。
- 数据迁移：不需要。
- 回滚方式：恢复 `CaptionEngine.ts`、`engine/utils/server.py`、`tsconfig.node.json`、协议/测试文档和 suppression 的本阶段改动，并删除本阶段新增的 `src/main/engine/protocol/`、`engine/protocol/` 及三个协议测试文件；无需修改用户配置或远端资源。

### 验证

- 首次 `npm run test:node && npm run test:python && npm run typecheck`：失败；Node 15/17 通过。一个上限测试把合法 `connect` 帧也设置为超限，另一个失败来自 Node 直接加载 TypeScript 时无法解析组件内部无扩展名 import；因 `&&`，本次未继续运行 Python 和类型检查。
- 调整测试阈值和 TypeScript import 后执行 `npm run test:node; npm run test:python; npm run typecheck`：Node 20/20 通过，Python 12/12 通过；类型检查因尚未启用 `allowImportingTsExtensions` 报 TS5097，失败原因随后通过受限编译配置修复。
- `npm run typecheck && npm run lint`：类型检查通过；lint 仅因本次代码减少历史违规后出现失效 suppression 而以状态 2 退出。
- `./node_modules/.bin/eslint . --prune-suppressions && npm run lint`：通过；只删除 `CaptionEngine.ts` 的 10 个失效历史登记，suppression 总数从 84 降为 74。
- 最终 `npm run verify`：通过；类型检查、lint、Node 20/20 和 Python 12/12 全部通过。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 均完成 Vite 构建。
- 最终 `git diff --check`：通过。
- 未执行安装程序打包、Windows/Linux 构建、真实音频设备、真实识别模型、翻译服务和付费 API：不属于本阶段协议准备范围，且需要平台环境或外部凭据。
- 未执行真实自定义引擎兼容测试或 Electron/Python 完整子进程 Socket/stdio 集成测试：仓库当前没有隔离 Electron 全局对象和 Python 运行时重依赖的集成夹具；本阶段使用两端 decoder/encoder 的确定性单元测试覆盖协议边界。

### 风险、限制与后续事项

- 1 MiB 单帧上限是防止无换行输出无限占用内存的保护；未来若合法事件可能超过上限，应通过协议评审调整，而不是关闭限制。
- 无换行尾帧只在 stdout/连接关闭时兼容；长连接必须逐条发送换行分隔消息。
- Python TCP 服务仍保持现有单客户端、单 `stop` 命令范围；重连、认证和更多控制命令不在本阶段内。
- stderr 仍是普通日志流，不属于 NDJSON 业务协议，本阶段没有把 stderr 日志块另行抽象。
- 已知事件字段校验会拒绝过去偶然可传入但类型错误的消息；这是有意的协议收紧，合法自定义引擎不受影响。
- Node 测试仍会显示既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能提示；没有为消除提示而改变整个项目的模块类型。
- npm 仍会显示既有 Electron mirror 配置弃用提示；本阶段未修改镜像配置。
- 下一阶段可以在该协议边界之上继续拆分命令参数构建、进程生命周期和事件分发，再接入统一 Recognition Provider；不得把 Fun-ASR WebSocket 逻辑写回 `CaptionEngine`。

### 参考与决策依据

- 根目录 `AGENTS.md` 的进程协议、兼容性、安全和禁止堆叠式实现约束。
- 项目现有 `utils.sysout` 一行一条 JSON 并立即 flush 的输出行为。
- TCP 是无消息边界的字节流，因此使用显式换行分帧，并在读取方维护跨块缓冲。
- Node.js 标准库 `StringDecoder`、`Buffer` 和 Python 标准库 `json`、`socket`；未引入第三方协议依赖。

## 2026-08-11 - 第三阶段：建立 Python 引擎核心边界并迁移 Vosk

### 授权与目标

- 用户授权：要求执行“第三阶段：重构 Python 引擎层”，建立 `RecognitionProvider`、统一事件和 `RecognitionSession`，并明确要求不要一次性重写所有引擎，应先用 Vosk 适配器验证行为。
- 目标：完成一条可运行、可测试、可回滚的 Vosk 纵向切片，把音频帧、Provider、事件、Session、翻译调度和 stdout 协议分开；Gummy、GLM、SOSV 继续使用旧路径。
- 变更类型：渐进式重构、内部功能修复、测试、文档。
- 明确非目标：不接入 Fun-ASR、不实现热词、不创建空的 `fun_asr.py`/`hotwords.py`、不迁移其他三个 Provider、不改变 Electron UI、配置或 CLI 参数。

### 修改文件

- `engine/core/__init__.py`
  - 新增核心接口和事件的统一导出边界。
- `engine/core/audio.py`
  - 新增不可变 `AudioFrame`，显式携带 PCM 数据、采样率、声道、样本宽度、格式和捕获时间。
  - 新增结构化 `AudioSource` 协议和实际使用的 `AudioPipeline`。
- `engine/core/events.py`
  - 新增内部统一事件：`CaptionPartial`、`CaptionFinal`、`ProviderReady`、`ProviderError`、`UsageUpdated`。
  - 为保持已有关闭日志，补充 `ProviderStopped` 生命周期事件。
- `engine/core/provider.py`
  - 新增抽象 `RecognitionProvider`，统一 `start -> accept_audio(frame)* -> stop` 生命周期。
  - Provider 通过内部事件队列上报结果，不返回协议字典。
- `engine/core/session.py`
  - 新增 `RecognitionSession`，统一读取音频队列、调用 Provider、发布事件、处理 fatal stop 和关闭资源。
  - partial 不提交翻译；final 按 `caption_id` 去重，每个 ID 最多提交一次。
  - Provider 未处理异常只输出 Provider 名和异常类型，不回显可能包含凭据的异常文本。
  - 无论正常或异常路径，都停止 Provider、冲刷事件、关闭翻译服务和音频设备。
- `engine/providers/__init__.py`
  - 新增已迁移 Provider 导出边界；当前只导出 Vosk。
- `engine/providers/vosk.py`
  - 新增 Vosk Provider 适配器，专注 Vosk SDK 和 partial/final 事件生成。
  - 验证输入必须是 16 kHz、单声道、PCM16。
  - 保留旧 Vosk 的 partial 去重、同句 ID/起始时间复用和非空 final 后 ID 递增语义。
  - 支持注入 recognizer factory 和 clock，使测试不需要真实模型或音频设备。
- `engine/services/__init__.py`
  - 新增翻译服务导出边界。
- `engine/services/translation.py`
  - 新增无翻译实现和 Provider 无关的有界后台翻译服务。
  - 固定使用 2 个 daemon worker 和最多 32 条等待任务，替代每条 final 创建一个线程。
  - 队列过载时保留原字幕、跳过最新翻译并输出明确警告。
  - 提供旧 Google/Ollama 翻译函数的装配适配器。
- `engine/protocol/output.py`
  - 新增内部事件到现有 stdout `command` 协议的唯一映射点。
  - `CaptionPartial` 和 `CaptionFinal` 都映射为兼容的 `caption` 消息；生命周期、错误和用量映射为已有日志命令。
- `engine/protocol/server.py`
  - 将第二阶段建立的 TCP 命令服务移动到协议目录，使 server 和 NDJSON decoder 同属协议层。
  - 保持 stop、错误恢复和 Socket 行为不变；绑定失败时补充关闭监听 Socket。
- `engine/utils/server.py`
  - 改为 `protocol.server` 的临时兼容导入，不再保存活动实现。
- `engine/utils/__init__.py`
  - 将 `start_server` 改为延迟兼容入口，避免协议层移动产生循环导入。
- `engine/main.py`
  - Vosk 装配改用 `AudioPipeline`、本地有界音频队列、`VoskProvider`、`RecognitionSession`、统一翻译服务和 `ProtocolEventSink`。
  - Vosk Provider ready 后才启动音频采集，模型加载期间不积压音频。
  - Vosk 音频队列容量为 `max(10, chunk_rate × 5)` 帧；队列满时采集线程等待并定期检查停止状态。
  - 音频采集函数增加可选 pipeline 和 output queue；其他旧 Provider 不传这些参数，继续保持旧行为。
  - Vosk KeyboardInterrupt 路径显式停止共享运行状态，避免关闭设备后采集线程继续循环。
- `engine/audio2text/vosk.py`
  - 删除旧 Vosk 类，消除其内部共享队列循环、stdout 构造和逐字幕翻译线程。
- `engine/audio2text/__init__.py`
  - 删除旧 `VoskRecognizer` 导出；应用入口改用 `providers.VoskProvider`。
- `engine/tests/test_engine_core.py`
  - 新增 AudioFrame/Pipeline、Provider 生命周期、Session partial/final 策略、final 翻译去重、资源关闭和异常脱敏测试。
- `engine/tests/test_vosk_provider.py`
  - 使用伪造 recognizer 验证 Vosk partial 去重、final ID/时间关联、生命周期和音频格式约束。
- `engine/tests/test_protocol_output.py`
  - 验证统一内部事件映射为现有 caption/info/error/usage/warn 协议。
- `engine/tests/test_translation_service.py`
  - 验证翻译服务的有界等待队列和过载警告。
- `docs/engine-manual/architecture.md`
  - 新增 Python 引擎当前结构、依赖方向、核心接口、Vosk 兼容边界、临时兼容层删除条件和逐 Provider 迁移顺序。
  - 明确 `cli.py`、Fun-ASR 和 hotwords 尚未创建的原因，避免无调用方空壳。
- `docs/api-docs/caption-engine.md`
  - 记录内部 partial/final 当前仍映射为相同外部 `caption` 命令，外部协议尚无 final 标记。
- `docs/testing.md`
  - 补充核心事件、Session、Vosk 适配器、协议输出和翻译容量测试范围。
- `change.md`
  - 追加本阶段完整授权、结构、行为、兼容性、验证、风险和回滚说明。

### 修改前后行为

- 修改前：Vosk 类同时加载 SDK、读取全局共享队列、构造 stdout 字典、识别 partial/final、选择翻译后端并为每条 final 创建线程。
- 修改后：Vosk Provider 只接受 `AudioFrame` 并产生统一事件；Session 统一读取队列和执行 final 翻译策略；协议层统一输出旧 command 消息。
- 修改前：Vosk 使用无界全局音频队列，慢识别可能持续积压内存。
- 修改后：Vosk 使用独立有界队列，容量约为 5 秒且至少 10 帧；队列满时通过背压暂停采集端入队。
- 修改前：Vosk 每个 final 创建一个 daemon 翻译线程，没有并发和等待任务上限。
- 修改后：翻译最多 2 个并发 worker、32 条等待任务；过载时明确警告并保留已经输出的原字幕。
- 修改前：Vosk Google 翻译分支向四参数函数传入六个参数，后台线程会抛出 `TypeError`。
- 修改后：统一翻译装配器使用正确函数签名；这是迁移过程中消除的旧路径缺陷。
- 修改前：Vosk 的队列读取可能在 stop 后因阻塞 `get()` 延迟退出，音频设备关闭责任分散。
- 修改后：Session 使用带超时的队列读取，并在 finally 中统一停止 Provider、关闭翻译服务和音频设备。
- Gummy、GLM、SOSV 的运行路径和旧 `translate()` 循环没有修改。

### 配置、接口与协议

- 用户持久化配置及版本：无变化，不需要迁移。
- Electron IPC：无变化。
- Python CLI 参数、默认值和 Provider 名称：无变化；`-e vosk` 调用方式保持不变。
- Electron/Python 外部子进程协议：命令名和字段无变化。
- 内部 Python API：新增 `AudioFrame`、`RecognitionProvider`、统一事件、`RecognitionSession`、`TranslationService` 和 `ProtocolEventSink`。
- 内部模块路径：Vosk 活动实现从 `audio2text.vosk` 迁移到 `providers.vosk`；`protocol.server` 成为 TCP server 的活动实现。
- 内部事件数据结构：partial/final 显式区分并共享稳定 `caption_id`；映射到旧协议后仍使用 `index/time_s/time_t/text/translation` 字段。
- 依赖、`requirements.txt`、npm 包和锁文件：无变化。
- PyInstaller spec：无变化；新模块通过 `main.py` 静态导入进入依赖图。

### 兼容性、迁移与回滚

- 应用 CLI 和 Electron 进程协议兼容：现有 Vosk 启动参数、caption 日志和翻译消息结构不变。
- Vosk model path 的包围双引号处理保持兼容。
- partial/final 继续复用同一个 `index` 和 `time_s`；外部暂时无法显式判断 final。
- `from utils import start_server` 和 `from utils.server import start_server` 通过兼容入口继续工作；新代码使用 `protocol.server`。
- 直接导入未文档化内部路径 `audio2text.vosk.VoskRecognizer` 的第三方代码不再兼容；应用本身没有该外部扩展承诺。若需要公共 Python SDK，应在后续单独定义版本化接口，而不是永久保留两套 Vosk 实现。
- Gummy、GLM、SOSV 无迁移要求；它们仍依赖 `audio2text`、全局队列和旧翻译逻辑。
- 数据迁移和远端资源迁移：不需要。
- 回滚方式：恢复 `engine/main.py`、`audio2text/__init__.py`、`audio2text/vosk.py`、`utils/__init__.py` 和第二阶段版本的 `utils/server.py`；删除本阶段新增的 `core/`、`providers/`、`services/`、`protocol/output.py`、`protocol/server.py`、四个新测试和架构文档；恢复协议/测试文档对应段落。第二阶段的 NDJSON decoder 和 Electron 协议组件无需回滚。

### 验证

- 首轮 `npm run test:python`：通过，Python 19/19；验证最初的 core、Session、Vosk 和协议输出纵向切片。
- `engine/.venv/bin/python3 engine/main.py --help`：通过；CLI 参数列表和入口模块加载正常。
- `engine/.venv/bin/python3 -m compileall -q engine/core engine/providers engine/services engine/protocol engine/main.py`：通过；新增/修改 Python 模块可编译。
- 引入 Vosk 有界音频队列后再次 `npm run test:python`：通过，Python 19/19。
- 增加 Provider 异常脱敏和翻译过载测试后 `npm run test:python`：通过，Python 21/21。
- 最终 `npm run verify`：通过；TypeScript/Vue 类型检查、ESLint、Node 20/20 和 Python 21/21 全部通过。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 均完成 Vite 构建。
- 最终再次执行 Python CLI help 和 compileall：通过。
- 最终 `git diff --check`：通过。
- 本阶段没有出现需要隐瞒或跳过的失败验证。
- 未运行真实 Vosk 模型、麦克风/系统音频、Google/Ollama 网络翻译或付费 API：单元测试使用伪造 recognizer、AudioSource、EventSink 和 TranslationService，避免外部设备与网络。
- 未执行 PyInstaller `main.spec` 打包、Windows/Linux 安装包或真实 Electron/Python Vosk 端到端：这些需要模型、设备和目标平台环境；普通 Electron 构建不包含重新生成的 Python 可执行文件。

### 风险、限制与后续事项

- 当前只有 Vosk 使用新架构；Gummy、GLM、SOSV 仍是明确的临时旧路径。每迁移一个 Provider 后必须删除对应旧循环，全部迁移完成后删除 `audio2text/` 和 `utils.server` 兼容层。
- `main.py` 仍包含 argparse 和旧 Provider 装配；在 registry/config 对象稳定前没有创建 `cli.py`，避免本阶段同时重写所有入口分支。
- 外部协议仍没有 partial/final 标记；Fun-ASR 接入前必须决定是否保持内部区别、还是设计带版本的外部事件 envelope。
- 有界音频队列避免无限内存增长，但 Provider 持续落后时会对采集线程施加背压，设备层可能产生延迟或丢帧；需要在固定音频回放测试中测量后再调整容量。
- 翻译 worker 是 daemon，关闭时不阻塞等待外部网络；与旧 daemon 线程相同，进程立即退出时尚未完成的翻译可能丢失。后续 TranslationService 应增加可取消请求、超时和有限冲刷策略。
- 翻译仍通过旧 `time_s` 映射到 Electron 字幕；内部已经有稳定 `caption_id`，但外部关联改造需要协议版本，未在本阶段扩展范围。
- `RecognitionProvider` 事件队列适合 Vosk 同步结果；Gummy/Fun-ASR 等异步回调 Provider 迁移前应增加显式事件唤醒和停止冲刷测试，不能直接复制 Vosk 循环。
- 本阶段没有创建 `providers/fun_asr.py` 和 `services/hotwords.py`；它们只能在真实能力、配置和测试调用方同时落地时新增。
- Python 暂无 mypy/ruff 等静态检查依赖；本阶段没有未经授权安装工具，使用 compileall、CLI 加载和单元测试验证。
- npm 的既有 Electron mirror 弃用提示和 Node `MODULE_TYPELESS_PACKAGE_JSON` 提示仍存在，本阶段未修改。

### 参考与决策依据

- 用户给出的目标目录、Provider 生命周期、统一事件和渐进迁移顺序。
- 根目录 `AGENTS.md` 中 AudioSource、AudioPipeline、RecognitionProvider、RecognitionSession、TranslationService、EventSink 和 ProviderRegistry 的目标职责。
- Vosk 当前 `AcceptWaveform`/`PartialResult`/`Result` 同步调用语义及项目已有 index/time 规则。
- Python 标准库 `dataclasses`、`queue`、`threading`、`typing.Protocol`；未新增第三方依赖。

## 2026-08-11 至 2026-08-12 - 迁移剩余 Python Provider 并完成统一运行时

### 授权与目标

- 用户授权：要求“迁移剩余模型”。
- 本次“剩余模型”按仓库当前已有实现解释为 Gummy、GLM 和 SOSV；Vosk 已在上一阶段完成迁移。
- 目标：让四个现有识别引擎全部通过 `RecognitionProvider`、`RecognitionSession`、统一音频采集、统一翻译服务和统一协议输出运行，并删除已经被替代的旧循环。
- 明确不在范围内：Fun-ASR 实时 WebSocket、热词服务、配置界面、外部协议版本升级和依赖升级。它们仍需在后续获得单独授权后设计、实现和验证。
- 变更类型：Python 引擎架构重构、内部接口、测试和文档；没有 Electron UI/IPC、持久化配置或依赖变更。

### 修改文件

- `engine/cli.py`
  - 从旧 `main.py` 提取完整 argparse 定义为 `CliOptions` 和 `parse_args()`；保持已有参数名、类型和默认值。
  - API Key 字段禁止出现在 dataclass 的 `repr` 中。
- `engine/main.py`
  - 删除 Gummy、Vosk、SOSV、GLM 四套重复装配与音频线程分支，改为单一 `run()` 路径。
  - 统一创建 `AudioCaptureWorker`、Provider runtime、`RecognitionSession` 和 `ProtocolEventSink`。
  - 修复 `display_caption` 已解析为整数却与字符串比较、导致 `-d 1` 无效的问题。
  - 保证共享状态为 `kill` 时只输出一次外部 `kill` 命令。
- `engine/core/events.py`
  - 为 `CaptionPartial`/`CaptionFinal` 增加可选 `translation`，用于携带 Gummy 服务端翻译。
  - 新增 `ProviderInfo` 统一非错误运行信息事件。
- `engine/core/provider.py`
  - Provider 事件队列改为有界队列，默认容量 256；阻塞 0.5 秒仍无法投递时抛出不含凭证或响应内容的运行时错误。
- `engine/core/audio.py`
  - 新增统一 `AudioCaptureWorker`，负责打开设备、可选 WAV 录音、音频转换、有界队列背压、异常脱敏和关闭信号。
- `engine/core/worker.py`
  - 新增固定线程数、有限待处理容量、可取消等待任务和有限关闭等待的 `BoundedWorkerPool`。
- `engine/core/__init__.py`
  - 导出新增事件与统一音频采集组件。
- `engine/providers/sosv.py`
  - 新增 `SosvProvider`、可注入 backend 协议和 Sherpa-ONNX backend。
  - 保留旧 VAD、周期 partial、final 标点、16 kHz 单声道 PCM16 输入约束及字幕 ID/时间关联语义。
- `engine/providers/glm.py`
  - 新增 `GlmProvider`，保留 RMS VAD 阈值 500、静音帧阈值和最小语音帧数。
  - 使用固定 2 个 worker、最多 8 个等待识别任务；停止时取消未开始请求、最多等待 1 秒，并忽略迟到结果。
  - 校验 GLM URL 只能使用 HTTP/HTTPS；错误事件不泄露响应正文、URL 查询凭证或 API Key。
- `engine/providers/gummy.py`
  - 新增 DashScope callback 到统一事件的适配器，按 SDK sentence-end 标志产生 partial/final，并保留服务端翻译和用量事件。
  - 保留首次字幕 index 为 1、同句 ID/开始时间复用、发送重试提示和累计失败终止语义。
  - DashScope SDK 延迟导入，测试不需要真实网络或凭证。
- `engine/providers/registry.py`
  - 新增 `ProviderConfig`、`ProviderRuntime` 和 `ProviderRegistry`，集中注册 `gummy`、`vosk`、`sosv`、`glm` 的 Provider、音频 Pipeline 与翻译服务装配。
  - 凭证字段不进入配置对象 `repr`。
- `engine/providers/__init__.py`
  - 导出所有 Provider 和 registry 公共装配类型。
- `engine/services/translation.py`
  - 翻译服务改用通用 `BoundedWorkerPool`，保持 2 个 worker 和 32 个等待任务的容量策略。
- `engine/protocol/output.py`
  - 增加 `ProviderInfo` 映射，并保留 Provider 事件中已有的服务端翻译文本。
- `engine/utils/shared.py`
  - 删除迁移完成后不再使用的全局无界音频 `chunk_queue`，只保留进程状态。
- `engine/utils/server.py`
  - 删除上一阶段临时兼容模块；活动 TCP server 唯一位于 `engine/protocol/server.py`。
- `engine/utils/__init__.py`
  - 删除已无调用方的 `start_server` 延迟兼容导出。
- `engine/audio2text/gummy.py`、`engine/audio2text/glm.py`、`engine/audio2text/sosv.py`、`engine/audio2text/__init__.py`
  - 删除被新 Provider 和 Session 完整替代的旧识别类、全局队列消费、内部翻译循环和 stdout 拼装。
- `engine/tests/test_sosv_provider.py`
  - 验证 SOSV 生命周期、partial/final、重复 partial 抑制、ID/时间复用和输入格式。
- `engine/tests/test_glm_provider.py`
  - 验证 VAD 分段、WAV 请求、异步 final、URL 校验和请求异常脱敏。
- `engine/tests/test_gummy_provider.py`
  - 验证 callback 生命周期、partial/final、服务端翻译、用量、ID/时间、可恢复发送失败和终止错误。
- `engine/tests/test_cli.py`
  - 验证 CLI 默认值、显式参数转换和凭证脱敏表示。
- `engine/tests/test_provider_registry.py`
  - 验证四个 Provider 的完整注册集合、重复/未知名称错误与配置凭证脱敏。
- `engine/tests/test_engine_core.py`
  - 增加统一音频采集、录音、背压和采集异常关闭测试。
- `engine/tests/test_protocol_output.py`
  - 增加 Provider info 与内联翻译的协议映射测试。
- `docs/engine-manual/architecture.md`
  - 更新为四个 Provider 均已迁移后的真实目录、职责、依赖方向、容量边界和关闭语义。
- `docs/api-docs/caption-engine.md`
  - 说明内部 partial/final 映射及 Gummy 内联服务端翻译与其他 Provider 后续翻译消息的差异。
- `docs/testing.md`
  - 增加 CLI、registry、音频采集、SOSV、GLM 和 Gummy 的自动化覆盖说明。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 将旧全局队列、`audio2text` 链接、`utils.start_server` 和在 `main.py` 增加模型分支的扩展说明更新为 Provider/Session/registry 架构，避免多语言手册指向已删除实现。
- `change.md`
  - 追加本轮授权、实现范围、行为、兼容性、验证、风险和回滚记录。

### 修改前后行为

- 修改前：Gummy、GLM、SOSV 各自读取全局无界队列、维护 translate 循环或线程、直接拼装 stdout；`main.py` 为每个引擎重复创建音频线程和关闭流程。
- 修改后：四个 Provider 只处理音频和产生统一事件；Session 负责队列消费、事件转发、final 翻译策略和资源关闭；registry 负责差异化装配；入口只有一条运行路径。
- 修改前：旧全局音频队列无容量上限，GLM 每个语音段新建线程，Provider 事件也没有容量边界。
- 修改后：音频队列约容纳 5 秒且至少 10 帧；GLM 使用 2 个固定 worker/8 个等待任务；翻译为 2/32；Provider 事件容量默认 256。队列满时使用明确背压或过载错误，不再无限增长。
- 修改前：Gummy 自己管理服务端翻译、SDK callback 和停止输出；GLM/SOSV 自己启动翻译线程。
- 修改后：Gummy 的服务端翻译随 caption 事件输出；GLM、SOSV、Vosk 的 final 由 Session 统一只提交一次翻译；Provider 不再持有客户端翻译线程。
- 修改前：`-d 1` 因整数/字符串比较错误无法启用终端字幕显示。
- 修改后：使用整数比较，`-d 1` 恢复生效。

### 配置、接口与协议

- 用户持久化配置及配置版本：无变化，不需要迁移。
- Electron IPC、preload API 和 renderer 调用：无变化。
- Python CLI 参数、别名、类型、默认值与 Provider 名称：无变化；只将解析实现移动到 `cli.py`。
- Electron/Python 外部 stdout `command` 协议：命令名和现有字段无变化；仍未添加外部 partial/final 标志。
- 内部事件：`CaptionPartial`/`CaptionFinal` 新增默认空字符串的 `translation`；新增 `ProviderInfo`。
- 内部 Python 模块：Gummy/GLM/SOSV 活动实现由 `audio2text.*` 迁移到 `providers.*`；Provider 装配统一通过 registry。
- 依赖、`requirements.txt`、npm package/lock 文件和 PyInstaller spec：无变化。
- Fun-ASR 与热词配置/API：本轮没有新增占位接口、文件或未使用配置。

### 兼容性、迁移与回滚

- 应用级兼容：现有 Electron 启动参数、CLI 参数、Provider 名称、caption/translation/info/error/usage/kill 命令保持兼容。
- 行为修复：`-d 1` 现在按其已有帮助文本正常启用显示；这是修复而非协议扩展。
- Gummy 保留 DashScope 服务端翻译、字幕 index 和失败计数语义；GLM 保留请求格式/VAD；SOSV 保留 Sherpa-ONNX 识别与标点语义。
- 未文档化的内部导入 `audio2text.GummyRecognizer`、`audio2text.GlmRecognizer`、`audio2text.SosvRecognizer`、`utils.server.start_server` 不再兼容；仓库内已确认无调用方，应用对这些路径没有公共 SDK 承诺。
- 数据、模型文件和远端资源：无迁移或删除。
- 精确回滚：恢复本轮修改前的 `engine/main.py`、`engine/core/`、`engine/services/translation.py`、`engine/protocol/output.py`、`engine/providers/__init__.py`、`engine/utils/` 和 `engine/audio2text/`；删除本轮新增的 `engine/cli.py`、`engine/core/worker.py`、三个新 Provider、registry 及对应测试；恢复三份文档对应段落。Vosk 的上一阶段迁移可以保留。

### 验证

- SOSV 迁移检查点：`npm run test:python` 通过，Python 23/23；相关模块 `compileall` 通过。
- GLM 迁移检查点：`npm run test:python` 通过，Python 26/26；相关模块 `compileall` 通过。
- Gummy 迁移检查点：`npm run test:python` 通过，Python 29/29；相关模块 `compileall` 通过。
- 首次合并统一入口后的编译检查失败：`engine/core/__init__.py` 中 `AudioCaptureWorker` 导出位置缩进错误，`compileall` 报 `IndentationError`，后续测试因此没有执行。修正导出列表后再次编译通过；该失败没有被忽略。
- 修正后的入口检查点：CLI `--help`、`compileall` 和 Python 29/29 均通过。
- 加入 CLI、registry 与音频采集测试后：`npm run test:python` 通过，Python 36/36。
- 最终 `npm run verify`：通过；TypeScript/Vue 类型检查、ESLint、Node 20/20 和 Python 36/36 全部通过。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 均完成 Vite 生产构建。
- 最终 `engine/.venv/bin/python3 engine/main.py --help`：通过；CLI 入口可加载且参数帮助可生成。
- 最终 `engine/.venv/bin/python3 -m compileall -q engine/core engine/providers engine/services engine/protocol engine/cli.py engine/main.py`：通过。
- 首次最终 `git diff --check` 发现 `docs/engine-manual/en.md` 末尾一处行尾空格；清理后重新执行通过。该格式失败没有被忽略。
- 最终记录检索命令曾因 Markdown 反引号未正确隔离而被 shell 解释，意外再次执行 `npm run verify`（仍全部通过），随后 `rg` 因替换得到多行模式而失败；该命令没有修改仓库文件，改用无反引号的固定模式后重新核对。
- 最终旧路径检索：活动引擎和三份多语言手册中没有 `shared_data.chunk_queue`、`utils.start_server`、`engine/audio2text` 或旧 `main_*` 分支引用。
- `npm run verify`/`build` 仍输出仓库既有 npm Electron mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告；没有为消除提示而修改 package 或依赖配置。
- 未运行真实麦克风/系统音频、真实 Vosk/SenseVoice 模型、DashScope/GLM/Google/Ollama 网络请求或付费 API；单元测试使用注入式伪造 backend/client/source，避免设备、凭证和网络副作用。
- 未运行 PyInstaller、Windows/Linux 安装包或真实 Electron/Python 音频端到端；这些需要目标平台、模型和设备环境。

### 风险、限制与后续事项

- GLM 正在执行的 HTTP 请求无法由标准同步 `requests` 强制取消；停止时最多等待 1 秒并屏蔽迟到事件，但底层 daemon worker 可能持续到请求超时。
- 有界音频队列消除了无限内存增长，但 Provider 长期落后会对采集线程施加背压，设备缓冲区仍可能增加延迟或丢帧；需要用固定音频回放测量容量。
- 翻译 worker 为 daemon；关闭时不等待已排队或正在进行的网络翻译，进程立即结束时这些结果可能丢失。网络取消与有限冲刷仍需后续单独设计。
- Gummy 的发送失败计数按旧实现保持累计、不在成功后清零；长会话中的间歇性错误最终可能触发终止，后续若调整需作为独立行为变更。
- SOSV 的真实 Sherpa-ONNX VAD/模型加载、Gummy SDK callback 时序和 GLM 服务端响应没有进行在线集成测试。
- `audioop` 延续现有重采样实现，在未来 Python 版本中存在移除风险；本轮为保持行为没有替换或新增 DSP 依赖。
- 外部协议仍不区分 partial/final；内部已经区分，但协议升级必须单独版本化并同步 Electron 消费端。
- Fun-ASR 与热词仍未实现。下一阶段应先定义实时 Provider 的连接/重连/结束冲刷语义和热词能力模型，再做一个可验证纵向切片，不能把逻辑塞回当前 Provider 或入口。

### 参考与决策依据

- 用户指定的第三阶段目录、`RecognitionProvider` 接口、统一事件模型、`RecognitionSession` 职责和“逐个迁移而非一次性重写”要求。
- 根目录 `AGENTS.md` 的 Provider/Session/Audio/Translation/Registry 边界、授权、测试和变更记录约束。
- 仓库旧 Gummy、GLM、SOSV 实现的可观察参数、ID/时间、VAD、翻译和错误行为。
- 本地已安装 DashScope SDK 中 `TranslationRecognizerRealtime` 的 callback 与同步 stop/join 行为；没有通过网络修改 SDK 或依赖版本。
- Python 标准库 `queue`、`threading`、`wave`、`urllib.parse` 和项目既有第三方依赖；未新增第三方包。

## 2026-08-12 - 第四阶段：配置模型完整迁移到分层 V2

### 授权与目标

- 用户授权：要求第四阶段进行配置模型重构，采用带版本的分层配置；随后明确要求“直接完成 V2 的完整迁移，不考虑已安装的版本兼容性”。
- 最终目标：磁盘配置、Electron 主进程、内部 IPC、Vue/Pinia 状态和引擎启动参数全部直接使用 `schemaVersion: 2` 的 application/engine/caption 分层模型，删除扁平 `Controls` 数据模型。
- 初始曾按渐进兼容思路创建 V1→V2 migration 和 `Controls` adapter；用户补充要求后，在本批次完成前删除了这两个临时文件和路线，最终工作区没有遗留双实现或兼容层。
- 明确非目标：不迁移旧用户配置、不增加 Fun-ASR/热词字段、不修改 Python CLI 或 Electron/Python stdout 协议、不升级依赖、不引入系统安全存储。
- 变更类型：破坏性配置重构、内部 IPC、类型、测试和文档。

### 修改文件

- `src/shared/types.ts`
  - 新增主进程和渲染进程共享的 UI、字幕、日志和 `FullConfig` 类型单一来源。
  - `FullConfig` 改为携带完整 `ConfigDocumentV2` 与独立的运行态 `engineEnabled`。
- `src/shared/config/schema.ts`
  - 定义 `CONFIG_SCHEMA_VERSION = 2`、application/engine/common/providers/custom/caption 分层接口和完整默认值。
  - Provider 专属字段从通用字段中分离；`engineEnabled` 不进入持久化模型。
- `src/shared/config/document.ts`
  - 新增严格 V2 文档、application、engine、Provider、caption 和 styles 解析校验。
  - 拒绝无版本、非 V2、未知 Provider、非法 URL、越界数值和错误字段类型，同时保留合法 V2 对象中的未知扩展字段。
- `src/shared/config/validation.ts`
  - 新增不依赖第三方库的字符串、布尔、数值、枚举、颜色、HTTP/HTTPS URL 和对象边界校验。
  - 错误只包含字段分类，不回显配置值或密钥。
- `src/main/types/index.ts`、`src/renderer/src/types/index.ts`
  - 删除两份重复类型定义，统一重新导出 `src/shared/types.ts`。
- `src/main/utils/AllConfig.ts`
  - 改为 V2 配置文档的唯一主进程所有者，读写 `schemaVersion: 2`。
  - 旧版、损坏或非法文件整体拒绝并使用 V2 默认值；应用退出时写回 V2。
  - application、engine 和 caption 更新均通过严格解析；配置日志不再输出含密钥的完整对象。
  - `engineEnabled`、字幕和软件日志继续作为运行态，不写入配置文件。
- `src/main/ControlWindow.ts`
  - 配置 IPC 改为 application、engineConfig、captionConfig 三个完整层级。
  - 主进程捕获并分类记录非法 renderer 配置，不保存未校验 IPC 数据。
- `src/main/CaptionWindow.ts`
  - 字幕窗口宽度通过 V2 application.layout 校验入口更新。
- `src/main/engine/config/EngineCommandBuilder.ts`
  - 新增纯函数命令构建组件；统一公共音频、录音、端口和目标语言参数，并通过 Provider 参数 builder 生成 Gummy/Vosk/SOSV/GLM 差异参数。
  - 自定义引擎参数与内置 Provider 参数分别构建。
- `src/main/utils/CaptionEngine.ts`
  - 删除对扁平 `allConfig.controls` 的读取和四段 Provider 参数拼装，改为读取 `EngineConfig` 并调用命令构建组件。
  - 引擎运行状态通过独立 `engineState` IPC 同步，不再混入配置对象。
- `src/renderer/src/App.vue`
  - 窗口挂载时从 `FullConfig.config` 分别初始化 application、engine 和 caption store，并单独初始化 `engineEnabled`。
- `src/renderer/src/stores/generalSetting.ts`
  - 使用共享 `ApplicationConfig`，保存未知 V2 扩展字段，并通过 `control.application.change` 发送完整 application 层。
- `src/renderer/src/stores/engineControl.ts`
  - 删除 20 余个扁平持久化 ref 的配置模型，改为单一 `EngineConfig`；引擎运行状态保留为独立 ref。
  - 使用 `control.engineConfig.change` 与独立的 `control.engineState.set`；初始 EngineConfig 由 `FullConfig.config` 提供。
- `src/renderer/src/stores/captionStyle.ts`
  - 使用共享 `CaptionConfig`，现有样式 ref 直接绑定其 styles 层，并通过 captionConfig IPC 发送完整层级。
- `src/renderer/src/components/EngineControl.vue`
  - 表单应用/回退直接读写 `engine.common`、`engine.providers` 和 `engine.custom`；不再读写扁平 Controls 字段。
- `src/renderer/src/components/EngineStatus.vue`
  - 当前 Provider、自定义引擎和模型路径检查改为读取 `EngineConfig`。
- `src/renderer/src/components/CaptionStyle.vue`
  - 样式应用与重置改用 V2 captionConfig store 操作。
- `tsconfig.node.json`、`tsconfig.web.json`
  - 将 `src/shared/**/*` 纳入 Node/Web 类型检查；Web 开启 `allowImportingTsExtensions` 以共享与 Node 测试相同的显式 TypeScript 模块路径。
- `eslint-suppressions.json`
  - 删除重构文件不再命中的既有 suppression；没有新增 suppression 或放宽 ESLint 规则。
- `tests/node/configDocument.test.mjs`
  - 验证完整 V2 默认值、拒绝旧/未来版本、嵌套字段校验和未知 V2 扩展字段保留。
- `tests/node/engineCommandBuilder.test.mjs`
  - 验证四个内置 Provider 的公共/专属参数、关闭翻译时的 `none` 目标和自定义引擎参数。
- `docs/api-docs/config-v2.md`
  - 新增 V2 分层结构、默认值、校验范围、旧配置重置、运行态和明文凭据限制文档。
- `docs/api-docs/electron-ipc.md`
  - 将旧 ui/styles/controls 配置通道更新为 application/engineConfig/captionConfig/engineState V2 通道。
- `docs/engine-manual/architecture.md`
  - 增加 Electron 配置 V2 职责、数据流、命令构建组件和破坏性旧配置行为。
- `docs/testing.md`
  - 增加 V2 文档和命令构建测试覆盖，并明确未执行真实 userData/桌面 IPC 测试。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步提示旧无版本配置不会迁移，首次启动使用默认值并在退出时写入 V2。
- `change.md`
  - 追加本阶段授权变化、破坏性行为、文件范围、验证、风险和回滚记录。

### 修改前后行为

- 修改前：`config.json` 无版本，application、Provider、翻译、录音、自定义引擎和运行态字段混在顶层及扁平 `controls`；主/渲染进程分别复制类型。
- 修改后：配置根固定为 `schemaVersion: 2`，并分为 `application`、`engine.common`、`engine.providers`、`engine.custom` 和 `caption`；共享类型只有一份。
- 修改前：旧配置读取通过零散 `if (config.xxx)` 合并，非法类型可进入主进程；Renderer controls 只按已有 key 盲目赋值。
- 修改后：磁盘和每次配置 IPC 都在主进程执行完整嵌套校验；非法配置整体拒绝，不输出原始值。
- 修改前：`engineEnabled` 虽然启动时被强制保留，但仍位于持久化 `controls` 结构并被写入 JSON。
- 修改后：`engineEnabled` 是独立运行状态，只通过 `control.engineState.set` 同步，不持久化。
- 修改前：`CaptionEngine` 直接读取扁平 Controls，并包含四套 Provider 参数条件分支。
- 修改后：纯 `EngineCommandBuilder` 从 V2 `EngineConfig` 生成参数，公共参数只生成一次，Provider 差异集中注册。
- 内置 Provider、翻译、录音、自定义引擎、启动超时、字幕样式和 UI 默认值保持原值；GLM 空 URL/模型在表单应用时回落到既有默认值。

### 配置、接口与协议

- 持久化配置：破坏性变化，从无版本扁平 JSON 切换为严格 `schemaVersion: 2` 分层 JSON。
- 配置迁移：按用户明确要求不提供。旧、缺失版本、未来版本、损坏或非法配置均使用完整默认值，退出时写回 V2。
- 未知字段：只要整个文档满足 V2 已知字段约束，同层未知扩展字段在磁盘解析、Renderer 状态和 IPC 往返中保留。
- Electron 内部 IPC：删除旧 `control.uiLanguage/uiTheme/uiColor/leftBarWidth`、`control.styles`、`control.controls` 和对应 set 通道；新增 application、captionConfig、engineConfig、engineState 分层通道。
- `FullConfig`：由多个扁平配置字段改为 `{ platform, config, engineEnabled, captionLog, softwareLog }`。
- Python CLI、Provider 名称、参数、默认值：无变化；只是参数来源由 Controls 改为 V2 EngineConfig。
- Electron/Python stdout/TCP 协议：无变化。
- 依赖、package/lock 文件、Python requirements 和 PyInstaller spec：无变化。
- 凭据：仍按既有行为以明文位于用户目录 JSON；配置对象不写日志，进程参数日志继续脱敏。本阶段未扩大为安全存储改造。

### 兼容性、数据与回滚

- 已安装版本配置：明确不兼容。旧用户的语言、主题、模型路径、API Key、录音路径和样式不会自动迁移；首次启动回到默认值。
- 旧配置不会备份；应用退出后 `config.json` 会被 V2 默认值覆盖。用户如需保留旧值，必须在启动此版本前自行复制旧文件。
- Electron 配置 IPC 和 `FullConfig` 属于应用内部接口，本阶段不保留扁平 Controls 兼容层。
- 自定义字幕引擎 stdout/TCP 协议、Python CLI 和自定义命令字符串的既有空格拆分行为保持不变。
- 数据库、字幕导出文件、模型文件、录音文件和远端资源：不迁移、不删除。
- 回滚方式：恢复本阶段修改前的 AllConfig、ControlWindow、CaptionWindow、CaptionEngine、主/渲染 types、App、三个 Pinia store、三个组件和 tsconfig；删除 `src/shared/`、`src/main/engine/config/` 与两个新增 Node 测试；恢复 IPC/架构/测试/三语用户文档并删除 `config-v2.md`。已被 V2 覆盖的旧 `config.json` 无法通过代码回滚恢复，只能使用用户事先备份。

### 验证

- 第一次 `npm run typecheck`：Node 类型检查通过，Web 类型检查失败；共享配置模块的显式 `.ts` import 需要 Web tsconfig 开启 `allowImportingTsExtensions`。补齐该编译选项后继续验证，该失败没有被忽略。
- 修正后 `npm run typecheck && npm run test:node`：通过；Node/Web 类型检查通过，Node 26/26。
- 清理最终 V2 命名后 `npm run typecheck && npm run lint`：Node/Web 类型检查通过；ESLint 没有报告代码违规，但因失效 suppression 提示以退出码 2 结束。
- 首次最终 `npm run verify`：类型检查通过，但 ESLint 因本次重写文件对应的旧 suppression 已不再命中而以退出码 2 停止，测试阶段未执行；单独复现 `npm run lint` 同样退出 2。执行 `npx eslint --cache . --prune-suppressions` 只删除失效记录后，继续最终验证。该失败没有被忽略。
- `npx eslint --cache . --prune-suppressions && npm run lint`：通过，删除失效 suppression 后 lint 退出码 0；没有新增 suppression。
- 最终 `npm run verify`：通过；Node/Web 类型检查、ESLint、Node 26/26 和 Python 36/36 全部通过。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 完成 Vite 生产构建，共转换 main 19 个、preload 1 个、renderer 3239 个模块。
- 最终 `git diff --check`：通过。
- 最终旧配置引用检查：源码和配置/API/架构文档中没有旧 ui/styles/controls IPC、`allConfig.controls`、`setControls` 或 `sendControls` 活动引用。
- 依赖检查：`package.json`、`package-lock.json`、`engine/requirements.txt` 和 `engine/main.spec` 无差异。
- 验证仍输出仓库既有 npm Electron mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告；没有为消除提示而修改依赖或模块类型。
- 未运行真实 Electron 窗口、`userData/config.json` 磁盘替换、IPC 往返或手工表单回归；当前自动化使用纯配置解析器和命令构建器，不启动 GUI。
- 未运行 Windows/Linux/macOS 安装包、PyInstaller、真实音频设备、模型或付费 API；本阶段没有修改相应运行链路或依赖，且这些需要目标平台和外部资源。

### 风险、限制与后续事项

- 最大风险是用户明确接受的配置丢失：旧文件退出后会被 V2 默认值覆盖，且没有自动备份。
- Electron 配置 IPC 端到端尚无 GUI 自动化；类型检查和纯函数测试不能替代手工验证所有表单 Apply/Cancel、双窗口同步及退出写盘。
- application 的常规字段变化会发送完整 application 对象；Vue watch 会批处理同一轮更新，但仍需在真实双窗口运行中确认没有多余往返。
- 自定义命令仍按既有 `split(' ')` 拆分，带空格的单个自定义参数语义仍有限；本阶段为避免改变公开自定义引擎行为没有重写参数解析。
- API Key 仍明文持久化并需要发送到 Renderer 配置 UI；后续应独立评估系统安全存储、只写凭据句柄和配置导入/导出策略。
- V2 当前 Provider union 只包含四个现有引擎。Fun-ASR 和热词接入时必须新增 Provider 专属层和能力校验，不能重新向 common 或组件堆平字段。
- 配置写入仍使用同步直接写文件，没有临时文件+原子替换；异常退出可能产生部分文件，下一次启动会拒绝并回到默认值。原子写入应作为独立可靠性改造。

### 参考与决策依据

- 用户提出的“带版本的分层配置”以及后续“完整 V2、不考虑已安装版本兼容性”的明确决策。
- 根目录 `AGENTS.md` 的 schemaVersion、Provider 通用/专属分层、主进程 IPC 校验、未知字段保留和单一类型来源约束；用户最新要求覆盖其中旧配置迁移建议。
- 当前 `AllConfig`、`CaptionEngine`、Pinia stores 和 Electron IPC 的实际调用关系。
- TypeScript 类型系统、Vue reactive/ref/toRaw、Electron structured-clone IPC 和 Node 标准 JSON/URL 校验；未新增第三方依赖。

## 2026-08-12 - 第五阶段：Renderer 引擎配置改为能力目录驱动

### 授权与目标

- 用户授权：要求执行第五阶段，将前端改为能力驱动，建立引擎目录，以字段描述渲染通用控件，只为热词管理器等特殊交互保留专用组件，避免未来接入 Paraformer、Qwen-ASR 等 Provider 时继续扩大巨型 Vue 文件。
- 目标：把 Gummy、Vosk、SOSV、GLM 的能力、语言、专属字段、默认值和启动要求从 Vue 模板及三份重复元数据中迁入独立目录；让表单通过统一字段渲染器读写 V2 `EngineConfig` 草稿。
- 明确非目标：本阶段不接入 Paraformer、Qwen-ASR、Fun-ASR，不实现热词管理器或远端热词操作，不增加 V2 配置字段，不修改 Python Provider、Electron 主进程、IPC、子进程协议、依赖或打包配置。
- 变更类型：Renderer 架构重构、用户界面、测试和文档。

### 修改文件

- `src/renderer/src/engines/types.ts`
  - 新增 Provider capability、语言角色、配置路径、字段控件、分组、条件可见性、默认值和分阶段校验描述类型。
  - 当前通用控件类型为 `select`、`text`、`password`、`number`、`switch` 和 `directory`；热词能力被显式建模，但四个现有 Provider 均声明为不支持。
- `src/renderer/src/engines/form.ts`
  - 新增不依赖 Vue 的 `EngineConfig` 深复制、嵌套路径读写、条件判断、字段可见性和空值判断工具。
- `src/renderer/src/engines/catalog.ts`
  - 集中注册四个现有 Provider，并根据 capability 合成引擎选择、语言、翻译、音频、录音、启动超时和自定义引擎公共字段。
  - 集中处理字段默认值、应用前翻译模型校验、启动前本地模型路径校验和切换 Provider 时的语言默认值。
- `src/renderer/src/engines/providers/shared.ts`
  - 新增语言描述辅助函数，避免各 Provider 重复拼装 i18n 键。
- `src/renderer/src/engines/providers/gummy.ts`
  - 声明 Gummy 的集成翻译、语言集合和阿里云 API Key 高级字段。
- `src/renderer/src/engines/providers/vosk.ts`
  - 声明 Vosk 的模型决定源语言、外部翻译、目标语言集合和启动必需模型目录。
- `src/renderer/src/engines/providers/sosv.ts`
  - 声明 SOSV 的可选源语言、外部翻译、目标语言集合和启动必需模型目录。
- `src/renderer/src/engines/providers/glm.ts`
  - 声明 GLM 的外部翻译、语言集合、URL/模型/API Key 字段及既有空值默认值。
- `src/renderer/src/components/engine/EngineFieldRenderer.vue`
  - 新增通用字段组件，统一渲染标签、帮助 Popover、服务商链接、选择、文本、密码、数字、开关和目录选择控件。
- `src/renderer/src/components/EngineControl.vue`
  - 从 460 余行 Provider/字段分支和 20 余个独立 ref 重构为约 170 行目录消费组件。
  - 只维护一份完整 `EngineConfig` 草稿，按 primary/advanced/custom section 渲染字段；应用时整体复制，取消时整体恢复。
  - 删除 Gummy/Vosk/SOSV/GLM 专属 `v-if`、手工字段复制、专属文件夹类型分支和本地重复校验。
- `src/renderer/src/components/EngineStatus.vue`
  - 删除 Vosk、SOSV 两段启动条件分支，改为调用目录统一启动校验。
- `src/renderer/src/stores/engineControl.ts`
  - 删除只为 UI 元数据服务的 `captionEngine`、`audioType` 状态。
  - 将固定模型路径通知改为接收目录产生的通用校验问题。
- `src/renderer/src/stores/generalSetting.ts`
  - 语言切换不再手工替换引擎和音频元数据；Vue i18n 变化会直接重新计算目录选项标签。
- `src/renderer/src/i18n/config/engine.ts`、`src/renderer/src/i18n/config/audio.ts`
  - 删除按 zh/en/ja 完整复制能力、字段值和标签的旧元数据文件。
- `src/renderer/src/i18n/index.ts`
  - 删除已移除旧元数据的导出。
- `src/renderer/src/i18n/lang/zh.ts`、`src/renderer/src/i18n/lang/en.ts`、`src/renderer/src/i18n/lang/ja.ts`
  - 增加字段、Provider、语言和翻译选项的三语 i18n 键；语言与 Provider 的能力值只在目录维护一份。
- `tests/node/engineCatalog.test.mjs`
  - 新增 7 个纯逻辑测试，覆盖注册唯一性、能力字段组合、草稿路径读写与复制、条件可见性、Provider 启动要求、翻译校验、默认值、UI 语言默认目标和全部目录文案的三语完整性。
- `docs/engine-manual/architecture.md`
  - 新增 Renderer 引擎目录结构、职责、普通 Provider 接入顺序和专用热词组件边界。
- `docs/testing.md`
  - 增加引擎目录测试覆盖，并明确通用控件浏览器交互和视觉布局仍未自动化。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步说明表单按当前引擎能力显示字段、“更多设置”只显示当前 Provider 专属字段，以及切换引擎不会删除其他 Provider 已保存配置。
- `eslint-suppressions.json`
  - 清理由本阶段重写 `EngineControl.vue` 后不再命中的 3 个旧显式返回类型 suppression；没有新增 suppression 或放宽规则。
- `change.md`
  - 追加本阶段授权、文件范围、行为、兼容性、验证、限制和回滚记录。

### 修改前后行为

- 修改前：`EngineControl.vue` 直接写死四个 Provider 的字段和条件，表单字段分别维护为大量 ref，应用和取消需要逐项复制。
- 修改后：Vue 组件只遍历字段描述；Provider 差异位于 `engines/providers/`，公共字段由 capability 合成，草稿以完整 V2 `EngineConfig` 为单位应用或恢复。
- 修改前：“更多设置”同时显示 Gummy、GLM、Vosk、SOSV 的全部 API Key/模型路径，即使这些字段与当前 Provider 无关。
- 修改后：“更多设置”只显示当前 Provider 的专属字段，并继续显示录音路径和启动超时；切换 Provider 只切换视图，不清除 `engine.providers` 中其他 Provider 的值。
- 修改前：翻译、录音、自定义引擎和更多设置开关分别两两排列在同一行。
- 修改后：三个持久化开关由通用组件各占一行，“更多设置”仍为独立 UI 开关；保存语义不变。
- 修改前：Vosk/SOSV 模型路径启动校验在 `EngineStatus.vue` 重复硬编码。
- 修改后：启动要求随 Provider 字段定义注册；状态组件不再知道本地模型名单。
- 修改前：引擎和语言的值、角色与标签按界面语言复制三份，SOSV 中文目标值在中文 UI 为 `zh`、英文/日文 UI 为 `zh-cn`。
- 修改后：能力和值只维护一份，标签使用三语 i18n；SOSV 中文目标统一为 Python CLI 文档和翻译映射均支持的 `zh`，Vosk 保留既有 `zh-cn` 值。
- Gummy 继续使用集成翻译，不显示客户端翻译 Provider 字段；Vosk/SOSV/GLM 继续显示 Ollama/OpenAI 兼容或 Google 翻译选项。
- GLM URL/模型留空后应用时继续回落到原有默认值；启用外部 Ollama 翻译时模型名称仍必须填写。

### 配置、接口与协议

- 持久化配置和 `schemaVersion`：无变化，仍为严格 V2；没有配置迁移。
- V2 字段、默认值和主进程校验：没有新增或删除字段；仅把 Renderer 的字段表现、空值默认和启动前要求集中为元数据。
- Electron IPC、`FullConfig`、Pinia 对主进程发送的 `EngineConfig` 数据结构：无变化。
- Python CLI、Provider registry、音频、翻译、stdout/TCP 协议：无变化。
- Renderer 内部接口：新增 `EngineDefinition`、`EngineFieldDescriptor`、`EngineCapabilities` 和纯表单工具；删除旧 `engines`/`audioTypes` 导出及对应 store 状态。
- 依赖、`package.json`、lockfile、Python requirements、PyInstaller 和 Electron 构建配置：无变化。
- API Key 仍按现有 V2 行为进入 Renderer 表单并明文持久化；本阶段没有扩大凭据使用面，也没有引入安全存储。

### 兼容性与回滚

- 磁盘 V2 配置兼容：现有字段和值继续读取；切换 Provider 不删除非当前 Provider 的专属配置。
- UI 布局有轻微变化：持久化开关改为通用单行控件，更多设置仅展示当前 Provider 字段。
- SOSV 中文翻译目标由界面语言相关值统一为 `zh`；`engine/utils/translation.py` 同时支持 `zh` 与 `zh-cn`，CLI 用户文档把 `zh` 定义为简体中文。
- 未接入 Provider、热词或远端资源，不产生费用，不创建或删除云端数据。
- 回滚方式：恢复本阶段修改前的两个组件、两个 store、i18n index/三语文件和 suppression 文件；恢复被删除的 `i18n/config/engine.ts`、`audio.ts`；删除 `components/engine/`、`engines/` 和目录测试；恢复五份文档对应段落。V2 磁盘配置无需回滚或迁移。

### 验证

- 第一次 `npm run typecheck:web`：失败，`catalog.ts` 错误地从 `schema.ts` 导入未重新导出的 `UILanguage`，报 TS2459；修正导入来源后继续验证，该失败没有被忽略。
- 第二次 `npm run typecheck:web`：失败，`UILanguage` 的共享类型路径误写为不存在的 `shared/types/index.ts`，报 TS2307；改为实际的 `shared/types.ts` 后继续验证，该失败没有被忽略。
- 修正后 `npm run typecheck:web`：通过。
- 首次 `npm run test:node`：通过，Node 32/32，其中当时已有的新增目录/表单测试 6/6；随后补充三语目录键完整性测试并在最终验证中一并执行。
- 首次 `npm run lint`：ESLint 未报告代码违规，但因重写后的 `EngineControl.vue` 对应旧 suppression 已失效而退出码 2；执行 `npx eslint . --prune-suppressions` 删除 3 个失效记录后，`npm run lint` 通过。没有新增 suppression。
- 补充三语目录键测试后的最终 `npm run verify`：通过；Node/Web TypeScript 检查、Vue 类型检查、ESLint、Node 33/33 和 Python 36/36 全部通过。
- 最终 `npm run build`：通过；Electron main、preload 和 renderer 生产构建完成，分别转换 19、1、3247 个模块。
- 最终 `git diff --check`：通过。
- Provider 分支审计：`EngineControl.vue`、`EngineStatus.vue` 和相关 store 中没有 Gummy/Vosk/SOSV/GLM 选择条件；旧 `captionEngine`/`audioTypes` 活动引用已清除。
- 依赖差异检查：`package.json`、`package-lock.json`、`engine/requirements.txt`、`engine/main.spec` 无差异。
- 验证仍输出仓库既有 npm Electron mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告；没有为消除提示而修改依赖或模块类型。
- 未运行真实 Electron GUI 手工回归、Ant Design Vue 浏览器交互测试、视觉快照、真实音频设备、模型、付费 API、PyInstaller 或安装包；本阶段自动化验证覆盖纯目录逻辑、类型、lint、现有 Python 回归和生产构建，但不能替代真实表单点击与视觉检查。

### 风险、限制与后续事项

- 当前没有 Vue 组件级测试框架，通用字段的目录按钮、Popover、Apply/Cancel 点击、键盘操作和三语视觉宽度仍需真实 Electron 窗口回归。
- `EngineConfigPath` 与 V2 schema 是显式闭合类型；新增 Provider 时必须同时扩展共享 V2 Provider 配置、主进程校验、命令构建、Renderer 路径联合和 Provider 目录，不能只添加前端选项。
- capability 已明确热词支持状态，但没有创建无调用方的热词组件或配置。未来接入需要远端列表编辑、创建/更新/删除和确认流程时，应新增专用组件并从 Provider 能力入口挂载，普通字段仍由通用渲染器处理。
- 目录目前通过一个显式注册数组汇总 Provider。新增常规 Provider 仍需在目录中增加一次 import/注册，但不需要修改 `EngineControl.vue` 或复制公共表单逻辑。
- Provider i18n 标签仍需为 zh/en/ja 各增加一个键；能力、语言值和字段结构不再按语言复制。
- API Key 仍明文持久化并进入 Renderer；应在单独授权的安全改造中评估系统凭据存储和只传凭据句柄。

### 参考与决策依据

- 用户提出的第五阶段目标：“前端改成能力驱动”“建立引擎目录”“字段描述渲染通用控件”“特殊交互使用专用组件”。
- 根目录 `AGENTS.md` 的 Renderer capability registry、通用控件、三语文本、Pinia 职责、禁止在 `EngineControl.vue` 继续堆 Provider `v-if` 和无使用者抽象约束。
- 当前 V2 `EngineConfig`、四个 Python Provider/Registry、Electron 启动参数 builder 和原有三语引擎元数据的实际能力。
- Vue 3 Composition API、Pinia、Vue i18n、Ant Design Vue 现有组件和浏览器原生 `structuredClone`；未新增第三方依赖。

## 2026-08-12 - 第六阶段：接入阿里云 Fun-ASR Realtime

### 授权与范围

- 用户授权：要求参照阿里云官方 Fun-ASR Realtime WebSocket API 文档完成第六阶段接入。
- 目标：在第五阶段能力目录、第四阶段严格 V2 配置、第三阶段统一 Python Provider/Session 和第二阶段稳定进程协议之上，完成从 Renderer 配置到 Electron 启动参数、Python Registry、DashScope SDK Provider、统一事件、外部翻译、测试和文档的完整纵向切片。
- 明确非目标：不实现热词资源创建/更新/删除，不创建 `services/hotwords.py` 空壳，不发起真实阿里云识别或计费请求，不修改远端 Workspace/API Key，不执行真实麦克风或系统音频测试，不提交或推送代码。
- 变更类型：新增在线 Provider、V2 配置扩展、能力目录扩展、CLI/进程参数、凭据脱敏、自动化测试和项目文档。

### 官方协议决策

- 采用阿里云官方 DashScope Python SDK，而不是在项目中自行复制 WebSocket 帧和任务状态机。SDK 对外使用 `Recognition.start()`、`send_audio_frame()` 和 `stop()`；底层负责 `run-task`、等待任务启动、发送二进制音频、`finish-task` 和等待任务结束。
- Endpoint 使用 Workspace 专属 WSS 地址，只接受北京 `cn-beijing` 或新加坡 `ap-southeast-1` 地域，固定路径 `/api-ws/v1/inference`。地址主机中的 Workspace ID 必须与独立配置字段一致。
- 音频使用官方要求的 16 kHz、单声道、PCM16；共享 AudioPipeline 完成声道合并和重采样，默认 `chunk_rate=10`，即约 100 ms 一帧。
- `sentence_end` 映射为内部 partial/final；服务端 `begin_time`/`end_time` 毫秒偏移映射为本次任务起点上的字幕时间；心跳不生成字幕；duration 映射为 usage。
- 正常停止调用 SDK `stop()`，使 SDK 发送结束任务并阻塞等待剩余结果或失败；Provider 和 Session 再保证关闭事件只发一次并冲刷待发布事件。

### 修改文件与职责

- `src/shared/config/schema.ts`
  - Provider union 新增稳定 ID `fun_asr`。
  - V2 `engine.providers` 新增必需 `funAsr` 层：模型、专属 WebSocket 地址、Workspace ID、API Key、语义断句、最大句间静音和心跳。
  - 默认模型为 `fun-asr-realtime`，最大句间静音 1300 ms，语义断句关闭，心跳开启；连接字段和凭据默认留空。
- `src/shared/config/validation.ts`、`src/shared/config/document.ts`
  - 新增 Fun-ASR 模型白名单、Workspace 字符限制、WSS、官方地域主机、固定路径和 Endpoint/Workspace 交叉校验。
  - 最大句间静音限制为 200–6000 ms；凭据长度和布尔字段继续由主进程共享解析器校验。
  - 允许默认配置的 Endpoint/Workspace 同时为空；真正启动前由能力目录要求二者齐全。
- `src/main/engine/config/EngineCommandBuilder.ts`
  - 新增 Fun-ASR 参数 builder，生成 `-e fun_asr` 以及 `-fmodel/-furl/-fworkspace/-fkey/-fsemantic/-fsilence/-fheartbeat`；共用音频、语言、录音和外部翻译参数仍只生成一次。
- `src/main/utils/CaptionEngine.ts`
  - Fun-ASR 启动前检查配置 API Key 或 `DASHSCOPE_API_KEY`，缺失时通过现有三语通知拒绝启动。
- `src/main/utils/UtilsFunc.ts`
  - 将 `-fkey` 加入进程命令日志脱敏列表。
- `src/main/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 新增 Fun-ASR 凭据缺失的主进程通知。
- `engine/cli.py`、`engine/main.py`
  - Typed CLI 增加七个 Fun-ASR 参数并映射到 ProviderConfig；布尔开关只接受 0/1，凭据字段不进入 dataclass `repr`。
- `engine/providers/fun_asr.py`
  - 新增官方 DashScope SDK 适配器、显式配置对象、SDK callback generation 隔离和 Endpoint/音频契约校验。
  - partial/final 使用同一服务端 sentence ID 派生 caption ID，final 去重后只允许 Session 提交一次翻译；心跳忽略，usage 去重。
  - 非主动断线最多重连 3 次，退避 0.25、0.5、1 秒；重连期间最多保存 50 帧（默认约 5 秒），满时丢弃最旧帧并上报不含音频内容的信息事件。
  - SDK 异常、回调错误和重连耗尽消息不回显服务端正文、URL、音频或凭据。
  - 每次重连建立新的服务端时间戳 epoch，并按当前任务已成功发送的 16 kHz PCM16 字节数计算 partial 缺失结束时间的回退，避免把新任务的毫秒偏移套到旧任务起点。
- `engine/providers/registry.py`、`engine/providers/__init__.py`
  - 注册第五个 Provider builder，并复用 16 kHz 单声道 Pipeline 和现有外部 TranslationService；`main.py` 没有增加模型流程分支。
- `engine/requirements.txt`
  - 将项目原有、已经被 Gummy 使用的官方 `dashscope` 依赖固定为本阶段实际检查和测试的 `1.26.6`，提高构建可复现性；没有增加新的依赖包或 Node lockfile 变更。
- `src/renderer/src/engines/types.ts`、`catalog.ts`
  - 闭合配置路径加入 Fun-ASR 字段；Provider definition 支持可选跨字段校验，目录注册第五个 Provider。
- `src/renderer/src/engines/providers/fun_asr.ts`
  - 新增能力定义：可选源语言、外部翻译、录音支持、热词明确不支持。
  - 以通用控件描述模型、Workspace、WSS、API Key、语义断句、最大句间静音和心跳；启动时要求 Workspace/WSS，并校验二者一致性。
- `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 新增 Provider、模型选项、字段、帮助、单位和校验通知三语文本。
- `tests/node/configDocument.test.mjs`
  - 覆盖 Fun-ASR 默认配置、合法配置和 Endpoint/Workspace 不一致拒绝。
- `tests/node/engineCommandBuilder.test.mjs`
  - 将内置 Provider 启动参数覆盖从四个扩展为五个，并验证全部 Fun-ASR 参数。
- `tests/node/engineCatalog.test.mjs`
  - 验证第五个 Provider 唯一注册、语言默认值、能力字段和三语键完整性。
- `tests/node/utilsFunc.test.mjs`
  - 验证 `-fkey` 不出现在脱敏日志结果中。
- `engine/tests/test_cli.py`、`test_provider_registry.py`
  - 覆盖 Fun-ASR 参数解析、默认值、五 Provider 注册集合和两层 Python 配置凭据脱敏。
- `engine/tests/test_fun_asr_provider.py`
  - 使用伪造 SDK client/result，覆盖 partial/final/heartbeat/usage、服务端时间戳、重连后新时间戳 epoch、final 去重、重连退避、缓冲冲刷、重试耗尽、错误脱敏、停止冲刷和音频/Endpoint 契约；不访问网络。
- `README.md`、`docs/api-docs/config-v2.md`、`caption-engine.md`、`docs/engine-manual/architecture.md`、`docs/testing.md`
  - 更新第五个引擎的用户选择、配置结构、协议映射、Provider 职责、重连/关闭语义、测试边界和热词非目标。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`
  - 增加 Workspace/Endpoint/API Key 地域一致性、计费提示、界面设置、CLI 参数和热词限制。
- `docs/engine-manual/zh.md`、`en.md`、`ja.md`
  - 将 Fun-ASR 添加到 Provider 示例，说明 CLI 正本、SDK 边界和接入示例。
- `change.md`
  - 追加本阶段授权、技术决策、完整文件范围、行为、依赖、兼容性、验证、限制与回滚记录。

### 修改前后行为

- 修改前：V2、Electron builder、Renderer 目录和 Python Registry 只有 Gummy、Vosk、SOSV、GLM；选择 Fun-ASR 没有配置、进程参数或运行实现。
- 修改后：Fun-ASR 是第五个能力驱动 Provider，完整走共享 V2 校验、通用表单、纯启动参数 builder、统一 Registry/Pipeline/Session/TranslationService 和既有 stdout/TCP 协议。
- 修改前：接入在线 WebSocket 引擎可能需要在 `EngineControl.vue`、`CaptionEngine`、`main.py` 和识别类各复制一套条件与循环。
- 修改后：Vue 组件和 `main.py` 均无 Fun-ASR 条件分支；差异分别位于 Renderer definition、Electron 参数 builder 和 Python Provider builder。
- Fun-ASR partial 只更新字幕，final 固化一次并触发一次客户端翻译。外部 command 仍都是 `caption`/`translation`，没有增加未版本化 final 字段。
- 服务端时间戳成为字幕时间来源；partial 缺少结束时间时才使用已发送音频相对时长作为保守回退，不用网络回调到达时间冒充音频位置。
- 正常关闭会等待 SDK 完成结束任务；异常断线使用有界退避和有界音频缓冲，不无限创建线程、任务或队列。

### 配置、接口、兼容性与依赖

- V2 schemaVersion 仍为 `2`，但 `engine.providers.funAsr` 成为必需已知层。按用户此前“V2 完整迁移，不考虑已安装版本兼容性”的决策，不添加旧 V2 增量迁移：缺少该层的已安装配置会整体拒绝并使用最新默认值，退出时写回。
- 未知扩展字段继续保留；Fun-ASR 已知字段仍严格按类型、范围和跨字段关系解析。
- 新增 Python CLI 参数和 Provider ID，不修改既有 Provider 参数、默认值或自定义引擎参数。
- Electron/Python stdout 与 TCP NDJSON command envelope 完全不变；自定义引擎协议无迁移。
- 凭据仍按当前 V2 安全模型明文持久化并传入 Renderer；进程日志和 Python `repr` 已扩展脱敏，但本阶段没有引入系统安全存储。
- `dashscope==1.26.6` 是阿里云官方维护、Apache 2.0 许可、项目原有依赖的版本固定，不是新增 SDK。当前项目虚拟环境元数据确认 Name `dashscope`、Version `1.26.6`、Author `Alibaba Cloud`、Home-page `https://dashscope.aliyun.com/`；`package.json`、`package-lock.json` 和 `engine/main.spec` 无变化。
- 精确回滚：恢复本阶段修改前的共享 schema/validation/document、Electron builder/CaptionEngine/脱敏/i18n、Python CLI/main/registry/requirements、Renderer types/catalog/三语 i18n 和相关测试；删除 `engine/providers/fun_asr.py`、其测试及 Renderer `providers/fun_asr.ts`；恢复本文列出的 README/API/架构/测试/三语手册段落。第五阶段能力目录和前四阶段架构可以保留。已被最新默认值覆盖的旧 V2 配置不能由代码回滚恢复。

### 验证记录

- 实现配置和 UI 后首次 `npm run typecheck`：通过。
- 首次组合执行 `npm run test:node` 与 `npm run test:python`：Python 42/42 通过；Node 33/34，唯一失败是新 WSS 校验器错误地拒绝默认空 Endpoint。修正 `requireWebSocketUrl` 的 `allowEmpty` 传递后继续验证，该失败没有被忽略。
- 修正后 `npm run typecheck`：通过；`npm run test:node` 为 34/34；`npm run test:python` 为 42/42。
- 最终审计发现重连后仍沿用首次任务时间起点；改为每个 generation 建立独立时间戳 epoch，并新增重连时间轴测试。最终验证计数因此增加到 Python 43 个。
- 最终 `npm run verify`：通过；Node/Web TypeScript 和 Vue 类型检查、ESLint、Node 34/34、Python 43/43 全部通过。
- 最终 `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 19、1、3249 个模块。
- `engine/.venv/bin/python3 engine/main.py --help`：通过；第五个 Provider 和七个参数出现在入口帮助中。
- `engine/.venv/bin/python3 -m compileall -q engine/core engine/providers engine/services engine/protocol engine/cli.py engine/main.py`：通过。
- `git diff --check`：通过。
- 依赖元数据检查：项目虚拟环境的 `dashscope` 为 1.26.6、Apache 2.0、Alibaba Cloud；requirements 仅把原有未固定依赖改为精确版本。
- 验证仍输出仓库既有 npm Electron mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告；未为消除提示扩大本阶段依赖或模块配置范围。

### 未执行、风险与后续事项

- 没有使用真实 API Key、Workspace、Endpoint、麦克风或系统音频，没有建立 Fun-ASR WebSocket，也没有产生云端费用或修改远端资源。所有 SDK 行为通过可注入伪客户端验证。
- 没有运行 Electron GUI 手工表单回归、真实 Python 子进程端到端、PyInstaller、安装包或 Windows/Linux 构建。生产 Web/Electron bundle 已构建，但不代表打包后的 Python 可执行文件已包含并成功运行所有 DashScope SDK 运行时模块。
- SDK `on_open` 表示异步 worker/连接已启动；SDK 内部负责等待服务端 task-started 并缓存待发送音频。项目的 `ProviderReady` 因此表示“SDK 已可接收音频”，不是向外暴露原始 task-started 帧。
- 重连只能保留失败后进入的有限音频，新连接生成新的 caption ID generation；连接中断前尚未 final 的句子不会跨服务端任务合并。该行为优先保证有限内存、去重和旧回调隔离，真实弱网体验仍需在线回放测试。
- `dashscope.base_websocket_api_url` 和 `dashscope.api_key` 是 SDK 进程级配置；当前架构每个字幕进程只运行一个 Provider，因此没有同进程多 Workspace 并发冲突。若未来改为多 Provider 同进程并发，必须先封装 SDK 全局状态。
- 热词尚未实现。后续阶段必须先确认 Fun-ASR 热词资源生命周期、地域/Workspace 绑定、计费和删除确认，再新增 `services/hotwords.py`、专用 Electron 组件和远端操作测试；不得把热词 ID 堆入通用文本字段。
- 应在用户显式提供测试账号并确认可产生费用后，增加 opt-in 在线测试：固定 PCM 回放、北京/新加坡 Endpoint、task-started/result-generated/task-finished、静音/心跳、断网重连、停止尾句、用量和错误码。默认 CI 仍不得访问付费 API。

### 参考与决策依据

- 阿里云官方 [Fun-ASR 实时语音识别 WebSocket API](https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api)：Endpoint、鉴权、任务流、二进制音频和结束流程。
- 阿里云官方 [Fun-ASR Python SDK](https://help.aliyun.com/zh/model-studio/fun-asr-realtime-python-sdk)：Recognition 调用、约 100 ms 帧、模型、语义断句、静音、心跳和停止等待行为。
- 阿里云官方 [服务端事件](https://help.aliyun.com/zh/model-studio/fun-asr-server-events)与[客户端事件](https://help.aliyun.com/zh/model-studio/fun-asr-client-events)：partial/final、时间戳、usage、task-finished/task-failed 和 finish-task 语义。
- 根目录 `AGENTS.md` 的官方 SDK 优先、单声道音频、时间戳、心跳、Provider/Session、有限重试、停止冲刷、能力目录、三语、凭据脱敏、测试和变更记录约束。
- 用户此前明确的第三至第五阶段架构路线，以及“V2 完整迁移、不考虑已安装版本兼容性”的配置决策。

## 2026-08-12 - 第七阶段：两级 Fun-ASR 热词与独立 HotwordService/UI

### 授权与范围

- 用户授权：要求第七阶段分两级实现热词；第一级为“热词表 ID + 上下文术语”，第二级为完整热词管理器，并建立独立 `HotwordService` 和 UI。
- 目标：在严格 V2 配置、能力驱动 Renderer、独立 Electron 进程组件、统一 Python Provider/Session 和第六阶段 Fun-ASR 接入之上，完成配置、运行时参数、远端资源管理边界、专用 UI、三语文本、测试与文档的完整纵向切片。
- 明确非目标：不实现 Fun-ASR 不支持的即时加权热词；不把远端 CRUD 塞入 RecognitionProvider/Session；不修改公开字幕 stdout/TCP 协议；不发起任何真实阿里云 list/create/update/delete 或识别请求；不使用真实凭据；不提交或推送代码。

### 官方能力与关键决策

- 预编译热词是持久远端 `vocabulary_id`，词条带 1–5 权重；创建时的 `target_model` 必须与识别模型完全一致，否则可能不生效。管理与识别使用同一个 API Key 所属账号、地域和 Workspace。
- 上下文通过 `start(raw_input={context: ...})` 传入。本项目把术语合并为一条 `user/input_text`，合计最多 400 字符；它没有权重，可以与预编译热词并用。
- Fun-ASR 不支持 SDK 文档中的即时 `vocabulary` 热词；该能力只属于文档列出的 Qwen-Audio 流式模型，因此 UI 和配置没有伪造即时热词入口。
- 项目锁定的 DashScope 1.26.6 虽保留 `Recognition.start(phrase_id=...)` 旧签名，但 Fun-ASR 官方请求字段是构造参数 `vocabulary_id`。最终实现为每个新 `Recognition` client 传 `vocabulary_id`、每次 `start()` 传 `raw_input.context`；重连同时重建两者，避免把新版词表 ID 错传为旧 `asr_phrase` 资源。
- 远端管理使用官方 `VocabularyService` 的 create/list/query/update/delete；update 是完整替换。修改和删除前先 query 并校验远端 `target_model`，不允许用当前模型误改其他模型的词表。
- 北京与新加坡 WSS Endpoint 派生对应 Workspace 专属 HTTP `/api/v1`；阿里云当前说明新加坡子业务空间不支持热词，UI 明确提示，不在客户端猜测主业务空间最终可用性。

### 修改文件与职责

- `src/shared/config/schema.ts`
  - 在必需的 `engine.providers.funAsr` 中增加必需 `hotwords` 子层：`vocabularyId`、`targetModel`、`contextTerms`。
  - 默认不使用热词表，上下文为空，目标模型为 `fun-asr-realtime`；`schemaVersion` 保持 2。
- `src/shared/config/validation.ts`、`src/shared/config/document.ts`
  - 校验词表 ID 字符与长度、上下文数组数量/去空/去重/单项长度/400 字符合计长度。
  - 非空词表 ID 要求目标模型与当前 Fun-ASR 识别模型完全一致。
- `src/shared/hotwords.ts`
  - 新增 Renderer/Main 共享的 Hotword request/response/resource 类型和不可信输入解析器。
  - 支持 list/query/create/update/delete；限制最多 2000 词、权重 1–5、Fun-ASR 语言 zh/en/ja、创建前缀、分页、ID、重复词和官方 ASCII/非 ASCII 长度。
  - 提供专用编辑器的 `text | weight | lang` 逐行解析，不把自由文本直接传给 SDK。
- `engine/services/hotwords.py`、`engine/services/__init__.py`
  - 新增 `HotwordRuntimeConfig`，分别构造 Recognition client 的 `vocabulary_id` 和 `start()` 的 `raw_input.context`。
  - 新增独立 `HotwordService` 与可注入 `VocabularyClient` 协议，规范化官方 SDK 的 snake_case 返回值。
  - create 强制使用当前应用模型；update/delete 查询后校验远端目标模型；HTTP Endpoint 只能由已验证 WSS/Workspace 派生。
  - 新增一次性 stdin/stdout worker，输入硬上限 1 MiB，只返回规范化数据或稳定错误码，不回显凭据、SDK 正文或远端异常。
- `engine/providers/fun_asr.py`
  - Provider 接收 `HotwordRuntimeConfig`；每次初连/重连创建 SDK client 时携带 `vocabulary_id`，每次任务 `start()` 携带上下文。
  - 热词资源管理没有进入 Provider；现有 partial/final、时间戳、用量、翻译和关闭职责不变。
- `engine/cli.py`、`engine/providers/registry.py`、`engine/main.py`
  - 新增 `-fvocabulary/--fun_asr_vocabulary_id`、`-fvmodel/--fun_asr_vocabulary_model` 和可重复 `-fcontext/--fun_asr_context_term`，经 typed config/Registry 注入 Provider。
  - `main.py --hotword-service` 是精确匹配的独立一次性入口；普通识别装配路径没有增加远端 CRUD 分支。
- `src/main/engine/EngineExecutable.ts`、`src/main/utils/CaptionEngine.ts`
  - 抽出开发环境/打包环境共用的 Python 或 bundled executable 解析器，字幕进程与热词 worker 使用同一平台路径规则；自定义字幕引擎行为不变。
- `src/main/services/HotwordService.ts`
  - 新增独立 Electron service，重新解析 Renderer 请求，从已应用 AllConfig/环境变量获取目标连接和 API Key。
  - 同时最多一个远端操作；20 秒超时；stdout 最大 1 MiB；SDK stderr 不转发；child spawn/stdin/响应异常全部映射为脱敏错误码。
  - API Key 仅写入子进程 stdin，不进入 Renderer IPC、argv、响应或操作日志；日志只记录 action、结果码和异常类型。
- `src/main/ControlWindow.ts`
  - 注册 `control.hotwords.execute` invoke handler，调用独立 service。
- `src/main/engine/config/EngineCommandBuilder.ts`
  - Fun-ASR 识别命令加入目标模型、可选词表 ID和重复上下文参数；继续使用参数数组，不经过 shell。
- `src/renderer/src/engines/types.ts`、`src/renderer/src/engines/providers/fun_asr.ts`
  - 补齐 V2 热词路径；Fun-ASR capability 从无热词改为 `manager`。
  - 目录级校验热词目标模型与识别模型，专用 UI 仍通过 capability 挂载而非 Provider ID 条件分支。
- `src/renderer/src/components/EngineControl.vue`
  - 当能力为 `manager` 时挂载 `HotwordManager`，传入本地草稿与已应用远端目标；没有加入 Fun-ASR `v-if`。
- `src/renderer/src/components/engine/HotwordManager.vue`
  - 一级 UI：已有词表 ID、目标模型、逐行上下文；明确区分带权重远端词表与无权重上下文。
  - 二级 UI：分页/前缀筛选、查询、创建、选用、完整替换、删除；创建成功仅写入本地草稿，识别仍需“应用更改”。
  - 管理器始终显示已应用 API Key 的所属账号语义、Workspace、地域和模型；因 SDK 不返回账号 ID，界面明确不显示密钥或账号标识。
  - 远端写入不受本地取消影响；删除前再次查询模型，并在确认框显示账号、Workspace、地域、模型、资源 ID 和不可撤销提示。
- `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 增加一级/二级 UI、格式说明、地域限制、确认、结果和全部稳定错误码的中英日文本。
- `engine/tests/test_cli.py`、`test_provider_registry.py`、`test_fun_asr_provider.py`
  - 覆盖新 CLI/Registry 字段、热词与上下文的首次任务和重连任务传递，以及现有 Provider 行为回归。
- `engine/tests/test_hotword_service.py`
  - 使用伪造 `VocabularyClient` 覆盖运行时模型/上下文约束、完整 CRUD、修改前模型拒绝和 worker 错误脱敏；不访问网络。
- `tests/node/configDocument.test.mjs`、`engineCommandBuilder.test.mjs`、`engineCatalog.test.mjs`
  - 覆盖 V2 默认值/解析/模型不匹配、识别参数生成、manager capability 和目录校验。
- `tests/node/hotwords.test.mjs`
  - 覆盖管理请求、词条编辑格式、官方长度/权重/语言限制和三语热词 UI 键结构。
- `README.md`、`docs/api-docs/config-v2.md`、`electron-ipc.md`、`caption-engine.md`
  - 记录两级使用方式、严格 V2 新层、独立 IPC/worker、凭据边界和公开字幕协议不变。
- `docs/engine-manual/architecture.md`、`zh.md`、`en.md`、`ja.md`
  - 更新服务树、运行时/远端职责分离、官方 SDK 字段、CLI 和扩展约束。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`
  - 增加一级/二级操作、应用与立即远端生效的差异、删除确认、模型匹配和新加坡限制；中英 CLI 示例加入新参数。
- `docs/testing.md`
  - 记录新增自动化覆盖和真实 Electron/阿里云远端链路未执行范围。
- `change.md`
  - 追加本阶段授权、官方决策、完整文件范围、兼容性、安全、验证失败、限制与回滚记录。

### 修改前后行为

- 修改前：Fun-ASR 能识别但 capability 明确为无热词；V2、CLI、Provider 和 UI 都不能传热词表或上下文，也没有远端资源管理边界。
- 修改后：用户可以先只填已有 `vocabularyId` 和上下文完成一级使用，也可以在独立二级管理器中管理远端词表，再把选中的 ID 写入草稿并显式应用。
- 本地 Apply/Cancel 只管理 V2 识别配置；远端 create/update/delete 是独立、立即生效的用户操作，取消本地草稿不能回滚云资源。
- Fun-ASR 识别 stdout/TCP command envelope 完全不变；热词不增加 caption 事件字段，最终句翻译仍只由 Session 触发一次。
- 管理请求在 Renderer、Electron 和 Python 三层验证；凭据只存在于已应用配置、主进程内存和一次性 worker stdin。

### 配置、接口、兼容性与依赖

- `schemaVersion` 仍为 2，但 `engine.providers.funAsr.hotwords` 变成必需已知层。按用户此前“V2 完整迁移、不考虑已安装版本兼容性”的决策，不为缺少该层的已安装 V2 增加增量迁移；非法文档使用最新默认配置并在退出时写回。
- 新增三个 Python CLI 参数；既有参数、Provider ID、自定义字幕命令和公开 stdout/TCP 协议不变。
- 新增内部 IPC `control.hotwords.execute` 和私有 `--hotword-service` worker envelope；二者不是第三方公开扩展协议。
- `package.json`、`package-lock.json`、`engine/requirements.txt` 和 `engine/main.spec` 无差异；复用第六阶段已锁定的官方 `dashscope==1.26.6`，没有安装或升级依赖。
- 精确回滚：恢复本阶段前的共享 schema/validation/document、CLI/main/registry/Fun provider/services export、Electron ControlWindow/command builder/CaptionEngine、Renderer EngineControl/目录/types/i18n 和现有测试；删除 `engine/services/hotwords.py`、`engine/tests/test_hotword_service.py`、`src/shared/hotwords.ts`、`src/main/engine/EngineExecutable.ts`、`src/main/services/HotwordService.ts`、`src/renderer/src/components/engine/HotwordManager.vue`、`tests/node/hotwords.test.mjs`；恢复本文列出的 README/API/架构/测试/三语手册段落。远端资源本阶段从未修改，无需云端回滚；已经被新默认配置覆盖的旧 V2 文件不能由代码回滚恢复。

### 验证记录

- 首次 `npm run typecheck`：失败，`src/shared/hotwords.ts` 中经过值校验的 `lang` 仍被 TypeScript 推断为普通 `string`（TS2322）；收窄为 `HotwordLanguage` 后通过。该失败未被忽略。
- 首次组合 Node/Python 测试：Node 36/36 通过；Python 48/49，新增 Fun-ASR 测试最初误插入到前一测试中，造成事件队列断言错位；恢复测试边界并清空启动事件后 Python 49/49。该失败未被忽略。
- 首次 `npm run lint`：失败，ASCII 判断使用控制字符范围正则触发 `no-control-regex`；改为逐字符 `codePointAt(0) > 127` 后通过，没有新增 suppression。
- 补充三语键测试后单独 `npm run test:node`：Node 37/37 通过；补充重连热词断言后 Python 49/49 通过。
- `engine/.venv/bin/python3 engine/main.py --hotword-service` 离线入口检查：通过；输入缺少连接字段的请求后只输出 `{ok:false,errorCode:"invalid_request"}` 并以 1 退出，没有触网或回显输入。
- 最终官方/本地 SDK 审计发现初稿把预编译 ID 传给 `start(phrase_id=...)`；根据当前官方 Python SDK 参数表、客户端事件和本地 DashScope 1.26.6 源码，改为 `Recognition(..., vocabulary_id=...)`，上下文仍通过 `start(raw_input=...)`，并重新执行全部验证。
- `engine/.venv/bin/python3 -m compileall -q ...`：通过。
- `engine/.venv/bin/python3 engine/main.py --help`：通过；三个热词参数出现在正式入口帮助中。
- 最终 `npm run verify`：通过；Node/Web/Vue TypeScript、ESLint、Node 37/37、Python 49/49 全部通过。
- 最终 `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 22、1、3253 个模块。
- 最终 `git diff --check`：通过。
- 验证仍输出仓库既有 npm Electron mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告；未为消除提示扩大依赖或模块配置范围。

### 未执行、风险与后续事项

- 没有使用真实 API Key、Workspace 或 Endpoint，没有建立阿里云连接，没有执行 list/query/create/update/delete，没有产生费用或修改远端数据。CRUD 语义通过可注入伪客户端验证。
- 没有运行真实 Electron GUI、浏览器组件交互/视觉/键盘测试、打包后的 Python worker、PyInstaller 或平台安装包。生产 bundle 通过不等于真实账号下的 UI 与远端链路已验收。
- SDK 不提供当前 API Key 所属账号的可展示标识；界面只能准确声明“已应用 API Key 的所属账号”，并显示可验证的 Workspace、地域、模型和资源 ID。真实账号归属需用户在阿里云控制台核对。
- 超时后远端最终状态未知，UI 明确要求刷新确认；客户端不会自动重试写操作，以免重复创建或重复修改。
- update 是完整替换，用户必须在编辑器中保留所有需要的条目；删除不可恢复。模型不匹配的资源必须先把当前 Fun-ASR 模型配置为该资源的 `target_model` 并应用，才能修改或删除。
- 新加坡子业务空间的限制由阿里云服务端决定；客户端只提示官方限制，不用 Workspace 名称猜测主/子空间。
- 后续若增加 Paraformer、Qwen-ASR 或即时热词，必须为其能力与资源类型建立独立 Provider/service 适配，不能把 Fun-ASR 的 `vocabulary_id`、旧 `phrase_id` 和即时 `vocabulary` 混为同一字段。

### 参考与决策依据

- 阿里云官方 [提高语音识别准确率](https://help.aliyun.com/zh/model-studio/improve-asr-accuracy)：预编译热词、即时热词、上下文的区别，账号/模型匹配与上下文限制。
- 阿里云官方 [Fun-ASR Realtime Python SDK](https://help.aliyun.com/zh/model-studio/fun-asr-realtime-python-sdk)：`vocabulary_id` 构造参数、`raw_input` start/call 参数、SDK 版本和上下文结构。
- 阿里云官方 [Fun-ASR 客户端事件](https://help.aliyun.com/zh/model-studio/fun-asr-client-events)：run-task 中的 `vocabulary_id`、context 与即时热词支持范围。
- 阿里云官方 [热词 Python SDK](https://help.aliyun.com/zh/model-studio/vocabulary-python-sdk)：VocabularyService CRUD、Workspace Endpoint、词条结构、update 完整替换和新加坡子业务空间限制。
- 本地项目锁定 DashScope 1.26.6 的 `Recognition.start` 与任务构造源码，用于识别旧 `phrase_id` 签名和新版 `vocabulary_id` 构造参数的实际边界。
- 根目录 `AGENTS.md` 的远端修改必须用户触发、目标信息/删除确认、官方 SDK、模型匹配、账号地域、凭据脱敏、有限进程、三语、测试、文档和完整 `change.md` 约束。

## 2026-08-12 - V2 版本号更新与 macOS arm64 构建

### 授权与目标

- 用户授权：要求“编译一下Mac版本，并更新大版本号为V2”。
- 本批次将“大版本号 V2”按应用发布版本处理为 `v2.0.0` / `2.0.0`，同步应用元数据、可见版本标识和发布文档，并生成 macOS Apple Silicon arm64 安装产物。
- 明确非目标：不修改系统 Python、Node、shell 环境或全局依赖；不升级依赖；不改配置 schema、IPC、字幕进程协议、Provider 行为或远端资源。

### 变更类型

- 配置：更新 npm 应用版本号和锁文件根版本。
- 文档：同步 README、CHANGELOG 与中英日用户/引擎文档版本标识。
- 构建：重新生成 Python 引擎与 macOS arm64 桌面包。

### 修改文件与原因

- `package.json`
  - 将应用版本从 `1.1.1` 更新为 `2.0.0`，供 Electron builder、Info.plist 和产物命名使用。
- `package-lock.json`
  - 同步根包版本从 `1.0.0` 到 `2.0.0`；没有新增、删除或升级依赖。
- `src/renderer/index.html`
  - 将窗口标题版本从 `v1.1.1` 更新为 `v2.0.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 将关于窗口显示版本从 `v1.1.1` 更新为 `v2.0.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 将 release badge 与首页发布提示更新为 `v2.0.0`。
  - 将旧的“非 Windows 停留在 v1.0.0”说明改为当前 V2 已提供 Windows 与 macOS arm64 构建，Linux 仍需单独验证。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 将对应版本更新为 `v2.0.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 将对应版本更新为 `v2.0.0`。
- `docs/CHANGELOG.md`
  - 追加 `v2.0.0` 发布与构建记录。
- `change.md`
  - 追加本批次授权、变更范围、验证、风险与回滚记录。

### 构建产物

- `engine/dist/main`
  - 使用 `engine/.venv` 内 PyInstaller 重新生成的 macOS arm64 Python 引擎。
- `dist/mac-arm64/Auto Caption.app`
  - Electron builder 生成的 macOS arm64 应用目录，Info.plist 中 `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 `2.0.0`。
- `dist/Auto Caption-2.0.0-arm64-mac.zip`
  - 对本地 ad-hoc 签名后的 `.app` 重新封装生成。
- `dist/Auto Caption-2.0.0-arm64-mac.zip.blockmap`
  - 使用 app-builder 对重封后的 zip 重新生成，避免旧 blockmap 指向重封前内容。
- `dist/auto-caption-2.0.0.dmg`
  - 使用本机 `hdiutil create` 从签名后的 `.app` 生成。
- `dist/latest-mac.yml`
  - 更新为 `2.0.0` zip 的路径、大小、sha512 和 releaseDate；这是生成目录中的更新元数据。

### 修改前后行为

- 修改前：应用版本源为 `package.json` 的 `1.1.1`，锁文件根版本为 `1.0.0`；标题、关于窗口、README 和手册仍显示旧版本；上次 Mac 构建产物为 `1.1.1`。
- 修改后：应用元数据、运行界面可见版本、README、手册、CHANGELOG 与本次 macOS 构建产物统一为 `2.0.0` / `v2.0.0`。
- 配置、IPC、Python stdout/TCP 协议、命令行参数和数据结构没有变化。
- 没有新增依赖，没有安装全局包，没有修改系统环境变量或 shell 配置。

### 兼容性、迁移与回滚

- 配置 schemaVersion 仍为 `2`；本批次只更新应用发布版本，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 x64 或 universal 包。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.0.0` 构建产物；如需恢复旧包，使用此前的 `1.1.1` 产物或重新按旧版本号构建。

### 验证记录

- `npm version 2.0.0 --no-git-tag-version --allow-same-version`：通过；同时输出既有 npm mirror 配置弃用警告。
- `npm run typecheck`：通过；Node 与 Web/Vue TypeScript 检查均通过。
- `npm run lint`：通过。
- `npm run build`：通过；Electron main、preload、renderer 生产构建完成。
- `PYINSTALLER_CONFIG_DIR=... engine/.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：沙盒内首次因 PyInstaller sync semaphore 权限失败；经用户批准在沙盒外运行后通过，CLI help 正常输出。
- `npm test`：通过；Node 37/37，Python 49/49。测试仍输出既有 npm mirror 弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能提示。
- `./node_modules/.bin/electron-builder --mac`：`.app` 和 zip 构建完成；DMG 阶段因 `hdiutil create` 失败退出码 1。该失败未忽略，随后用本机 `hdiutil create` 单独生成最终 DMG。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重封签名后的 zip。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.0.0.dmg`：通过；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.0.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.0.0-arm64-mac.zip`：通过，无压缩数据错误。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `shasum -a 256 dist/auto-caption-2.0.0.dmg dist/Auto Caption-2.0.0-arm64-mac.zip`：
  - DMG：`fee084c97afcb7ac3b990f496034edf3a425309f7353220a34ed2556034b1527`
  - ZIP：`d4c0f8684eb0eddca8172ff997594ed194442a9a8e5bfc20f68d3c492d15c221`

### 未执行、风险与后续事项

- 未启动真实 Electron GUI 做窗口交互、麦克风/系统音频授权或真实识别流程；本批次验证到构建、测试、签名和安装包完整性。
- 未做 Windows、Linux、macOS x64 或 universal 构建；不能声称这些平台的 V2 安装包已由本批次验证。
- 未使用真实 API Key、Workspace 或云服务，不产生费用，也不修改远端热词资源。
- Electron builder 仍提示缺少 Developer ID signing identity；发布到普通用户机器前建议使用正式证书签名并 notarize。

### 参考与决策依据

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，DMG artifact 使用 `${name}-${version}.${ext}`。
- 根目录 `AGENTS.md`：遵循修改前检查、三语文档同步、构建产物记录、验证记录、系统环境与依赖边界、`change.md` 追加记录要求。

## 2026-08-12 - V2.2.0 小版本号更新与 macOS arm64 构建

### 授权与目标

- 用户授权：要求“编译一下Mac版本 并更新小版本号”。
- 本批次将“小版本号”按语义化版本从 `2.1.0` 提升为 `2.2.0`，同步应用元数据、可见版本标识和发布文档，并重新生成 macOS Apple Silicon arm64 安装产物。
- 明确非目标：不修改系统 Python、Node、shell 环境或全局依赖；不升级依赖；不改配置 schema、IPC、字幕进程协议、Provider 行为或远端资源。

### 变更类型

- 配置：更新 npm 应用版本号和锁文件根版本。
- 文档：同步 README、CHANGELOG 与中英日用户/引擎文档版本标识。
- 构建：重新生成 Python 引擎与 macOS arm64 桌面包。

### 修改文件与原因

- `package.json`
  - 将应用版本从 `2.1.0` 更新为 `2.2.0`，供 Electron builder、Info.plist 和产物命名使用。
- `package-lock.json`
  - 同步根包版本从 `2.1.0` 到 `2.2.0`；没有新增、删除或升级依赖。
- `src/renderer/index.html`
  - 将窗口标题版本从 `v2.1.0` 更新为 `v2.2.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 将关于窗口显示版本从 `v2.1.0` 更新为 `v2.2.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 将 release badge、首页发布提示和平台说明更新为 `v2.2.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 将对应版本更新为 `v2.2.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 将对应版本更新为 `v2.2.0`。
- `docs/CHANGELOG.md`
  - 追加 `v2.2.0` 发布与构建记录。
- `change.md`
  - 追加本批次授权、变更范围、验证、风险与回滚记录。

### 构建产物

- `engine/dist/main`
  - 使用 `engine/.venv` 内 PyInstaller 重新生成的 macOS arm64 Python 引擎。
- `dist/mac-arm64/Auto Caption.app`
  - Electron builder 生成的 macOS arm64 应用目录，Info.plist 中 `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 `2.2.0`。
- `dist/Auto Caption-2.2.0-arm64-mac.zip`
  - 对本地 ad-hoc 签名后的 `.app` 重新封装生成。
- `dist/Auto Caption-2.2.0-arm64-mac.zip.blockmap`
  - 使用 app-builder 对重封后的 zip 重新生成。
- `dist/auto-caption-2.2.0.dmg`
  - 使用本机 `hdiutil create` 从签名后的 `.app` 生成。
- `dist/latest-mac.yml`
  - 更新为 `2.2.0` zip 的路径、大小、sha512 和 releaseDate；这是生成目录中的更新元数据。

### 修改前后行为

- 修改前：应用版本源、标题、关于窗口、README、手册和上次 Mac 构建产物为 `2.1.0` / `v2.1.0`。
- 修改后：应用元数据、运行界面可见版本、README、手册、CHANGELOG 与本次 macOS 构建产物统一为 `2.2.0` / `v2.2.0`。
- 配置、IPC、Python stdout/TCP 协议、命令行参数和数据结构没有变化。
- 没有新增依赖，没有安装全局包，没有修改系统环境变量或 shell 配置。

### 兼容性、迁移与回滚

- 本批次只更新应用发布版本，不涉及用户配置迁移；当前仓库自动化测试覆盖的是既有 V3 配置行为。
- macOS 产物为 arm64；未生成 x64 或 universal 包。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.2.0` 构建产物；如需恢复旧包，使用此前的 `2.1.0` 产物或重新按旧版本号构建。

### 验证记录

- `npm version minor --no-git-tag-version`：通过；版本提升到 `v2.2.0`，同时输出既有 npm mirror 配置弃用警告。
- `npm run verify`：通过；Node/Web/Vue TypeScript、ESLint、Node 39/39 和 Python 49/49 全部通过。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 22、1、3256 个模块。
- `PYINSTALLER_CONFIG_DIR=... engine/.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：沙盒内首次因 PyInstaller sync semaphore 权限失败；经用户批准在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：`.app` 和 zip 构建完成；DMG 阶段因 `hdiutil create` 失败退出码 1。该失败未忽略，随后用本机 `hdiutil create` 单独生成最终 DMG。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重封签名后的 zip。
- `node_modules/app-builder-bin/mac/app-builder_arm64 blockmap --input ... --output ...`：通过，生成 `2.2.0` zip blockmap。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.2.0.dmg`：通过；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.2.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.2.0-arm64-mac.zip`：通过，无压缩数据错误。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `shasum -a 256 dist/auto-caption-2.2.0.dmg dist/Auto Caption-2.2.0-arm64-mac.zip`：
  - DMG：`1e4d02311ceb054cae7d54f653ed058359c5dcb4d00982c7e21f0e9b5f9819d9`
  - ZIP：`65aaae31ea603929c6183a9cef5e16e328ed55bd92077ef6cf3c6ee8a39cd3b5`

### 未执行、风险与后续事项

- 未启动真实 Electron GUI 做窗口交互、麦克风/系统音频授权或真实识别流程；本批次验证到构建、测试、签名和安装包完整性。
- 未做 Windows、Linux、macOS x64 或 universal 构建；不能声称这些平台的 V2.2.0 安装包已由本批次验证。
- 未使用真实 API Key、Workspace 或云服务，不产生费用，也不修改远端热词资源。
- Electron builder 仍提示缺少 Developer ID signing identity；发布到普通用户机器前建议使用正式证书签名并 notarize。

### 参考与决策依据

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，DMG artifact 使用 `${name}-${version}.${ext}`。
- 根目录 `AGENTS.md`：遵循修改前检查、三语文档同步、构建产物记录、验证记录、系统环境与依赖边界、`change.md` 追加记录要求。

## 2026-08-12 - 翻译配置折叠与命名自定义引擎

### 授权与目标

- 用户明确授权执行修改：关闭翻译时不再展示无效的翻译服务字段；启用翻译后增加“配置翻译引擎”开关，打开时才展开外部翻译 Provider、模型、Base URL 和 API Key。
- 用户同时要求把自定义引擎放入字幕引擎下拉菜单：选择添加入口时提示命名，创建后以该名称长期显示，并在自定义条目右侧提供删除按钮。
- 非目标：不修改 Python Provider、字幕 stdout/TCP 协议、远端热词资源、依赖版本、发布版本或安装包。
- 修改前已存在用户未提交改动；本批次保留这些改动，并在相关文件中只追加本功能所需差异。`src/renderer/src/engines/form.ts` 的 Vue Proxy 克隆修复不是本批次产生的修改。

### 变更类型

- 功能：翻译配置折叠；命名、多条目的自定义字幕引擎选择与删除。
- 修复：关闭翻译后不再向 Python 子进程传递翻译模型、URL 或翻译凭据；自定义引擎不再被残留内置 Provider 校验阻止。
- 配置：配置 schema 从 V2 升级至 V3，并提供 V2→V3 显式迁移。
- 测试：补充迁移、显隐、命令参数隔离和自定义引擎校验覆盖。
- 文档：同步 README、三语用户手册、配置/API、架构、测试和 CHANGELOG。

### 修改文件与原因

- `src/shared/config/schema.ts`、`validation.ts`、`document.ts`、`src/shared/types.ts`
  - 将单一 `provider + custom.enabled` 双状态改为 `activeEngineId + customEngines[]`；增加活动内置/自定义引擎解析、命名条目校验和 V2→V3 迁移。
- `src/main/engine/config/EngineCommandBuilder.ts`
  - 由已解析的内置 Provider 或自定义条目构建参数；翻译关闭时不生成 `-tm`、`-omn`、`-ourl`、`-okey`。
- `src/main/utils/CaptionEngine.ts`、`AllConfig.ts`
  - 按唯一活动引擎启动进程，处理不存在的选择，并使用 V3 配置读写及安全日志。
- `src/main/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 增加活动引擎失效的三语主进程错误文本。
- `src/renderer/src/engines/catalog.ts`、`types.ts`
  - 将外部翻译字段划分为独立 section，显隐同时受“启用翻译”和翻译 Provider 控制；统一跳过自定义引擎的内置 Provider 校验，并校验自定义可执行路径。
- `src/renderer/src/components/engine/EngineSelector.vue`
  - 新增统一下拉选择器，显示五个内置 Provider、命名自定义条目、“添加自定义引擎…”入口和条目右侧确认删除按钮。
- `src/renderer/src/components/EngineControl.vue`
  - 增加命名弹窗、重复/空名称检查、翻译配置展开开关、自定义条目编辑和删除后的安全回退；折叠状态只属于当前界面，不持久化。
- `src/renderer/src/components/EngineStatus.vue`、`src/renderer/src/stores/engineControl.ts`
  - 状态与启动通知显示活动内置 Provider 或用户命名的自定义引擎。
- `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 补齐翻译配置、自定义命名、删除确认和校验文本。
- `tests/node/configDocument.test.mjs`
  - 验证 V3 默认值、完整 V2 自定义配置迁移、未来/无版本拒绝和活动引擎校验。
- `tests/node/engineCatalog.test.mjs`
  - 验证翻译关闭后的字段不可见，以及自定义引擎只校验自身可执行路径、不执行残留 Vosk 等内置要求；保留此前已有的 Vue reactive clone 测试。
- `tests/node/engineCommandBuilder.test.mjs`
  - 验证 V3 内置/自定义启动参数，并确认翻译关闭后目标为 `none` 且不再传翻译服务参数。
- `docs/api-docs/config-v2.md` → `docs/api-docs/config-v3.md`
  - 更新配置示例、字段约束、迁移和兼容说明。
- `docs/api-docs/electron-ipc.md`、`docs/engine-manual/architecture.md`、`docs/testing.md`
  - 同步 V3 数据结构、Renderer 组件职责、IPC 数据类型和验证范围。
- `README.md`、`README_en.md`、`README_ja.md`、`docs/user-manual/zh.md`、`en.md`、`ja.md`、`docs/CHANGELOG.md`
  - 中英日同步用户可见交互和未发布变更说明。
- `change.md`
  - 追加本批次的授权、行为、兼容性、验证和风险记录。

### 修改前后行为

- 修改前：关闭翻译仍显示目标语言和外部翻译服务字段；启动 Vosk、SOSV、GLM、Fun-ASR 时仍把翻译模型、URL 和 API Key 传给子进程。
- 修改后：关闭翻译时隐藏目标语言和翻译配置入口，启动参数只使用 `-t none`；开启后显示“配置翻译引擎”，用户打开后才展示外部翻译字段。字段值在折叠或关闭期间保留。
- 修改前：自定义引擎通过 `custom.enabled` 覆盖仍被选中的内置 Provider，只能保存一项，并可能触发背后内置 Provider 的启动校验。
- 修改后：下拉菜单是唯一活动引擎选择源；可创建多个命名自定义条目、确认删除并保留未选择条目的配置。选择自定义条目只校验其可执行路径。
- 删除在草稿中立即反映；删除当前条目时草稿回退到 Gummy。点击“应用更改”才持久化，点击“取消更改”可恢复已应用状态。

### 配置、IPC、协议、命令行与数据结构

- 配置 schemaVersion 从 `2` 升级为 `3`。
- `engine.provider` 与 `engine.custom` 替换为 `engine.activeEngineId` 和 `engine.customEngines[]`；自定义条目包含 `id`、`name`、`executable`、`command`。
- 完整 V2 配置显式迁移：旧自定义开关开启时创建并选中 `Custom Engine`；关闭但已填写路径/命令时创建未选中条目；旧字段不会继续写入 V3。
- Electron 内部配置 IPC 通道名称不变，但传递的数据结构升级为 V3；主进程继续重新校验完整 engine 层。
- Python stdout/TCP 字幕协议没有变化；自定义引擎仍通过原协议通信，端口参数行为不变。
- 内置 Python CLI 参数名称没有变化；翻译关闭时不再传递本就无效的外部翻译服务参数。

### 兼容性、迁移与回滚

- V2→V3 迁移有单元测试；无版本、V1、结构不完整或未来版本仍按既有安全策略拒绝并使用 V3 默认值。
- 自定义字幕引擎进程协议保持兼容；旧单条自定义配置迁移后默认名称为 `Custom Engine`，用户可在后续新建自定义条目时使用其他名称。
- Windows、macOS、Linux 使用相同 JSON 结构与 `spawn(executable, args)` 路径；本批次未执行三平台真实 GUI/进程启动回归，不能声称跨平台运行已实测。
- 精确回滚需要恢复本批次列出的源码、测试和文档，并把配置解析恢复到 V2；已经由应用写出的 V3 `config.json` 无法被旧版直接读取，回滚前应备份并手工转换或使用旧备份。

### 验证记录

- `npm run lint`：通过，无 ESLint 错误。
- `npm run typecheck`：通过，Node TypeScript 与 Vue TypeScript 均无错误。
- `npm test`：通过；Node 39/39、Python 49/49。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，分别转换 22、1、3256 个模块。
- `git diff --check`：通过，无空白错误。
- 验证过程中的真实修正：首次 lint 发现测试未使用变量，已删除；首次完整类型检查发现迁移临时对象推断过窄，已声明为 `Record<string, unknown>`，随后完整验证通过。
- npm/Node 保留既有 mirror 配置弃用警告与无 `type: module` 的性能警告；不影响本次命令成功，未通过无关依赖或包类型调整扩大范围。

### 未执行、风险与后续事项

- 未执行真实 Electron GUI 点击回归：尝试按 Browser 技能连接本地界面，但当前会话未提供该技能要求的浏览器控制工具。下拉菜单弹窗、右侧删除按钮和动态显隐由 Vue 类型检查、构建与纯逻辑测试覆盖，但仍建议在桌面应用中人工确认 Ant Design Select 弹层内删除按钮的点击区域和三语布局。
- 未使用真实麦克风、扬声器、字幕引擎可执行文件或付费 API；不会产生费用，也不会修改远端资源。
- 未执行 Windows/Linux/macOS 安装包构建或真实自定义进程启动。
- 自定义命令仍沿用既有空格切分语义；包含引号或参数内部空格的复杂命令不是本次授权范围，后续应独立设计跨平台参数解析。
- 配置中凭据仍沿用既有明文存储行为；本次只确保关闭翻译时不再把翻译凭据传给子进程，没有扩大凭据暴露面。

### 参考与决策依据

- 用户确认的交互：以“启用翻译”决定业务行为，以“配置翻译引擎”控制外部翻译字段展开；自定义引擎作为可命名、可删除的下拉条目。
- 项目现有 Provider capability registry、V2 配置解析、Electron `spawn` 启动路径和 Ant Design Vue 表单组件。
- 根目录 `AGENTS.md`：配置变化必须显式迁移、三语同步、主进程校验、凭据不泄漏、测试与 `change.md` 完整记录要求。

## 2026-08-12 - 修复声明式引擎设置卡片初始化崩溃

### 授权与目标

- 用户授权：明确要求“修复引擎设置卡片崩溃问题”。
- 变更类型：修复、测试。
- 目标：修复 `EngineControl.vue` 初始化、应用更改和取消更改时复制 Vue/Pinia 响应式引擎配置触发 `DataCloneError`，恢复首页字幕引擎、模型选择和模型配置入口。
- 明确非目标：不调整声明式 Provider 目录、字段布局、配置 schema、默认值、IPC、Python 子进程、字幕协议、依赖、版本号或安装包；不顺带修改其他界面。

### 修改文件与原因

- `src/renderer/src/engines/form.ts`
  - `cloneEngineConfig` 在调用 `structuredClone` 前使用 Vue `toRaw` 解除根配置对象的响应式 Proxy。
  - 保留既有深复制和草稿隔离语义，同时使 Pinia store 配置与 `ref` 草稿可以安全通过同一克隆边界。
- `tests/node/engineCatalog.test.mjs`
  - 新增 Vue `reactive` 配置回归测试，直接覆盖此前普通对象测试未触发的 Proxy 场景。
  - 同时断言克隆结果内容完整，且修改克隆不会回写响应式源配置。
- `change.md`
  - 追加本批次授权、行为、兼容性、验证和风险记录。

### 修改前后行为

- 修改前：`EngineControl.vue` 在 setup 中把 Pinia 暴露的响应式 `engineConfig` 传给 `structuredClone`；浏览器拒绝克隆 Proxy 并抛出 `DataCloneError`，Vue 将失败的子组件留为空节点，首页从通用设置直接跳到字幕样式设置。应用和取消路径也存在同一异常风险。
- 修改后：统一克隆工具先取得 Vue 原始对象再执行结构化深复制；引擎设置卡片能够完成初始化，既有 Provider/模型字段可以渲染，应用与取消继续使用彼此隔离的完整 V2 草稿。
- Gummy、Vosk、SOSV、GLM、Fun-ASR 的字段定义、可见性、模型选项、更多设置和热词管理行为没有变化。

### 配置、接口、兼容性与回滚

- 配置 `schemaVersion`、V2 数据结构、默认值和持久化格式均无变化，不需要迁移，也不会删除或覆盖 Provider 专属配置。
- Electron IPC、Python CLI、子进程生命周期、stdout/TCP 协议、数据结构和命令行均无变化。
- 没有新增或升级依赖；复用项目已有 Vue `toRaw` API。
- 用户可见文本没有变化，因此不需要增加中英日 i18n 键或修改用户手册；本次恢复的是文档已经描述的既有入口。
- 跨平台逻辑只依赖 Vue 响应式 API 和浏览器结构化克隆；自动化验证在 macOS arm64 执行，Windows 和 Linux GUI 未实测。
- 精确回滚：恢复 `form.ts` 中直接 `structuredClone(config)` 的旧实现，删除 `engineCatalog.test.mjs` 的响应式克隆测试，并追加更正记录；回滚会重新引入卡片初始化崩溃。

### 验证记录

- `npm run test:node && npm run typecheck && npm run lint`：通过；Node 38/38，通过新增的响应式 Proxy 克隆测试，Node/Web/Vue TypeScript 与 ESLint 均通过。
- `npm run verify`：通过；类型检查、ESLint、Node 38/38 和 Python 49/49 全部通过。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 22、1、3253 个模块，新的 renderer bundle 正常生成。
- 验证继续输出仓库既有 npm Electron mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；没有为消除提示扩大修改范围。

### 未执行、风险与后续事项

- 未启动真实 Electron GUI 进行卡片视觉、Provider 切换、应用/取消点击和重启持久化手工回归；自动化测试验证了导致崩溃的响应式克隆边界，生产构建验证了组件可编译，但不能替代 GUI 验收。
- 未重新生成 PyInstaller 引擎、DMG、ZIP、Windows 或 Linux 安装包；本次没有修改 Python 和打包配置，现有安装包仍包含修复前的 renderer bundle，发布时需要重新打包。
- `toRaw` 只解除传入对象自身的 Proxy。当前 V2 配置由普通 JSON 数据经单一 Vue 响应式根对象包装，符合该前提；如果未来向配置树直接嵌入独立 reactive 子对象，应扩展克隆边界测试，而不能假设任意嵌套 Proxy 可被 `structuredClone` 接受。

### 关键技术决策来源

- Vue 3 `toRaw` 的既有项目依赖 API：用于在只读克隆边界取得 Proxy 的原始对象，不改变 store 的响应式状态。
- 浏览器/Node `structuredClone` 的实际行为：可深复制 V2 的 JSON 兼容数据，但拒绝 Vue Proxy；新增测试以运行时行为固定该约束。
- 根目录 `AGENTS.md` 的最小范围、配置兼容、测试、真实结果和 `change.md` 记录要求。

## 2026-08-12 - V2.1.0 小版本号更新与 macOS arm64 构建

### 授权与目标

- 用户授权：要求“编译一下Mac版本 并更新小版本号”。
- 本批次将“小版本号”按语义化版本从 `2.0.0` 提升为 `2.1.0`，同步应用元数据、可见版本标识和发布文档，并重新生成 macOS Apple Silicon arm64 安装产物。
- 本批次构建包含当前工作区已有的“引擎设置卡片初始化崩溃”修复；该修复代码和测试已由上一条记录说明，本批次不再修改其实现。
- 明确非目标：不修改系统 Python、Node、shell 环境或全局依赖；不升级依赖；不改配置 schema、IPC、字幕进程协议、Provider 行为或远端资源。

### 变更类型

- 配置：更新 npm 应用版本号和锁文件根版本。
- 文档：同步 README、CHANGELOG 与中英日用户/引擎文档版本标识。
- 构建：重新生成 Python 引擎与 macOS arm64 桌面包。

### 修改文件与原因

- `package.json`
  - 将应用版本从 `2.0.0` 更新为 `2.1.0`，供 Electron builder、Info.plist 和产物命名使用。
- `package-lock.json`
  - 同步根包版本从 `2.0.0` 到 `2.1.0`；没有新增、删除或升级依赖。
- `src/renderer/index.html`
  - 将窗口标题版本从 `v2.0.0` 更新为 `v2.1.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 将关于窗口显示版本从 `v2.0.0` 更新为 `v2.1.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 将 release badge、首页发布提示和平台说明更新为 `v2.1.0`，并说明本小版本包含引擎设置卡片初始化修复与 macOS arm64 构建。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 将对应版本更新为 `v2.1.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 将对应版本更新为 `v2.1.0`。
- `docs/CHANGELOG.md`
  - 追加 `v2.1.0` 修复与构建记录。
- `change.md`
  - 追加本批次授权、变更范围、验证、风险与回滚记录。

### 构建产物

- `engine/dist/main`
  - 使用 `engine/.venv` 内 PyInstaller 重新生成的 macOS arm64 Python 引擎。
- `dist/mac-arm64/Auto Caption.app`
  - Electron builder 生成的 macOS arm64 应用目录，Info.plist 中 `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 `2.1.0`。
- `dist/Auto Caption-2.1.0-arm64-mac.zip`
  - 对本地 ad-hoc 签名后的 `.app` 重新封装生成。
- `dist/Auto Caption-2.1.0-arm64-mac.zip.blockmap`
  - 使用 app-builder 对重封后的 zip 重新生成。
- `dist/auto-caption-2.1.0.dmg`
  - 使用本机 `hdiutil create` 从签名后的 `.app` 生成。
- `dist/latest-mac.yml`
  - 更新为 `2.1.0` zip 的路径、大小、sha512 和 releaseDate；这是生成目录中的更新元数据。

### 修改前后行为

- 修改前：应用版本源、标题、关于窗口、README、手册和上次 Mac 构建产物为 `2.0.0` / `v2.0.0`。
- 修改后：应用元数据、运行界面可见版本、README、手册、CHANGELOG 与本次 macOS 构建产物统一为 `2.1.0` / `v2.1.0`。
- 配置、IPC、Python stdout/TCP 协议、命令行参数和数据结构没有变化。
- 没有新增依赖，没有安装全局包，没有修改系统环境变量或 shell 配置。

### 兼容性、迁移与回滚

- 配置 schemaVersion 仍为 `2`；本批次只更新应用发布版本，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 x64 或 universal 包。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.1.0` 构建产物；如需恢复旧包，使用此前的 `2.0.0` 产物或重新按旧版本号构建。

### 验证记录

- `npm version minor --no-git-tag-version`：通过；版本提升到 `v2.1.0`，同时输出既有 npm mirror 配置弃用警告。
- `npm run verify`：通过；Node/Web/Vue TypeScript、ESLint、Node 38/38 和 Python 49/49 全部通过。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 22、1、3253 个模块。
- `PYINSTALLER_CONFIG_DIR=... engine/.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：沙盒内首次因 PyInstaller sync semaphore 权限失败；经用户批准在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：`.app` 和 zip 构建完成；DMG 阶段因 `hdiutil create` 失败退出码 1。该失败未忽略，随后用本机 `hdiutil create` 单独生成最终 DMG。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重封签名后的 zip。
- `node_modules/app-builder-bin/mac/app-builder_arm64 blockmap --input ... --output ...`：通过，生成 `2.1.0` zip blockmap。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.1.0.dmg`：通过；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.1.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.1.0-arm64-mac.zip`：通过，无压缩数据错误。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `shasum -a 256 dist/auto-caption-2.1.0.dmg dist/Auto Caption-2.1.0-arm64-mac.zip`：
  - DMG：`b2b49b1549c696262189cd4f0582469f6623296285cfdf50b7c7fba6c6adb6e3`
  - ZIP：`5219bd628dfb9c1f4e26b2e4b79d52dad303b023e309323a638f2f10004d251a`

### 未执行、风险与后续事项

- 未启动真实 Electron GUI 做窗口交互、麦克风/系统音频授权或真实识别流程；本批次验证到构建、测试、签名和安装包完整性。
- 未做 Windows、Linux、macOS x64 或 universal 构建；不能声称这些平台的 V2.1.0 安装包已由本批次验证。
- 未使用真实 API Key、Workspace 或云服务，不产生费用，也不修改远端热词资源。
- Electron builder 仍提示缺少 Developer ID signing identity；发布到普通用户机器前建议使用正式证书签名并 notarize。
- 当前工作区还包含本批次之前已有的 `src/renderer/src/engines/form.ts` 与 `tests/node/engineCatalog.test.mjs` 修复改动；本批次构建将这些未提交改动打入 `2.1.0` 产物。

### 参考与决策依据

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，DMG artifact 使用 `${name}-${version}.${ext}`。
- 根目录 `AGENTS.md`：遵循修改前检查、三语文档同步、构建产物记录、验证记录、系统环境与依赖边界、`change.md` 追加记录要求。

## 2026-08-12 - 修复 macOS/Linux 打包版字幕引擎启动报错

### 授权与目标

- 用户授权：在确认 Fun-ASR 启动时出现 `spawn ENOTDIR` 后，明确要求“修复启动报错问题”。
- 变更类型：修复、测试。
- 目标：让 macOS/Linux 正式打包版从 Electron Builder 实际复制的位置启动单文件 Python 字幕引擎，并在子进程无法启动时将错误交给应用处理，避免 Electron 主进程未捕获异常弹窗。
- 明确非目标：不修改 Fun-ASR API Key、Workspace、WebSocket、模型或热词逻辑；不修改 Python Provider、配置 schema、IPC、stdout/TCP 协议、依赖、版本号或远端资源；不生成或覆盖安装包。

### 修改文件与原因

- `src/main/engine/PackagedEnginePath.ts`
  - 新增不依赖 Electron 运行时的打包引擎路径解析函数，使关键的跨平台文件布局可以直接单元测试。
  - Windows 解析为 `Resources/engine/main.exe`；macOS/Linux 解析为 `Resources/engine/main`，与 `electron-builder.yml` 的 `extraResources` 目标一致。
- `src/main/engine/EngineExecutable.ts`
  - 正式环境改用统一路径解析函数，删除 macOS/Linux 错误的额外 `/main` 路径层级。
  - 开发环境仍使用仓库内 `.venv` Python 和 `engine/main.py`，行为不变。
- `src/main/utils/CaptionEngine.ts`
  - 为 `spawn` 返回的子进程注册一次性 `error` 监听器。
  - 启动路径不存在、路径类型错误、无执行权限等操作系统启动错误现在写入日志并通过既有三语 `engine.start.error` 消息通知控制窗口，不再成为未捕获的 Electron 主进程异常。
- `tests/node/packagedEnginePath.test.mjs`
  - 新增 Windows、macOS、Linux 正式包路径回归测试，固定单文件 PyInstaller 产物与 Electron Builder 复制布局的契约。
- `change.md`
  - 追加本批次授权、修改范围、兼容性、验证结果、风险和回滚说明。

### 修改前后行为

- 修改前：PyInstaller `onefile=True` 生成单个 `engine/dist/main`，Electron Builder 将其复制为 `Resources/engine/main`；macOS/Linux 正式版却尝试执行 `Resources/engine/main/main`。由于第一个 `main` 实际是文件而不是目录，Node 返回 `ENOTDIR`，且没有子进程 `error` 监听器，最终弹出 JavaScript 主进程未捕获异常。
- 修改后：macOS/Linux 正式版直接执行 `Resources/engine/main`，与实际包布局一致；Windows 仍执行 `Resources/engine/main.exe`。如果以后仍发生启动级操作系统错误，应用会显示可诊断错误并保持主进程存活。
- 修复发生在 Python/Fun-ASR 进程启动之前，不改变云端鉴权、请求、字幕 partial/final、翻译或热词行为。

### 配置、接口、兼容性与回滚

- 配置 `schemaVersion`、持久化字段、默认值和迁移均无变化。
- Electron IPC、Python CLI 参数、子进程 NDJSON/stdout 与本地 TCP 协议、数据结构均无变化。
- 没有新增或升级依赖；没有新增用户可见文本，复用已存在的中英日 `engine.start.error` 翻译，因此无需新增 i18n 键。
- Windows 的生产路径和所有平台的开发路径保持不变。Linux 采用与其 Electron Builder 单文件复制规则一致的修复，但本批次只在 macOS arm64 开发机执行自动化验证。
- 精确回滚：恢复 `EngineExecutable.ts` 的旧生产路径，删除 `PackagedEnginePath.ts` 和对应测试，并移除 `CaptionEngine.ts` 的 `error` 监听器；该回滚会重新引入 macOS/Linux `ENOTDIR` 和启动失败导致主进程异常的问题。

### 验证记录

- `npm run test:node`：通过，Node 40/40；新增测试确认 darwin/linux 为 `/app/resources/engine/main`，win32 为 `/app/resources/engine/main.exe`。
- `npm run typecheck`：通过，Node TypeScript 与 Vue TypeScript 均无错误。
- `npm run lint`：通过，无 ESLint 错误。
- `npm run test:python`：通过，Python 49/49，包括 Fun-ASR Provider、CLI、热词和协议既有测试。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 23、1、3256 个模块。
- `rg` 检查生产构建并用 `test` 核对已安装应用：通过；`out/main/index.js` 使用 `engine/main` 且包含进程 `error` 处理，已安装的 `Resources/engine/main` 可执行，旧的嵌套 `engine/main/main` 不存在。
- 上述 npm/Node 命令保留仓库既有 mirror 配置弃用警告和 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；不影响命令成功，本次没有通过依赖或包类型调整扩大范围。

### 未执行、风险与后续事项

- 未重新运行 PyInstaller、Electron Builder macOS 打包、DMG/ZIP 生成或安装覆盖；已安装的旧版 `.app` 不会因源码修改自动更新，必须在后续发布构建中包含本修复。
- 未启动真实 Electron GUI，也未执行麦克风/系统音频授权和真实 Fun-ASR 云端识别；本批次验证了错误根因对应的路径契约、静态类型、完整现有测试和生产代码构建，但不能声称安装包端到端启动已实测。
- 未在 Windows 和 Linux 实机执行字幕进程启动；Windows 路径未改变，Linux 修复由跨平台纯逻辑测试覆盖。
- 子进程启动错误消息可能包含本地可执行文件路径，这是诊断所需信息；不会包含命令参数或 API Key，日志仍不输出未脱敏凭据。

### 关键技术决策来源

- 本地 `engine/main.spec`：`onefile=True`，确认 macOS 构建产物是单个可执行文件而非 `main/main` 目录结构。
- 本地 `electron-builder.yml`：macOS/Linux 将 `engine/dist/main` 复制到 `Resources/engine/main`。
- 已安装应用只读核对：`/Applications/Auto Caption.app/Contents/Resources/engine/main` 是 Mach-O arm64 文件，且不存在下一级 `main`。
- Node `child_process.spawn` 的项目既有启动边界和已存在的三语 `engine.start.error` 文案。
- 根目录 `AGENTS.md`：遵循最小修改、跨平台兼容、凭据保护、真实验证与 `change.md` 完整记录要求。

## 2026-08-12 - V2.3.0 小版本号更新与 macOS arm64 构建

### 授权与目标

- 用户授权：要求“编译一下Mac版本 并更新小版本号”。
- 本批次将“小版本号”按语义化版本从 `2.2.0` 提升为 `2.3.0`，同步应用元数据、可见版本标识和发布文档，并重新生成 macOS Apple Silicon arm64 安装产物。
- 本批次构建包含上一条记录中的 macOS/Linux 打包版字幕引擎路径修复，目标是让 macOS 正式包内的 Electron 主进程执行 `Resources/engine/main`。
- 明确非目标：不修改系统 Python、Node、shell 环境或全局依赖；不升级依赖；不改配置 schema、IPC、字幕进程协议、Provider 行为或远端资源。

### 变更类型

- 配置：更新 npm 应用版本号和锁文件根版本。
- 文档：同步 README、CHANGELOG 与中英日用户/引擎文档版本标识。
- 构建：重新生成 Python 引擎与 macOS arm64 桌面包。

### 修改文件与原因

- `package.json`
  - 将应用版本从 `2.2.0` 更新为 `2.3.0`，供 Electron builder、Info.plist 和产物命名使用。
- `package-lock.json`
  - 同步根包版本从 `2.2.0` 到 `2.3.0`；没有新增、删除或升级依赖。
- `src/renderer/index.html`
  - 将窗口标题版本从 `v2.2.0` 更新为 `v2.3.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 将关于窗口显示版本从 `v2.2.0` 更新为 `v2.3.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 将 release badge、首页发布提示和平台说明更新为 `v2.3.0`，并说明本小版本包含打包路径修复与 macOS arm64 构建。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 将对应版本更新为 `v2.3.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 将对应版本更新为 `v2.3.0`。
- `docs/CHANGELOG.md`
  - 追加 `v2.3.0` 修复与构建记录。
- `change.md`
  - 追加本批次授权、变更范围、验证、风险与回滚记录。

### 构建产物

- `engine/dist/main`
  - 使用 `engine/.venv` 内 PyInstaller 重新生成的 macOS arm64 Python 引擎。
- `dist/mac-arm64/Auto Caption.app`
  - Electron builder 生成的 macOS arm64 应用目录，Info.plist 中 `CFBundleShortVersionString` 和 `CFBundleVersion` 均为 `2.3.0`。
  - 已确认内嵌引擎位于 `Contents/Resources/engine/main`，且为可执行 Mach-O arm64 文件。
- `dist/Auto Caption-2.3.0-arm64-mac.zip`
  - 对本地 ad-hoc 签名后的 `.app` 重新封装生成。
- `dist/Auto Caption-2.3.0-arm64-mac.zip.blockmap`
  - 使用 app-builder 对重封后的 zip 重新生成。
- `dist/auto-caption-2.3.0.dmg`
  - 使用本机 `hdiutil create` 从签名后的 `.app` 生成。
- `dist/latest-mac.yml`
  - 更新为 `2.3.0` zip 的路径、大小、sha512 和 releaseDate；这是生成目录中的更新元数据。

### 修改前后行为

- 修改前：应用版本源、标题、关于窗口、README、手册和上次 Mac 构建产物为 `2.2.0` / `v2.2.0`。
- 修改后：应用元数据、运行界面可见版本、README、手册、CHANGELOG 与本次 macOS 构建产物统一为 `2.3.0` / `v2.3.0`。
- 本批次没有新增配置字段、IPC 字段、Python stdout/TCP 协议字段或命令行参数。
- 没有新增依赖，没有安装全局包，没有修改系统环境变量或 shell 配置。

### 兼容性、迁移与回滚

- 本批次只更新应用发布版本，不涉及用户配置迁移；当前仓库自动化测试覆盖的是既有 V3 配置行为。
- macOS 产物为 arm64；未生成 x64 或 universal 包。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.3.0` 构建产物；如需恢复旧包，使用此前的 `2.2.0` 产物或重新按旧版本号构建。

### 验证记录

- `npm version minor --no-git-tag-version`：通过；版本提升到 `v2.3.0`，同时输出既有 npm mirror 配置弃用警告。
- `npm run verify`：通过；Node/Web/Vue TypeScript、ESLint、Node 40/40 和 Python 49/49 全部通过。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 23、1、3256 个模块。
- `PYINSTALLER_CONFIG_DIR=... engine/.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：沙盒内首次因 PyInstaller sync semaphore 权限失败；经用户批准在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：`.app` 和 zip 构建完成；DMG 阶段因 `hdiutil create` 失败退出码 1。该失败未忽略，随后用本机 `hdiutil create` 单独生成最终 DMG。
- `test -x dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：通过；验证路径修复对应的 macOS 包内引擎文件存在且可执行。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重封签名后的 zip。
- `node_modules/app-builder-bin/mac/app-builder_arm64 blockmap --input ... --output ...`：通过，生成 `2.3.0` zip blockmap。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.3.0.dmg`：通过；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.3.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.3.0-arm64-mac.zip`：通过，无压缩数据错误。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `shasum -a 256 dist/auto-caption-2.3.0.dmg dist/Auto Caption-2.3.0-arm64-mac.zip`：
  - DMG：`09c3d183f5042f37d6a70515ef3e36005183e6a072dd48b45d22f5af87972348`
  - ZIP：`5643706d398b4c55f8cf8a9a0a9027cb5375b9c00e685cd701522bf96656a939`

### 未执行、风险与后续事项

- 未启动真实 Electron GUI 做窗口交互、麦克风/系统音频授权或真实识别流程；本批次验证到构建、测试、签名和安装包完整性，并静态确认 macOS 包内引擎路径。
- 未做 Windows、Linux、macOS x64 或 universal 构建；不能声称这些平台的 V2.3.0 安装包已由本批次验证。
- 未使用真实 API Key、Workspace 或云服务，不产生费用，也不修改远端热词资源。
- Electron builder 仍提示缺少 Developer ID signing identity；发布到普通用户机器前建议使用正式证书签名并 notarize。

### 参考与决策依据

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，macOS/Linux 引擎资源复制目标是 `Resources/engine/main`。
- 根目录 `AGENTS.md`：遵循修改前检查、三语文档同步、构建产物记录、验证记录、系统环境与依赖边界、`change.md` 追加记录要求。

## 2026-08-13 - 控制窗口响应式布局与字幕预览停靠修复

### 授权与目标

- 用户先要求技术评估，随后明确授权“完整修复这个问题”，允许在有成熟实现时添加依赖，并最终确认按“控制窗口响应式布局完整修复”计划实施；实现完成阶段又明确要求将“打开字幕窗口”所在按钮行放在日志区域上方。
- 变更类型：修复、重构、配置、测试、文档。
- 目标：消除控制窗口缩窄时设置表单、状态项、操作按钮、日志工具栏、表格和字幕预览之间的堆叠、挤压与页面级横向溢出；在不复制设置草稿状态的前提下提供可靠的窄屏设置浮层；将字幕预览停靠在右侧底部并限制高度；把引擎控制按钮作为日志区域正上方的独立布局行。
- 明确非目标：不修改配置 schema、`leftBarWidth` 持久化语义、Electron IPC、Python CLI、NDJSON/TCP 协议、字幕数据结构、识别/翻译/热词逻辑；不升级 Ant Design Vue、Vue、Electron 或其他既有依赖；不构建安装包、不调用真实云服务、不改远端资源。

### 修改文件与原因

- `package.json`、`package-lock.json`
  - 新增唯一直接依赖 `@vueuse/core@^14.4.0`，并同步锁定其传递包；用于设置浮层的点击外部、Esc、焦点范围和监听器生命周期管理。
  - npm 重新解析锁文件时同步了部分既有 peer 标记；没有主动升级其他直接依赖。
- `src/main/ControlWindow.ts`
  - 控制窗口最小尺寸由 `750×500` 提高为 `900×600`；初始 `1200×800` 保持不变。
- `src/renderer/src/views/ControlPage.vue`
  - 使用既有 Ant Design Vue `Layout.Sider`，设置 `breakpoint="xl"` 与 `collapsed-width="56"`；宽屏继续按保存的 `leftBarWidth` 百分比显示常驻设置栏，窄屏使用同一设置面板 DOM 作为 360px 浮层。
  - 使用 VueUse `onClickOutside`、`onKeyStroke`、`useFocusWithin` 实现点击锁定、再次点击关闭、点击外部关闭、Esc 关闭、键盘焦点临时展开和监听器自动清理；跨回宽屏清除锁定，窄屏不写入 `leftBarWidth`。
  - 新增带 Tooltip、`aria-expanded`、`aria-pressed` 的设置按钮，并保留悬停/指针进入临时展开；关闭时释放栏内焦点，避免 Esc 后因焦点残留立即重开。
  - 右侧改为明确的四段纵向布局：状态指标、引擎控制按钮、弹性可滚动日志、底部字幕预览；日志占用剩余空间，预览关闭后不产生额外轨道或间距。
  - 补齐 `min-width: 0`、`min-height: 0`、滚动边界、容器查询和页面级溢出控制。
- `src/renderer/src/components/CaptionStyle.vue`
  - 使用 Vue 3.5 延迟 Teleport 将原预览 DOM 投放到右侧专用宿主，删除旧的绝对定位和 `left/bottom/60%` 偏移；字体、颜色、透明度、阴影、翻译和多行草稿状态不变。
  - 设置开关区域允许换行，避免窄设置面板中标签与开关互相挤压。
- `src/renderer/src/components/EngineStatus.vue`
  - 状态区改为 `auto-fit/minmax` 网格；引擎控制按钮改为 `flex-wrap + gap`，取消固定按钮外边距。
  - 控制按钮行去掉自身大块上下 margin，由控制页纵向布局作为独立一行放在日志区正上方。
- `src/renderer/src/components/CaptionLog.vue`、`src/renderer/src/components/SoftwareLog.vue`
  - 标题操作区和工具栏改为可换行 flex/gap；移除依赖固定 margin 的按钮布局。
  - Ant Design 表格启用组件内横向滚动，字幕表最小滚动宽度 560px、软件日志表 640px，避免撑宽整个页面。
- `src/renderer/src/assets/input.css`、`src/renderer/src/assets/main.css`
  - 通用表单行允许换行，标签、输入区和值显示具有明确收缩/换行边界；单选组允许换行。
  - `html/body/#app` 补齐高度和 `box-sizing`，body 禁止成为额外滚动容器。
- `src/renderer/src/components/GeneralSetting.vue`、`src/renderer/src/components/engine/EngineFieldRenderer.vue`、`src/renderer/src/components/engine/HotwordManager.vue`
  - 为文本输入、目录选择、热词目标和操作工具栏补齐 flex 收缩、换行、宽度上限与 `min-width: 0`，消除 360px 设置面板内的截断和横向撑开。
- `src/renderer/src/i18n/lang/zh.ts`、`src/renderer/src/i18n/lang/en.ts`、`src/renderer/src/i18n/lang/ja.ts`
  - 同步新增“设置 / Settings / 設定”键，供折叠栏按钮、Tooltip 和无障碍名称使用。
- `tests/node/i18nParity.test.mjs`、`docs/testing.md`
  - 新增递归比较中英日完整 i18n 对象键结构的 Node 测试，并记录覆盖范围；以后任一语言漏键都会失败。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步说明 900×600 最小窗口、1200px 响应式设置栏、悬停/焦点/点击/Esc 交互、草稿保持和底部 35% 预览边界。
- `change.md`
  - 追加本批次授权、依赖决策、修改范围、兼容性、真实验证、风险与回滚记录。

### 修改前后行为

- 修改前：控制页由固定横向 flex 和多个固定 margin/宽度组成；窗口缩窄时左栏持续占用百分比宽度，状态、按钮和工具栏无法系统换行，表格会撑宽页面；字幕预览绝对定位并可能覆盖记录区；控制窗口仍可缩至 750×500。
- 修改后：1200px 及以上设置栏常驻；低于 1200px 时 Sider 折叠为 56px，设置表单以同一份 360px 浮层 DOM 展开，未应用草稿不会因组件重建丢失。设置浮层支持指针进入、键盘焦点、点击锁定、再次点击、点击外部和 Esc。
- 右侧状态、按钮、日志和预览按独立纵向段排列；“打开字幕窗口 / 启动字幕引擎 / 关闭字幕引擎”按钮行固定在日志区上方并可换行。日志区弹性占用剩余空间并自行滚动；表格只在组件内部横向滚动。
- 字幕预览停靠右侧底部，关闭时宿主不占空间，开启时最大高度为内容窗口 35%，超出部分只在预览宿主内部滚动，不覆盖日志区。
- 窗口不能缩到 900×600 以下；初始尺寸仍为 1200×800。

### 依赖、配置、接口、兼容性与回滚

- 新增 `@vueuse/core@^14.4.0` 的必要性：它集中提供跨组件验证过的点击外部、键盘、焦点与生命周期清理组合式工具，避免项目自行维护易泄漏或边界不完整的全局 DOM 监听；包支持 tree-shaking，MIT 许可证，Vue peer 要求 `^3.5.0`，与项目 Vue 3.5.13 匹配。
- 继续使用既有 Ant Design Vue `Layout.Sider` 和 `xl` 断点，不引入新的布局/抽屉组件库。未采用 Drawer，因为设置表单包含未应用的本地草稿；常驻栏与 Drawer 切换容易重建组件或要求复制状态，而 Sider 加同一份浮层 DOM 可直接保持草稿。
- `schemaVersion`、`leftBarWidth` 字段与 6–12 合法范围均不变，不需要配置迁移；窄屏开合不持久化覆盖用户的左栏宽度。
- Electron IPC、Python CLI、子进程协议、字幕/日志数据结构和远端服务行为均无变化；没有新增密钥字段或日志输出。
- CSS、Vue 和 Electron 主进程窗口约束是跨 Windows/macOS/Linux 的公共实现；自动化与生产渲染回归在 macOS arm64 开发机完成，未声称其他平台实机 GUI 已验证。
- 精确回滚：恢复本条“修改文件与原因”列出的文件，移除 `@vueuse/core` 并重新生成锁文件；将窗口最小值恢复为 `750×500`、控制页恢复旧 flex、字幕预览恢复旧绝对定位。回滚会重新引入窄窗口堆叠和覆盖问题，用户配置无需迁移或回退。

### 验证记录

- `npm install @vueuse/core@^14.4.0`：在网络访问获批后成功；新增 4 个包。npm audit 同时报告现有依赖树 33 个问题（2 low、2 moderate、28 high、1 critical），本批次未运行可能引入破坏性升级的 `npm audit fix`。
- `npm run verify`：最终代码通过；TypeScript（Node/Web/Vue）、ESLint、Node 41/41 和 Python 49/49 全部成功。新增 i18n 测试递归确认中英日键结构一致。
- `npm run build`：最终代码通过；Electron main、preload、renderer 生产构建分别转换 23、1、3258 个模块。
- `git diff --check`：通过，无空白错误。
- 生产 renderer 浏览器回归：在 1400×800、1200×800、1199×600、900×600 视口检查；1200px 保持常驻设置栏，1199px 在 Ant Sider 过渡完成后折叠为 56px，900px 同样折叠，四种尺寸均无 body 横向或纵向溢出。
- 浮层交互回归：设置按钮锁定后面板为 360px；Esc 将 `aria-expanded/aria-pressed` 置为 false 并把焦点释放到 body；点击日志内容区关闭；跨到 1200px 后清除锁定；键盘焦点可临时保持展开。
- 草稿保持回归：将未应用字体草稿改为 `ResponsiveDraft`，Esc 关闭并重新打开后值仍存在；测试结束前恢复为 `sans-serif`，未点击应用且未写入持久配置。
- 预览压力回归：在 900×600 下将原字幕字号调到 72px并开启翻译预览；宿主高度限制为 210px（600px 的 35%），内容 `scrollHeight` 为 327px、`overflow-y: auto`，日志底部 354px、预览顶部 370px，无重叠且 body 无溢出。
- 本地 Electron 开发进程成功启动并加载变更；macOS ScreenCaptureKit 在自动截图时返回系统捕获错误，因此最终尺寸与交互断言改用同一生产 renderer 的受控浏览器视口完成。测试用本地服务器和开发进程均已停止，临时测试文件位于 `/private/tmp`，没有进入仓库。
- 验证过程保留仓库既有 npm mirror 配置弃用警告和 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；这些警告未导致命令失败，本批次未扩大范围修改 npm 配置或包模块类型。

### 未执行、风险与后续事项

- 未在 Windows/Linux 实机运行控制窗口，也未执行 Electron Builder 打包；跨平台公共代码已通过类型检查和生产构建，但平台窗口管理器的视觉差异仍需发布前实机回归。
- macOS 自动化无法通过 ScreenCaptureKit直接截取 Electron 原生窗口；受控生产 renderer 已覆盖目标尺寸和交互，但不能等同于安装包级 GUI 自动化。
- 未测试真实麦克风、系统音频、识别引擎或付费 API；本次不触及这些路径。
- npm audit 报告的 33 个依赖问题是独立的依赖治理事项；为避免无授权的大范围升级，本批次只记录，不自动修复。

### 关键技术决策来源

- VueUse `packages/core/package.json`：`@vueuse/core` 14.4.0、Vue peer `^3.5.0` 与 tree-shaking 包结构，`https://raw.githubusercontent.com/vueuse/vueuse/main/packages/core/package.json`。
- VueUse MIT 许可证：`https://raw.githubusercontent.com/vueuse/vueuse/main/LICENSE`。
- Ant Design Vue 官方仓库与现有项目依赖：继续使用 Vue 3/Electron 可用的 `Layout.Sider` 和内置 `xl` 断点，`https://github.com/vueComponent/ant-design-vue`。
- Vue 3.5 延迟 Teleport：项目已使用 Vue 3.5，采用 `defer` 让目标宿主在同一挂载阶段稍后出现，同时保持预览组件状态与 DOM 行为。
- 根目录 `AGENTS.md`：遵循最小依赖、三语同步、配置/协议兼容、真实验证和 `change.md` 追加记录要求。

## 2026-08-13 - V2.4.0 小版本、依赖更新与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”，并补充“如果依赖有更新记得检查并使用新依赖”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.3.0` 提升到 `2.4.0`，检查并应用当前约束允许的新依赖，生成 macOS arm64 构建产物。
- 明确非目标：不做破坏性 git 操作，不创建提交、分支、PR 或 Release；不修改系统 Python、全局 npm、shell 配置或系统环境变量；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有未提交变更；本批次只在当前工作区基础上增量处理版本、依赖、文档版本标识和构建产物，未回退或覆盖既有未提交改动。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.4.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.4.0`。
  - 执行 `npm update` 后，锁文件采用当前 semver 约束允许的新解析版本；直接依赖/开发依赖解析版本包括 `electron@35.7.5`、`@types/node@22.20.1`、`eslint@9.39.5`、`eslint-plugin-vue@10.10.0`、`pinia@3.0.4`、`prettier@3.9.6`、`typescript@5.9.3`、`vite@6.4.3`、`vue@3.5.41`、`vue-eslint-parser@10.4.1`、`vue-i18n@11.4.8`、`vue-router@4.6.4`、`vue-tsc@2.2.12` 等。
  - 未采用需要修改依赖范围或大版本迁移的 latest 版本，例如 `electron@43`、`vite@8`、`electron-vite@5`、`electron-builder@26`、`vue-tsc@3` 等。
- `engine/requirements.txt`
  - 将 `dashscope==1.26.6` 更新为 `dashscope==1.26.7`，显式锁定当前可用补丁版本。
  - Python 虚拟环境 `engine/.venv` 中按 requirements 升级了解析依赖；实际可见更新包括 `pyinstaller@6.22.0`、`sherpa_onnx@1.13.5`、`sherpa-onnx-core@1.13.5`、`openai@3.0.0`，并新增/更新其传递依赖 `httpx2@2.10.0`、`httpcore2@2.10.0`、`truststore@0.10.4`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布说明和 macOS 产物说明到 `v2.4.0`，说明本次包含依赖更新与 macOS arm64 构建。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.4.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.4.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.4.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.4.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.4.0` 条目，记录依赖更新、版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.4.0` 路径、大小、sha512 与 releaseDate，供 macOS 更新元数据使用。
- `change.md`
  - 追加本批次授权、文件清单、依赖决策、行为变化、验证、风险与回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.4.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 blockmap。
  - `dist/auto-caption-2.4.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 及构建期生成的 blockmap。

### 修改前后行为

- 修改前：应用、README、手册、关于窗口、浏览器标题和 macOS 构建元数据仍指向 `2.3.0`；本地依赖解析停留在旧锁文件和旧 Python 虚拟环境状态。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.4.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；npm 依赖只更新项目 `node_modules` 与 `package-lock.json`，Python 依赖只更新项目内 `engine/.venv` 与 `engine/requirements.txt`。

### 依赖决策、兼容性与回滚

- npm 依赖策略：先执行 `npm outdated --long` 检查，再使用 `npm update` 采用当前 `package.json` semver 范围内的新版本；未自动扩大到需要迁移的大版本，以免把 Mac 编译请求扩大为 Electron/Vite/ESLint 大版本迁移。
- Python 依赖策略：先执行 `engine/.venv/bin/python3 -m pip list --outdated` 检查，再在项目虚拟环境内执行 `pip install --upgrade -r requirements.txt`；只将已显式锁定的 `dashscope` 从 `1.26.6` 调整到 `1.26.7`，其余未锁定包按解析器在虚拟环境内升级。
- 仍有未采用的更新：
  - npm latest 中存在多个大版本更新，如 `electron@43`、`electron-builder@26`、`electron-vite@5`、`vite@8`、`typescript@7`、`vue-router@5`、`vue-tsc@3` 等，需要单独迁移验证后再采用。
  - Python 仍报告 `numpy`、`numba`、`llvmlite` 等存在更新，但这些包受二进制兼容、Python 版本和上游约束影响；本批次没有强制改约束。
- `openai` 因 requirements 未固定上限，在虚拟环境中解析到 `3.0.0`；自动化测试和 PyInstaller 构建通过，但未使用真实 OpenAI 兼容翻译服务做运行时调用，后续发布前建议补真实或 mock API 回归。
- macOS 产物为 arm64；未验证 Intel x64 或 universal 包。
- 本次 `.app` 使用本地 ad-hoc 签名，没有 Developer ID 证书签名和 notarization；普通用户首次打开仍可能看到 macOS Gatekeeper 安全提示。
- 精确回滚：恢复 `package.json`/`package-lock.json` 到 `2.3.0` 与旧解析版本；恢复 `engine/requirements.txt` 的 `dashscope==1.26.6`；恢复本条列出的 README、文档、标题、关于窗口、CHANGELOG 与 `dist/latest-mac.yml` 版本/元数据；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.4.0` 产物，并按旧版本重建需要的包。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区在本批次开始前已有未提交修改，需要保留并绕开。
- `npm outdated --long`：沙盒内首次因 `registry.npmjs.org` DNS 失败；经用户授权的沙盒外重试成功，确认当前约束内和 latest 中均有更新。
- `engine/.venv/bin/python3 -m pip list --outdated --format=columns`：沙盒外成功，确认 Python 虚拟环境内有可更新包。
- `npm update`：成功；新增 31 个包、移除 32 个包、变更 192 个包；npm audit 报告仍存在 13 个问题（12 high、1 critical），本批次未运行可能破坏兼容性的 `npm audit fix --force`。
- `engine/.venv/bin/python3 -m pip install --upgrade -r requirements.txt`：成功；只更新项目虚拟环境，未安装全局 Python 包。
- `engine/.venv/bin/python3 -m pip check`：通过，输出 `No broken requirements found.`；保留 pip cache 目录不可写警告，未影响依赖一致性。
- `npm ls --depth=0`：通过，确认直接依赖解析版本；保留既有 npm mirror 配置弃用警告。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.4.0`，没有创建 git tag。
- `npm run verify`：通过；TypeScript、ESLint、Node 41/41 和 Python 49/49 全部成功。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，renderer 由 Vite 6.4.3 转换 3259 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config engine/.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：沙盒内首次因 PyInstaller sync semaphore 权限失败；经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内首次因下载 Electron 35.7.5 的 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，生成 `.app`、zip、DMG 和 blockmap。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.4.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.4.0-arm64-mac.zip`。
- `node_modules/app-builder-bin/mac/app-builder_arm64 blockmap --input ... --output ...`：通过，最终 zip blockmap 输出 size `210472878`、sha512 `YMKvMKAH1nzXi26NAaxtvZgLOnK37Tm8MCctB1CVY4QgWzodhZoP2hqduOa96mzLyXgkL48cSaYhyIFcYotmZg==`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.4.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.4.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.4.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.4.0.dmg dist/Auto Caption-2.4.0-arm64-mac.zip`：
  - DMG：`67e8277abd9c73c4ebb30d787a365a05d09462d682968ee1023839d2b0f6cd22`
  - ZIP：`c303781b31162df5fa7c0b1c6a02d956f3d0d70394cea2f6ae165803a8eb9d65`
- `npm run typecheck`：通过；Node 与 Web 类型检查均成功。
- `npm run lint`：通过；ESLint 成功。
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API 或热词远端资源；本批次验证到自动化测试、生产构建、引擎可执行文件 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.4.0` 包已验证。
- npm audit 仍报告 13 个漏洞；其中可能需要 Electron/Electron Builder/Vite 等大版本迁移，建议作为单独依赖治理任务处理。
- `openai@3.0.0` 已进入项目虚拟环境但未做真实服务调用；如果 OpenAI 兼容翻译路径用于发布，建议补充针对该 SDK 版本的 mock 或实机回归。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json` 与 `npm outdated --long`：确定 npm 更新范围，优先采用当前 semver 约束允许的新依赖。
- 本地 `engine/requirements.txt`、`pip list --outdated` 与 `pip check`：确定 Python 虚拟环境更新范围和依赖一致性。
- 本地 `electron-builder.yml`：确认 macOS arm64 打包入口、产物命名和引擎资源复制位置。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循依赖边界、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。

## 2026-08-13 - V2.5.0 小版本与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.4.0` 提升到 `2.5.0`，并生成 macOS arm64 构建产物。
- 明确非目标：本次用户未要求依赖检查或升级，因此不主动执行依赖治理；不创建 git tag、commit、branch、PR 或 Release；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有未提交改动，包括 `electron-builder.yml`、`package.json`、`package-lock.json` 和 `change.md`；本批次保留这些改动，并基于当前工作区中的 `electron@43.4.0`、`electron-builder@26.15.3` 与平台化 `extraResources` 配置进行 macOS 打包。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.5.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.5.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.5.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.5.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.5.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.5.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.5.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.5.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.5.0` 路径、大小、sha512 与 releaseDate。
- `change.md`
  - 追加本批次授权、修改范围、构建上下文、验证、风险和回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.5.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.5.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.4.0` / `v2.4.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.5.0` / `v2.5.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；构建使用项目本地 `node_modules` 与 `engine/.venv`，仅在项目目录生成和更新构建产物。

### 兼容性、迁移与回滚

- 本批次只更新发布版本和重新构建 macOS arm64 包，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 Intel x64 或 universal 包。
- 当前构建基于工作区已有的 Electron 43 / Electron Builder 26 大版本依赖状态；自动化测试与打包通过，但未在真实 GUI 中做 Electron 43 的安装后交互回归。
- Electron Builder 26 不再提供旧的 `node_modules/app-builder-bin/mac/app-builder_arm64` 路径；本批次改用 `app-builder-lib/out/targets/blockmap/blockmap` 的 `buildBlockMap` API 刷新签名后 zip/DMG 的 blockmap。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.4.0`；恢复 `package.json` 和 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.5.0` 构建产物；如需恢复旧包，使用此前 `2.4.0` 产物或按旧版本号重新构建。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区开局已有未提交修改，需要保留。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.5.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `npm run verify`：通过；TypeScript、ESLint、Node 41/41 和 Python 49/49 全部成功；保留既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，renderer 由 Vite 6.4.3 转换 3259 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：首次因工作目录已在 `engine/` 但命令误写为 `engine/.venv/bin/pyinstaller` 导致路径不存在；使用正确的 `./.venv/bin/pyinstaller` 重跑后通过，生成 `engine/dist/main`。保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内因 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，基于 `electron@43.4.0` 与 `electron-builder@26.15.3` 生成 `.app`、zip、DMG 和初始 blockmap。构建日志提示 duplicate dependency references，并提示缺少 Developer ID 签名证书；未导致构建失败。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.5.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.5.0-arm64-mac.zip`。
- `node_modules/app-builder-bin/mac/app-builder_arm64 blockmap ...`：失败，原因是 Electron Builder 26 不再存在该旧路径；随后使用新的内部 blockmap API 生成最终 blockmap。
- `node -e "const { buildBlockMap } = require('./node_modules/app-builder-lib/out/targets/blockmap/blockmap'); ..."`：通过，生成最终 zip 和 DMG blockmap；最终 zip size `224865885`、sha512 `hqnF0Hn3Q+DNOkmoXl57i0GIUocBAKUhIjjyXxXHyAhCSDklIeokYP0+/Kx4/3C4l2xmYlsWdhEdlXtpWZ6V8g==`；最终 DMG size `245134908`、sha512 `JOcArxFyI1i3aLP4e0ZAlWj6cKMUMJme9/Bh7BK0mml/ezP6QqtB0D7xs3PCFZUxgsnFz3FnEU11UidT3cNKbg==`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.5.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `hdiutil verify dist/auto-caption-2.5.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.5.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.5.0.dmg dist/Auto Caption-2.5.0-arm64-mac.zip`：
  - DMG：`2715460ce58f237fe047f3a4a3325f822be519dbb6624298e75d91be87ae2f51`
  - ZIP：`fe6a25c20ddcedb05708d65db58b22acc385b8f10a12b08ef185515311f72c30`
- `rg -n "2\\.4\\.0|v2\\.4\\.0|auto-caption-2\\.4\\.0|Auto Caption-2\\.4\\.0" ...`：应用版本相关文件无旧版本残留；仅 `package-lock.json` 中存在依赖自身版本 `node-gyp@12.4.0`，与应用版本无关。
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API 或热词远端资源；本批次验证到自动化测试、生产构建、引擎 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议使用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.5.0` 包已验证。
- 当前工作区已有 Electron 43 / Electron Builder 26 大版本依赖状态；虽然本次测试和打包通过，仍建议在发布前做安装包级 GUI 回归，尤其关注窗口生命周期、权限提示、自动更新和内置 Python 引擎启动路径。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`：确认版本源、当前 Electron/Electron Builder 解析版本和 npm 脚本。
- 本地 `electron-builder.yml`：确认当前平台化 `extraResources` 配置会把 macOS/Linux 引擎打包到 `Resources/engine/main`。
- Electron Builder 26 本地模块 `app-builder-lib/out/targets/blockmap/blockmap`：用于替代旧 `app-builder-bin` 路径，刷新签名后产物 blockmap。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循修改前检查、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。


## 2026-08-13 - 初始化操作系统原生 CA 信任

### 用户授权与变更目标

- 用户明确允许新增依赖并要求“fix：初始化 CA问题”。
- 变更类型：修复、依赖、测试、构建、文档。
- 目标：修复 Fun-ASR WebSocket 在打包 Python 运行时因默认 OpenSSL CA 路径为空而持续报 `SSLCertVerificationError: unable to get local issuer certificate` 的问题，使应用统一使用操作系统原生 CA 信任，同时保持完整的 TLS 证书链和主机名校验。
- 明确非目标：不关闭证书校验，不绕过主机名校验，不修改 Fun-ASR 鉴权/重试协议，不调用真实付费识别任务，不安装或删除系统证书，不更新安装目录中的现有 App，不发布构建、提交、推送或创建 PR。
- 修改前执行 `git status --short --branch`，工作区为 `main...origin/main` 且没有未提交文件；本批次修改均可与任务开始前状态区分。

### 根因与技术决策

- 用户提供的新 Debug JSONL 显示 Fun-ASR 初始连接及三次重试均在 TLS 握手阶段失败，错误为 `ClientConnectorCertificateError` / `SSLCertVerificationError`；generation 幂等、最终 fatal 和正常退出已按预期工作。
- 同一 Endpoint 使用系统 `curl` 可完成 TLS 校验并返回未鉴权 HTTP 401，说明服务端证书链和 macOS 系统信任正常。
- 当前 Python 3.13 的 `ssl.get_default_verify_paths()` 指向 `/Library/Frameworks/Python.framework/Versions/3.13/etc/openssl/cert.pem`，该文件不存在，默认 SSLContext 的 CA 统计为 0；系统 `/etc/ssl/cert.pem` 存在。因此故障不是服务端断链，而是 Python/OpenSSL 未继承系统信任。
- DashScope 1.26.7 的普通 aiohttp Session 会显式使用 `certifi.where()`，但 Fun-ASR 所走的 `websocket_request.py` 创建 `aiohttp.ClientSession(trust_env=True)` 后直接 `ws_connect()`，没有传入 SDK 另一处创建的 SSLContext；它最终命中了上述空的 Python 默认信任。
- 选择在应用入口、导入 DashScope/aiohttp 等网络客户端之前调用 `truststore.inject_into_ssl()`。官方文档明确该 API 适用于应用和脚本，并为 macOS 使用 Security framework、Windows 使用 CryptoAPI、Linux 使用 OpenSSL 系统路径；本项目属于应用入口，不是在可复用库的 import side effect 中注入。
- 新增直接精确依赖 `truststore==0.10.4`：本地与官方资料显示其为稳定版、MIT 许可、要求 Python 3.10+，支持本项目三平台；当前引擎 Python 3.13 满足要求。它此前只是 httpcore2/httpx2 的传递依赖，直接固定后不再依赖其他包偶然带入。
- 未采用的替代方案：`certifi` 是独立静态 CA 包，不能完整继承 macOS/Windows 企业信任；硬编码 `SSL_CERT_FILE` 不跨平台且无法等价访问原生证书库；修改 DashScope 私有 WebSocket 实现会与锁定 SDK 内部结构耦合；关闭 TLS 校验不符合安全要求。

### 修改文件与具体原因

- `engine/system_trust.py`
  - 新增幂等的 `initialize_system_trust()`，通过 truststore 将标准库 SSLContext 切换到当前 OS 原生信任，并返回不含敏感信息的后端名称。
- `engine/main.py`
  - 在导入 CLI、Provider、服务和 DashScope/aiohttp 之前完成系统 CA 初始化，保证 aiohttp 的模块级默认 SSLContext 缓存在初始化后创建。
  - 启动时增加一条现有 `ProviderDebug` 协议事件，记录 `macOS Security`、`Windows CryptoAPI` 或 `OpenSSL system paths` 后端；该事件只进入隐式完整 Debug 日志，原有日志记录页继续不显示 DEBUG。
- `engine/requirements.txt`
  - 增加精确直接依赖 `truststore==0.10.4`，未更改其他依赖版本。
- `engine/main.spec`
  - 使用 `collect_submodules('truststore')` 收集条件加载的 macOS、Windows、Linux 后端，避免 PyInstaller 静态分析只收集当前构建平台后端而破坏跨平台各自构建。
- `engine/tests/test_system_trust.py`
  - 新增隔离子进程测试，验证重复初始化幂等、标准库默认 Context 使用 truststore、真实 `main` 入口按正确时序初始化，以及 aiohttp 模块级 verified Context 也确实使用 truststore。
- `docs/engine-manual/architecture.md`
  - 记录入口时序、跨平台信任后端、TLS 校验不降级和隐藏 Debug 行为。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 三语说明 Fun-ASR 使用系统 CA 信任，以及企业代理/私有 CA 应安装到系统信任库。
- `docs/testing.md`
  - 补充系统 CA 的隔离测试边界和无凭据 TLS 握手验收方式。
- `docs/CHANGELOG.md`
  - 在未发布条目记录系统 CA 修复、直接依赖和 PyInstaller 收集策略。
- `change.md`
  - 追加本批次授权、根因、依赖决策、行为变化、验证、风险和回滚记录。

### 修改前后行为、接口与兼容性

- 修改前：Fun-ASR WebSocket 未显式提供 SSLContext，打包 Python 的默认 OpenSSL CA 文件缺失时，即使 macOS 系统已信任服务端证书也会在 TLS 握手阶段失败并重试耗尽。
- 修改后：Python 进程在所有应用网络客户端导入前初始化系统信任；Fun-ASR、热词服务和其他依赖标准库 SSL 默认值的 TLS 客户端均使用 OS 原生 CA，仍执行完整证书链和主机名校验。
- 配置 schemaVersion、默认值、迁移、持久字段、IPC、TCP 命令、Python CLI、字幕/翻译/热词数据结构均无变化，不需要配置迁移。
- Python→Electron 没有新增协议 command 或字段，只复用已有隐藏 `debug` 事件增加一条启动诊断；旧 Electron 若不识别 debug 仍可按既有兼容策略忽略，不影响字幕事件。
- 新依赖为纯 Python wheel，无新增编译工具链；要求 Python 3.10+，低于该版本的自定义引擎开发环境不再满足依赖要求，但项目现有语法和当前构建环境本已使用 Python 3.10+ / 3.13。
- 回滚方式：恢复本条列出的代码、依赖、spec、测试和文档文件；删除 `engine/system_trust.py` 与 `engine/tests/test_system_trust.py`，并按旧 spec 重新构建引擎。配置数据无需回滚。回滚会重新暴露打包 Python 不继承系统 CA 的故障。

### 实际验证与真实结果

- `engine/.venv/bin/python3 -m pip install truststore==0.10.4`：通过，报告 `Requirement already satisfied`，没有安装或升级其他包；pip 仅提示用户缓存目录不可写并禁用缓存。
- `engine/.venv/bin/python3 -m pip show truststore`：确认版本 `0.10.4`、MIT 许可、本地安装路径及当前仅被 httpcore2/httpx2 传递使用的状态。
- `engine/.venv/bin/python3 -m unittest engine.tests.test_system_trust -v`：最终 2/2 通过；覆盖幂等初始化、真实入口顺序和 aiohttp verified Context。
- `npm run verify`：通过；TypeScript、ESLint、Node 53/53、Python 59/59 全部成功。保留既有 npm mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，分别转换 26、1、3260 个模块。
- 首次从仓库根目录执行 `PYINSTALLER_CONFIG_DIR=... engine/.venv/bin/pyinstaller --clean --noconfirm engine/main.spec`：失败；既有 spec 的 Vosk 相对路径按错误工作目录解析到仓库根 `.venv/lib/python3.12/...`。这次失败没有隐藏为成功。
- 切换到 `engine/` 后执行 `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-ca-pyinstaller ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 macOS arm64 `engine/dist/main`。保留既有 `pycparser` 可选隐藏导入及 `@rpath/libomp.dylib` 解析警告。
- `./.venv/bin/pyi-archive_viewer -r -b ./dist/main | rg ...`：确认单文件归档包含 `system_trust`、`truststore._api`、`_macos`、`_openssl`、`_ssl_constants`、`_windows`。
- `file engine/dist/main`：确认生成物为 Mach-O 64-bit arm64。
- 沙盒内首次执行 `engine/dist/main --help`：因 PyInstaller semaphore 权限报 `semctl: Operation not permitted`；经授权在沙盒外重试通过并完整输出 CLI help，说明 truststore 及三平台条件模块没有破坏打包入口。
- 无凭据 aiohttp WSS 探针在沙盒内首先因 DNS 受限失败；沙盒外第一次探针故意/错误地在 CA 初始化前导入 aiohttp，复现原 `CERTIFICATE_VERIFY_FAILED`，从而确认导入时序是关键约束；改为与真实 `main.py` 一致的“先初始化、后导入 aiohttp”后返回 `tls_verified_http_status=401`。401 是未提供 API Key 的预期服务端响应，证明 TLS 证书校验已经通过，且没有创建识别任务或产生 API 费用。
- `git diff --check`：代码、测试和文档修改后通过；追加本记录后再次执行最终检查。

### 未执行验证、已知风险与后续事项

- 未使用真实 API Key 启动 Fun-ASR 任务，未采集音频，未调用翻译或远端热词 API，因此没有产生云端费用；在线验证止于无凭据 TLS 握手后的 HTTP 401。
- 仅在 macOS arm64 源码环境和 PyInstaller 产物上实测；Windows CryptoAPI 与 Linux OpenSSL 后端由 truststore 官方支持、归档包含对应模块且离线测试验证后端选择，但尚未在 Windows/Linux 实机打包和联网验收，不能声明这两个平台已实测。
- 本批次只重新生成被 Git 忽略的 `engine/dist/main`，没有重新封装 Electron `.app`、DMG/ZIP，也没有替换 `/Applications/Auto Caption.app` 中的旧引擎。要让已安装 App 使用修复，仍需在后续获授权后重新构建并安装/替换应用产物。
- `truststore.inject_into_ssl()` 必须早于 aiohttp 等会缓存默认 SSLContext 的模块导入；当前入口顺序和回归测试对此有保护。未来若增加 PyInstaller runtime hook 或在 `main.py` 前导入网络库，必须维持同一约束。
- truststore 作为安全边界依赖应继续精确锁定；升级时需复核官方平台支持、许可证、aiohttp 导入时序和三平台 PyInstaller 收集结果。

### 关键外部文档与技术决策来源

- Truststore 0.10.4 官方文档：`https://truststore.readthedocs.io/en/stable/`，用于确认 `inject_into_ssl()` 的应用入口适用范围、Python 版本要求和 macOS Security / Windows CryptoAPI / Linux OpenSSL 支持。
- Truststore 0.10.4 PyPI 发布页：`https://pypi.org/project/truststore/0.10.4/`，用于确认精确发布版本、wheel 与项目元数据。
- 项目锁定的 DashScope 1.26.7 本地源码 `dashscope/api_entities/websocket_request.py` 与 `aio_session.py`：用于确认 Fun-ASR WebSocket 没有复用 SDK 另一处 certifi SSLContext。
- 用户提供的 `auto-caption-debug-2026-08-13T08-40-21-364Z.jsonl`：用于确认真实失败类型、重试次数和正常 fatal 退出行为。
- macOS 系统 `curl`、Python `ssl` 默认路径/CA 统计、本地 `/etc/ssl/cert.pem` 状态及无凭据 aiohttp WSS 探针：用于区分服务端证书问题与 Python CA 初始化问题，并验证修复结果。
- 根目录 `AGENTS.md`：决定直接依赖评审、跨平台说明、三语用户文档、凭据保护、真实失败记录和本条 `change.md` 内容。

## 2026-08-13 - Electron 安全升级与三平台构建测试

### 授权与目标

- 用户明确要求先升级依赖，再分别进行 Windows、macOS 和 Linux 构建测试；随后明确授权升级依赖、运行 npm 安装钩子，并要求安装在仓库根目录的项目环境中。
- 变更类型：配置、构建、测试、修复。
- 目标：将 npm audit 指向的 Electron 运行时与 electron-builder 构建链升级到修复版本，验证根目录安装、安装钩子、自动化测试、通用生产构建和三平台打包结果。
- 明确非目标：不全局安装 npm/Python/系统依赖，不安装 Docker、Wine 或虚拟机，不修改 Python requirements 或 `engine/.venv`，不提交、推送、创建 PR/Release，不签名或发布测试包，不调用真实麦克风、付费 API 或远端热词资源。
- 修改前 `git status --short --branch` 为 `main...origin/main` 且工作区干净；本批次没有需要绕开的用户未提交修改。

### 修改文件与原因

- `package.json`
  - 将直接开发依赖 `electron` 从 `^35.1.5` 升级到 `^43.4.0`，修复 npm audit 报告的 Electron 运行时公告。
  - 将直接开发依赖 `electron-builder` 从 `^25.1.8` 升级到 `^26.15.3`，带动修复 `app-builder-lib`、`builder-util-runtime`、`@electron/rebuild`、`node-gyp` 和 `tar` 构建链漏洞。
- `package-lock.json`
  - 由根目录 `npm install --save-dev electron@43.4.0 electron-builder@26.15.3` 重新解析并锁定依赖树；实际解析为 `electron@43.4.0`、`electron-builder@26.15.3`、`app-builder-lib@26.15.3`、`builder-util-runtime@9.7.0`、`@electron/rebuild@4.2.0`、`node-gyp@12.4.0` 和 `tar@7.5.22`。
  - 安装位置为仓库根目录 `node_modules`，没有使用全局 npm 目录；Python 虚拟环境不参与 npm 安装。
- `electron-builder.yml`
  - 在 `files` 中显式排除 `dist/**`，避免使用临时输出目录测试时把仓库既有发布产物递归装入 `app.asar`。
  - 将原顶层两条 `extraResources` 拆分到 `win`、`mac` 和 `linux` 平台配置，避免 macOS 包探测 Windows `main.exe`，也避免 Windows 包误复制 Unix `main`；Linux 与 macOS 仍使用各自原生环境生成的同名 `engine/dist/main`。
- `change.md`
  - 追加本次授权、依赖决策、配置兼容修复、真实验证结果、失败项、限制与回滚说明。

### 修改前后行为

- 修改前：根目录解析为 `electron@35.7.5` 和 `electron-builder@25.1.8`，`npm audit` 报告 13 个受影响包条目（12 high、1 critical）；生产范围审计仍报告 Electron 1 个 high。
- 修改后：根目录解析为 `electron@43.4.0` 和 `electron-builder@26.15.3`，完整 `npm audit` 为 0 个漏洞；安装钩子使用 Electron 43.4.0/arm64 完成原生依赖检查。
- 修改前：当 electron-builder 输出目录被改到仓库外部时，既有 `dist/` 不再由输出目录默认排除，测试 `.app` 的 `app.asar` 会递归包含历史安装包并膨胀至约 2.9GB。
- 修改后：`dist/**` 始终显式排除；重建的 macOS `.app` 为约 477MB、DMG/ZIP 各约 215MB，三平台 `app.asar` 检查均确认不包含 `/dist`。
- 修改前：顶层引擎资源规则在每个平台都尝试复制 `main.exe` 与 `main`。
- 修改后：每个平台只声明自己的目标引擎文件；macOS 最终包包含 Mach-O arm64 `engine/main` 且不含 `main.exe`，Windows 包不再误带 macOS `main`。
- 用户配置、schemaVersion、迁移、IPC、Python CLI、stdout/TCP 子进程协议、字幕数据结构、用户可见文本和远端服务行为均无变化；无需配置迁移或三语文案更新。

### 依赖决策、兼容性与回滚

- 选择 `electron@43.4.0` 和 `electron-builder@26.15.3` 是 npm audit 对当前依赖树给出的可修复版本；没有使用 `npm audit fix --force`，避免无边界修改其他直接依赖。
- Electron 与 electron-builder 均为项目既有 MIT 许可工具的升级，不新增新的直接依赖类别；替代方案是停留旧主版本并接受已知漏洞，不能满足本次安全目标。
- `npm ls` 未报告 peer/invalid/extraneous 错误；现有 `electron-vite@3.1.0`、Vue/Vite/TypeScript 组合通过类型检查、测试和生产构建。
- Windows/Linux Electron 外壳可在 macOS 交叉打包，但 PyInstaller 不能从 macOS 生成 Windows PE 或 Linux ELF 引擎；完整平台包仍必须在目标系统（或合适的 VM/容器/CI runner）中先生成 `engine/dist/main.exe` 或原生 `engine/dist/main`。
- 精确回滚：将 `package.json` 的 Electron/electron-builder 范围恢复为 `^35.1.5`/`^25.1.8` 并恢复旧锁文件；从 `electron-builder.yml` 移除 `!dist/**`，并把平台级 `extraResources` 恢复为原顶层两条规则。回滚会重新引入已知 audit 漏洞以及跨平台资源误复制风险。

### 验证记录

- `npm install --save-dev electron@43.4.0 electron-builder@26.15.3`：经用户授权后成功，在仓库根目录新增 58、移除 179、变更 36 个包；安装结果报告 0 个漏洞。
- `npm ls electron electron-builder app-builder-lib builder-util-runtime @electron/rebuild node-gyp tar --all`：通过，确认上述修复版本及完整依赖链，无 npm ls 依赖错误。
- `npm audit --json`：成功；info/low/moderate/high/critical/total 全部为 0。
- `npm run postinstall`：成功；`electron-builder install-app-deps` 调用 `@electron/rebuild`，按 Electron 43.4.0、arm64 完成根项目原生依赖安装检查。
- `npm run verify`：通过；Node 41/41、Python 49/49、Node/Web 类型检查和 ESLint 全部成功。
- `npm run build`：通过；main/preload/renderer 生产构建成功，分别转换 23、1、3259 个模块。
- 首次 `npm run build:mac -- --arm64 -c.directories.output=/private/tmp/auto-caption-build-test-20260813/mac`：命令完成但测试产物异常膨胀；检查发现 `app.asar` 包含仓库旧 `dist/`，由此新增显式排除规则。该首次结果不计为有效构建通过。
- 修复后 `npm run build:mac -- --arm64 -c.directories.output=/private/tmp/auto-caption-build-test-20260813/mac-retry`：通过；生成 macOS arm64 `.app`、DMG、ZIP 与 blockmap。`hdiutil verify`、`unzip -tq`、Mach-O arm64 检查和 `/dist` 排除断言均通过；没有 Developer ID，因此 electron-builder 明确跳过正式签名。
- 最终平台级资源配置执行 `electron-builder --mac --arm64 --dir -c.directories.output=/private/tmp/auto-caption-build-test-20260813/mac-final`：通过；确认 `.app` 与 Python 引擎均为 Mach-O arm64、Windows `main.exe` 未进入 macOS 包、`app.asar` 不含 `/dist`。
- `npm run build:win -- --x64 -c.directories.output=/private/tmp/auto-caption-build-test-20260813/windows`：Electron/NSIS 命令退出 0，生成 109MB NSIS 安装器和 PE x64 unpacked 应用；随后资源断言退出 2，因为仓库没有 `engine/dist/main.exe`，完整 Windows 应用构建判定失败。
- `npm run build:linux -- --x64 -c.directories.output=/private/tmp/auto-caption-build-test-20260813/linux`：electron-builder 命令退出 0，生成 215MB tar.gz；`gzip -t`、Electron ELF x64 和 `/dist` 排除断言通过，随后引擎格式断言退出 2，因为包内 `engine/main` 是 macOS Mach-O arm64 而非 Linux ELF x64，完整 Linux 应用构建判定失败。
- `git diff --check`：通过，无空白错误；最终 `git status` 仅包含 `package.json`、`package-lock.json`、`electron-builder.yml` 和本条 `change.md` 记录。

### 未执行、失败项、风险与后续事项

- Windows 和 Linux 的“完整可运行应用”未通过：当前 macOS 主机无法原生生成对应 PyInstaller 引擎，本机也没有 Docker、Podman、Colima、Lima、Multipass、Parallels、VirtualBox、UTM、QEMU 或 Wine；未擅自安装系统级运行时。
- Windows 后续必须在 Windows x64 环境使用项目虚拟环境安装 `engine/requirements.txt`、运行 PyInstaller、确认 `engine/dist/main.exe` 为 PE x64，再重新运行 `npm run build:win` 并做安装/启动验证。
- Linux 后续必须在 Linux x64 环境生成 ELF x64 `engine/dist/main`，再重新运行 `npm run build:linux` 并做 tar.gz 解压/启动验证。macOS 上生成的同名文件不得用于 Linux 发布。
- 未在 Windows/Linux 实机启动 Electron GUI，没有测试安装器权限、音频设备、Python 子进程启动或系统动态库；不得把本次交叉打包外壳描述为平台实机通过。
- macOS 包未做 Developer ID 签名、公证或安装后 GUI/音频回归；仅验证原生格式、资源、归档完整性和生产构建。
- 保留既有 npm 11 对 `.npmrc` 中 `electron_mirror`/`electron_builder_binaries_mirror` 的弃用警告，以及 Node 测试的 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致本次命令失败，本批次未扩大范围处理。
- 所有测试产物位于 `/private/tmp/auto-caption-build-test-20260813/`，未加入 Git，也未覆盖仓库现有 `dist/` 发布产物。

### 关键外部文档或技术决策来源

- npm 官方 audit 数据库：升级前给出 Electron 43.4.0 与 electron-builder 26.15.3 修复路径；升级后复核为 0 个漏洞。
- Electron Builder Multi Platform Build：明确不能期待在单一主机完成所有平台原生构建，原生依赖需要目标平台或预构建，Windows/Linux 可使用对应 Docker/CI 环境，`https://www.electron.build/docs/features/multi-platform-build/`。
- Electron Builder Architecture：确认 macOS arm64、Windows x64、Linux x64 CLI 架构参数及原生模块的目标平台约束，`https://www.electron.build/docs/architecture/`。
- 本地 `package.json`、`package-lock.json`、`electron-builder.yml`、构建日志和产物文件格式检查：作为实际解析版本、配置行为与平台构建结论的权威证据。
- 根目录 `AGENTS.md`：遵循依赖升级授权、平台兼容、生成目录排除、真实失败记录与 `change.md` 追加制度。

## 2026-08-13 - 设置表单临界宽度断行与间距一致性修复

### 授权与目标

- 用户提供三张实际窗口截图并明确要求修复两个问题：部分宽度下表单元素间距不一致，以及特定宽度下语言、颜色等选项与字幕样式开关仍会错行。
- 变更类型：修复、重构、文档、测试。
- 目标：消除依赖 Flex 剩余空间计算产生的临界宽度随机断行，让同类字段采用可预测的两种布局，并保证单选按钮组和开关单元不会被拆成孤立行。
- 明确非目标：不改变窗口断点、侧栏宽度持久化、设置草稿、字幕样式数据、引擎配置、IPC、Python CLI、子进程协议或依赖版本；不处理本任务以外的视觉风格和功能。

### 修改文件与原因

- `src/renderer/src/assets/input.css`
  - 将通用 `.input-item` 从可任意换行的 Flex 改为确定性的 CSS Grid，统一 12px 行外间距、12px 列间距和 6px 行内间距。
  - 设置面板不超过 480px 时统一切换为标签在上、控件在下；普通开关字段仍保持标签与开关为不可拆分的同一行。
  - 新增等分且禁止内部换行的 `.responsive-radio-group`，避免按钮组在临界剩余宽度下留下单个选项。
- `src/renderer/src/components/GeneralSetting.vue`
  - 语言、主题和颜色按钮组接入等分单行布局；颜色按钮取消多余水平 padding，保证六个色块在 300px 侧栏和 360px 浮层中仍完整同排。
  - 左栏宽度滑块适配 Grid 的控制列和窄面板堆叠模式。
- `src/renderer/src/components/CaptionStyle.vue`
  - 字幕行数改为四等分单行按钮组。
  - 将显示预览、显示翻译和文本阴影重构为三个独立开关单元，每行固定标签列与开关列；标签列扩大到 128px，保证中英日最长文案也不折行，三行高度和间距一致。
- `src/renderer/src/components/engine/EngineFieldRenderer.vue`
  - 将目录图标和目录输入框包装为同一控件单元，避免 Grid 切换时二者被分配到不同的自动行。
- `src/renderer/src/components/engine/HotwordManager.vue`
  - 热词表单同步使用确定性 Grid 和 480px 堆叠规则，防止更深层设置在相同宽度再次出现同类问题。
- `src/renderer/src/views/ControlPage.vue`
  - 卡片标题与附加操作改为整体可换行，并保持附加操作靠右；删除仅在 360px 强制整列换行的旧规则，避免小信息图标或操作区被单独挤到异常行。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步说明 480px 表单布局切换和选项/开关完整单元行为。
- `change.md`
  - 追加本批次授权、根因、文件范围、兼容性、验证与回滚记录。

### 修改前后行为

- 修改前：`.input-item` 使用 `flex-wrap`，浏览器会根据标签文本、Ant Design 控件固有宽度和剩余像素分别决定断行；因此相邻几像素可能出现“标签在左/标签在上”切换、日语或黑色色块单独掉到下一行，以及三个字幕开关按 2+1 分行。折行后的行高不同又进一步表现为元素间距不一致。
- 修改后：设置面板宽度不超过 480px 时所有普通表单稳定采用上下布局，超过 480px 时稳定采用标签列加控件列。语言、主题、颜色和字幕行数按钮组始终分别保持 3、3、6、4 个选项在同一行并等分宽度。
- 三个字幕样式开关始终为三个独立行；中文、英文和日文标签均为单行，开关不会脱离自己的标签，行间距固定。
- 目录输入、热词表单和卡片标题操作同步遵守相同边界，不新增另一套特殊宽度补丁。

### 配置、接口、兼容性与回滚

- 配置 schemaVersion、`leftBarWidth`、字幕样式字段、默认值、迁移和保存行为均无变化。
- Electron IPC、Python CLI、NDJSON/TCP 协议、识别/翻译/热词业务逻辑和数据结构均无变化。
- 没有新增、删除或升级依赖；实现使用项目现有 Electron/Chromium 支持的 CSS Grid、容器查询和 `:has()`。
- 公共渲染代码适用于 Windows、macOS 和 Linux；本批次自动化与生产 renderer 视觉回归在 macOS arm64 环境完成，未声称其他平台实机 GUI 已验证。
- 精确回滚：恢复本条列出的 6 个渲染代码文件和 3 个用户手册文件即可；无需配置迁移。回滚会重新引入 Flex 临界断行和不等间距问题。

### 验证记录

- `npm run typecheck`：通过，Node TypeScript 与 Vue TypeScript 均无错误。
- `npm run lint`：通过，无 ESLint 错误。
- `npm run verify`：最终代码通过；Node 41/41、Python 49/49、类型检查和 ESLint 全部成功。
- `npm run build`：最终代码通过；Electron main、preload、renderer 生产构建分别转换 23、1、3259 个模块。
- 生产 renderer 连续宽度回归：在 25% 侧栏下检查 1200、1280、1400、1600、1800、1920、2000、2200px 窗口宽度，对应面板约 299–549px；4 组目标单选按钮的实际行数始终为 1，三个字幕开关的实际行距始终为 32px，body 无横向溢出。
- 480px 边界精细扫描：窗口宽度从 1900px 到 1960px 每 5px 检查一次；面板在约 479px 保持堆叠、约 480px 切换为双列，切换前后所有按钮组均为单行且无页面溢出。
- 折叠浮层回归：1199×900 下设置浮层为 360px，语言、主题、颜色和字幕行数均为单行，三个开关的标签与开关垂直对齐，页面无横向溢出。
- 25%/50% 和三语回归：300px 与约 598px 侧栏下均无目标控件掉行；中文、英文、日文的三个开关标签高度均为 22px，英文 `Show Translation` 不再折成两行。
- 浏览器回归只向本地临时服务器加载生产 renderer；没有提交表单、访问外部站点或持久化测试配置。临时服务器在验证结束时关闭，测试文件位于 `/private/tmp`，未进入仓库。

### 未执行、风险与后续事项

- 未在 Windows/Linux 实机运行 GUI，也未重新生成三平台安装包；发布前仍建议在目标平台检查系统字体度量差异。
- 未测试真实音频、识别、翻译或远端热词 API；本批次不触及这些路径。
- 本批次使用的 480px 是设置面板自身宽度而非窗口宽度，因此仍兼容 25%–50% 用户侧栏设置和 360px 折叠浮层。

### 关键技术决策来源

- 用户提供的三张 macOS 实际窗口截图：确认问题集中在 Flex 临界宽度的自由换行，而非 1200px Sider 断点或数据状态。
- 本地生产 renderer 的实际 DOM 几何扫描：以按钮 `getBoundingClientRect().top`、开关行高/行距、侧栏实际宽度和 body overflow 作为验收依据。
- 项目现有 Ant Design Vue 控件结构、Electron 43 Chromium 运行时和已存在的设置面板容器查询边界。
- 根目录 `AGENTS.md`：遵循最小范围、三语文档同步、跨平台说明、真实验证和 `change.md` 追加制度。

## 2026-08-13 - V2.6.0 小版本与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.5.0` 提升到 `2.6.0`，并生成 macOS arm64 构建产物。
- 明确非目标：本次用户未要求依赖检查或升级，因此不主动执行依赖治理；不创建 git tag、commit、branch、PR 或 Release；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有未提交改动，包含设置表单响应式布局相关的渲染代码、三语用户手册和 `change.md` 记录；本批次保留这些改动，只在当前工作区基础上叠加版本号、文档版本标识和 macOS arm64 构建产物。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.6.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.6.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.6.0`；本次文案只描述 macOS arm64 构建，不新增依赖更新声明。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.6.0`；保留本批次前已有的 480px 表单布局说明。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.6.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.6.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.6.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.6.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.6.0` 路径、大小、sha512 与 releaseDate。
- `change.md`
  - 追加本批次授权、修改范围、构建上下文、验证、风险和回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.6.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.6.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.5.0` / `v2.5.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.6.0` / `v2.6.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；构建使用项目本地 `node_modules` 与 `engine/.venv`，仅在项目目录生成和更新构建产物。

### 兼容性、迁移与回滚

- 本批次只更新发布版本并重新构建 macOS arm64 包，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 Intel x64 或 universal 包。
- 当前构建基于工作区已有的 `electron@43.4.0` 与 `electron-builder@26.15.3`；自动化测试与打包通过，但未在真实安装后的 GUI 中做 Electron 43 交互回归。
- Electron Builder 26 不再提供旧的 `node_modules/app-builder-bin/mac/app-builder_arm64` 路径；本批次继续使用 `app-builder-lib/out/targets/blockmap/blockmap` 的 `buildBlockMap` API 刷新签名后 zip/DMG 的 blockmap。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.5.0`；恢复 `package.json` 和 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.6.0` 构建产物；如需恢复旧包，使用此前 `2.5.0` 产物或按旧版本号重新构建。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区开局已有未提交修改，需要保留。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.6.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.5\\.0|v2\\.5\\.0|auto-caption-2\\.5\\.0|Auto Caption-2\\.5\\.0" ...`：应用版本相关文件无旧版本残留；历史 `docs/CHANGELOG.md` 条目和 `package-lock.json` 中依赖自身版本 `@electron/notarize@2.5.0`、`ts-api-utils@2.5.0` 与应用版本无关。
- `npm run verify`：通过；TypeScript、ESLint、Node 41/41 和 Python 49/49 全部成功；保留既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，renderer 由 Vite 6.4.3 转换 3259 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内因 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，基于 `electron@43.4.0` 与 `electron-builder@26.15.3` 生成 `.app`、zip、DMG 和初始 blockmap。构建日志提示 duplicate dependency references，并提示缺少 Developer ID 签名证书；未导致构建失败。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.6.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.6.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.6.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "const { buildBlockMap } = require('./node_modules/app-builder-lib/out/targets/blockmap/blockmap'); ..."`：通过，生成最终 zip 和 DMG blockmap；最终 zip size `224871311`、sha512 `ePdEWXwPW+XNDC6fboUIgypjorIMnPNGzZi9ViUkvEj9xxVWaCarxS0RG+JZ/vNJVL1BzSIcGjQOvdVxv8yk4A==`；最终 DMG size `245647089`、sha512 `aVSUAh/XP9NL+xHYreCZELsZrRNTEpmWplqVcTWLuxAbZnqUMcdUMN6psS/HqV6LDyfFcQQnNLGoapnp22WEdw==`。
- `hdiutil verify dist/auto-caption-2.6.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.6.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.6.0.dmg dist/Auto Caption-2.6.0-arm64-mac.zip`：
  - DMG：`7f51ee99047658e33331616472664b6502cab83a91c4698bae473606fbab7990`
  - ZIP：`93d45c88f8e64e5d4f676c16523122151c7f4deea579248b8e55c1b036cb9869`
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API 或热词远端资源；本批次验证到自动化测试、生产构建、引擎 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议使用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.6.0` 包已验证。
- 当前工作区已有 Electron 43 / Electron Builder 26 大版本依赖状态；虽然本次测试和打包通过，仍建议在发布前做安装包级 GUI 回归，尤其关注窗口生命周期、权限提示、自动更新和内置 Python 引擎启动路径。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`：确认版本源、当前 Electron/Electron Builder 解析版本和 npm 脚本。
- 本地 `electron-builder.yml`：确认当前平台化 `extraResources` 配置会把 macOS/Linux 引擎打包到 `Resources/engine/main`。
- Electron Builder 26 本地模块 `app-builder-lib/out/targets/blockmap/blockmap`：用于刷新签名后产物 blockmap。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循修改前检查、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。

## 2026-08-13 - V2.8.0 小版本与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.7.0` 提升到 `2.8.0`，并生成 macOS arm64 构建产物。
- 明确非目标：本次用户未要求依赖检查或升级，因此不主动执行依赖治理；不创建 git tag、commit、branch、PR 或 Release；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有未提交改动，包含 Python 系统信任库初始化、`truststore==0.10.4` 直接依赖、PyInstaller 隐式导入、文档和测试；本批次保留这些改动，只在当前工作区基础上叠加版本号、文档版本标识和 macOS arm64 构建产物。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.8.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.8.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.8.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.8.0`；保留本批次前已有的系统 CA 信任库说明。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.8.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.8.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.8.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.8.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.8.0` 路径、大小、sha512 与 releaseDate。
- `change.md`
  - 追加本批次授权、修改范围、构建上下文、验证、风险和回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件，构建时包含本批次前已有的 `truststore` 隐式导入配置。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.8.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.8.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.7.0` / `v2.7.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.8.0` / `v2.8.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；构建使用项目本地 `node_modules` 与 `engine/.venv`，仅在项目目录生成和更新构建产物。

### 兼容性、迁移与回滚

- 本批次只更新发布版本并重新构建 macOS arm64 包，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 Intel x64 或 universal 包。
- 当前构建基于工作区已有的 `electron@43.4.0` 与 `electron-builder@26.15.3`；自动化测试与打包通过，但未在真实安装后的 GUI 中做 Electron 43 交互回归。
- 本次 Python 打包基于工作区已有的系统 CA 信任库改动：`engine/requirements.txt` 已包含 `truststore==0.10.4`，`engine/main.spec` 使用 `collect_submodules('truststore')`。构建日志确认 `truststore` 相关依赖参与分析；未修改系统证书或系统 Python。
- Electron Builder 26 不再提供旧的 `node_modules/app-builder-bin/mac/app-builder_arm64` 路径；本批次继续使用 `app-builder-lib/out/targets/blockmap/blockmap` 的 `buildBlockMap` API 刷新签名后 zip/DMG 的 blockmap。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.7.0`；恢复 `package.json` 和 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.8.0` 构建产物；如需恢复旧包，使用此前 `2.7.0` 产物或按旧版本号重新构建。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区开局已有未提交修改，需要保留。
- `engine/.venv/bin/python3 -m pip show truststore`：通过，确认项目虚拟环境内 `truststore` 版本为 `0.10.4`；保留 pip cache 目录不可写警告。
- `engine/.venv/bin/python3 -m pip check`：通过，输出 `No broken requirements found.`；只检查项目虚拟环境，未修改系统 Python。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.8.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.7\\.0|v2\\.7\\.0|auto-caption-2\\.7\\.0|Auto Caption-2\\.7\\.0" ...`：应用版本相关文件无旧版本残留；历史 `docs/CHANGELOG.md` 条目和 `package-lock.json` 中依赖自身版本 `jiti@2.7.0`、`@peculiar/asn1-schema` 约束与应用版本无关。
- `npm run verify`：通过；TypeScript、ESLint、Node 53/53 和 Python 59/59 全部成功；Python 覆盖包含 `test_system_trust`；保留既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，分别转换 26、1、3260 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；日志显示 `hook-urllib3`、`hook-certifi`、`truststore` 相关依赖进入分析流程；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内因 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，基于 `electron@43.4.0` 与 `electron-builder@26.15.3` 生成 `.app`、zip、DMG 和初始 blockmap。构建日志提示 duplicate dependency references，并提示缺少 Developer ID 签名证书；未导致构建失败。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.8.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.8.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.8.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "const { buildBlockMap } = require('./node_modules/app-builder-lib/out/targets/blockmap/blockmap'); ..."`：通过，生成最终 zip 和 DMG blockmap；最终 zip size `224894490`、sha512 `rvkdpz3/oOm0c/h0ECVZTY3d9/cIZ2TvBfzYViNr5DkIioNYck188R86yjFKX3PJhaoMJrpxnHKgUiyM3rcO6A==`；最终 DMG size `244884069`、sha512 `9s9GxDjENoqmv4WI24VwW/SwadxMmWY4DKz0CLS3ldM6PJoB95FlSgkKekvSu7SbWUq2z4VfROyp8cTwqGDWwQ==`。
- `hdiutil verify dist/auto-caption-2.8.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.8.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.8.0.dmg dist/Auto Caption-2.8.0-arm64-mac.zip`：
  - DMG：`1563f0b9a432b60088a563cf71ab5644fd01785859ddebd5c2a64882dac9813f`
  - ZIP：`f95928691f5e26a42f06799aaf602a1f2a270ea49040f044789590ff47c57f77`
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API、系统代理证书链或热词远端资源；本批次验证到自动化测试、生产构建、引擎 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议使用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.8.0` 包已验证。
- 当前工作区已有 Electron 43 / Electron Builder 26 大版本依赖状态，并且包含本批次前已有的系统信任库改动；虽然本次测试和打包通过，仍建议在发布前做安装包级 GUI 和真实 TLS 回归，尤其关注 macOS 企业 CA、Windows CryptoAPI、Linux OpenSSL 路径和内置 Python 引擎启动路径。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`：确认版本源、当前 Electron/Electron Builder 解析版本和 npm 脚本。
- 本地 `engine/requirements.txt`、`engine/main.spec`、`engine/system_trust.py` 与 `engine/tests/test_system_trust.py`：确认当前系统信任库改动、`truststore==0.10.4` 和 PyInstaller 隐式导入策略。
- 本地 `electron-builder.yml`：确认当前平台化 `extraResources` 配置会把 macOS/Linux 引擎打包到 `Resources/engine/main`。
- Electron Builder 26 本地模块 `app-builder-lib/out/targets/blockmap/blockmap`：用于刷新签名后产物 blockmap。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循修改前检查、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。

## 2026-08-13 - 隐式 Debug 会话、Fun-ASR 幂等失败处理与进程组收尾

### 用户授权与变更目标

- 用户先要求对 Fun-ASR 的重复重连、task-failed 后 `stop()`、错误分类、fatal 退出、进程树强杀和真实回调顺序测试进行技术评审，随后明确改为要求实现：新增本次软件启动的完整 Debug 日志、日志页保存按钮、消除 `Set application config` 刷屏，并完成上述 Fun-ASR 和进程生命周期修复。
- 用户最新补充要求：Debug 只隐式记录，原有日志记录页不显示 DEBUG；原有 INFO、WARN、ERROR 展示行为保持不变。
- 用户此前要求 Debug 字段不脱敏，但根目录 `AGENTS.md` 第 13 节强制禁止 API Key、Token 和密码进入日志，二者直接冲突。本批次已向用户说明并遵循更高优先级项目安全约束：诊断字段、错误码、请求 ID、generation 和异常栈尽量完整保留，凭据值始终脱敏。
- 变更类型：功能、修复、重构、测试、文档。
- 明确非目标：不升级或安装依赖，不调用真实阿里云/翻译 API，不操作远端热词，不修改配置 schemaVersion，不创建分支/commit/PR/Release，不生成三平台安装包，不扩展到其他 Provider 的重试架构重写。
- 修改前执行 `git status --short --branch`，工作区为 `main...origin/main` 且无未提交文件；本批次没有覆盖用户已有修改。

### 修改文件与原因

#### Debug 会话、日志安全与用户界面

- `src/main/logging/DebugLogSession.ts`
  - 新增每次软件启动独立的 UTF-8 JSON Lines 会话写入器；支持 Electron ready 前内存缓冲、初始化后逐条同步持久化及当前会话完整复制导出。
  - 明确定义 `DEBUG` 为不可见级别，INFO/WARN/ERROR 为原有可见级别。
- `src/main/utils/Log.ts`
  - 将所有 `Log.debug/info/warn/error` 统一写入本次 Debug 会话；只有 INFO/WARN/ERROR 继续进入控制台、队列和 Renderer 日志页。
  - Debug 记录包含单调 sequence、ISO 时间、级别、来源、格式化消息和结构化字段。
- `src/main/utils/UtilsFunc.ts`
  - 新增字符串、异常、数组和嵌套对象的递归日志脱敏，覆盖 API Key、Token、Password、Secret、Authorization、Bearer、`sk-*`、URL 查询凭据和现有命令行凭据参数。
  - 复用既有命令参数敏感项集合，避免普通命令日志与完整 Debug 日志的掩码规则漂移。
- `src/main/index.ts`
  - 在 `app.whenReady()` 最前初始化会话，并隐式记录应用版本、平台和架构；不向原日志页增加启动 DEBUG。
- `src/main/ControlWindow.ts`
  - 新增 `control.debugLog.export` IPC，由主进程打开系统保存对话框并导出当前会话，Renderer 不接触内部日志路径。
- `src/renderer/src/components/SoftwareLog.vue`
  - 在原日志记录页增加“保存完整 Debug 日志”按钮及保存结果提示；原表格数据源和显示级别不变。
- `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`
  - 同步增加按钮、成功和失败文案。
- `src/renderer/src/stores/softwareLog.ts`
  - 删除收到日志 IPC 时的冗余 Renderer `console.log`。
- `src/renderer/src/components/GeneralSetting.vue`
  - 删除主题变化时两个未归档的 `console.log` 调试输出，避免调试信息绕过统一会话。
- `tests/node/debugLogSession.test.mjs`
  - 覆盖初始化前后记录、JSONL 导出、结构化脱敏，以及生产共用路由中 DEBUG 只持久化而 INFO/WARN/ERROR 同时对外投递。

#### application 配置刷屏

- `src/main/config/ApplicationConfigChange.ts`
  - 新增可独立测试的 application 配置深度变化判断。
- `src/main/utils/AllConfig.ts`
  - 深度相同的 application 消息直接忽略；真实变化改记隐式 DEBUG，不再输出可见的 `Set application config` INFO。
- `src/main/ControlWindow.ts`
  - 只有配置真实变化后才向字幕窗口广播，阻断相同配置回显循环。
- `src/renderer/src/stores/generalSetting.ts`
  - 后端配置回填期间通过 `ApplicationConfigSync` 抑制 watch 回发；取消 `leftBarWidth` 每一步变化都提交的 watch，保留显式一次提交方法。
- `src/renderer/src/utils/ApplicationConfigSync.ts`
  - 提取可测试的 Renderer 配置同步门：Vue flush 前禁止反馈提交，revision 保证较早 flush 不会提前结束较新的回填窗口。
- `src/renderer/src/components/GeneralSetting.vue`
  - 侧栏宽度滑块改为拖动结束时提交一次，拖动期间仅更新本地布局预览。
- `tests/node/applicationConfigChange.test.mjs`
  - 覆盖相同配置抑制、真实布局变化识别、远端回填反馈抑制和连续回填 revision 顺序。

#### Fun-ASR generation 状态机、错误分类和协议诊断

- `engine/core/events.py`、`engine/core/__init__.py`
  - 新增内部 `ProviderDebug`；`ProviderError` 可带可选结构化 details，不改变既有构造调用。
- `engine/protocol/output.py`
  - 新增可选 `debug` stdout command；带 details 的错误增加 `diagnostic.version: 1`，无 details 的旧错误输出保持原格式。
- `src/main/utils/CaptionEngine.ts`
  - 接收 `debug` 后只调用 `Log.debug`；错误 `content` 仍进入原日志和用户通知，`diagnostic` 只进入隐式完整日志。
- `engine/providers/fun_asr.py`
  - 为每个连接 generation 引入 `connecting/active/failed/closing/closed` 状态；失败声明在锁内幂等完成，使 `on_error`、后续 `on_close` 和最终 `stop()` 最多触发一次重连或一次 fatal。
  - 从 SDK result 提取并脱敏 status code、code、message、request ID；鉴权、权限、参数、欠费、模型不存在/不可用/禁用等永久错误优先立即 fatal，限流、超时、网络、WebSocket、内部服务和 5xx 错误才进入最多三次指数退避。未知 SDK/传输错误仍受相同上限约束。
  - task-failed 后从当前 Provider 分离 SDK client，并不再调用其 `stop()`；预期的 `InvalidParameter` 只形成隐藏 Debug，不向用户报错。
  - 用局部 DashScope 1.26.x 适配器隔离 SDK 内部状态：仅活动 task 可 stop；task-failed 时取消 1.26.7 遗留的非 daemon silence timer。访问私有字段使用 `getattr`/`setattr` 降级，未来 SDK 小版本缺少字段时不会因清理再次失败。
  - 重连成功接收首个服务端事件后重置连续失败计数；旧 generation 的迟到回调继续忽略。
- `engine/tests/test_fun_asr_provider.py`
  - 将伪客户端补齐可停止/失败清理能力及结构化 SDK 结果。
  - 新增真实顺序 `on_error → on_close → stop` 测试，验证永久失败只上报一次、无重连、失败 client 不 stop、停止事件只一次且密钥不泄漏。
  - 新增同 generation 重复 `on_error` 后再 `on_close` 仍只启动一次重连、鉴权/权限/模型不可用/限流/服务不可用分类表、`ModelUnavailable + HTTP 503` 仍按永久错误立即终止，以及生产 SDK 适配器取消失败 timer 且不 stop 的测试。
- `engine/tests/test_protocol_output.py`
  - 覆盖隐藏 debug command 和版本化错误 diagnostic envelope。

#### fatal 正常退出与跨平台进程树

- `engine/core/session.py`
  - Provider `start()` 后先发布 pending fatal；只有共享状态仍为 running 才启动音频采集。
- `engine/main.py`
  - Provider fatal 将共享状态改为 `stop` 并走 Session 正常清理，不再在 Session 返回后输出 `kill` 要求 Electron 立即强杀。
- `engine/tests/test_engine_core.py`
  - 新增启动阶段 fatal 不启动采集、运行中 fatal 退出循环，且两条路径均关闭 Provider、翻译服务和音频资源的测试。
- `src/main/engine/EngineProcessControl.ts`
  - 新增可注入、可测试的进程树策略：POSIX 校验 PID 后向 `-pid` 进程组发送 SIGKILL；Windows 调用 taskkill tree 适配器。
- `src/main/utils/CaptionEngine.ts`
  - macOS/Linux 以 detached 子进程建立独立 PyInstaller 进程组；强杀覆盖整个组。Windows 从 shell 字符串 `exec` 改为 `execFile('taskkill', ['/pid', pid, '/t', '/f'])`。
  - close 日志同时记录 exit code 和 signal，便于区分正常退出与强杀。
- `tests/node/engineProcessControl.test.mjs`
  - 覆盖 POSIX 独立组策略、负 PID kill、Windows tree kill 和非法 PID 拒绝；在 POSIX 上实际启动 detached Node 父子进程，验证组 SIGKILL 后两者均不存在。

#### 文档、基线和 Lint 记录

- `docs/api-docs/caption-engine.md`
  - 记录 `debug`、可选错误 diagnostic、Fun-ASR generation 幂等顺序、错误分类和兼容性。
- `docs/api-docs/electron-ipc.md`
  - 记录 Debug 导出 IPC、可见/隐藏日志边界、脱敏规则和 application 去重语义。
- `docs/engine-manual/architecture.md`、`docs/engine-manual/zh.md`、`en.md`、`ja.md`
  - 同步 Provider 生命周期、SDK 1.26.7 隔离、fatal 正常退出和跨平台强杀策略。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`
  - 同步说明完整 Debug 保存按钮、只隐式显示 DEBUG、清空表格与会话文件的区别、导出时点和凭据脱敏。
- `README.md`、`README_en.md`、`README_ja.md`
  - 三语功能列表增加隐式 Debug 会话及按启动导出能力。
- `docs/testing.md`
  - 更新 Node/Python 离线覆盖与仍未覆盖的真实进程/云端范围。
- `docs/CHANGELOG.md`
  - 在未发布条目记录本批次用户可见功能和修复。
- `eslint-suppressions.json`
  - `Log.ts` 改用 unknown 并补齐显式返回类型后，执行 ESLint 官方 prune 清除该文件已失效的 suppression；未新增 suppression。
- `change.md`
  - 追加本批次完整变更记录。

### 修改前后行为

- 修改前：日志系统没有 DEBUG 级别持久化；关闭或刷新日志页后缺少本次启动的完整诊断；Fun-ASR SDK 结构化失败信息没有保留。
- 修改后：应用启动即创建 `userData/debug-logs/debug-<ISO>.jsonl`，DEBUG/INFO/WARN/ERROR 全部进入该文件；日志页仍只显示既有 INFO/WARN/ERROR。用户可将点击时为止的完整当前会话另存为 `.jsonl`。
- 修改前：侧栏滑块变化、配置回显和重复值均可能触发 `Set application config` INFO 与广播，调整窗口/布局时形成刷屏。
- 修改后：拖动期间只本地预览，结束提交一次；Renderer 回填不反向发送，主进程深度相同配置不保存、不广播，真实变化只留下隐藏 DEBUG。
- 修改前：同一 Fun-ASR task-failed 的 `on_error`、`on_close` 和 Session `stop()` 可重复消耗重试、重复上报，失败 task 再 stop 产生用户可见 `InvalidParameter`；fatal 后 Electron 收到 `kill` 并立即强杀。
- 修改后：每个 generation 只能决定一次失败结果；失败 task 只做 abort 清理且不 stop；永久错误立即 fatal，暂时错误有界重试；预期 InvalidParameter 隐藏。fatal 先走 Python 正常资源关闭，只有停止超时/启动超时等异常路径才强杀完整进程树。

### 配置、IPC、协议、数据结构与兼容性

- 配置 schemaVersion、持久字段、默认值和迁移函数均无变化；只改变 application 相同值的处理和滑块发送时机，不需要配置迁移。
- 新增 Renderer→Main 调用式 IPC `control.debugLog.export`，无请求参数，返回 `saved/canceled/unavailable/failed`；保存路径由主进程系统对话框选择。
- Python→Electron stdout 协议新增可选 `debug` command，以及可选 `error.diagnostic`/`debug.details`；所有旧 command 与字段均未改名或删除。旧自定义引擎无需产生新字段；新 Electron 仍接受旧 error 格式。
- Python 内部事件联合新增 `ProviderDebug`，`ProviderError.details` 有默认值，对现有 Provider 调用向后兼容。
- Python CLI 参数、TCP command、字幕/翻译数据结构、热词配置与远端资源语义无变化。
- macOS/Linux bundled/custom 引擎现在作为独立进程组启动；pipe/stdout/TCP 行为不变。Windows 继续整树强杀，但改用无 shell 的参数数组，减少命令注入面。
- 没有新增、删除或升级依赖；DashScope 继续使用项目显式锁定版本。SDK 私有 timer 清理被限制在局部适配器内，且缺少字段时安全降级。
- 精确回滚：恢复本条列出的代码、测试和文档文件并恢复 `eslint-suppressions.json` 对应旧条目即可；无需配置迁移。回滚会重新引入 Debug 不可导出、application 刷屏、Fun-ASR 重复回调处理和 POSIX 只杀单 PID 的问题。

### 验证记录

- 开发中首次 Python 测试出现 1 个失败：新增 `ProviderDebug` 排在原有 `ProviderReady` 前导致旧断言读取首事件失败；调整为保持原 Ready 顺序后通过。该失败没有隐藏为成功。
- 开发中首次 TypeScript 检查曾发现无父窗口 `showSaveDialog` 重载和之后的 DEBUG 联合类型未收窄问题；分别用有/无 BrowserWindow 分支及 `VisibleLogLevel` 类型谓词修复。
- 开发中首次 Lint 报告 `Log.ts` 新方法缺少 7 处显式返回类型；补齐后 Lint只提示旧 suppression 已失效，执行 `npx eslint --cache . --prune-suppressions` 后通过。
- 完成审计补强测试首次运行失败：Node strip-only 不支持 TypeScript 构造器参数属性，Lint 同时拒绝测试 finally 中的空 catch；改为显式类字段和明确 ESRCH 断言后聚焦测试通过。该失败没有记为成功。
- `npm run test:node`：前一轮 49/49；补强日志路由、配置同步和真实 POSIX 进程组后最终 53/53。
- `npm run test:python`：前一轮 54/54；补强运行中 fatal、重复 on_error、错误分类表和 SDK timer 适配器后最终 57/57。
- `npm run typecheck`：最终通过，Node TypeScript 与 Vue TypeScript 均无错误。
- `npm run lint`：最终通过，无新增 ESLint 错误或 suppression。
- `npm run verify`：全部审计测试加入后最终通过；typecheck、Lint、Node 53/53、Python 57/57 全部成功。
- `npm run build`：最终代码通过；Electron main、preload、renderer 生产构建成功，分别转换 26、1、3260 个模块。
- `git diff --check`：在代码和文档变更完成后通过；追加本记录后再次执行并记录最终结果。
- 验证保留 npm 既有 mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；二者未造成测试或构建失败，本批次未扩大范围修改 package/module 策略。

### 未执行、风险与后续事项

- 未连接真实 Fun-ASR 服务、麦克风或系统音频，未产生云端费用；错误分类与回调顺序均使用伪 SDK client/result 离线验证。发布前应显式使用测试账号分别验收鉴权失败、模型不可用、限流/5xx 和正常 stop。
- 未运行真实 PyInstaller 子进程的启动超时与正常停止，也未在 Windows/Linux 实机验证；POSIX 组强杀已用 detached Node 父子进程验证无遗留。发布前仍应在三平台打包产物上验证正常 fatal 的 exit code/signal，以及超时路径无遗留 PyInstaller 子进程。
- 未启动 Electron GUI 点击保存对话框或视觉验收按钮；类型、三语键一致性和生产构建已覆盖，仍建议做一次桌面交互回归，确认取消、覆盖文件和无写权限路径的提示。
- Debug 会话采用同步逐条 append，优先保证崩溃前记录和导出一致性。当前 DEBUG 量低且 application 高频相同值已被抑制；如未来引入高频逐帧 DEBUG，应先测量 I/O 再改为带 flush/背压的异步 writer，不能无界缓存。
- 每次启动产生独立内部会话文件，目前不自动删除历史 Debug 文件，避免未经用户同意销毁诊断。后续如需保留策略，应单独定义数量/容量上限、用户可见说明和安全删除测试。
- DashScope 1.26.7 非 daemon silence timer 清理依赖 SDK 私有实现，已通过局部适配和缺字段降级降低风险；升级 SDK 时必须重新检查 task-failed 回调顺序和 timer 行为。

### 关键外部文档与技术决策来源

- 阿里云百炼 Fun-ASR Realtime Python SDK 文档：`https://help.aliyun.com/zh/model-studio/fun-asr-realtime-python-sdk`，用于确认官方 SDK 的 start/send/stop 与 callback 语义。
- 阿里云百炼 Fun-ASR Realtime WebSocket API：`https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api`，用于错误结果、task 生命周期和地域端点边界。
- 项目锁定的 DashScope 1.26.7 本地实现：用于复现 task-failed 后 `_running` 与 `_silence_timer` 的实际状态；未通过猜测改写裸 WebSocket。
- Node.js `child_process` detached 文档：`https://nodejs.org/api/child_process.html#optionsdetached`；POSIX `kill(2)` 进程组语义：`https://man7.org/linux/man-pages/man2/kill.2.html`。
- 用户提供的 15:27:51–15:28:17 日志和错误截图：确认真实顺序为三次任务启动/重连耗尽、重复最终失败、随后 stop InvalidParameter、Electron 强杀且进程延迟退出。
- 根目录 `AGENTS.md`：决定凭据必须脱敏、协议增量兼容、三语文档同步、离线测试边界、跨平台说明和本记录内容。

## 2026-08-13 - V2.7.0 小版本与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.6.0` 提升到 `2.7.0`，并生成 macOS arm64 构建产物。
- 明确非目标：本次用户未要求依赖检查或升级，因此不主动执行依赖治理；不创建 git tag、commit、branch、PR 或 Release；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有大量未提交改动，包含 Debug 日志、配置同步、Fun-ASR 生命周期、协议文档、进程树控制、测试和三语文档；本批次保留这些改动，只在当前工作区基础上叠加版本号、文档版本标识和 macOS arm64 构建产物。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.7.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.7.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.7.0`；保留本批次前已有的 Debug 日志功能说明。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.7.0`；保留本批次前已有的完整 Debug 日志保存说明。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.7.0`；保留本批次前已有的 Fun-ASR generation 幂等和 debug 协议说明。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.7.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.7.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.7.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.7.0` 路径、大小、sha512 与 releaseDate。
- `change.md`
  - 追加本批次授权、修改范围、构建上下文、验证、风险和回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.7.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.7.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.6.0` / `v2.6.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.7.0` / `v2.7.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；构建使用项目本地 `node_modules` 与 `engine/.venv`，仅在项目目录生成和更新构建产物。

### 兼容性、迁移与回滚

- 本批次只更新发布版本并重新构建 macOS arm64 包，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 Intel x64 或 universal 包。
- 当前构建基于工作区已有的 `electron@43.4.0` 与 `electron-builder@26.15.3`；自动化测试与打包通过，但未在真实安装后的 GUI 中做 Electron 43 交互回归。
- Electron Builder 26 不再提供旧的 `node_modules/app-builder-bin/mac/app-builder_arm64` 路径；本批次继续使用 `app-builder-lib/out/targets/blockmap/blockmap` 的 `buildBlockMap` API 刷新签名后 zip/DMG 的 blockmap。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.6.0`；恢复 `package.json` 和 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.7.0` 构建产物；如需恢复旧包，使用此前 `2.6.0` 产物或按旧版本号重新构建。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区开局已有大量未提交修改，需要保留。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.7.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.6\\.0|v2\\.6\\.0|auto-caption-2\\.6\\.0|Auto Caption-2\\.6\\.0" ...`：应用版本相关文件无旧版本残留；历史 `docs/CHANGELOG.md` 条目和 `package-lock.json` 中依赖自身版本 `mime@2.6.0` 与应用版本无关。
- `npm run verify`：通过；TypeScript、ESLint、Node 53/53 和 Python 57/57 全部成功；保留既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，分别转换 26、1、3260 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内因 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，基于 `electron@43.4.0` 与 `electron-builder@26.15.3` 生成 `.app`、zip、DMG 和初始 blockmap。构建日志提示 duplicate dependency references，并提示缺少 Developer ID 签名证书；未导致构建失败。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.7.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.7.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.7.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "const { buildBlockMap } = require('./node_modules/app-builder-lib/out/targets/blockmap/blockmap'); ..."`：通过，生成最终 zip 和 DMG blockmap；最终 zip size `224887308`、sha512 `ZscQMJUzfwGBx+xGsx2hfFn+R9aa78Brk1V/i2HsWcWKR6fxFEO1AA6R9qc55JmxMLzv9yRbJYQZR9TKfibK7w==`；最终 DMG size `244878808`、sha512 `Bd3eAztFwmL8ka/RjEmJ6pki9FGQGDcXN8J5crsheSU5jB9ApLuOOtNG9l2j3rBlM1x+NnvT0dFO0078Q+veGg==`。
- `hdiutil verify dist/auto-caption-2.7.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.7.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.7.0.dmg dist/Auto Caption-2.7.0-arm64-mac.zip`：
  - DMG：`3ba131fc5dbe7479735436bd94117ec9e5ef7d63c464987f80731065fb64388e`
  - ZIP：`75050ee7194db8d85984d2b4a0870b698eed998275fb9f0fb5c73b3765bc1bfc`
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API 或热词远端资源；本批次验证到自动化测试、生产构建、引擎 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议使用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.7.0` 包已验证。
- 当前工作区已有 Electron 43 / Electron Builder 26 大版本依赖状态，并且包含本批次前已有的大量功能改动；虽然本次测试和打包通过，仍建议在发布前做安装包级 GUI 回归，尤其关注窗口生命周期、权限提示、自动更新、Debug 日志导出和内置 Python 引擎启动路径。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`：确认版本源、当前 Electron/Electron Builder 解析版本和 npm 脚本。
- 本地 `electron-builder.yml`：确认当前平台化 `extraResources` 配置会把 macOS/Linux 引擎打包到 `Resources/engine/main`。
- Electron Builder 26 本地模块 `app-builder-lib/out/targets/blockmap/blockmap`：用于刷新签名后产物 blockmap。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循修改前检查、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。

## 2026-08-13 - 字幕稳定 ID 与幂等实时更新

### 授权与目标

- 用户确认 Vue 实时更新按 `time_s` 匹配失败，并要求采用稳定 `captionId` 方案完成修复。
- 变更类型：修复、协议、测试、文档。
- 目标：把字幕永久身份与显示序号分离；同一句 partial/final 即使时间戳变化也更新同一条记录；翻译优先按稳定 ID 关联；旧自定义引擎缺少新字段时仍可按 `time_s` 回退。
- 明确非目标：不修改 Fun-ASR 音频采集、分帧、VAD 或服务端流式参数；不升级依赖；不调用真实云端 API；不创建分支、commit、PR 或发布包。

### 修改文件与原因

- `src/shared/types.ts`、`src/shared/captions.ts`
  - 为 `CaptionItem` 增加永久 `captionId`，并提供 Renderer 可复用的按 ID 幂等 upsert；`index` 继续仅作为用户可见行号。
- `src/main/engine/captions/CaptionLog.ts`
  - 新增主进程字幕模型，维护 `captionId -> position` 映射；使用 `${engineRunId}:${engineCaptionId}` 组合身份；清空时同步清除数组和映射；翻译优先使用 ID，只有缺少 ID 时才回退扫描 `time_s`。
- `src/main/utils/CaptionEngine.ts`
  - 每次引擎启动递增运行序号，并把当前 `engineRunId` 传入字幕和翻译处理，避免 Python 重启后复用 sentence ID 造成碰撞。
- `src/main/utils/AllConfig.ts`、`src/main/ControlWindow.ts`
  - 用新的主进程字幕模型替代“只比较最后一条”和按时间戳更新翻译的逻辑；字幕与翻译统一广播完整的 `both.captionLog.upsert`；清空操作改为同时清除位置映射。
- `src/main/engine/protocol/messages.ts`
  - 翻译消息新增可选数值 `caption_id` 并执行运行时类型校验；保留原 `time_s` 字段和旧格式兼容。
- `src/renderer/src/stores/captionLog.ts`
  - 合并旧的 add/upd 监听为幂等 upsert；更新目标只按 `captionId` 查找，找不到时插入，以便窗口漏过首次事件后由后续事件自愈。
- `src/renderer/src/views/CaptionPage.vue`、`src/renderer/src/components/CaptionStyle.vue`、`src/renderer/src/components/CaptionLog.vue`
  - Vue 列表和表格行键统一改用 `captionId`，不再使用可变时间戳或显示序号作为身份。
- `engine/services/translation.py`、`engine/utils/translation.py`
  - 内置翻译链路把 `CaptionFinal.caption_id` 原样写入 translation 事件；仍同时输出 `time_s` 供旧 Electron/兼容诊断使用。
- `tests/node/captionLog.test.mjs`、`tests/node/engineProtocol.test.mjs`
  - 覆盖同 ID 时间戳变化、时间戳碰撞、跨引擎运行 ID 重复、翻译 ID/旧格式回退、清空映射、Renderer 漏 add 自愈，以及可选字段协议校验。
- `engine/tests/test_translation_service.py`
  - 覆盖内置翻译适配器向翻译事件传递稳定 caption ID。
- `docs/api-docs/caption-engine.md`、`docs/api-docs/electron-ipc.md`、`docs/CHANGELOG.md`
  - 记录 Python/Electron 稳定 ID 语义、可选翻译字段、旧引擎回退策略、统一 IPC upsert 和用户可见修复说明。
- `change.md`
  - 追加本批次授权、协议兼容、验证、风险和回滚记录。

### 修改前后行为

- 修改前：Electron 只在新消息 `index` 等于上一条时替换数组末项；Renderer 的 upd 再按 `time_s` 查找。Fun-ASR 修正 partial 的开始时间后，同一句后续文本找不到首个记录，表现为每句话只保留第一个字或产生碎片。
- 修改后：引擎一次运行内的原始 `index` 与 `engineRunId` 组合成永久 `captionId`。主进程与 Renderer 都只按该 ID upsert；`time_s`、`time_t`、正文和翻译可变化而身份不变。
- 修改前：翻译异步结果只按 `time_s` 从后向前扫描，时间修正或碰撞时会漏更新或更新错句。
- 修改后：内置翻译携带原句 `caption_id`，Electron 加入运行作用域后精确更新；旧自定义引擎没有该字段时才使用原有 `time_s` 回退。
- 修改前：清空字幕只清数组，若引入位置映射会留下陈旧状态。
- 修改后：清空操作由字幕模型统一处理，数组与 ID 映射原子清空；下一个字幕重新从显示序号 1 开始。

### 配置、IPC、协议、数据结构与兼容性

- 配置 schemaVersion、持久化字段、默认值和迁移函数均无变化；无需用户配置迁移。
- `CaptionItem` 新增必填内部字段 `captionId: string`；原 `index`、时间、正文和翻译字段保留，`index` 的公开含义收窄为显示序号。
- Python stdout 的 `translation` command 新增可选数值 `caption_id`；原 command 名称及 `time_s`、`text`、`translation` 字段均保留。内置引擎产生新字段，旧自定义引擎不产生时由 Electron 兼容回退。
- Electron→Renderer 的增量字幕 IPC 由 `both.captionLog.add` / `both.captionLog.upd` 合并为 `both.captionLog.upsert`；全量初始化数据仍由现有配置快照提供，清空 IPC 名称不变。
- 回退兼容层的删除条件：当自定义引擎协议完成明确版本迁移、文档和生态确认全部提供稳定字幕 ID 后，才可在独立变更中移除 `time_s` 回退；本批次不删除旧协议字段。
- 没有新增、删除或升级依赖；没有修改命令行参数、TCP command、热词、凭据或远端资源行为。
- 精确回滚：恢复本条列出的 TypeScript、Vue、Python、测试和文档文件，并删除新增的 `CaptionLog.ts`、`captions.ts`、`captionLog.test.mjs`。回滚不需要配置迁移，但会恢复按可变时间戳关联导致的实时字幕缺字风险。

### 验证记录

- `node --test --experimental-strip-types tests/node/captionLog.test.mjs tests/node/engineProtocol.test.mjs`：通过，9/9。
- `engine/.venv/bin/python -m pytest engine/tests/test_translation_service.py engine/tests/test_caption_runtime.py`：通过，6/6。
- `npm run typecheck`：通过；Node TypeScript 与 Vue TypeScript 均无错误。
- `npm run lint`：通过，无新增 ESLint 错误。
- `npm run test:node`：通过，58/58；覆盖新增字幕模型、协议与既有主进程行为。
- `npm run test:python`：通过，60/60；覆盖新增翻译 ID 传递与既有引擎行为。
- `npm run build`：通过；包含 typecheck，Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `npm run verify`：最终通过；typecheck、Lint、Node 58/58 与 Python 60/60 全部成功。
- `rg -n "both\\.captionLog\\.(add|upd|upsert)|captionLog\\[.*time_s|:key=.*time_s|row-key" src tests docs engine`：确认活动代码和文档只保留统一 upsert，Vue key 不再依赖 `time_s`。
- `git diff --check`：代码与文档修改完成后通过；追加本记录后在最终审计再次执行。
- 验证保留 npm 既有 mirror 配置弃用警告与 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致测试或构建失败，本批次未扩大范围修改包管理配置。

### 未执行、风险与后续事项

- 未连接真实 Fun-ASR、麦克风、QuickTime、Loopback 或 BlackHole，未产生云端费用；本批次用固定协议事件离线覆盖 partial/final、翻译和重启碰撞。发布前建议用用户本次音频重复一次 GUI 回归，确认表格、字幕浮窗与导出均只形成完整句子。
- 未在 Windows/Linux 实机运行 GUI，也未重新打包 Python/Electron 安装包；TypeScript、Python 自动化测试和当前 macOS 上的生产构建已通过，不能据此声称三平台安装包已实机验证。
- 手工“修改时间”目前仍是 Renderer 本地编辑；稳定 ID 保证晚到翻译关联到正确字幕，但若编辑期间仍有同一句完整字幕事件到达，服务端最新时间仍会覆盖本地尚未持久化的显示时间。若要把手工时间编辑提升为跨窗口主状态，应作为独立功能定义提交/冲突语义和 IPC 校验。
- 旧自定义引擎的 `time_s` 回退只能保持既有能力，时间碰撞本身仍存在歧义；要获得完整可靠性，自定义引擎也应按更新后的协议输出稳定 `index` 和 translation `caption_id`。

### 关键技术决策来源

- 用户提供的 Debug JSONL、字幕 JSON、音频波形和多轮截图：确认音频中段空白来自原文件无声，而“每句仅首字”来自 UI 增量更新关联失败，不是 Fun-ASR 音频流断裂。
- 当前 Python Provider 的 `CaptionFinal.caption_id` 与 Fun-ASR sentence ID：确认 partial/final 已有可复用的句级稳定身份，不需要再用回调时间构造 ID。
- 根目录 `AGENTS.md`：决定主进程保持稳定字幕 ID、翻译只关联稳定 ID、协议增量兼容、清空映射、测试和文档记录范围。

## 2026-08-14 - V2.9.0 小版本与 macOS arm64 构建

### 授权与目标

- 用户要求“编译一下Mac版本 并更新小版本号”。
- 变更类型：构建、配置、文档、测试。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.8.0` 提升到 `2.9.0`，并生成 macOS arm64 构建产物。
- 明确非目标：本次用户未要求依赖检查或升级，因此不主动执行依赖治理；不创建 git tag、commit、branch、PR 或 Release；不做 Windows、Linux、macOS x64/universal 构建；不调用真实麦克风、识别云服务、翻译云服务或远端热词资源。
- 修改前工作区已有未提交改动，包含字幕稳定 ID、翻译关联、协议、主进程/Renderer 字幕模型、测试和文档；本批次保留这些改动，只在当前工作区基础上叠加版本号、文档版本标识和 macOS arm64 构建产物。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.9.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本到 `2.9.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.9.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册版本标识到 `v2.9.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册版本标识到 `v2.9.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.9.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.9.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.9.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.9.0` 路径、大小、sha512 与 releaseDate。
- `change.md`
  - 追加本批次授权、修改范围、构建上下文、验证、风险和回滚记录。
- 生成产物：
  - `engine/dist/main`：PyInstaller 生成的 macOS arm64 Python 引擎可执行文件。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用。
  - `dist/Auto Caption-2.9.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.9.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.8.0` / `v2.8.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.9.0` / `v2.9.0`。
- 本批次没有新增或删除用户配置字段，没有修改配置迁移、IPC、Python stdout/TCP 协议、命令行参数、字幕数据结构、热词语义或远端资源操作。
- 未修改系统环境；构建使用项目本地 `node_modules` 与 `engine/.venv`，仅在项目目录生成和更新构建产物。

### 兼容性、迁移与回滚

- 本批次只更新发布版本并重新构建 macOS arm64 包，不涉及用户配置迁移。
- macOS 产物为 arm64；未生成 Intel x64 或 universal 包。
- 当前构建基于工作区已有的 `electron@43.4.0` 与 `electron-builder@26.15.3`；自动化测试与打包通过，但未在真实安装后的 GUI 中做 Electron 43 交互回归。
- Electron Builder 26 不再提供旧的 `node_modules/app-builder-bin/mac/app-builder_arm64` 路径；本批次继续使用 `app-builder-lib/out/targets/blockmap/blockmap` 的 `buildBlockMap` API 刷新签名后 zip/DMG 的 blockmap。
- 由于没有 Developer ID 证书，本次只做本地 ad-hoc 签名，未做 Apple Developer ID 签名或 notarization。首次打开可能仍需用户通过 macOS 安全提示手动允许。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.8.0`；恢复 `package.json` 和 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.9.0` 构建产物；如需恢复旧包，使用此前 `2.8.0` 产物或按旧版本号重新构建。

### 验证记录

- `git status --short --branch`：已执行；确认当前在 `main...origin/main`，且工作区开局已有未提交修改，需要保留。
- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.9.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.8\\.0|v2\\.8\\.0|auto-caption-2\\.8\\.0|Auto Caption-2\\.8\\.0" ...`：应用版本相关文件无旧版本残留；历史 `docs/CHANGELOG.md` 条目和 `package-lock.json` 中依赖自身版本 `@peculiar/asn1-schema@2.8.0` 与应用版本无关。
- `npm run verify`：通过；TypeScript、ESLint、Node 58/58 和 Python 60/60 全部成功；保留既有 `MODULE_TYPELESS_PACKAGE_JSON` 性能警告。
- `npm run build`：通过；Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，生成 `engine/dist/main`；保留既有 `pycparser` 可选隐藏导入警告和 `@rpath/libomp.dylib` 解析警告。
- `engine/dist/main --help`：经用户授权在沙盒外运行后通过，CLI help 正常输出。
- `./node_modules/.bin/electron-builder --mac`：沙盒内因 `npmmirror.com` DNS 失败；经用户授权沙盒外重试后通过，基于 `electron@43.4.0` 与 `electron-builder@26.15.3` 生成 `.app`、zip、DMG 和初始 blockmap。构建日志提示 duplicate dependency references，并提示缺少 Developer ID 签名证书；未导致构建失败。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：二者均为 Mach-O 64-bit executable arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.9.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，本地 ad-hoc 签名完成。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，`.app` valid on disk 且 satisfies its Designated Requirement。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.9.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.9.0.dmg`：通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "const { buildBlockMap } = require('./node_modules/app-builder-lib/out/targets/blockmap/blockmap'); ..."`：通过，生成最终 zip 和 DMG blockmap；最终 zip size `224898981`、sha512 `+1lw3Izl++neIsXi0+nX06bH9iPDpim0GZ8qtaDPPTTTqEE4cUZWY0EP6iC0GooDKGD1NFAgfM5eTZiJ/yM0hw==`；最终 DMG size `244694849`、sha512 `HOuqOViYy0O8Eg6PVV/Z5Xhb/++KHoPd4kERtQ6UtPW7t6bBxyrPxoCz+AWIjt6jVSfkwc9Z20M0xJPafYNI7g==`。
- `hdiutil verify dist/auto-caption-2.9.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.9.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.9.0.dmg dist/Auto Caption-2.9.0-arm64-mac.zip`：
  - DMG：`17247485c4d55b0d708c3b503d6cf7968d6dd65b54c550a84fe3c1ab4d2ffcf3`
  - ZIP：`929098bc166617906c223088df835b7ba4d5abb2d30fc4909cc7e3aaed61c673`
- `git diff --check`：通过，无空白错误。

### 未执行、风险与后续事项

- 未启动安装后的真实 Electron GUI，也未测试麦克风、系统音频权限、真实识别、真实翻译 API 或热词远端资源；本批次验证到自动化测试、生产构建、引擎 help、签名和安装包完整性。
- 未做 Apple Developer ID 签名和 notarization；若面向外部分发，建议使用正式证书重新签名、公证并再次生成/校验 DMG 与 zip。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.9.0` 包已验证。
- 当前工作区已有 Electron 43 / Electron Builder 26 大版本依赖状态，并且包含本批次前已有的字幕稳定 ID 和翻译关联改动；虽然本次测试和打包通过，仍建议在发布前做安装包级 GUI 回归，尤其关注字幕浮窗、字幕记录表格、导出文件、异步翻译关联和内置 Python 引擎启动路径。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`：确认版本源、当前 Electron/Electron Builder 解析版本和 npm 脚本。
- 本地 `electron-builder.yml`：确认当前平台化 `extraResources` 配置会把 macOS/Linux 引擎打包到 `Resources/engine/main`。
- Electron Builder 26 本地模块 `app-builder-lib/out/targets/blockmap/blockmap`：用于刷新签名后产物 blockmap。
- macOS 本机 `codesign`、`hdiutil`、`ditto` 与 Electron Builder 输出：确认最终 `.app`、zip、DMG 的签名、镜像和压缩包完整性。
- 根目录 `AGENTS.md`：遵循修改前检查、系统环境不修改、三语文档同步、构建产物记录和 `change.md` 追加记录要求。

## 2026-08-15 - 全字幕引擎与 SDK 完整错误诊断日志

### 用户授权与目标

- 用户明确要求“fix，将所有错误详情都完整保留到 debug 日志中，包括所有的字幕引擎以及 SDK 的报错”。
- 变更类型：修复、重构、测试、文档。
- 目标：统一保留 Gummy、Fun-ASR、GLM、Vosk、SOSV、音频采集、异步翻译、热词 Worker、Provider/Session 清理和 Python/Electron 子进程错误的可诊断内容；错误通知继续保持简洁，完整详情只进入本次 Debug JSONL 或既有 stderr 错误记录。
- 安全边界：用户要求的“完整”按项目安全约束解释为“凭据脱敏并有界保护后的完整诊断”。API Key、Token、密码、Authorization、Cookie 和二进制音频正文禁止进入日志；未调用真实云端 API，未安装或升级依赖，未修改远端资源。

### 修改文件与原因

- `engine/core/diagnostics.py`、`engine/core/__init__.py`
  - 新增统一诊断序列化入口。异常保留类型、模块、消息、参数、自定义属性、完整 traceback、cause/context；SDK 对象保留实例属性及常见公开字段；字节数据只保留类型和长度。
  - 递归脱敏显式运行凭据及敏感字段/文本，并对循环引用、非有限数值、不可访问属性和失败的 `repr` 做安全降级。单字符串、集合项数和嵌套深度采用 64 KiB、256 项和 8 层的明确上限及截断标记。
- `engine/core/session.py`、`engine/core/audio.py`
  - Provider 运行/停止、翻译关闭、音频流关闭、音频采集/录音关闭/关闭信号异常均附带结构化诊断，不再只保留异常类名或让清理异常覆盖原错误。
- `engine/providers/gummy.py`
  - 将 DashScope `on_error(message)` 原样送入安全 SDK 序列化，不再丢弃服务端状态、错误码、消息和 request ID 等字段。
  - Gummy start、send_audio_frame、stop 和回调处理异常均记录 operation、异常属性与 traceback；每次 SDK 音频发送失败写隐藏 Debug 事件，最终 fatal 复用同一诊断。
- `engine/providers/fun_asr.py`
  - 在既有 status/code/message/requestId 之上保留完整 SDK result；start、send、reconnect、stop、失败 client 清理和回调解析异常均保留 traceback 和 SDK/异常属性，同时继续按 generation 幂等处理失败。
- `engine/providers/glm.py`
  - HTTP 非成功响应改用 `raise_for_status()`，使 requests 的 response/status/reason/headers/body 等可序列化诊断可由统一入口捕获；client 初始化和异步请求错误附带已脱敏的完整异常详情。
- `engine/providers/registry.py`、`engine/main.py`
  - 为 Provider runtime 增加内部 diagnostic handler，将翻译和音频的隐藏诊断统一映射为 `ProviderDebug`，避免各服务直接拼装 stdout。
- `engine/services/translation.py`、`engine/utils/translation.py`
  - 移除 Ollama/OpenAI 兼容/Google 翻译适配器内部吞错，让有界翻译服务统一生成简洁 warning 和脱敏完整诊断；稳定字幕 ID 和成功翻译输出格式不变。
- `engine/services/hotwords.py`、`src/main/services/HotwordService.ts`
  - 热词 Worker 对校验、模型不匹配和 SDK 异常向私有 stderr 写入脱敏 JSON 诊断，同时保持 stdout 的稳定 `HotwordResponse` 不变；Electron 使用增量 UTF-8 解码收集 Worker stderr，仅写 Debug 日志。
  - Electron 侧 Worker spawn、stdin、响应解析错误保留完整 JavaScript Error name/message/stack/cause/自定义字段。
- `engine/protocol/server.py`
  - TCP command server 的 client/start 异常向 stderr 输出结构化 traceback，而不再只写 `str(error)`。
- `engine/sysaudio/darwin.py`、`engine/sysaudio/win.py`
  - 16 kHz 设备打开失败但可回退默认采样率时，写入隐藏 `debug` 诊断并记录 fallbackSampleRate；Windows WASAPI fatal 初始化异常保留结构化 stderr traceback。
- `src/main/utils/UtilsFunc.ts`
  - 扩展递归脱敏/序列化，完整保留 JavaScript Error stack、cause 和自定义属性，支持 Map、Set、BigInt、循环引用及显式运行密钥替换；新增从实际字幕引擎参数数组提取敏感值的安全工具。
- `src/main/utils/CaptionEngine.ts`
  - 字幕引擎 stderr 改用 `StringDecoder` 跨 Buffer 解码，保留 UTF-8 多字节字符、多行 Python traceback 和 SDK 自有日志；使用本次实际命令行密钥及 `DASHSCOPE_API_KEY` 做精确二次脱敏。
- `engine/tests/test_diagnostics.py`
  - 新增异常 traceback/cause/自定义属性、SDK callback 字段、二进制摘要和凭据脱敏的统一诊断测试。
- `engine/tests/test_engine_core.py`、`engine/tests/test_gummy_provider.py`、`engine/tests/test_fun_asr_provider.py`、`engine/tests/test_glm_provider.py`、`engine/tests/test_hotword_service.py`、`engine/tests/test_translation_service.py`
  - 覆盖 Session、音频、Gummy callback/send、Fun-ASR SDK result、GLM worker、热词私有 stderr 和翻译线程的完整诊断与凭据不泄漏；既有生命周期、字幕和重连测试继续回归。
- `tests/node/debugLogSession.test.mjs`、`tests/node/utilsFunc.test.mjs`
  - 覆盖 JavaScript Error cause/自定义 SDK response、递归字段、实际命令密钥提取和 SDK stderr 精确脱敏。
- `docs/api-docs/caption-engine.md`、`docs/api-docs/electron-ipc.md`
  - 记录可选 `error.diagnostic`/`debug.details` 的通用异常与 SDK 字段、stderr 增量解码、大小上限和凭据/二进制安全边界。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步中英日三语说明所有内置引擎及 SDK 的 Debug 诊断范围和脱敏限制。
- `README.md`、`README_en.md`、`README_ja.md`、`docs/CHANGELOG.md`
  - 同步中英日功能摘要和未发布变更说明。
- `change.md`
  - 追加本批次授权、范围、协议兼容、安全、验证和回滚记录。

### 修改前后行为

- 修改前：Gummy `on_error(message)` 在 Provider 边界被直接丢弃，日志只能看到 `Gummy callback reported an error`；Fun-ASR 只保留选定服务字段；GLM、Vosk、SOSV、音频、翻译和多个清理路径通常只记录异常类型，热词 SDK stderr 被完全丢弃。
- 修改后：相同错误的用户可见 `content` 仍保持简洁；Debug JSONL 同时保存 `operation`、SDK result、服务字段、异常类型/模块/消息/参数/属性、traceback 和 cause/context，可直接定位服务端拒绝、HTTP 响应、SDK 状态和本地调用点。
- 修改前：Electron 对 Python stderr 直接按任意 Buffer 调用 `toString().split('\n')`，UTF-8 字符和 traceback 行可能被进程数据块拆散；热词 Worker stderr 无条件忽略。
- 修改后：字幕引擎和热词 Worker 均使用增量 UTF-8 解码；收到的 stderr 内容在凭据精确替换后完整进入当前 Debug 会话。热词 stdout 公共返回值仍只包含稳定错误码。
- 修改前：Ollama/OpenAI/Google 适配器内部吞掉异常并输出不一致 warning，外层无法获得 traceback。
- 修改后：翻译 Worker 统一捕获异常，保留简洁 warning，并将完整脱敏诊断写入隐藏 Debug 事件；翻译失败仍不删除原字幕。

### 配置、IPC、协议、数据结构与兼容性

- 配置 schemaVersion、持久化字段、默认值、配置迁移、命令行参数和 Electron IPC 均无变化，不需要用户配置迁移。
- Python stdout 继续使用现有 `command` envelope。`error.diagnostic.version` 保持 `1`；本批次只扩展可选字段（如 `operation`、`sdkResult`、`errorType`、`errorModule`、`errorMessage`、`errorArgs`、`errorAttributes`、`stackTrace`、`cause`、`context`），不删除或改名旧字段。
- 自定义字幕引擎不需要产生新字段；新 Electron 继续接受旧 `error`/`debug` 格式。热词 Worker stdout 的 `{ ok, data/errorCode }` 私有响应格式不变，诊断只走 stderr。
- `ProviderRegistry.create`、`AudioCaptureWorker` 和翻译服务增加可选内部 diagnostic handler；默认 no-op 保持既有测试和第三方内部调用兼容。
- 没有新增、删除或升级依赖；没有远端资源、计费调用或凭据存储变化。
- 精确回滚：恢复本条列出的 Python、TypeScript、测试和文档文件，并删除新增的 `engine/core/diagnostics.py`、`engine/tests/test_diagnostics.py`。回滚无需配置迁移，但会恢复 Gummy/SDK 根因丢失和 stderr 不完整问题。

### 验证记录

- `engine/.venv/bin/python3 -m unittest engine.tests.test_gummy_provider engine.tests.test_fun_asr_provider engine.tests.test_glm_provider engine.tests.test_engine_core engine.tests.test_translation_service engine.tests.test_hotword_service -v`：通过，32/32；实现中途验证 Gummy/Fun-ASR/GLM/Session/翻译/热词链路。
- `npm run test:python && npm run test:node`：通过，Python 66/66、Node 59/59。
- `npm run typecheck`：通过；Node TypeScript 与 Vue TypeScript 均无错误。
- `npm run verify`：通过；typecheck、ESLint、Node 59/59 和 Python 66/66 全部成功。
- `npm run build`：通过；包含 typecheck，Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `git diff --check`：实现和文档完成后通过；追加本记录后最终审计再次执行。
- 验证保留 npm 既有 mirror 配置弃用警告与 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致测试、Lint、类型检查或构建失败，本批次未扩大范围修改包管理配置。

### 未执行、风险与后续事项

- 未调用真实 Gummy、Fun-ASR、GLM、OpenAI/Ollama、Google 翻译或热词 API，未使用真实麦克风/系统音频，也未产生费用；离线 fake SDK/result/exception 覆盖字段保存和脱敏，但发布前仍建议分别触发一次真实服务失败并确认服务商实际对象字段。
- 未重新运行 PyInstaller 或 Electron 安装包打包，未在 Windows/Linux 实机验证 WASAPI/PulseAudio；当前 macOS 完成 Python/Node 自动化和 Electron 生产构建，不能据此声明三平台安装包已经实机回归。
- 诊断对单字符串限制 64 KiB、单集合限制 256 项、嵌套限制 8 层，超限处带明确截断标记；这是避免异常响应或循环对象无限放大 Debug 文件的安全边界，因此不承诺保存无限大小的响应正文。
- SDK 自己直接写 stderr 的内容会由 Electron 使用本次已知命令凭据再次脱敏；无法识别且没有任何敏感字段标签/常见格式的未知第三方秘密理论上仍可能出现在供应商自由文本中。项目已对实际 API Key 值、常见 Key/Token/Bearer/Authorization/Cookie 格式和结构化敏感字段做双层处理。

### 关键外部文档或技术决策来源

- 用户提供的新 Gummy Debug 日志：确认原始 `on_error` 详情丢失后只剩通用 callback/stop 错误，直接决定优先修复 SDK callback 透传和 traceback。
- 阿里云百炼官方实时语音 Demo：其 `on_error` 显式保留 request ID 和服务消息，作为 Gummy/Fun-ASR SDK 回调诊断字段的对照；`https://github.com/aliyun/alibabacloud-bailian-speech-demo`。
- 当前锁定 DashScope SDK 1.26.7、本地 Provider 实现和现有 `error.diagnostic.version: 1` 协议：决定复用可选诊断 envelope，而不破坏旧自定义引擎 command。
- 根目录 `AGENTS.md`：决定凭据禁止写日志、协议增量兼容、中英日文档同步、测试和本记录范围。

## 2026-08-15 - V2.10.0 小版本与 macOS arm64 构建

### 用户授权与变更目标

- 用户明确要求“编译一下Mac版本 并更新小版本号”。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.9.0` 提升到 `2.10.0`，并基于当前工作区生成 macOS arm64 构建产物。
- 非目标：不提交 Git、不推送、不发布 Release、不执行 Windows/Linux/macOS x64 或 universal 打包；不升级或安装新的项目依赖。
- 修改前检查：已阅读根目录 `AGENTS.md`；`rg --files -g 'AGENTS.md'` 确认无子目录补充规则；`git status --short --branch` 显示当前分支 `main...origin/main` 且已有多项未提交修改，本批次只追加版本与构建相关改动并保留既有改动。

### 变更类型

- 构建、配置、文档。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.10.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本和 lock 根条目到 `2.10.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.10.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册对应版本标识到 `v2.10.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册对应版本标识到 `v2.10.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.10.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.10.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.10.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.10.0` 路径、大小、sha512 与 releaseDate。
- 构建产物：
  - `engine/dist/main`：本地 `.venv` 内 PyInstaller 生成的 macOS arm64 Python 字幕引擎。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用包。
  - `dist/Auto Caption-2.10.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.10.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.9.0` / `v2.9.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.10.0` / `v2.10.0`。
- 运行时业务逻辑、配置默认值、Provider 行为、字幕协议、热词协议、翻译行为和 IPC 均不因本批次版本构建变更而改变。

### 配置、IPC、协议、命令行与数据结构

- `package.json` 和 `package-lock.json` 根版本变化为 `2.10.0`。
- 没有新增、删除或升级依赖；锁文件中仅根包版本随 npm version 更新。
- 没有修改持久化配置 schemaVersion、配置迁移、Electron IPC、Python stdout 协议、本地 TCP 命令协议、命令行参数或数据结构。
- `dist/latest-mac.yml` 只描述本次 macOS arm64 最终产物，不影响源码层配置。

### 兼容性、迁移与回滚

- 兼容性：版本号与 macOS arm64 产物更新不需要用户配置迁移；现有配置文件、字幕日志和自定义引擎协议保持兼容。
- 平台范围：本批次只实际验证 macOS arm64 构建；不声明 Windows、Linux、macOS x64 或 universal 产物已经验证。
- 签名范围：`Auto Caption.app` 使用本地 ad-hoc 签名；没有 Apple Developer ID 签名或 notarization，首次打开仍可能触发 macOS 安全确认。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.9.0`；恢复 `package.json` 与 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.10.0` 构建产物；如需恢复旧包，使用此前 `2.9.0` 产物或按旧版本号重新构建。

### 验证记录

- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.10.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.9\\.0|v2\\.9\\.0|auto-caption-2\\.9\\.0|Auto Caption-2\\.9\\.0" ...`：应用版本相关文件无旧版本残留；仅剩历史 `docs/CHANGELOG.md` 条目、依赖自身版本 `birpc@2.9.0` 和 Node engine 条件 `>=22.9.0`，与应用版本无关；`dist/latest-mac.yml` 在最终产物生成后更新为 `2.10.0`。
- `npm run verify`：通过；包含 typecheck、ESLint、Node 59/59 和 Python 66/66。
- `npm run build`：通过；包含 typecheck，Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`（在 `engine/` 内）：通过，生成 `engine/dist/main`；保留既有 `pycparser.lextab/yacctab` hidden import warning 与 `@rpath/libomp.dylib` warning。
- `./dist/main --help`：沙箱内因 PyInstaller semaphore 权限失败；按规则在沙箱外重跑同一项目本地可执行文件，通过并输出 CLI 帮助。
- `npx electron-builder --mac`：沙箱内因 `npmmirror.com` DNS 失败；按规则在沙箱外重跑同一项目打包命令，通过，生成 `dist/mac-arm64`、zip、DMG 与初始 blockmap；保留重复依赖引用 warning 与缺少 Developer ID 导致跳过 Apple 正式签名的 warning。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：通过，两个可执行文件均为 Mach-O arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.10.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，完成本地 ad-hoc 签名。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，签名验证有效。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.10.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.10.0.dmg`：沙箱内失败为“设备未配置”；按规则在沙箱外重跑，通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "... buildBlockMap ..."`：通过，为签名后 zip 和 DMG 重建 `.blockmap`，并计算最终 sha512、size 与 releaseDate。
- `hdiutil verify dist/auto-caption-2.10.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.10.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.10.0.dmg dist/Auto Caption-2.10.0-arm64-mac.zip`：
  - DMG：`4f4b6a20d3c03533821383c32e96b7983dae3d3a8ade17d11265e1cc66ccbe06`
  - ZIP：`38645f7dd56e3decb08862fc5fec122857863fecae253c0eb62830c873f2a050`
- 最终产物大小：
  - `dist/auto-caption-2.10.0.dmg`：约 234 MB。
  - `dist/Auto Caption-2.10.0-arm64-mac.zip`：约 214 MB。
  - `engine/dist/main`：约 83 MB。
- `git diff --check`：追加本记录后执行，结果记录在最终交付中。

### 未执行、风险与后续事项

- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.10.0` 包已验证。
- 未执行 Apple Developer ID 签名、notarization 或 GitHub Release 发布；当前 DMG/ZIP 适合作为本地验证包，正式发布前仍建议使用开发者证书签名并公证。
- 未访问真实麦克风、系统音频、Gummy、Fun-ASR、GLM、翻译或热词 API；本批次只验证自动化测试、生产构建、Python 引擎 CLI 冒烟和 macOS 安装包完整性。
- 未升级依赖或安装新依赖；如果后续需要“检查并使用新依赖”，建议单独授权依赖升级批次，以便分别记录必要性、锁文件变化、许可证/兼容性和回归结果。
- 既有 npm mirror 配置弃用警告、Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告、PyInstaller hidden import/libomp warning、Electron Builder 重复依赖引用 warning 和 hdiutil create 用法弃用提示仍存在；本批次未扩大范围修复。

### 关键外部文档或技术决策来源

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，DMG artifact 使用 `${name}-${version}.${ext}`。
- Electron Builder 26 本地 `app-builder-lib` blockmap API：用于重新生成签名后 zip/DMG 的 blockmap，避免自动更新元数据指向签名前哈希。
- 根目录 `AGENTS.md`：决定版本构建必须同步中英日文档、记录 `change.md`、避免系统环境修改、如实记录沙箱外打包步骤与未验证平台。

## 2026-08-16 - 新增逐行滚动字幕显示方式

### 用户授权与变更目标

- 用户明确要求“新增字幕显示样式：逐行滚动”，同时保留当前字幕显示方法，并在设置中添加两种方式的切换选项。
- 目标：保留现有整句显示为默认模式；新增基于公共精确换行结果的逐行滚动模式；在字幕样式设置和预览中支持切换并持久化；对旧配置提供显式迁移。
- 非目标：不修改字幕引擎 partial/final 协议、识别 Provider、翻译服务、音频、热词、工具栏行为或窗口 IPC；不增加依赖，不安装 Electron，不打包发布，不提交、推送或创建 PR。
- 修改前检查：完整阅读根目录 `AGENTS.md`；确认没有子目录补充规则；`git status --short --branch` 显示 `main...origin/main` 且工作区干净；随后阅读 V3 配置类型/迁移/校验、Pinia 字幕样式、设置表单、公共精确换行组件、字幕窗口/预览共用组件、测试和中英日文档。

### 变更类型

- 功能、配置、重构、测试、文档。

### 修改文件与原因

- 配置与主进程：
  - `src/shared/types.ts`：新增 `CaptionDisplayMode = 'static' | 'rolling'`，在公共 `Styles` 中增加必需 `displayMode`，并把 `FullConfig` 指向 V4 类型。
  - `src/shared/config/schema.ts`：配置版本升级到 4；新增 `ConfigDocumentV4`；默认样式使用 `displayMode: 'static'`，确保新安装保留原显示方式。
  - `src/shared/config/document.ts`：入口改为 `parseConfigDocumentV4`；保留 V2→V3 迁移并新增 V3→V4 显式迁移；迁移保留同层未知字段并强制旧配置使用 `static`；主进程校验只接受 `static`/`rolling`。
  - `src/main/utils/AllConfig.ts`：使用 V4 类型和解析器，配置拒绝日志同步说明使用 V4 默认值。
- 公共呈现与逐行滚动：
  - `src/renderer/src/captions/rollingLines.ts`：新增无 Vue 依赖的视觉行模型，将各字幕实测原文/译文转换为稳定行 key，并按最大视觉行数截取末尾窗口。
  - `src/renderer/src/components/caption/ExactCaptionText.vue`：在现有精确换行测量完成后发出 `linesChange`，相同行内容不重复通知；一行文本也会在首次测量后报告。
  - `src/renderer/src/components/caption/RollingCaptionViewport.vue`：新增逐行呈现组件；隐藏测量层复用 `ExactCaptionText`，可见层用稳定 key 的 `TransitionGroup` 在新行进入时以 500 ms 向上滚动；启用 `prefers-reduced-motion` 时取消动画；测量 Map 只保留当前最多 `lineNumber + 2`（且至少 4）条字幕，避免随会话无界增长。
  - `src/renderer/src/components/caption/CaptionViewport.vue`：作为公共分派入口，`static` 继续执行原有模板，`rolling` 调用新组件；字幕窗口和样式预览无需各自增加判断。
- 设置与三语界面：
  - `src/renderer/src/stores/captionStyle.ts`：公开响应式 `displayMode`，沿用完整 caption 层 IPC 保存和恢复。
  - `src/renderer/src/components/CaptionStyle.vue`：增加“整句显示 / 逐行滚动”单选；预览实时切换；应用、取消、恢复默认均包含显示方式；逐行模式禁用长字幕开关并说明始终精确换行、行数表示视觉行数。
  - `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`：补齐显示方式名称、两个选项和滚动换行说明。
- 测试：
  - `tests/node/configDocument.test.mjs`：更新到 V4；覆盖默认静态模式、V2→V3→V4、V3→V4、扩展字段保留、合法 rolling 和非法模式拒绝。
  - `tests/node/captionPresentation.test.mjs`：覆盖实测原文/译文到稳定行的转换、关闭翻译、按视觉行数截取。
  - `tests/node/engineCatalog.test.mjs`、`tests/node/engineCommandBuilder.test.mjs`：测试标题同步当前 V4 配置名称，测试行为不变。
- 文档：
  - `docs/api-docs/config-v4.md`：新增 V4 结构、显示方式语义、校验、V2/V3 迁移、默认值和回滚限制。
  - `docs/api-docs/config-v3.md`：标记为历史格式并链接当前 V4。
  - `docs/api-docs/electron-ipc.md`：`FullConfig` 类型和配置链接更新到 V4；IPC 通道本身不变。
  - `docs/api-docs/caption-presentation.md`：补充滚动行公共模型、组件分派、500 ms 行动画、静态/滚动边界和配置迁移语义。
  - `docs/engine-manual/architecture.md`、`docs/testing.md`：架构、测试范围和迁移链更新到 V4。
  - `docs/user-manual/zh.md`、`en.md`、`ja.md`：说明两种方式、行数语义、精确换行、动画和 V4 迁移。
  - `README.md`、`README_en.md`、`README_ja.md`：在三语特性列表加入两种显示方式。
  - `docs/CHANGELOG.md`：未发布部分记录逐行滚动与 V4 配置。
  - `change.md`：追加本次授权、范围、兼容、验证、风险和回滚记录。

### 修改前后行为

- 修改前：`CaptionViewport` 只按最近 N 条字幕整句显示；即使公共精确换行能够得到视觉行，也没有逐行窗口或动画。
- 修改后：默认仍为 `static`，完全沿用原显示路径；选择 `rolling` 后，原文和已启用译文先按实际宽度精确分行，界面只保留最后 N 个视觉行，新增行使用稳定 key 触发行级上移动画；同一 partial 未形成新视觉行时只更新文本，不重复滚动。
- 修改前：“长字幕”和“字幕行数”只服务整句视图。
- 修改后：整句视图语义不变；逐行视图始终精确换行，因此禁用“长字幕”选择，“字幕行数”改为可见视觉行数，并在设置中明确提示。
- 修改前：V3 配置没有显示方式。
- 修改后：V4 必需 `displayMode`；新配置和 V2/V3 迁移均设为 `static`，升级不会主动改变用户现有字幕显示。

### 配置、IPC、协议、命令行与数据结构

- 持久化 `schemaVersion` 从 3 升级到 4；`caption.styles.displayMode` 是新增必需字段，合法值仅为 `static` 或 `rolling`，默认 `static`。
- V3→V4 迁移只在保留字段的基础上写入 `displayMode: static`；V2 先走既有命名自定义引擎迁移到 V3，再继续迁移到 V4。无版本、V1、结构不完整和未来版本仍被拒绝。
- Electron IPC 通道、方向和 envelope 不变；`control.captionConfig.change`、`both.captionConfig.set` 传递的完整 caption 层自然包含新样式字段，主进程继续重新校验。
- Python stdout NDJSON、TCP command、字幕 `event_version/phase`、翻译消息、Provider 生命周期和命令行参数均无变化。
- 没有新增、删除或升级依赖；仅使用现有 Vue `TransitionGroup`、CSS transition 和公共 DOM Range 精确换行能力。

### 兼容性、迁移与回滚

- 默认/迁移兼容：新安装、V2 和 V3 配置均选择 `static`，现有字幕窗口和预览行为保持不变；用户必须在字幕样式中明确选择并应用 `rolling`。
- 扩展字段兼容：V3→V4 保留根、application、engine、caption 和 styles 的未知字段；V4 解析继续保留未知扩展字段。
- 平台兼容：行模型为纯 TypeScript，动画为 Chromium/Vue 标准能力；`prefers-reduced-motion` 提供无动画降级。实际自动化与构建只在当前 macOS arm64 环境执行，未声称 Windows/Linux GUI 已实机验证。
- 向旧版本回滚：一旦应用写出 V4，旧 V3 程序会把它视为未来版本并回退默认配置。若必须回滚，应先备份配置，再把 `schemaVersion` 改回 3 并删除 `caption.styles.displayMode`，或恢复升级前的 V3 配置备份。
- 代码精确回滚：恢复本条列出的配置、主进程、Renderer、测试和文档文件，删除三个新增文件；同时按上一条将本地用户配置从 V4 转回 V3。

### 验证记录

- `node --experimental-strip-types --test tests/node/configDocument.test.mjs tests/node/captionPresentation.test.mjs tests/node/i18nParity.test.mjs`：通过，9/9；覆盖 V2/V3→V4、默认/非法模式、视觉行转换/截取和三语键一致性。
- `npm run lint`：通过。
- `npm run verify`：通过；Node/Web 类型检查、ESLint、Node 68/68 和 Python 66/66 全部成功。
- `npm run build`：通过；包含完整类型检查，Electron main、preload、renderer 生产构建成功，分别转换 28、1、3272 个模块。
- `git diff --check`：代码、测试和文档完成后通过；追加本记录后再次执行并在交付中报告。
- Electron 可用性只读检查：本地 `node_modules/electron` 缺少可执行文件；读取模块时其安装器尝试下载二进制，但受限网络下 `fetch failed`，未安装依赖、未修改锁文件。因此未启动真实字幕窗口。
- 验证保留既有 npm mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致校验或构建失败，本批次未扩大范围修复。

### 未执行、风险与后续事项

- 未执行真实 Electron 窗口的动画、窗口缩放、双语异步翻译插入和样式预览视觉冒烟；原因是当前 Electron 二进制缺失且用户未授权安装依赖。生产编译和纯行模型已验证，但跨平台视觉手感仍需安装完整运行时后检查。
- 一次 ASR 更新若跨越多个视觉行，多个新行会在同一 500 ms 过渡中进入，而不是排队逐个播放；常规流式 partial 通常逐步增长。若后续要求严格逐行队列，可在不修改公共字幕/换行模型的情况下增加有界动画队列。
- 异步翻译到达会按字幕顺序插入对应译文视觉行并可能触发滚动，这是与整句模式一致的原文/译文顺序；翻译关闭时不生成译文行。
- 未访问麦克风、系统音频、Gummy、Fun-ASR、GLM、翻译或热词 API，没有产生费用，也未改变凭据处理。

### 关键外部文档或技术决策来源

- 用户提供的本地科大讯飞悬浮字幕保存页及资源：确认其固定可视高度、按实际行高计算溢出、约 500 ms 上移一行的行为；本项目没有复制供应商代码，而是用既有 Vue/精确换行架构实现等价语义。
- 本地 `src/renderer/src/captions/visualLines.ts`、`ExactCaptionText.vue` 和 `CaptionViewport.vue`：决定复用已验证的 Chromium 实际换行结果，并让公共 `CaptionViewport` 作为显示方式唯一分派入口。
- 本地 V3 配置 schema、parser 和 V2 迁移测试：决定升级到 V4 并显式串联 V2→V3→V4，避免通过缺字段默认值形成隐式长期迁移。
- 根目录 `AGENTS.md`：决定配置变化必须版本化迁移、主进程校验、补齐中英日、同步 README/API/架构/用户文档、执行全量校验和构建并追加本记录。

## 2026-08-16 - V2.12.0 小版本与 macOS arm64 构建

### 用户授权与变更目标

- 用户明确要求“编译一下Mac版本 并更新小版本号”。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.11.0` 提升到 `2.12.0`，并基于当前工作区（包含用户已有的字幕展示、协议与诊断修改）生成 macOS arm64 构建产物。
- 非目标：不提交或推送 Git，不创建 PR 或 Release，不安装、删除或升级依赖，不修改系统 Python/Node、全局包或 shell 配置，不执行 Windows、Linux、macOS x64 或 universal 打包。
- 修改前检查：完整阅读根目录 `AGENTS.md`，`rg --files -g 'AGENTS.md'` 确认没有子目录补充规则；`git status --short --branch` 显示 `main...origin/main`，并已有字幕生命周期、精确换行、工具栏、协议、日志诊断、测试和文档等未提交修改。本批次先阅读目标文件现有 diff，仅更新可明确区分的版本标识并保留全部既有内容。

### 变更类型

- 构建、配置、文档。

### 修改文件与原因

- `package.json`、`package-lock.json`：将应用、锁文件和根包条目的版本从 `2.11.0` 同步为 `2.12.0`；依赖声明和解析版本没有变化。
- `README.md`、`README_en.md`、`README_ja.md`：同步中英日版本徽章、发布提示和平台说明到 `v2.12.0`。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`：在保留用户已有字幕显示说明的同时，将对应版本更新为 `v2.12.0`。
- `docs/engine-manual/zh.md`、`en.md`、`ja.md`：在保留用户已有生命周期协议说明的同时，将对应版本更新为 `v2.12.0`。
- `src/renderer/index.html`、`src/renderer/src/components/EngineStatus.vue`：同步窗口标题和关于界面的可见版本。
- `docs/CHANGELOG.md`：增加 `v2.12.0` 发布条目，记录版本同步和 macOS arm64 产物；保留当前工作区已有的未发布功能记录。
- `change.md`：追加本次授权范围、工作区保护、构建命令、真实验证结果、风险和回滚信息。
- 生成产物（位于 Git 忽略的构建目录，不加入版本控制）：`engine/dist/main`、`dist/mac-arm64/Auto Caption.app`、`dist/Auto Caption-2.12.0-arm64-mac.zip`、`dist/auto-caption-2.12.0.dmg`、对应 `.blockmap` 和 `dist/latest-mac.yml`。签名后重新封装 ZIP/DMG，并重建 blockmap/更新元数据，确保哈希对应最终内容。

### 修改前后行为

- 修改前：版本源、可见版本文本和上一批 macOS 构建为 `2.11.0`；当前工作区新增功能尚未包含在新的安装包中。
- 修改后：版本源、README、手册、窗口标题、关于界面、CHANGELOG、Info.plist 和 macOS arm64 产物统一为 `2.12.0`；本次产物包含当前工作区已有改动。
- 本批次自身不改变配置默认值、Provider 行为、字幕/翻译/热词业务语义、Electron IPC 或 Python 子进程协议；产物中出现的相关功能变化来自构建前已存在的用户修改，并未被本批次覆盖。

### 配置、IPC、协议、命令行、数据结构与依赖

- 仅 `package.json` 与 `package-lock.json` 根版本变为 `2.12.0`；没有新增、删除或升级直接/间接依赖，没有运行安装命令。
- 持久化配置 schemaVersion、配置迁移、Electron IPC 通道、Python stdout/TCP 协议、CLI 参数和数据结构均未因版本构建步骤变化。
- `dist/latest-mac.yml` 更新为最终签名后 ZIP/DMG 的路径、大小、SHA-512 与时间戳，供通用更新元数据消费；不改变源码配置。

### 兼容性、迁移与回滚

- 版本号更新不需要配置迁移；现有用户配置和自定义引擎继续使用当前工作区所实现的兼容规则。
- 只在当前 macOS arm64 环境完成自动化、生产和安装包验证；未声明 Windows、Linux、macOS x64 或 universal 已验证。
- 应用使用本机 ad-hoc 签名，未使用 Apple Developer ID、未 notarize；首次分发打开仍可能受到 Gatekeeper 提示。
- 回滚本批次时，可将上述版本文件中的 `2.12.0` 恢复为 `2.11.0`，移除本条 CHANGELOG/change 记录，并忽略或删除 Git 忽略目录中的 `2.12.0` 生成产物；不需要配置回迁。用户在本次开始前的未提交功能改动不属于回滚范围。

### 验证记录

- 版本一致性检查：`package.json`、`package-lock.json` 和 lock 根包均为 `2.12.0`；版本入口扫描未发现非历史 `2.11.0` 残留。
- `npm run verify`：通过；Node/Web TypeScript、ESLint、Node 66/66 和 Python 66/66 全部成功。
- `npm run build`：通过；Electron main、preload、renderer 生产构建分别转换 28、1、3268 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过；使用项目内 `engine/.venv` 生成 arm64 `engine/dist/main`。保留 `pycparser.lextab/yacctab` hidden import 与 `@rpath/libomp.dylib` 既有 warning。
- `./dist/main --help`：沙箱内因 PyInstaller semaphore 权限失败；沙箱外首次调用未返回可判定状态，第二次明确以退出码 0 输出完整 CLI 帮助，冒烟通过。
- `npx electron-builder --mac`：沙箱内因 `npmmirror.com` DNS 受限失败；沙箱外重跑通过，生成 arm64 `.app`、ZIP、DMG 和初始 blockmap。保留重复依赖引用以及缺少 Developer ID、跳过正式 Apple 签名的 warning。
- `file ...`：应用主程序和打包内 Python 引擎均为 Mach-O 64-bit arm64。
- `plutil -p .../Info.plist`：`CFBundleShortVersionString` 与 `CFBundleVersion` 均为 `2.12.0`。
- `codesign --force --deep --sign - ...` 与 `codesign --verify --deep --strict --verbose=2 ...`：通过，本地 ad-hoc 签名有效。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 ZIP。
- `hdiutil create ...`：沙箱内以“设备未配置”失败；沙箱外重跑通过，生成签名后 DMG；保留该 create 用法已弃用 warning。
- Electron Builder 26 本地 `buildBlockMap(..., 'gzip', ...)`：通过，为最终 ZIP/DMG 重建 blockmap，并据此更新 `latest-mac.yml`。
- `hdiutil verify dist/auto-caption-2.12.0.dmg`：通过，checksum VALID。
- `unzip -tq 'dist/Auto Caption-2.12.0-arm64-mac.zip'`：通过，无压缩数据错误。
- 最终 SHA-256：DMG `0e5fc07f73550570c5702fba8d43c5655a6a3cedcfa4f304ab9a4646008a3444`；ZIP `f2e000c7a195c908f1ebcf48c9c180d3b1ca5a5e4e10e8ca74f378e09a7cd1a2`。
- 最终大小：DMG 约 234 MB，ZIP 约 215 MB，Python 引擎约 83 MB；最终 `git diff --check` 和工作区审计在交付前执行。

### 未执行、风险与后续事项

- 未进行 Developer ID 签名、Apple notarization、真实安装拖拽/首次启动 GUI 冒烟、真实麦克风/系统音频或付费 Provider 测试，也未发布远端 Release；这些不属于本次本地 macOS 编译授权。
- 未执行 Windows、Linux、macOS x64 或 universal 构建；跨平台源码仍由本次自动化测试和生产编译覆盖，但不能替代对应平台实机验证。
- npm mirror 配置弃用警告、Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告、PyInstaller hidden import/libomp warning、Electron Builder 重复依赖 warning 和 hdiutil create 弃用提示仍存在；均未导致最终构建或完整性检查失败，本批次未扩大范围修复。
- 当前工作区包含用户既有未提交功能修改；本次产物有意基于该状态生成。正式发布前应审阅整份 diff，并决定是否提交这些功能修改。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`、`electron-builder.yml` 与 `engine/main.spec`：确定版本来源、macOS arm64 打包目标、引擎资源路径和项目内虚拟环境构建方式。
- Electron Builder 26 本地 `app-builder-lib` blockmap API：用于重建签名后产物的增量更新元数据，避免 `latest-mac.yml` 指向签名前哈希。
- 根目录 `AGENTS.md`：决定保护用户已有修改、同步中英日版本文本、完整记录失败与沙箱外重跑、禁止系统环境/依赖变更并如实限定已验证平台。

## 2026-08-15 - 公共增量字幕、精确换行与自动隐藏工具栏

### 用户授权与变更目标

- 用户明确要求先实现“增量字幕模型、精确换行、自动隐藏工具栏”，并要求前两项成为以后新增字幕显示方式可以调用的公共方案。
- 目标：为字幕建立稳定 ID 驱动的 partial/final 生命周期；用 Chromium 实际排版结果生成精确视觉行；让字幕窗口和样式预览共享显示组件；将右侧工具栏改为不占字幕宽度的自动隐藏覆盖层。
- 非目标：本批次不实现逐行滚动动画，不修改识别 Provider 的翻译触发规则，不增加字幕样式配置项，不升级或安装依赖，不打包发布，不提交、推送或创建 PR。
- 修改前检查：完整阅读根目录 `AGENTS.md`；`rg --files -g 'AGENTS.md'` 确认目标目录没有更具体规则；`git status --short --branch` 显示 `main...origin/main` 且工作区干净；随后阅读共享类型、主进程字幕日志与协议、Python 输出层、Renderer store、字幕窗口、样式预览、配置、IPC、测试和相关文档。

### 变更类型

- 功能、重构、协议、测试、文档。

### 修改文件与原因

- 公共增量模型与主进程接入：
  - `src/shared/types.ts`：为 `CaptionItem` 增加必需的 `phase`，定义 `CaptionPhase = 'partial' | 'final' | 'unknown'`。
  - `src/shared/captions.ts`：新增公共 `IncrementalCaptionCollection`、变化结果和 phase 规范化；集中处理稳定 ID upsert、final 防回退、旧引擎隐式固化、翻译保留、完整替换和清空。
  - `src/main/engine/captions/CaptionLog.ts`：改为组合公共增量模型，保留运行 ID 与 Provider index 组成的稳定 `captionId`，按模型变化结果更新字幕和翻译。
  - `src/main/utils/AllConfig.ts`：一次字幕写入可能同时产生“旧活跃句固化”和“新句加入”两项变化，按顺序向所有窗口分发全部变化。
- 字幕引擎进程协议：
  - `src/main/engine/protocol/messages.ts`：为 `caption` 增加成对出现的可选 `event_version: 1` 与 `phase`，拒绝半套元数据、未知版本和未知 phase，同时继续接受完全省略两者的旧引擎消息。
  - `engine/protocol/output.py`：内置引擎把 `CaptionPartial`/`CaptionFinal` 映射为版本 1 的 `partial`/`final` stdout 事件。
  - `engine/tests/test_protocol_output.py`：验证两种内部事件输出正确的版本和生命周期字段。
- 公共精确换行与显示：
  - `src/renderer/src/captions/visualLines.ts`：新增 grapheme 分段、测量位置分行和 DOM Range 实际 inline box 测量函数；保留硬换行与空行。
  - `src/renderer/src/components/caption/ExactCaptionText.vue`：新增可复用精确文本组件；隐藏镜像与可见文本共享宽度和排版属性，使用 rAF 合并测量，并在容器尺寸及字体加载变化后重测；关闭换行时保留显示尾部的单行行为。
  - `src/renderer/src/components/caption/CaptionViewport.vue`：新增公共字幕显示组件，统一原文/译文、显示条数、阴影、精确换行和窗口拖动区域。
  - `src/renderer/src/components/CaptionStyle.vue`：样式预览改用 `CaptionViewport`，移除与字幕窗口重复的渲染分支；为本次触及的旧函数补齐返回类型并统一现有文件格式。
  - `src/renderer/src/views/CaptionPage.vue`：字幕窗口改用同一 `CaptionViewport`，右侧工具栏改为绝对覆盖层；默认 900 ms 后隐藏，指针进入/移动或键盘聚焦时显示，离开后重新隐藏；保留关闭、打开控制窗口、鼠标穿透和拖动功能，并在卸载时清理计时器、ResizeObserver 与穿透状态。
- 用户可见文本与 Lint 元数据：
  - `src/renderer/src/i18n/lang/zh.ts`、`en.ts`、`ja.ts`：补齐工具栏三个操作和鼠标穿透开关状态的无障碍标题。
  - `eslint-suppressions.json`：删除因本次重写及显式返回类型而失效的 `CaptionStyle.vue`、`CaptionPage.vue` 抑制项；没有清理其他历史抑制。
- 测试：
  - `tests/node/captionLog.test.mjs`：覆盖显式 partial/final、final 防回退、旧引擎隐式固化、翻译在后续 final 更新中保留，以及 Renderer 稳定 ID upsert。
  - `tests/node/engineProtocol.test.mjs`：覆盖版本 1 生命周期接受、半套字段和未知版本拒绝。
  - `tests/node/captionPresentation.test.mjs`：覆盖 Unicode 代理对/组合字符不拆分、按实测顶部坐标分行、硬换行与空行保留。
- 文档：
  - `docs/api-docs/caption-presentation.md`：新增公共增量模型、精确换行 API、组件复用方式、扩展准则与当前不含滚动动画的边界。
  - `docs/api-docs/caption-engine.md`：记录版本 1 phase、final 防回退、旧引擎 unknown/隐式固化和拒绝规则。
  - `docs/api-docs/electron-ipc.md`：补充 `CaptionItem.phase` 及模型语义，并更正 `caption.windowHeight.change` 为高度变化说明。
  - `docs/engine-manual/zh.md`、`en.md`、`ja.md`：同步自定义引擎的版本化生命周期输出要求。
  - `docs/user-manual/zh.md`、`en.md`、`ja.md`：同步增量更新、精确换行和自动隐藏工具栏的用户行为。
  - `docs/CHANGELOG.md`：在未发布条目记录三项功能。
  - `change.md`：追加本次授权、文件范围、协议兼容、验证、风险与回滚记录。

### 修改前后行为

- 修改前：同一句主要依靠稳定 `captionId` 原地替换，但进程协议没有 final 标记，显示链路无法可靠阻止延迟 partial 覆盖最终句；不同显示方式仍可能各自推断生命周期。
- 修改后：内置引擎显式输出 version 1 partial/final，公共模型集中固化状态并禁止 `final -> partial`；旧自定义引擎继续工作，并在下一条新 ID 出现时隐式固化上一句。
- 修改前：字幕窗口和样式预览各自依赖浏览器自然换行并复制模板，未来添加视觉行能力容易漂移，也无法取得可复用的实际分行结果。
- 修改后：两处共同调用 `CaptionViewport`/`ExactCaptionText`；文本先按 Unicode grapheme 测量 Chromium 真实 inline box，再以显式视觉行呈现，宽度、字体或字体加载变化会触发重测。
- 修改前：右侧固定 32 px 标题栏始终显示并从字幕可用宽度中扣除。
- 修改后：40 px 工具栏绝对覆盖在右侧，不参与精确换行宽度；初始短暂显示后自动隐藏，指针或键盘交互会显示并暂停隐藏，离开后恢复；启用鼠标穿透时进入工具栏会临时恢复交互，离开后继续穿透。

### 配置、IPC、协议、命令行与数据结构

- 持久化配置 `schemaVersion`、字段、默认值、校验和迁移函数均无变化；没有配置迁移要求，也没有新增字幕样式选项。
- Python stdout `caption` 消息新增可选且成对出现的 `event_version: 1`、`phase: 'partial' | 'final'`；内置引擎始终发送，新自定义引擎应发送，旧自定义引擎可以整组省略。
- Electron 内部/Renderer IPC 的 `CaptionItem` 新增 `phase: 'partial' | 'final' | 'unknown'`。通道名称和方向不变；`both.captionLog.upsert` 仍是幂等稳定 ID upsert，但一次引擎事件可能顺序分发两次以完成旧句固化与新句插入。
- TCP command、翻译消息、CLI 参数、Provider 配置、子进程启动方式和翻译仅在 final 触发一次的规则均无变化。
- 字幕日志是当前运行内存数据，不是持久化配置；因此必需 `phase` 不需要配置迁移。导出的 JSON 会自然包含该字段，SRT 行为不变。
- 没有新增、删除或升级依赖；实现只使用现有 Vue/Electron 和 Chromium 的 `Intl.Segmenter`、DOM Range、ResizeObserver、FontFaceSet API。

### 兼容性、迁移与回滚

- 旧自定义引擎：完整省略生命周期字段时继续通过协议校验并映射为 `unknown`；同 ID 仍原地更新，新 ID 会固化上一活跃句。只提供一个字段或未知版本会被明确拒绝，避免不可判定的半版本状态。
- 内置 Provider：统一输出层增加元数据，不改变 Provider 生命周期、音频、时间戳、翻译或重试；final 后延迟 partial 被公共模型丢弃。
- Windows、macOS、Linux：数据模型和换行函数为跨平台逻辑；DOM 测量运行在项目已有 Chromium Renderer。实际自动化和生产构建在当前 macOS arm64 开发环境完成，未对 Windows/Linux GUI 做实机验证。
- 精确回滚：恢复本条列出的共享类型/模型、协议、输出层、主进程、Renderer、i18n、测试和文档文件，并恢复两项 ESLint 抑制记录；不需要配置回迁。回滚会恢复无 phase 协议、重复显示模板和常驻占宽工具栏。

### 验证记录

- 首次 `npm run verify`：类型检查通过，随后 ESLint 以退出码 2 停在本次重写造成的过期抑制项；没有把该次运行记为通过。删除仅对应 `CaptionStyle.vue`、`CaptionPage.vue` 的失效记录并补齐显式返回类型后重跑。
- `npm run lint`：通过；确认剩余历史抑制项仍有效。
- 最终 `npm run verify`：通过；Node/Web 类型检查、ESLint、Node 66/66 和 Python 66/66 全部成功。
- `npm run build`：通过；包含完整类型检查，Electron main、preload、renderer 生产构建成功，分别转换 28、1、3268 个模块。
- 浏览器视觉验证尝试：经项目已有浏览器测试能力尝试打开 `http://127.0.0.1:5173/#/caption` 与 `http://localhost:5173/#/caption`，均被内置浏览器的本地地址安全策略阻止；遵循安全策略未使用间接 URL、raw CDP 或其他浏览器面绕过。
- 本地运行尝试：`npm run dev` 在沙箱内因 `listen EPERM ::1:5173` 失败；获准在沙箱外重跑后 Vite Renderer 启动，但 Electron 报 `Electron uninstall` 并退出。随后只读方式启动绑定 `127.0.0.1:5173` 的 Vite Renderer 服务成功，但仍无法越过内置浏览器策略，测试后已用 Ctrl-C 停止服务。
- `git diff --check`：代码、测试和文档修改完成后通过；追加本记录后再次执行并在最终交付中如实报告。
- 验证保留项目既有 npm mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致最终校验或构建失败，本批次未扩大范围修改包管理配置。

### 未执行、风险与后续事项

- 未完成真实 Electron 窗口的视觉截图、指针悬停、键盘 Tab、鼠标穿透和窗口拖动实机回归，原因是本地 Electron 二进制不可用且内置浏览器禁止访问本地地址；类型、状态转换、纯分行函数和生产编译已经覆盖，但 UI 最终手感仍建议在安装完整 Electron 后人工冒烟。
- DOM Range 的真实 `getClientRects()` 结果只能在 Chromium 布局环境产生；Node 测试覆盖了 grapheme 和“位置到视觉行”的纯逻辑，不能替代不同字体 fallback、缩放比例和极窄窗口的实机排版测试。
- 本次没有实现用户此前提到的逐行滚动；公共模型和 `CaptionViewport` 已留下稳定输入边界，后续可在独立变更中增加滚动呈现，而无需复制生命周期或换行规则。
- 启用鼠标穿透后能否持续收到转发的 pointer move 依赖 Electron `setIgnoreMouseEvents(ignore, { forward: ignore })` 的平台行为；现有主进程已使用该参数，但 Windows/Linux 与 macOS 的实际工具栏唤醒仍需分别验证。
- 未访问真实麦克风、系统音频、Gummy、Fun-ASR、GLM、翻译或热词 API，没有产生费用，也未验证真实服务端的乱序回调；离线测试构造了 final 后延迟 partial 场景。

### 关键外部文档或技术决策来源

- 用户提供的本地科大讯飞悬浮字幕保存页及资源：作为增量显示、精确分行与工具栏隐藏行为参考；项目实现使用自身 Vue/Electron 架构和公共 API，没有复制供应商脚本或资源。
- 本地 `engine/core` 生命周期事件、`src/main/engine/captions/CaptionLog.ts` 和稳定 `captionId` 既有实现：决定在现有 partial/final 语义之上增加版本化外部标记，并把公共模型放到 `src/shared`。
- Chromium DOM Range inline box、`Intl.Segmenter`、ResizeObserver 和 FontFaceSet：决定使用浏览器真实排版而不是固定字符数、平均字宽或 Provider 专属估算。
- 根目录 `AGENTS.md`：决定保留旧自定义引擎、版本化协议、同步中英日文本、补充协议/扩展文档、执行类型/Lint/Node/Python/生产构建并追加本记录。

## 2026-08-15 - 补全配置拒绝诊断并修正 Token Usage 误脱敏

### 用户授权与变更目标

- 用户明确要求修复两项 Debug 日志问题：`Config rejected` 只有 `InvalidConfigError`、缺少具体字段/原因/堆栈，以及 `Engine Token Usage: 0` 被错误记录为 `Engine <redacted>: 0`。
- 目标：配置读取失败时保留安全、可定位的异常摘要和隐藏结构化诊断；将日志脱敏限制到凭据语义，保留 token 用量/计数等非敏感指标。
- 非目标：不修改配置内容或迁移策略，不修复触发配置拒绝的用户配置，不改字幕 Provider、IPC、进程协议、界面、依赖或打包配置，不提交或发布。
- 修改前检查：完整阅读根目录 `AGENTS.md`；`rg --files -g 'AGENTS.md'` 确认无子目录补充规则；`git status --short --branch` 显示 `main...origin/main` 且工作区干净。

### 变更类型

- 修复、测试。

### 修改文件与原因

- `src/main/utils/AllConfig.ts`
  - 配置读取失败的 ERROR 摘要由仅记录异常类型改为记录 `name: message`，直接显示具体拒绝原因。
  - 同时新增仅写 Debug JSONL 的 `Config Error Diagnostic`，包含诊断版本、`config.read` operation、配置路径和完整 Error 序列化结果，因此保留 name、message、stack、cause 和自定义属性；所有字段继续经过统一脱敏入口。
- `src/main/utils/UtilsFunc.ts`
  - 将结构化敏感字段匹配从“字段名任意位置包含 token 等词”收窄为凭据型字段结尾，避免 `tokenUsage`、`tokenCount`、`maxTokens` 被误判，同时继续覆盖 `token`、`accessToken`、Provider API Key、password、secret、authorization、credential 和 cookie。
  - 将自由文本规则拆分为显式 `:`/`=` 赋值和至少 8 字符的自然语言凭据值两类，不再把 `Token Usage` 中的普通单词 `Usage` 当成密钥；Bearer、URL 查询参数、常见 `sk-` Key 和运行时已知密钥替换规则保持不变。
- `tests/node/debugLogSession.test.mjs`
  - 新增配置校验诊断回归测试，确认 `InvalidConfigError` 的具体原因和 stack 在递归安全序列化后仍然存在。
- `tests/node/utilsFunc.test.mjs`
  - 新增文本与结构化回归测试，确认 `Engine Token Usage: 0` 和 token 统计字段保持原值，而真实 token、access token 与 Provider API Key 仍被脱敏。
- `change.md`
  - 追加本次授权、行为、安全边界、验证结果、兼容性与回滚记录。

### 修改前后行为

- 修改前：配置文件无效时只产生 `Config rejected; V3 defaults will be used (InvalidConfigError)`，无法从导出的 Debug 日志判断具体校验失败字段，也没有 JavaScript stack。
- 修改后：ERROR 行包含异常类型和具体 message；紧随其后的隐藏 Debug 诊断包含 `operation: config.read`、配置路径以及已脱敏的完整 Error 对象和 stack。配置仍安全回退到 V3 默认值。
- 修改前：自由文本规则将 `Token Usage` 匹配为“token + 凭据值”，结构化规则也会遮蔽任何包含 `token` 的统计字段。
- 修改后：`Engine Token Usage: 0` 原样记录，`tokenUsage`、`tokenCount` 和 `maxTokens` 保持可诊断数值；真正的 token/API Key/password/secret 等凭据仍输出 `<redacted>`。

### 配置、IPC、协议、数据结构与兼容性

- 配置 schemaVersion、默认值、持久化字段、解析规则和迁移函数均无变化；无配置迁移要求。
- Electron IPC、Python stdout NDJSON、本地 TCP 命令、字幕事件结构和命令行参数均无变化。
- 新增内容仅是 Debug JSONL 中一条 `DEBUG` 级配置诊断记录；现有日志记录 envelope 与字段类型不变，不影响旧日志读取或自定义字幕引擎。
- 脱敏逻辑为跨平台纯 TypeScript 行为，不依赖 Windows、macOS 或 Linux 平台 API。
- 没有新增、删除或升级依赖，也没有外部 API、远端资源、计费或凭据存储变化。
- 精确回滚：恢复本条列出的两个 TypeScript 文件和两个 Node 测试文件，并删除本条 `change.md` 记录；无需配置迁移，但会恢复配置错误详情缺失和 Token Usage 误脱敏问题。

### 验证记录

- `node --experimental-strip-types --test tests/node/utilsFunc.test.mjs tests/node/debugLogSession.test.mjs`：通过，9/9；覆盖 Token Usage/统计字段保留、真实凭据脱敏，以及配置异常原因和 stack 保留。
- `npm run typecheck:node`：通过，Electron 主进程 TypeScript 无错误。
- `npm run verify`：通过；Node/Web 类型检查、ESLint、Node 61/61 和 Python 66/66 全部成功。
- `npm run build`：通过；包含完整类型检查，Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `git diff --check`：修改测试完成后通过；追加本记录后执行最终审计并在交付中如实报告。
- 验证保留项目既有 npm mirror 配置弃用警告与 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；均未导致类型检查、Lint、测试或构建失败，本批次未扩大范围修改包管理配置。

### 未执行、风险与后续事项

- 未重新打包或安装 Electron/PyInstaller 应用，也未通过 GUI 导出真实 Debug 日志；自动化测试直接覆盖共用日志脱敏/异常序列化函数，生产构建验证调用可编译，但发布包仍需下一次正常打包后才能包含本修复。
- 未调用真实字幕、翻译或热词 API，未访问麦克风/系统音频，也未产生费用；本修改不涉及这些运行路径。
- 自由文本中仅以空格分隔、少于 8 字符且没有 `:`/`=`、Bearer、查询参数、常见 Key 前缀或运行时精确值可供识别的未知短凭据，仍无法仅凭文本可靠区分于普通术语；结构化凭据字段和实际进程参数密钥仍会无条件脱敏。
- 配置异常 stack 会包含本地代码路径，这是 Debug 日志用于定位错误的预期行为；不会显示在普通软件日志 UI 的 DEBUG 过滤层中。

### 关键外部文档或技术决策来源

- 用户提供的 `auto-caption-debug-2026-08-14T16-36-56-793Z.jsonl`：直接确认配置异常只有类型名，以及 `Engine Token Usage: 0` 被文本脱敏规则误伤。
- 本地 `src/main/utils/Log.ts` 与 `src/main/logging/DebugLogSession.ts`：决定复用既有“ERROR 简洁可见、DEBUG 完整落盘”和递归安全序列化机制，不新增日志协议。
- 根目录 `AGENTS.md`：决定完整错误诊断仍必须脱敏凭据、补充回归测试、执行类型/Lint/测试/构建并追加本记录。

## 2026-08-15 - V2.11.0 小版本与 macOS arm64 构建

### 用户授权与变更目标

- 用户明确要求“编译一下Mac版本 并更新小版本号”。
- 目标：在不修改系统环境的前提下，将 V2 小版本从 `2.10.0` 提升到 `2.11.0`，并基于当前工作区生成 macOS arm64 构建产物。
- 非目标：不提交 Git、不推送、不发布 Release、不执行 Windows/Linux/macOS x64 或 universal 打包；不升级、安装或替换项目依赖。
- 修改前检查：已阅读根目录 `AGENTS.md`；`rg --files -g 'AGENTS.md'` 确认无子目录补充规则；`git status --short --branch` 显示当前分支 `main...origin/main` 且已有 `change.md`、`src/main/utils/AllConfig.ts`、`src/main/utils/UtilsFunc.ts`、`tests/node/debugLogSession.test.mjs`、`tests/node/utilsFunc.test.mjs` 未提交修改。本批次保留这些既有改动，只追加版本与构建相关变更。

### 变更类型

- 构建、配置、文档。

### 修改文件与原因

- `package.json`
  - 通过 `npm version minor --no-git-tag-version` 将应用版本更新为 `2.11.0`；未创建 git tag。
- `package-lock.json`
  - 同步根包版本和 lock 根条目到 `2.11.0`。
- `README.md`、`README_en.md`、`README_ja.md`
  - 同步版本徽章、发布提示和平台说明到 `v2.11.0`。
- `docs/user-manual/zh.md`、`docs/user-manual/en.md`、`docs/user-manual/ja.md`
  - 同步用户手册对应版本标识到 `v2.11.0`。
- `docs/engine-manual/zh.md`、`docs/engine-manual/en.md`、`docs/engine-manual/ja.md`
  - 同步引擎手册对应版本标识到 `v2.11.0`。
- `src/renderer/index.html`
  - 同步浏览器标题中的可见版本到 `Auto Caption v2.11.0`。
- `src/renderer/src/components/EngineStatus.vue`
  - 同步关于信息中的可见版本到 `v2.11.0`。
- `docs/CHANGELOG.md`
  - 新增 `v2.11.0` 条目，记录版本同步与 macOS arm64 构建。
- `dist/latest-mac.yml`
  - 在生成目录中同步最终签名后 zip 和 DMG 的 `2.11.0` 路径、大小、sha512 与 releaseDate。
- 构建产物：
  - `engine/dist/main`：本地 `.venv` 内 PyInstaller 生成的 macOS arm64 Python 字幕引擎。
  - `dist/mac-arm64/Auto Caption.app`：Electron Builder 生成并经本地 ad-hoc 签名的 macOS arm64 应用包。
  - `dist/Auto Caption-2.11.0-arm64-mac.zip` 与 `.blockmap`：签名后 `.app` 重新封装的 zip 和 Electron Builder 26 blockmap。
  - `dist/auto-caption-2.11.0.dmg` 与 `.blockmap`：包含签名后 `.app` 的 APFS UDZO DMG 和 Electron Builder 26 blockmap。

### 修改前后行为

- 修改前：应用版本源、README、手册、关于窗口、浏览器标题和 macOS 构建元数据为 `2.10.0` / `v2.10.0`。
- 修改后：应用版本源、可见版本文本、README、用户手册、引擎手册、CHANGELOG 与本次 macOS arm64 产物统一为 `2.11.0` / `v2.11.0`。
- 运行时业务逻辑、配置默认值、Provider 行为、字幕协议、热词协议、翻译行为和 IPC 均不因本批次版本构建变更而改变。

### 配置、IPC、协议、命令行与数据结构

- `package.json` 和 `package-lock.json` 根版本变化为 `2.11.0`。
- 没有新增、删除或升级依赖；锁文件中仅根包版本随 npm version 更新。
- 没有修改持久化配置 schemaVersion、配置迁移、Electron IPC、Python stdout 协议、本地 TCP 命令协议、命令行参数或数据结构。
- `dist/latest-mac.yml` 只描述本次 macOS arm64 最终产物，不影响源码层配置。

### 兼容性、迁移与回滚

- 兼容性：版本号与 macOS arm64 产物更新不需要用户配置迁移；现有配置文件、字幕日志和自定义引擎协议保持兼容。
- 平台范围：本批次只实际验证 macOS arm64 构建；不声明 Windows、Linux、macOS x64 或 universal 产物已经验证。
- 签名范围：`Auto Caption.app` 使用本地 ad-hoc 签名；没有 Apple Developer ID 签名或 notarization，首次打开仍可能触发 macOS 安全确认。
- 精确回滚：恢复本批次列出的版本/文档文件到 `2.10.0`；恢复 `package.json` 与 `package-lock.json` 根版本；删除或忽略 `dist/` 与 `engine/dist/` 中本次生成的 `2.11.0` 构建产物；如需恢复旧包，使用此前 `2.10.0` 产物或按旧版本号重新构建。

### 验证记录

- `npm version minor --no-git-tag-version`：通过；版本提升到 `2.11.0`，没有创建 git tag；保留既有 npm mirror 配置弃用警告。
- `rg -n "2\\.10\\.0|v2\\.10\\.0|auto-caption-2\\.10\\.0|Auto Caption-2\\.10\\.0" ...`：应用版本相关文件无旧版本残留；初次扫描仅剩历史 `docs/CHANGELOG.md` 条目和待本次打包后更新的 `dist/latest-mac.yml`。
- `npm run verify`：通过；包含 typecheck、ESLint、Node 61/61 和 Python 66/66。
- `npm run build`：通过；包含 typecheck，Electron main、preload、renderer 生产构建成功，分别转换 27、1、3261 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`（在 `engine/` 内）：通过，生成 `engine/dist/main`；保留既有 `pycparser.lextab/yacctab` hidden import warning 与 `@rpath/libomp.dylib` warning。
- `./dist/main --help`：沙箱内因 PyInstaller semaphore 权限失败；按规则在沙箱外重跑同一项目本地可执行文件，通过并输出 CLI 帮助。
- `npx electron-builder --mac`：沙箱内因 `npmmirror.com` DNS 失败；按规则在沙箱外重跑同一项目打包命令，通过，生成 `dist/mac-arm64`、zip、DMG 与初始 blockmap；保留重复依赖引用 warning 与缺少 Developer ID 导致跳过 Apple 正式签名的 warning。
- `file dist/mac-arm64/Auto Caption.app/Contents/MacOS/Auto Caption dist/mac-arm64/Auto Caption.app/Contents/Resources/engine/main`：通过，两个可执行文件均为 Mach-O arm64。
- `plutil -p dist/mac-arm64/Auto Caption.app/Contents/Info.plist | rg 'CFBundleShortVersionString|CFBundleVersion'`：通过，两个版本字段均为 `2.11.0`。
- `codesign --force --deep --sign - dist/mac-arm64/Auto Caption.app`：通过，完成本地 ad-hoc 签名。
- `codesign --verify --deep --strict --verbose=2 dist/mac-arm64/Auto Caption.app`：通过，签名验证有效。
- `ditto -c -k --sequesterRsrc --keepParent ...`：通过，重新封装签名后的 `Auto Caption-2.11.0-arm64-mac.zip`。
- `hdiutil create -volname 'Auto Caption' -fs APFS -format UDZO -srcfolder ... -ov dist/auto-caption-2.11.0.dmg`：沙箱内失败为“设备未配置”；按规则在沙箱外重跑，通过，重新生成包含签名后 `.app` 的 DMG；hdiutil 提示该 create 用法已弃用，未影响产物生成。
- `node -e "... buildBlockMap ..."`：通过，为签名后 zip 和 DMG 重建 `.blockmap`，并计算最终 sha512、size 与 releaseDate。
- `hdiutil verify dist/auto-caption-2.11.0.dmg`：通过，checksum VALID。
- `unzip -tq dist/Auto Caption-2.11.0-arm64-mac.zip`：通过，无压缩数据错误。
- `shasum -a 256 dist/auto-caption-2.11.0.dmg dist/Auto Caption-2.11.0-arm64-mac.zip`：
  - DMG：`7a2eb68ffb3282b536f4b78593d48b23091ab9312da9386dbd9757d4d11ce560`
  - ZIP：`651e57d008723464e16b502bd1d95b7a347afb6d624487591c89c3fee19886f3`
- 最终产物大小：
  - `dist/auto-caption-2.11.0.dmg`：约 234 MB。
  - `dist/Auto Caption-2.11.0-arm64-mac.zip`：约 215 MB。
  - `engine/dist/main`：约 83 MB。
- `git diff --check`：追加本记录后执行，结果记录在最终交付中。

### 未执行、风险与后续事项

- 未执行 Windows、Linux、macOS x64 或 universal 构建；不能声明这些平台的 `2.11.0` 包已验证。
- 未执行 Apple Developer ID 签名、notarization 或 GitHub Release 发布；当前 DMG/ZIP 适合作为本地验证包，正式发布前仍建议使用开发者证书签名并公证。
- 未访问真实麦克风、系统音频、Gummy、Fun-ASR、GLM、翻译或热词 API；本批次只验证自动化测试、生产构建、Python 引擎 CLI 冒烟和 macOS 安装包完整性。
- 未升级依赖或安装新依赖；如后续需要依赖升级，应单独授权依赖升级批次，以便分别记录必要性、锁文件变化、许可证/兼容性和回归结果。
- 既有 npm mirror 配置弃用警告、Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告、PyInstaller hidden import/libomp warning、Electron Builder 重复依赖引用 warning 和 hdiutil create 用法弃用提示仍存在；本批次未扩大范围修复。

### 关键外部文档或技术决策来源

- 本地 `package.json` 与 `electron-builder.yml`：确认 macOS 产物版本来自 npm 包版本，DMG artifact 使用 `${name}-${version}.${ext}`。
- Electron Builder 26 本地 `app-builder-lib` blockmap API：用于重新生成签名后 zip/DMG 的 blockmap，避免自动更新元数据指向签名前哈希。
- 根目录 `AGENTS.md`：决定版本构建必须同步中英日文档、记录 `change.md`、避免系统环境修改、如实记录沙箱外打包步骤与未验证平台。

## 2026-08-16 - V2.13.0 小版本与 macOS arm64 构建

### 用户授权与变更目标

- 用户明确要求“编译一下Mac版本 并更新小版本号”。
- 目标：不修改系统环境，将版本从 `2.12.0` 提升到 `2.13.0`，并基于当前工作区生成 macOS arm64 应用与 Python 引擎。
- 非目标：不安装或升级依赖，不提交、推送、创建 PR/Release，不执行 Windows、Linux、macOS x64 或 universal 打包，不调用真实音频或付费服务。
- 修改前检查：完整阅读根目录 `AGENTS.md`，确认没有子目录规则；`git status --short --branch` 显示 `main...origin/main`，且已有 V4 配置、逐行滚动字幕、测试和文档等用户未提交修改。修改前阅读目标文件 diff，本批次保留全部既有内容，只更新可区分的版本字段并追加记录。

### 变更类型

- 构建、配置、文档。

### 修改文件与原因

- `package.json`、`package-lock.json`：根应用版本和 lock 根包版本更新为 `2.13.0`；依赖声明和解析版本不变。
- `README.md`、`README_en.md`、`README_ja.md`：同步三语版本徽章、发布提示和平台说明，同时保留已有逐行滚动功能说明。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`：对应版本更新为 `v2.13.0`，保留已有 V4/滚动字幕内容。
- `docs/engine-manual/zh.md`、`en.md`、`ja.md`：对应版本更新为 `v2.13.0`。
- `src/renderer/index.html`、`src/renderer/src/components/EngineStatus.vue`：同步标题和关于界面的可见版本。
- `docs/CHANGELOG.md`：新增 `v2.13.0` 发布条目；当前未发布的 V4 配置与逐行滚动说明归入该版本。
- `change.md`：追加本次授权、文件范围、构建、验证、风险和回滚记录。
- Git 忽略的生成产物：`engine/dist/main`、`dist/mac-arm64/Auto Caption.app`、`dist/Auto Caption-2.13.0-arm64-mac.zip`、`dist/auto-caption-2.13.0.dmg`、对应 `.blockmap` 与 `dist/latest-mac.yml`；签名后重新封装 ZIP/DMG 并重建更新元数据。

### 修改前后行为

- 修改前：应用版本、可见文本和上一批构建为 `2.12.0`。
- 修改后：版本源、三语文档、可见文本、Info.plist、ZIP/DMG 和更新元数据统一为 `2.13.0`；本次产物包含构建前已有的 V4 配置与逐行滚动字幕修改。
- 本批次本身不改变 Provider、字幕/翻译/热词协议、IPC、CLI 或数据结构；相关 V4 行为来自用户已有修改，未被覆盖。

### 配置、IPC、协议、命令行、数据结构与依赖

- 仅 npm 根包版本变化；没有新增、删除或升级依赖，也没有执行安装命令。
- 本批次不修改持久化配置 schema、迁移、IPC 通道、Python stdout/TCP 协议、CLI 参数或共享数据结构。
- `dist/latest-mac.yml` 仅同步最终签名后产物的文件名、大小、SHA-512 和时间戳。

### 兼容性、迁移与回滚

- 版本号更新无需额外配置迁移；当前工作区自身包含的 V3→V4 迁移随产物一同打包。
- 仅实测 macOS arm64；未声明 Windows、Linux、macOS x64 或 universal 已验证。
- 应用为本地 ad-hoc 签名，没有 Developer ID 签名和 notarization，外部分发首次打开可能收到 Gatekeeper 提示。
- 回滚本批次可将上述版本文件恢复为 `2.12.0`，移除本条版本记录，并忽略/移除 `2.13.0` 生成产物；用户在任务开始前的未提交修改不属于回滚范围。

### 验证记录

- 版本一致性检查：`package.json`、`package-lock.json` 和 lock 根包均为 `2.13.0`；非历史版本入口没有旧 `v2.12.0` 残留。
- `npm run verify`：通过；Node/Web TypeScript、ESLint、Node 68/68、Python 66/66 全部成功。
- `npm run build`：通过；main、preload、renderer 分别转换 28、1、3272 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，使用项目内 `.venv` 生成 arm64 引擎；保留 `pycparser.lextab/yacctab` hidden import 和 `@rpath/libomp.dylib` warning。
- `./dist/main --help`：沙箱内因 semaphore 权限失败；沙箱外重跑退出码 0，输出完整帮助，冒烟通过。
- `npx electron-builder --mac`：沙箱内因 `npmmirror.com` DNS 受限失败；沙箱外重跑通过。保留重复依赖引用以及无 Developer ID、跳过正式 Apple 签名 warning。
- `file`：应用主程序和包内 Python 引擎均为 Mach-O 64-bit arm64；`plutil`：两个 Info.plist 版本字段均为 `2.13.0`。
- `codesign --force --deep --sign -` 与 `codesign --verify --deep --strict --verbose=2`：通过，ad-hoc 签名有效。
- `ditto`：通过，重新封装签名后 ZIP。`hdiutil create` 沙箱内以“设备未配置”失败，沙箱外重跑通过；保留 create 用法弃用提示。
- Electron Builder 26 本地 `buildBlockMap`：通过，为最终 ZIP/DMG 重建 `.blockmap` 并同步 `latest-mac.yml`。
- `hdiutil verify dist/auto-caption-2.13.0.dmg`：通过，checksum VALID；`unzip -tq 'dist/Auto Caption-2.13.0-arm64-mac.zip'`：通过，无压缩错误。
- 最终 SHA-256：DMG `c86bb6aaa5da3553b774c38b48da77e1d57345050119da48d73ad97d87d5d54c`；ZIP `3ae21cec13cc2b806a0d7b5fcab57e57d7a8dad624988f2f4c44757b2f527abd`。
- 最终大小：DMG 约 234 MB、ZIP 约 215 MB、Python 引擎约 83 MB；最终 `git diff --check` 与工作区审计在交付前执行。

### 未执行、风险与后续事项

- 未执行 Developer ID 签名、公证、远端发布、真实安装/GUI 动画、麦克风/系统音频或真实 Provider 测试；这些超出本次本地编译范围。
- 未实机验证 Windows、Linux、macOS x64/universal；自动化和当前 macOS arm64 构建不能替代相应平台测试。
- npm mirror 配置弃用、Node `MODULE_TYPELESS_PACKAGE_JSON`、PyInstaller hidden import/libomp、Electron Builder 重复依赖和 hdiutil 弃用提示仍存在，但未导致最终构建失败。
- 当前产物有意包含工作区原有未提交 V4/滚动字幕修改；正式发布前仍需审阅整份 diff。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`、`electron-builder.yml` 与 `engine/main.spec`：确定版本来源、arm64 打包、资源路径和项目内虚拟环境构建方式。
- Electron Builder 26 本地 blockmap API：用于让更新元数据对应签名后最终文件。
- 根目录 `AGENTS.md`：决定保护用户修改、同步三语版本、记录失败与沙箱外重跑、不改系统环境/依赖并限定实际验证平台。

## 2026-08-16 - 修复逐行滚动原文被译文顶掉及新行居中

### 用户授权与变更目标

- 用户在只读原因定位后明确要求修复两个逐行滚动问题：异步翻译到达后顶掉原文，以及新字幕行从中间开始显示。
- 目标：原文和译文各自维护可见行额度并独立滚动；逐行模式的新行从左侧开始显示。
- 非目标：不改变整句显示方式、精确换行算法、配置结构、字幕引擎、翻译服务、IPC、进程协议、版本号、依赖或现有 macOS 构建产物。
- 修改前检查：复核根目录 `AGENTS.md`、`git status --short --branch`、逐行行模型/组件/测试/文档和目标文件既有 diff。工作区已有 V4 字幕方式及后续 `2.13.0` 构建变更，本批次保留这些用户修改，只修改可独立区分的滚动呈现文件并追加文档记录。

### 变更类型

- 修复、重构、测试、文档。

### 修改文件与原因

- `src/renderer/src/captions/rollingLines.ts`：把单一混合行数组改为 `RollingCaptionTracks`，分别返回 `source` 和 `translation` 行；稳定 key、精确测量输入和公共末尾 N 行选择函数保持不变。
- `src/renderer/src/components/caption/RollingCaptionViewport.vue`：使用两个独立 `TransitionGroup`，分别计算原文和译文的最后 `lineNumber` 个视觉行；翻译轨道只在启用翻译时呈现；可见行由居中改为左对齐。
- `tests/node/captionPresentation.test.mjs`：更新公共行模型测试；新增延迟翻译场景，验证原文和译文各自保留最后两行且互不占用额度；继续覆盖关闭翻译和通用行截取。
- `docs/api-docs/caption-presentation.md`：说明公共滚动模型的双轨结构、独立行额度、独立动画和左侧起点。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`：同步说明逐行模式原文/译文独立滚动、异步译文不会顶掉原文及新行左对齐。
- `docs/CHANGELOG.md`：在未发布部分记录两个显示修复。
- `change.md`：追加本次授权、范围、行为、验证、兼容性和风险记录。

### 修改前后行为

- 修改前：行模型按每条字幕依次把原文和译文追加到同一个数组，组件再对整个数组执行一次 `slice(-lineNumber)`；异步译文位于数组尾部，因此会占用并顶掉原文的可见行。
- 修改后：行模型返回原文、译文两个轨道，组件对每个轨道独立截取最后 `lineNumber` 行并在独立容器中执行动画；译文到达只改变译文轨道，不影响原文轨道的选中结果和 DOM 列表。
- 修改前：滚动行占满宽度并使用 `text-align: center`，同一 partial 增长时以中心为锚点重新排版。
- 修改后：滚动行使用 `text-align: left`，文本从左侧开始增长；未强制覆盖 Unicode 双向文本方向，字符内部仍交给浏览器 BiDi 规则处理。
- 整句 `static` 路径未修改，仍保留原有居中显示行为。

### 配置、IPC、协议、命令行、数据结构与依赖

- 持久化配置 schema、默认值和 V2→V3→V4 迁移均无变化；`lineNumber` 在逐行模式下现在分别应用于原文和译文轨道。
- Electron IPC、Python stdout NDJSON、本地 TCP command、字幕 partial/final 生命周期、翻译关联和 CLI 参数均无变化。
- Renderer 内部公共行模型从单一 `RollingCaptionLine[]` 调整为 `RollingCaptionTracks`；该模块没有对外进程协议或第三方 API 使用者。
- 没有新增、删除或升级依赖，没有执行安装命令。

### 兼容性、迁移与回滚

- 原文与译文字体、字号、颜色、字重、精确换行、稳定 key、500 ms 动画及减少动态效果支持保持不变。
- 启用翻译时最多可同时显示 `lineNumber` 行原文和 `lineNumber` 行译文，总高度可能高于旧混合队列；这是按用户要求让两部分各自滚动的预期变化，字幕窗口现有高度观察器会继续同步内容高度。
- Windows、macOS 和 Linux 均使用现有 Vue/Chromium 标准布局能力；本批次自动化只在当前 macOS arm64 开发环境执行，未声明其他平台 GUI 已实机验证。
- 回滚本批次可恢复上述行模型、滚动组件、测试和文档文件中本条对应修改；无需迁移或回退用户配置。不得回退同一工作区已有的 V4、版本号或构建变更。

### 验证记录

- `npm run typecheck && node --experimental-strip-types --test tests/node/captionPresentation.test.mjs`：通过；Web/Node 类型检查通过，呈现模型测试 6/6，通过独立轨道、延迟翻译、翻译关闭和末尾行选择场景。
- `npm run verify`：通过；Node/Web TypeScript、ESLint、Node 69/69、Python 66/66 全部成功。
- `npm run build`：通过；包含完整类型检查，Electron main、preload、renderer 生产构建成功，分别转换 28、1、3272 个模块。
- `git diff --check`：在代码和文档完成后于最终工作区审计执行，结果在交付中如实报告。
- 校验保留既有 npm mirror 配置弃用警告和 Node `MODULE_TYPELESS_PACKAGE_JSON` 性能警告；没有测试或构建失败。

### 未执行、风险与后续事项

- 未执行真实字幕窗口、异步云端翻译、窗口缩放或样式预览的 GUI 冒烟；自动化已验证纯行模型隔离，CSS 左对齐和两个 `TransitionGroup` 的最终视觉效果仍需实际窗口确认。
- 一次更新产生多条新视觉行时，同一轨道中的这些行仍会同时进入 500 ms 过渡；本次只修复两轨隔离和起点对齐，没有扩大为严格逐行动画队列。
- 未访问麦克风、系统音频、识别/翻译/热词 API，没有产生费用、修改凭据或重新打包现有 `2.13.0` 产物。

### 关键技术决策来源

- 用户确认的预期语义：翻译和原文分为两部分，各自处理滚动；新行文字从左侧开始显示。
- 本地 `RollingCaptionViewport.vue` 与 `rollingLines.ts` 原实现：确认问题来自混合数组共用一次尾部截取和可见行明确居中，而非字幕数据被删除或字符书写方向错误。
- 根目录 `AGENTS.md`：决定保护已有未提交变更、同步中英日用户文档、补充回归测试、执行全量校验和构建并追加本记录。

## 2026-08-16 - V2.14.0 小版本与 macOS arm64 构建

### 用户授权与变更目标

- 用户明确要求“编译一下Mac版本 并更新小版本号”。
- 目标：在不修改系统环境的前提下，把版本从 `2.13.0` 提升到 `2.14.0`，并基于当前工作区生成 macOS arm64 应用和 Python 引擎。
- 非目标：不安装/升级依赖，不提交、推送、创建 PR/Release，不执行 Windows、Linux、macOS x64/universal 构建，不调用真实音频或付费服务。
- 修改前检查：完整阅读根目录 `AGENTS.md`，确认无子目录规则；`git status --short --branch` 显示已有 V4 配置、逐行滚动及原文/译文独立滚动修复等未提交修改。修改前阅读目标文件 diff，本批次保留所有既有修改，仅同步版本与构建记录。

### 变更类型

- 构建、配置、文档。

### 修改文件与原因

- `package.json`、`package-lock.json`：根应用和 lock 根包版本更新到 `2.14.0`；依赖声明与解析版本不变。
- `README.md`、`README_en.md`、`README_ja.md`：同步三语版本徽章、发布提示和平台说明。
- `docs/user-manual/zh.md`、`en.md`、`ja.md`：同步对应版本，同时保留 V4、滚动字幕和双轨修复说明。
- `docs/engine-manual/zh.md`、`en.md`、`ja.md`：同步对应版本。
- `src/renderer/index.html`、`src/renderer/src/components/EngineStatus.vue`：同步窗口标题和关于界面版本。
- `docs/CHANGELOG.md`：新增 `v2.14.0` 条目，将当前未发布的双轨滚动修复纳入该版本。
- `change.md`：追加本次完整构建记录。
- Git 忽略产物：`engine/dist/main`、`dist/mac-arm64/Auto Caption.app`、`dist/Auto Caption-2.14.0-arm64-mac.zip`、`dist/auto-caption-2.14.0.dmg`、对应 `.blockmap` 与 `dist/latest-mac.yml`；签名后重封装并重建更新元数据。

### 修改前后行为

- 修改前：应用版本和上一批构建为 `2.13.0`。
- 修改后：版本源、三语文档、可见版本、Info.plist、ZIP/DMG 和更新元数据统一为 `2.14.0`；产物包含任务开始前已有的 V4、逐行滚动和原文/译文独立滚动修复。
- 本批次自身不改变配置、IPC、进程协议、CLI、Provider 或数据结构行为。

### 配置、IPC、协议、命令行、数据结构与依赖

- 仅 npm 根包版本变化；未新增、删除或升级依赖，未执行安装命令。
- 本批次不修改持久化配置 schema/迁移、IPC、Python stdout/TCP 协议、CLI 参数或共享数据结构。
- `dist/latest-mac.yml` 只同步最终签名后产物的路径、大小、SHA-512 和时间戳。

### 兼容性、迁移与回滚

- 版本更新无需新增配置迁移；工作区已有 V3→V4 迁移随应用打包。
- 仅验证 macOS arm64；不声明其他平台或架构已验证。
- 应用采用本地 ad-hoc 签名，无 Developer ID 和 notarization，外部分发可能触发 Gatekeeper。
- 回滚本批次可把上述版本字段恢复为 `2.13.0`、移除本条发布/构建记录并忽略 `2.14.0` 产物；不得回退任务前已有用户修改。

### 验证记录

- 版本一致性：`package.json`、`package-lock.json` 与 lock 根包均为 `2.14.0`；非历史入口无旧 `v2.13.0`。
- `npm run verify`：通过；Node/Web TypeScript、ESLint、Node 69/69、Python 66/66。
- `npm run build`：通过；main、preload、renderer 分别转换 28、1、3272 个模块。
- `PYINSTALLER_CONFIG_DIR=/private/tmp/auto-caption-pyinstaller-config ./.venv/bin/pyinstaller --clean --noconfirm ./main.spec`：通过，项目内 `.venv` 生成 arm64 引擎；保留 `pycparser.lextab/yacctab` hidden import 和 `@rpath/libomp.dylib` warning。
- `./dist/main --help`：沙箱内因 semaphore 权限失败；沙箱外重跑退出码 0，CLI 冒烟通过。
- `npx electron-builder --mac`：沙箱内因 `npmmirror.com` DNS 受限失败；沙箱外重跑通过；保留重复依赖引用以及缺少 Developer ID warning。
- `file`：应用和包内引擎均为 Mach-O arm64；`plutil`：两个版本字段均为 `2.14.0`。
- `codesign --force --deep --sign -` 及严格验证：通过，ad-hoc 签名有效。
- `ditto` 重封装 ZIP：通过。`hdiutil create` 沙箱内“设备未配置”，沙箱外重跑通过；保留 create 弃用提示。
- Electron Builder 本地 `buildBlockMap`：通过，最终 ZIP/DMG blockmap 与 `latest-mac.yml` 已同步。
- `hdiutil verify`：DMG checksum VALID；`unzip -tq`：ZIP 无压缩错误。
- SHA-256：DMG `d7a58cdcd27c0dc2a75cd528dad288392f01d75444b51614ca79a0f310a53065`；ZIP `e39f032babb4ec343c473ad43716b820032d28c321de5987ccf9ca5a021853cc`。
- 大小：DMG 约 234 MB、ZIP 约 215 MB、引擎约 83 MB；最终 `git diff --check` 和状态审计在交付前执行。

### 未执行、风险与后续事项

- 未执行 Developer ID 签名、公证、发布、真实安装/GUI、音频或 Provider 冒烟；不在本次本地编译授权内。
- 未验证 Windows、Linux、macOS x64/universal。
- npm mirror 配置弃用、Node `MODULE_TYPELESS_PACKAGE_JSON`、PyInstaller hidden import/libomp、Electron Builder 重复依赖和 hdiutil 弃用提示仍存在，但未导致构建失败。
- 产物有意包含工作区原有未提交功能和修复；正式发布前应审阅完整 diff。

### 关键外部文档或技术决策来源

- 本地 `package.json`、`package-lock.json`、`electron-builder.yml`、`engine/main.spec`：确定版本、arm64 目标和项目内虚拟环境构建方式。
- Electron Builder 26 本地 blockmap API：确保更新元数据对应最终签名后文件。
- 根目录 `AGENTS.md`：要求保护用户修改、同步三语、记录失败与沙箱外重跑、不改系统环境/依赖并限定验证平台。
