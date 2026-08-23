# electron ipc api-doc

本文档主要记录主进程和渲染进程的通信约定。

## 命名方式

本项目渲染进程包含两个：字幕窗口和控制窗口，主进程需要分别和两者进行通信。通信命令的命名规则如下：

1. 命令一般由三个关键字组成，由点号隔开。
2. 第一个关键字表示通信发送目标：
   - `control` 表示控制窗口类实例（后端）或控制窗口（前端）
   - `caption` 表示字幕窗口类实例（后端）或字幕窗口（前端）
   - `both` 表示上述对象都有可能成为目标
3. 第二个关键字表示需要修改的对象 / 发生改变的对象，采用小驼峰命名
4. 第三个关键字一般是动词，表示通信发生时对应动作 / 需要进行的操作

根据上面的描述可以看出通信命令一般有两种语义，一种表示要求执行的操作，另一种表示当前发生的事件。

## 前端 <=> 后端

### `both.window.mounted`

**介绍：** 前端窗口挂载完毕，请求最新的配置数据

**发起方：** 前端

**接收方：** 后端

**数据类型：**

- 发送：无数据
- 接收：`FullConfig`

`FullConfig.config` 是完整 `ConfigDocumentV5`，`FullConfig.engineEnabled` 是不持久化的运行状态。配置结构见 [配置文件 V5](config-v5.md)。

### `control.nativeTheme.get`

**介绍：** 前端获取系统当前的主题

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：**

- 发送：无数据
- 接收：`string`

### `control.folder.select`

**介绍：** 打开文件夹选择器，并将用户选择的文件夹路径返回给前端

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：**

- 发送：无数据
- 接收：`string`

### `control.debugLog.export`

**介绍：** 打开系统保存对话框，将本次软件启动以来的完整 Debug 会话导出为 UTF-8 JSON Lines 文件。

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：**

- 发送：无数据
- 接收：`"saved" | "canceled" | "unavailable" | "failed"`

主进程从启动开始持续写入会话文件。`DEBUG` 仅存在于该文件，不进入原有日志记录页；原有 `INFO`、`WARN`、`ERROR` 显示行为不变。日志页的“清空”只清空当前可见表格，不清除会话文件。Provider 诊断、SDK 回调字段、异常 cause/自定义属性/traceback、字幕引擎 stderr 和热词 Worker stderr 都会保留；stderr 使用跨 Buffer 的增量 UTF-8 解码。API Key、Token、密码、Authorization、Cookie、环境变量和命令行凭据必须递归脱敏，二进制音频不得写入日志正文。

### `control.engine.info`

**介绍：** 获取字幕引擎的资源消耗情况

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：**

- 发送：无数据
- 接收：`EngineInfo`

### `control.hotwords.execute`

**介绍：** 对 Fun-ASR 远端预编译热词表执行一次用户发起的管理操作。

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**发送：** `HotwordRequest`，其 `action` 为 `list`、`query`、`create`、`update` 或 `delete`。创建和更新的词条为 `{ text, weight, lang? }`；更新是完整替换。请求中不包含 API Key、Workspace、Endpoint 或模型，这些目标信息由主进程从已应用配置取得并重新校验。

**接收：** `HotwordResponse`：成功时 `{ ok: true, data }`；失败时 `{ ok: false, errorCode }`。错误只使用稳定的脱敏代码，不回传 SDK 原始异常。

该通道不是字幕引擎长连接协议。主进程每次启动独立 Python 子进程，将凭据和已验证请求通过 stdin 发送，并只读取一条有 1 MiB 上限的 JSON 响应；同时最多执行一个操作，20 秒超时。创建、更新、删除必须由用户点击触发，其中删除由 UI 在显示 API Key 所属账号、Workspace、地域、模型和资源 ID 后二次确认。

## 前端 ==> 后端

### `control.application.change`

**介绍：** 前端修改应用外观或布局，将完整 application 层发送给后端校验和保存

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** `ApplicationConfig`

主进程会忽略与当前配置深度相同的重复消息。窗口布局宽度在滑块拖动结束时发送一次，后端配置回显不会再次触发保存或广播。

### `control.captionLog.clear`

**介绍：** 清空字幕记录

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 无数据

### `control.captionConfig.change`

**介绍：** 前端修改字幕配置，将完整 caption 层发送给后端校验和保存

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** `CaptionConfig`

### `control.captionConfig.reset`

**介绍：** 将字幕样式恢复为默认

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 无数据

### `control.engineConfig.change`

**介绍：** 前端修改字幕引擎配置，将完整 engine 层发送给后端校验和保存

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** `EngineConfig`

### `control.captionWindow.activate`

**介绍：** 激活字幕窗口

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 无数据

### `control.engine.start`

**介绍：** 请求启动字幕引擎。普通 Provider 返回 `{ accepted: true }` 后进入原有启动流程；`apple_speech` 会在创建 Python 进程前重新执行平台能力和当前源语言模型检查，只有模型状态为 `installed` 才接受。模型检查/下载不使用字幕引擎启动超时。

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 请求无数据；响应为 `AppleSpeechStartResult`，至少包含 `accepted: boolean`，拒绝时可带 `reason`、`availability` 和 `modelStatus`

### `control.appleSpeech.availability`

**介绍：** 查询 macOS 系统语音引擎能力。非 macOS 返回 `hidden`；macOS 版本、辅助程序、硬件或语言能力不满足时返回 `disabled` 及结构化原因；可用时返回运行时语言和模型保留信息。

