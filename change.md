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
