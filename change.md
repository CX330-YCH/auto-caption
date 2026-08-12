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
