# Auto Caption 用户手册

对应版本：v2.21.0

## 软件简介

Auto Caption 是一个跨平台的字幕显示软件，能够实时获取系统音频输入（录音）或输出（播放声音）的流式数据，并调用音频转文字的模型生成对应音频的字幕。软件提供的默认字幕引擎（使用阿里云 Gummy 模型）支持九种语言（中、英、日、韩、德、法、俄、西、意）的识别与翻译。

目前软件默认字幕引擎在 Windows、 macOS 和 Linux 平台下均拥有完整功能，在 macOS 要获取系统音频输出需要额外配置。

测试过可正常运行的操作系统信息如下，软件不能保证在非下列版本的操作系统上正常运行。

| 操作系统版本        | 处理器架构 | 获取系统音频输入 | 获取系统音频输出 |
| ------------------ | ---------- | ---------------- | ---------------- |
| Windows 11 24H2    | x64        | ✅                | ✅                |
| macOS Sequoia 15.5 | arm64      | ✅需要额外配置    | ✅                |
| Ubuntu 24.04.2     | x64        | ✅    | ✅                |
| Kali Linux 2022.3     | x64        | ✅    | ✅                |
| Kylin Server V10 SP3 | x64 | ✅ | ✅ |

![](../../assets/media/main_zh.png)

### 软件缺点

要使用默认的 Gummy 字幕引擎需要获取阿里云的 API KEY。

在 macOS 平台获取音频输出需要额外配置。

软件使用 Electron 构建，因此软件体积不可避免的较大。

## Gummy 引擎使用前准备

要使用软件提供的默认字幕引擎（阿里云 Gummy），需要从阿里云百炼平台获取 API KEY，然后将 API KEY 添加到软件设置中或者配置到环境变量中（仅 Windows 平台支持读取环境变量中的 API KEY）。

**国际版的阿里云服务并没有提供 Gummy 模型，因此目前非中国用户无法使用默认字幕引擎。**

这部分阿里云提供了详细的教程，可参考：