**数据类型：** 请求为可选 `force: boolean`；响应为 `AppleSpeechAvailability`

### `control.appleSpeech.modelStatus`

**介绍：** 查询一个已校验 locale 的 `AssetInventory` 状态。状态不是 `installed` 时，主进程拒绝启动 Apple Speech 字幕引擎。

**数据类型：** 请求为 2–64 字符且仅含字母、数字、下划线或连字符的 locale；响应为 `AppleSpeechModelStatus`

### `control.appleSpeech.installModel`

**介绍：** 用户明确触发语言模型安装。主进程同时最多允许一个安装操作，立即返回操作 ID；Swift 辅助程序通过 `AssetInstallationRequest.progress` 下载并安装，不进入 30 秒引擎启动计时。

**数据类型：** 请求为已校验 locale；响应为 `{ accepted, operationId?, reason? }`

安装过程由主进程向所有应用窗口发送 `control.appleSpeech.modelProgress`，数据为带 `operationId`、`state` 和可选 `fractionCompleted` 的 `AppleSpeechModelProgress`。最终状态为 `installed` 或 `failed`。

### `control.appleSpeech.releaseModel`

**介绍：** 用户在模型名额达到上限时明确释放一个 macOS 保留语言，然后重新查询状态。模型文件由系统管理，本操作不直接删除应用文件。

**数据类型：** 请求为已校验 locale；响应为 `AppleSpeechModelStatus`

### `control.engine.stop`

**介绍：** 关闭字幕引擎

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 无数据

### `control.engine.forceKill`

**介绍：** 强制关闭启动超时的字幕引擎

**发起方：** 前端控制窗口

**接收方：** 后端控制窗口实例

**数据类型：** 无数据

### `caption.windowHeight.change`

**介绍：** 字幕内容精确换行或样式变化后，字幕窗口报告向上取整的内容高度。主进程只接受当前字幕窗口发送的有限数字和 `22–16384px` 范围，随后将原生窗口最小高度和最大高度锁定为该值；宽度仍可在既有 `480–10000px` 范围内调整。

**发起方：** 前端字幕窗口

**接收方：** 后端字幕窗口实例

**数据类型：** `number`，有限值且范围为 `22–16384`

### `caption.mouseEvents.ignore`

**介绍：** 是否设置鼠标穿透

**发起方：** 前端字幕窗口

**接收方：** 后端字幕窗口实例

**数据类型：** `boolean`

### `caption.controlWindow.activate`

**介绍：** 激活控制窗口

**发起方：** 前端字幕窗口

**接收方：** 后端字幕窗口实例

**数据类型：** 无数据

### `caption.window.close`

**介绍：** 关闭字幕窗口

**发起方：** 前端字幕窗口

**接收方：** 后端字幕窗口实例

**数据类型：** 无数据

## 后端 ==> 前端

### `both.application.set`

**介绍：** 后端将完整 application 配置同步给窗口

**发起方：** 后端

**接收方：** 前端窗口

**数据类型：** `ApplicationConfig`

### `control.nativeTheme.change`

**介绍：** 系统主题发生改变

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** `string`

### `control.engine.started`

**介绍：** 引擎启动成功，参数为引擎的进程 ID

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** `number`

### `control.engine.stopped`

**介绍：** 引擎关闭

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** 无数据

### `control.error.occurred`

**介绍：** 发送错误

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** `string`

### `control.engineState.set`

**介绍：** 后端同步当前引擎是否运行；该状态不属于持久化配置

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** `boolean`

### `control.softwareLog.add`

**介绍：** 添加一条新的日志数据

**发起方：** 后端

**接收方：** 前端控制窗口

**数据类型：** `SoftwareLog`

### `both.captionConfig.set`

**介绍：** 后端将完整 caption 配置发送给前端

**发起方：** 后端

**接收方：** 前端

**数据类型：** `CaptionConfig`

### `both.captionLog.upsert`

**介绍：** 按稳定 `captionId` 新增或替换一条字幕数据。Renderer 必须把该事件作为幂等 upsert；即使首次事件遗漏，后续 partial/final 或翻译更新也能补齐记录。

**发起方：** 后端

**接收方：** 前端

**数据类型：** `CaptionItem`

`CaptionItem` 的结构为：

```ts
interface CaptionItem {
  captionId: string
  index: number
  time_s: string
  time_t: string
  text: string
  translation: string
  phase: 'partial' | 'final' | 'unknown'
}
```

`captionId` 是 `${engineRunId}:${engineCaptionId}`，只用于身份与更新；`index` 是从 1 开始的显示序号。Vue 列表 key 和更新查找必须使用 `captionId`，不得使用可能被识别服务校正或被用户修改的时间字段。`phase` 表示字幕生命周期；`unknown` 只用于没有发送版本化 phase 的旧自定义引擎。公共增量模型会拒绝 `final -> partial` 回退，并在下一条新字幕出现时把仍为 `unknown` 的上一条隐式固化。

### `both.captionLog.set`

**介绍：** 设置全部的字幕数据

**发起方：** 后端

**接收方：** 前端

**数据类型：** `CaptionItem[]`

窗口首次挂载时，完整字幕数组也包含稳定 `captionId`。清空字幕记录会同时清除主进程的字幕数组与 ID→位置映射。
