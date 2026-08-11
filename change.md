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