- [获取 API KEY](https://help.aliyun.com/zh/model-studio/get-api-key)
- [将 API Key 配置到环境变量](https://help.aliyun.com/zh/model-studio/configure-api-key-through-environment-variables)

## GLM 引擎使用前准备

需要先获取 API KEY，参考：[Quick Start](https://docs.bigmodel.cn/en/guide/start/quick-start)。

## Fun-ASR Realtime 引擎使用前准备

先在阿里云百炼同一个 Workspace 中准备 API Key、Workspace ID 和专属 WebSocket 地址。地址必须是官方北京或新加坡地域的 `wss://<WorkspaceId>.<region>.maas.aliyuncs.com/api-ws/v1/inference`，其中的 Workspace ID 必须与设置字段一致，三者也必须属于同一地域。该云端服务会产生费用，使用前请查看[官方 WebSocket API 文档](https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api)和当前计费规则。

设置页可选择模型、语义断句、最大句间静音（200–6000 ms）和心跳。Fun-ASR 的最终句使用现有外部翻译配置。

字幕引擎启动时会初始化操作系统原生 CA 信任库：macOS 使用钥匙串的 Security 信任，Windows 使用 CryptoAPI，Linux 使用系统 OpenSSL 证书路径。公司代理或私有 CA 必须先正确安装到系统信任库；应用不会关闭 TLS 证书校验，也不依赖打包 Python 中可能缺失的独立 CA 文件。

“更多设置”中的热词分两级：一级可直接填写已有热词表 ID 和目标模型，并逐行填写上下文术语；上下文合计最多 400 字符、没有权重，可与热词表同时使用。修改一级配置后必须点击“应用更改”，下次识别任务才会使用。二级管理器使用已经应用的 API Key 所属账号、Workspace、地域和模型，可刷新、创建、完整替换、删除远端热词表；远端写操作立即生效，不受本地“取消更改”影响。删除会显示全部目标信息并再次确认。热词表模型必须与当前识别模型一致；阿里云当前说明新加坡子业务空间不支持热词。

## Vosk 引擎使用前准备

如果要使用 Vosk 本地字幕引擎，首先需要在 [Vosk Models](https://alphacephei.com/vosk/models) 页面下载你需要的模型。然后将下载的模型安装包解压到本地，并将对应的模型文件夹的路径添加到软件的设置中。

![](../../assets/media/config_zh.png)

## 使用 SOSV 模型

使用 SOSV 模型的方式和 Vosk 一样，下载地址如下：https://github.com/HiMeditator/auto-caption/releases/tag/sosv-model

## macOS 获取系统音频输出

> 基于 [Setup Multi-Output Device](https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device) 教程编写

字幕引擎无法在 macOS 平台直接获取系统的音频输出，需要安装额外的驱动。目前字幕引擎采用的是 [BlackHole](https://github.com/ExistentialAudio/BlackHole)。首先打开终端，执行以下命令中的其中一个（建议选择第一个）：

```bash
brew install blackhole-2ch
brew install blackhole-16ch
brew install blackhole-64ch
```

![](../img/03.png)

安装完成后打开 `音频 MIDI 设置`（`cmd + space` 打开搜索，可以搜索到）。观察设备列表中是否有 BlackHole 设备，如果没有需要重启电脑。

![](../img/04.png)

在确定安装好 BlackHole 设备后，在 `音频 MIDI 设置` 页面，点击左下角的加号，选择“创建多输出设备”。在输出中包含 BlackHole 和你想要的音频输出目标。最后将该多输出设备设置为默认音频输出设备。

![](../img/05.png)

现在字幕引擎就能捕获系统的音频输出并生成字幕了。

## Linux 获取系统音频输出

首先在控制台执行：

```bash
pactl list short sources
```

如果有以下类似的输出内容则无需额外配置：

```bash
220     alsa_output.pci-0000_02_02.0.3.analog-stereo.monitor    PipeWire        s16le 2ch 48000Hz       SUSPENDED
221     alsa_input.pci-0000_02_02.0.3.analog-stereo     PipeWire        s16le 2ch 48000Hz       SUSPENDED
```

否则，执行以下命令安装 `pulseaudio` 和 `pavucontrol`：

```bash
# Debian or Ubuntu, etc.
sudo apt install pulseaudio pavucontrol
# CentOS, etc.
sudo yum install pulseaudio pavucontrol
```

## 软件使用

### 修改设置

字幕设置可以分为三类：通用设置、字幕引擎设置、字幕样式设置。需要注意的是，修改通用设置是立即生效的。但是对于其他两类设置，修改后需要点击对应设置模块右上角的“应用”选项，更改才会真正生效。如果点击“取消更改”那么当前修改将不会被保存，而是回退到上次修改的状态。

字幕控制窗口的最小尺寸为 900×600。窗口内容宽度低于 1200px 时，设置区域会折叠为左侧“设置”栏：鼠标悬停或使用键盘聚焦可以临时展开，点击设置栏可以锁定展开，再次点击、点击设置区域以外的位置或按 Esc 可以收起。未应用的字幕引擎和字幕样式草稿不会因为设置栏展开、收起或窗口跨越断点而丢失。设置表单的最大宽度为 640px，因此扩大左侧区域不会把单选按钮、下拉框、输入框和滑块无限拉长；普通字段在表单宽度大于 360px 时保持标签与控件同行，只有不超过 360px 时才统一使用上下排列。语言、主题、颜色和字幕行数始终按完整控件单元排列；宽栏开关与普通字段共用右对齐标签列，悬浮展开等不超过 360px 的窄栏则从内容区左侧以“标签 + 开关”的紧凑同行布局显示，不会整体偏向中间或让文字与开关分离。字幕样式中的原文和译文字体可以搜索当前系统允许应用读取的本机字体；首次展开列表时才读取字体名称，列表只在本机内存中使用，不读取字体文件或上传字体清单。若当前环境不支持、访问被拒绝或字体未安装，可切换到手动输入并继续使用单个字体名称或完整 CSS 字体栈；原有配置不会因枚举失败被覆盖。字体修改仍属于样式草稿，点击“应用”后才同步到字幕窗口。字幕样式预览固定停靠在右侧底部，最高占窗口内容高度的 35%；内容超过该高度时只在预览区域内部滚动，不会遮挡字幕记录。

当前版本使用带 `schemaVersion: 5` 的分层配置文件。完整 V2 配置会依次迁移到 V3、V4、V5，V3/V4 也会继续迁移到 V5；显示方式默认“整句显示”，断句换行默认“跟随断句换行”，因此升级不会改变原有字幕行为。无版本配置仍使用默认设置。

字幕引擎设置会根据当前选择的引擎显示其支持的语言和专属字段。关闭“启用翻译”时不显示或传递翻译服务参数；开启后可通过“配置翻译引擎”展开 Provider、模型、Base URL 和 API Key。“更多设置”显示当前引擎需要的凭据或本地模型路径，以及通用录音路径和启动超时。切换引擎不会删除已保存的专属配置，修改仍需点击“应用更改”才会保存。

### 启动和关闭字幕

在修改完全部配置后，点击界面的“启动字幕引擎”按钮，即可启动字幕。如果需要独立的字幕展示窗口，单击界面的“打开字幕窗口”按钮即可激活独立的字幕展示窗口。如果需要暂停字幕识别，单击界面的“关闭字幕引擎”按钮即可。

### 调整字幕展示窗口

如下图为字幕展示窗口，该窗口实时展示当前最新字幕。同一句流式字幕会在原位置增量更新，最终结果固化后不会被延迟的中间结果覆盖。字幕样式设置提供“整句显示”和“逐行滚动”：整句显示保留原有按最近字幕条数呈现的方式；两种方式都在左右对称的安全边距内显示。逐行滚动始终按当前内容宽度、字体和字号精确分行，只对因宽度不足而自动折出的完整行进行两端对齐，跟随断句产生的行和当前末行保持左对齐；原文和译文分别建立“字幕行数”指定的固定视觉行容量并独立滚动，文本不足时保留空余行槽而不复制字幕，异步译文不会顶掉原文。流式 partial 缩短或重写时，已经滚出窗口的旧行不会为了填满行数而重新出现；如果重写后的当前文本暂时没有越过原展示位置，会短暂保留空行，后续增长或下一条字幕会继续填入。逐行滚动还可选择“跟随断句换行”或“不跟随断句换行”：前者让每条断句从新行开始；后者让下一条字幕接在上一句末尾，只有达到实际宽度才换行。一个选择同时作用于原文和翻译，但两者仍独立排版和滚动。只有尾部增长或新增字幕形成新行时，同一轨道中的旧行才会以约 500ms 动画向上移动；partial 重写、最终态更新和历史译文补写保持原位，窗口缩放或字体变化则按新布局重新排版。系统启用“减少动态效果”时不播放动画。右侧工具栏默认自动隐藏，鼠标移入窗口、移到工具栏或使用键盘聚焦时重新显示；它是覆盖层，不占用字幕排版宽度。三个按钮的功能分别是：关闭字幕展示窗口、打开字幕控制窗口、启用鼠标穿透。字幕窗口高度由当前显示方式、行数和字体自动确定并锁定，不能手动压缩后裁掉文字；左右边缘仍可拖动以调整宽度，重新换行后高度会自动更新。

![](../img/01.png)

### 字幕记录的导出

在字幕控制窗口中可以看到当前收集的所有字幕的记录，点击“导出字幕”按钮，即可将字幕记录导出为 JSON 或 SRT 文件。

### 保存完整 Debug 日志

“日志记录”页仍只显示原有的 INFO、WARN 和 ERROR，不显示 DEBUG。需要排查问题时，点击“保存完整 Debug 日志”可将本次软件启动以来的完整会话保存为 `.jsonl` 文件；点击日志页的“清空”不会清除该会话文件。日志会保留结构化诊断字段和异常栈，但 API Key、Token、密码及 Authorization 始终脱敏。保存操作只导出点击按钮时已经产生的内容。

## 字幕引擎

所谓的字幕引擎实际上是一个子程序，它会实时获取系统音频输入（录音）或输出（播放声音）的流式数据，并调用音频转文字的模型生成对应音频的字幕。生成的字幕通过转换为字符串的 JSON 数据，并通过标准输出传递给主程序。主程序读取字幕数据，处理后显示在窗口上。

软件提供五个内置字幕引擎。字幕引擎下拉菜单中的“添加自定义引擎…”会先要求输入名称，再创建并选中对应条目；已创建条目会长期显示在下拉菜单中，并可通过右侧删除按钮移除。其中引擎路径是自定义字幕引擎在电脑上的可执行文件路径，引擎指令是运行参数，需要按该引擎规则填写。

![](../img/02_zh.png)

注意使用自定义字幕引擎时，前面的字幕引擎的设置将全部不起作用，自定义字幕引擎的配置完全通过引擎指令进行配置。

如果你是开发者，想开发自定义字幕引擎，请查看[字幕引擎说明文档](../engine-manual/zh.md)。

## 单独使用字幕引擎

### 运行参数说明

> 以下内容默认用户对使用终端运行程序有一定了解。

字幕引擎可用使用的完整的运行参数如下：

![](../img/06.png)

而在单独使用时其中某些参数并不需要使用，或者不适合进行修改。

下面的运行参数说明仅包含必要的参数。

#### `-e , --caption_engine`

需要选择的字幕引擎模型，目前有五个可用，分别为：`gummy, glm, vosk, sosv, fun_asr`。

该项的默认值为 `gummy`。

该项适用于所有模型。

#### `-a, --audio_type`

需要识别的音频类型，其中 `0` 表示系统音频输出，`1` 表示麦克风音频输入。

该项的默认值为 `0`。

该项适用于所有模型。

#### `-d, --display_caption`

是否在控制台显示字幕，`0` 表示不显示，`1` 表示显示。

该项默认值为 `0`，只使用字幕引擎的话建议选 `1`。

该项适用于所有模型。

#### `-t, --target_language`

> 其中 Vosk 和 SOSV 模型分句效果较差，会导致翻译内容难以理解，不太建议这两个模型使用翻译。

需要翻译成的目标语言，所有模型都支持的翻译语言如下：

- `none` 不进行翻译
- `zh` 简体中文
- `en` 英语
- `ja` 日语
- `ko` 韩语

除此之外 `vosk` 和 `sosv` 模型还支持如下翻译：

- `de` 德语
- `fr` 法语
- `ru` 俄语
- `es` 西班牙语
- `it` 意大利语

该项的默认值为 `none`。

该项适用于所有模型。

#### `-s, --source_language`

需要识别的语言的源语言，默认值为 `auto`，表示不指定源语言。

但是指定源语言能在一定程度上提高识别准确率，可用使用上面的语言代码指定源语言。

该项适用于 Gummy、GLM、SOSV 和 Fun-ASR 模型。

其中 Gummy 模型可用使用上述全部的语言，在加上粤语（`yue`）。

GLM 模型支持指定的语言有：英语、中文、日语、韩语。

SOSV 模型支持指定的语言有：英语、中文、日语、韩语、粤语。

Fun-ASR 支持 `auto`，以及中文、英语、日语、韩语、德语、法语、俄语、西班牙语和意大利语提示。

#### `-k, --api_key`

指定 `Gummy` 模型需要使用的阿里云 API KEY。

该项默认值为空。

该项仅适用于 Gummy 模型。

#### `-gkey, --glm_api_key`

指定 `glm` 模型需要使用的 API KEY，默认为空。

#### `-gmodel, --glm_model`

指定 `glm` 模型需要使用的模型名称，默认为 `glm-asr-2512`。

#### `-gurl, --glm_url`

指定 `glm` 模型需要使用的 API URL，默认值为：`https://open.bigmodel.cn/api/paas/v4/audio/transcriptions`。

#### Fun-ASR 专属参数

- `-fmodel, --fun_asr_model`：`fun-asr-realtime`（默认）或 `fun-asr-realtime-2025-11-07`。
- `-furl, --fun_asr_url`：Workspace 专属 WSS Endpoint。
- `-fworkspace, --fun_asr_workspace`：Workspace ID。
- `-fkey, --fun_asr_api_key`：阿里云百炼 API Key；留空时读取 `DASHSCOPE_API_KEY`。
- `-fsemantic, --fun_asr_semantic_punctuation`：语义断句，`0` 关闭（默认），`1` 开启。
- `-fsilence, --fun_asr_max_sentence_silence`：最大句间静音毫秒数，默认 `1300`，范围 200–6000。
- `-fheartbeat, --fun_asr_heartbeat`：心跳，`1` 开启（默认），`0` 关闭。
- `-fvocabulary, --fun_asr_vocabulary_id`：已有预编译热词表 ID；留空表示不使用。
- `-fvmodel, --fun_asr_vocabulary_model`：热词表目标模型，必须与 `-fmodel` 相同。
- `-fcontext, --fun_asr_context_term`：上下文术语，可重复传入，总计最多 400 字符；不带权重。

独立运行示例：

```bash
python main.py -e fun_asr -fworkspace <workspace-id> \
  -furl wss://<workspace-id>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference \
  -fkey <dashscope-api-key> -fvocabulary <vocabulary-id> \
  -fcontext "Auto Caption" -fcontext "阿里云百炼" -s zh -t none -d 1
```

#### `-tm, --translation_model`

指定 Vosk 和 SOSV 模型的翻译方式，默认为 `ollama`。

该项支持的值有：

- `ollama` 使用本地 Ollama 模型进行翻译，需要用户安装 Ollama 软件和对应的模型
- `google` 使用 Google 翻译 API 进行翻译，无需额外配置，但是需要有能访问 Google 的网络

该项仅适用于 Vosk 和 SOSV 模型。

#### `-omn, --ollama_name`

指定要使用的翻译模型名称，可以是 Ollama 本地模型，也可以是 OpenAI API 兼容的云端模型。若未填写 Base URL 字段，则默认调用本地 Ollama 服务，否则会通过 Python OpenAI 库调用该地址指向的 API 服务。

如果使用 Ollama 模型，建议使用参数量小于 1B 的模型，比如： `qwen2.5:0.5b`, `qwen3:0.6b`。需要在 Ollama 中下载了对应的模型才能正常使用。

默认值为空，适用于除了 Gummy 外的其他模型。

#### `-ourl, --ollama_url`

调用 OpenAI API 的基础请求地址，如果不填写则调用本地默认端口的 Ollama 模型。

默认值为空，适用于除了 Gummy 外的其他模型。

#### `-okey, --ollama_api_key`

指定调用 OpenAI 兼容模型的 API KEY。

默认值为空，适用于除了 Gummy 外的其他模型。

#### `-vosk, --vosk_model`

指定需要调用的 Vosk 模型的本地文件夹的路径。该项默认值为空。

该项仅适用于 Vosk  模型。

#### `-sosv, --sosv_model`

指定需要调用的 SOSV 模型的本地文件夹的路径。该项默认值为空。

该项仅适用于 SOSV  模型。

### 使用源代码运行字幕引擎

> 以下内容默认使用该方式的用户对 Python 环境配置和使用有所了解。

首先下载项目源代码到本地，其中字幕引擎源代码在项目的 `engine` 目录下。然后配置 Python 环境，其中项目依赖的 Python 包在 `engine` 目录下 `requirements.txt` 文件中。

配置好后进入 `engine` 目录，执行命令进行运行字幕引擎。

比如要使用 Gummy 模型，指定音频类型为系统音频输出，源语言为英语，翻译语言为中文，执行的命令如下：

> 注意：为了更直观，下面的命令写在了多行，如果执行失败，尝试去掉反斜杠，并改换单行命令执行。

```bash
python main.py \
-e gummy \
-k sk-******************************** \
-a 0 \
-d 1 \
-s en \
-t zh
```

指定 Vosk 模型，指定音频类型为系统音频输出，翻译语言为英语，使用 Ollama `qwen3:0.6b` 模型进行翻译：

```bash
python main.py \
-e vosk \
-vosk D:\Projects\auto-caption\engine\models\vosk-model-small-cn-0.22 \
-a 0 \
-d 1 \
-t en \
```

指定 SOSV 模型，指定音频类型为麦克风，自动选择源语言，不翻译，执行的命令如下：

```bash
python main.py \
-e sosv \
-sosv D:\\Projects\\auto-caption\\engine\\models\\sosv-int8 \
-a 1 \
-d 1 \
-s auto \
-t none
```

使用 Gummy 模型的运行效果如下：

![](../img/07.png)

### 运行字幕引擎可执行文件

首先在 [GitHub Release](https://github.com/HiMeditator/auto-caption/releases/tag/engine) 中下载对应平台的可执行文件（目前仅提供 Windows 和 Linux 平台的字幕引擎可执行文件）。

然后再字幕引擎可执行文件所在目录打开终端，执行命令进行运行字幕引擎。

只需要将上述指令中的 `python main.py` 替换为可执行文件名称即可（比如：`engine-win.exe`）。
