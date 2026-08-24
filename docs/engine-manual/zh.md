# 字幕引擎说明文档

对应版本：v2.24.0

![](../../assets/media/structure_zh.png)

## 字幕引擎介绍

所谓的字幕引擎实际上是一个子程序，它会实时获取系统音频输入（麦克风）或输出（扬声器）的流式数据，并调用音频转文字的模型生成对应音频的字幕。生成的字幕转换为 JSON 格式的字符串数据，并通过标准输出传递给主程序（需要保证主程序读取到的字符串可以被正确解释为 JSON 对象）。主程序读取并解释字幕数据，处理后显示在窗口上。

**字幕引擎进程和 Electron 主进程之间的通信遵循的标准为：[caption engine api-doc](../api-docs/caption-engine.md)。**

## 运行流程

主进程和字幕引擎通信的流程：

### 启动引擎

- Electron 主进程：使用 `child_process.spawn()` 启动字幕引擎进程
- 字幕引擎进程：创建 TCP Socket 服务器线程，创建后在标准输出中输出转化为字符串的 JSON 对象，该对象中包含 `command` 字段，值为 `connect`
- 主进程：监听字幕引擎进程的标准输出，尝试将标准输出按行分割，解析为 JSON 对象，并判断对象的 `command` 字段值是否为 `connect`，如果是则连接 TCP Socket 服务器

### 字幕识别

- 字幕引擎进程：音频采集线程通过 `AudioPipeline` 将音频块写入本次会话的有界队列；`RecognitionSession` 将音频交给所选 Provider，并统一处理字幕事件、final 翻译和关闭。最后由协议输出层通过标准输出发送字幕数据对象字符串
- Electron 主进程：持续监听字幕引擎的标准输出，并根据解析的对象的 `command` 字段采取不同的操作

### 关闭引擎

- Electron 主进程：当用户在前端操作关闭字幕引擎时，主进程通过 Socket 通信给字幕引擎进程发送 `command` 字段为 `stop` 的对象字符串
- 字幕引擎进程：接收主引擎进程发送的字幕数据对象字符串，将字符串解析为对象，如果对象的 `command` 字段为 `stop`，则将全局变量 `shared_data.status` 的值设置为 `stop`
- 字幕引擎进程：主线程循环监听系统音频输出，当 `thread_data.status` 的值不为 `running` 时，则结束循环，释放资源，结束运行
- Electron 主进程：如果检测到字幕引擎进程结束，进行相应处理，并向前端反馈

## 项目已经实现的功能

以下功能已经实现，可以直接复用。

### 标准输出

可以输出普通信息、命令和错误信息。

样例：

```python
from utils import stdout, stdout_cmd, stdout_obj, stderr
# {"command": "print", "content": "Hello"}\n
stdout("Hello")
# {"command": "connect", "content": "8080"}\n
stdout_cmd("connect", "8080")
# {"command": "print", "content": "print"}\n
stdout_obj({"command": "print", "content": "print"})
# sys.stderr.write("Error Info" + "\n")
stderr("Error Info")
```

### 创建 Socket 服务

该 Socket 服务会监听指定端口，会解析 Electron 主程序发送的内容，并可能改变 `shared_data.status` 的值。

样例：

```python
from protocol.server import start_server
from utils import shared_data
port = 8080
start_server(port)
while thread_data == 'running':
    # do something
    pass
```

### 音频获取

`AudioStream` 类用于获取音频数据，实现是跨平台的，支持 Windows、Linux 和 macOS。该类初始化包含两个参数：

- `audio_type`: 获取音频类型，0 表示系统输出音频（扬声器），1 表示系统输入音频（麦克风）
- `chunk_rate`: 音频数据获取频率，每秒音频获取的音频块的数量，默认为 10

该类包含四个方法：

- `open_stream()`: 开启音频获取
- `read_chunk() -> bytes`: 读取一个音频块
- `close_stream()`: 关闭音频获取
- `close_stream_signal()` 线程安全的关闭系统音频输入流

样例：

```python
from sysaudio import AudioStream
audio_type = 0
chunk_rate = 20
stream =  AudioStream(audio_type, chunk_rate)
stream.open_stream()
while True:
    data = stream.read_chunk()
    # do something with data
    pass
stream.close_stream()
```

### 音频处理

获取到的音频流在转文字之前可能需要进行预处理。一般需要将多通道音频转换为单通道音频，还可能需要进行重采样。本项目提供了两个音频处理函数：

- `merge_chunk_channels(chunk: bytes, channels: int) -> bytes`： 将多通道音频块转换为单通道音频块
- `resample_chunk_mono(chunk: bytes, channels: int, orig_sr: int, target_sr: int) -> bytes`：将当前多通道音频数据块转换成单通道音频数据块，然后进行重采样

样例：

```python
from sysaudio import AudioStream
from utils import merge_chunk_channels
stream =  AudioStream(1)
while True:
    raw_chunk = stream.read_chunk()
    chunk = resample_chunk_mono(raw_chunk, stream.CHANNELS, stream.RATE, 16000)
    # do something with chunk
```

## 字幕引擎需要实现的功能

### 音频转文字

在得到了合适的音频流后，需要将音频流转换为文字了。一般使用各种模型（云端或本地）来实现音频流转文字。需要根据需求选择合适的模型。

这部分应实现为 `RecognitionProvider`，只负责识别生命周期与统一事件，需要实现三个方法：

- `start(self)`：启动模型
- `accept_audio(self, frame: AudioFrame)`：处理一个规范化音频帧，并产生 partial/final/lifecycle 事件
- `stop(self)`：停止模型

Provider 不读取全局队列、不直接写标准输出，也不创建自己的客户端翻译循环；这些职责分别属于 `RecognitionSession`、协议输出层和 `TranslationService`。

完整的字幕引擎实例如下：

- [gummy.py](../../engine/providers/gummy.py)
- [fun_asr.py](../../engine/providers/fun_asr.py)
- [vosk.py](../../engine/providers/vosk.py)
- [sosv.py](../../engine/providers/sosv.py)
- [glm.py](../../engine/providers/glm.py)

### 字幕翻译

有的语音转文字模型并不提供翻译，如果有需求，需要再添加一个翻译模块，也可以使用自带的翻译模块。

样例：

```python
from utils import google_translate, ollama_translate
text = "这是一个翻译测试。"
google_translate("", "en", text, "time_s")
ollama_translate("qwen3:0.6b", "en", text, "time_s")
```

### 字幕数据发送

在获取到当前音频流的文字后，需要将文字发送给主程序。字幕引擎进程通过标准输出将字幕数据传递给 Electron 主进程。

传递的内容必须是 JSON 字符串，其中 JSON 对象需要包含的参数如下：

```typescript
export interface CaptionItem {
  command: "caption",
  event_version: 1,    // 生命周期字段版本
  phase: "partial" | "final",
  index: number,        // 字幕序号
  time_s: string,       // 当前字幕开始时间
  time_t: string,       // 当前字幕结束时间
  text: string,         // 字幕内容
  translation: string   // 字幕翻译
}
```

同一句的中间结果和最终结果必须复用 `index`；`partial` 表示仍可更新，`final` 表示已经固化。新引擎应同时提供 `event_version: 1` 和 `phase`。为兼容旧自定义引擎，两者可以整组省略，但不能只提供其中一个；完整兼容规则见进程协议文档。

**注意必须确保每输出一次字幕 JSON 数据就得刷新缓冲区，确保 electron 主进程每次接收到的字符串都可以被解释为 JSON 对象。** 建议使用项目已经实现的 `stdout_obj` 函数来发送。

### 命令行参数的指定

自定义字幕引擎的设置提供命令行参数指定，因此需要设置好字幕引擎的参数，本项目目前用到的参数如下：

> `engine/cli.py` 和 `python main.py --help` 是完整参数的唯一权威来源。Fun-ASR 使用 `-e fun_asr`，并通过 `-fmodel`、`-furl`、`-fworkspace`、`-fkey`、`-fsemantic`、`-fsilence`、`-fheartbeat`、`-fvocabulary`、`-fvmodel` 和可重复的 `-fcontext` 配置；不得在 `main.py` 再复制一条装配分支。

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Convert system audio stream to text')
    # all
    parser.add_argument('-e', '--caption_engine', default='gummy', help='Caption engine: gummy or vosk')
    parser.add_argument('-a', '--audio_type', default=0, help='Audio stream source: 0 for output, 1 for input')
    parser.add_argument('-c', '--chunk_rate', default=10, help='Number of audio stream chunks collected per second')
    parser.add_argument('-p', '--port', default=0, help='The port to run the server on, 0 for no server')
    parser.add_argument('-t', '--target_language', default='zh', help='Target language code, "none" for no translation')
    parser.add_argument('-r', '--record', default=0, help='Whether to record the audio, 0 for no recording, 1 for recording')
    parser.add_argument('-rp', '--record_path', default='', help='Path to save the recorded audio')
    # gummy and sosv
    parser.add_argument('-s', '--source_language', default='auto', help='Source language code')
    # gummy only
    parser.add_argument('-k', '--api_key', default='', help='API KEY for Gummy model')
    # vosk and sosv
    parser.add_argument('-tm', '--translation_model', default='ollama', help='Model for translation: ollama or google')
    parser.add_argument('-omn', '--ollama_name', default='', help='Ollama model name for translation')
    # vosk only
    parser.add_argument('-vosk', '--vosk_model', default='', help='The path to the vosk model.')
    # sosv only
    parser.add_argument('-sosv', '--sosv_model', default=None, help='The SenseVoice model path')
```

比如对于本项目的字幕引擎，我想使用 Gummy 模型，指定原文为日语，翻译为中文，获取系统音频输出的字幕，每次截取 0.1s 的音频数据，那么命令行参数如下：

```bash
python main.py -e gummy -s ja -t zh -a 0 -c 10 -k <dashscope-api-key>
```

Fun-ASR 示例：

```bash
python main.py -e fun_asr -s ja -t zh -a 0 -c 10 \
  -fworkspace <workspace-id> \
  -furl wss://<workspace-id>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference \
  -fkey <dashscope-api-key> -fvocabulary <vocabulary-id> \
  -fvmodel fun-asr-realtime -fcontext "Auto Caption" -fcontext "阿里云百炼"
```

该 Provider 使用官方 DashScope SDK，输入必须为 16 kHz 单声道 PCM16。partial/final、服务端时间戳、用量和生命周期只转换为统一事件；final 翻译、stdout 和关闭流程仍由 Session/协议层负责。`HotwordRuntimeConfig` 校验热词表目标模型与识别模型一致，并在每次新任务启动时传入预编译热词 ID 和最多 400 字符的无权重上下文。远端 CRUD 由 `services/hotwords.py` 的独立一次性 worker 承担，不进入 Provider 或公开字幕协议。

Fun-ASR 为每个连接 generation 维护幂等状态：同一次任务的 `on_error → on_close → stop` 最多触发一次重连或一次 fatal。永久服务错误立即终止，暂时错误才进行三次有界退避重连；task-failed 后不会再次调用 SDK `stop()`。生命周期细节通过隐藏的 `debug` 协议事件写入完整 Debug 日志，原有日志记录页不显示 DEBUG。fatal 会请求 Session 正常关闭资源；只有超时等异常路径才由 Electron 强杀整个打包进程树。

所有内置字幕引擎（Gummy、Fun-ASR、GLM、Vosk、SOSV、Apple Speech）及音频、翻译、热词 SDK 的错误都会把脱敏后的 SDK 回调字段、异常类型、消息、自定义属性、完整 traceback 和 cause/context 写入本次 Debug JSONL。Python/SDK stderr 同样完整收集。API Key、Token、密码、Authorization、Cookie 和二进制音频正文始终不记录；过大的远端响应采用明确的有界截断标记。

V6 Debug Mode 通过 `--debug-mode 0|1` 启动，并可由 TCP `debug_mode` command 即时切换。开启后 `ProviderMetric` 统一输出音频帧读取/转换/入队、队列深度与帧龄、Provider event 队列、Fun-ASR 重连缓冲、GLM/翻译 Worker 和 Apple Speech helper 状态。Provider 专属指标通过 `diagnostic_snapshot()` 扩展，Session 不增加 Provider 条件分支。超过 512 KiB 的错误诊断使用带长度和 SHA-256 的 `diagnostic_chunk` 分块，避免 Electron 的单行限制丢失根因。

### Apple Speech Provider

`apple_speech` 只在 macOS 26+ 使用。Electron 先通过 Swift 辅助程序的 `probe`、`model-status`、`model-install`、`model-release` 子命令管理系统能力和 `AssetInventory` 模型；这些操作与 Python 字幕引擎启动超时分离。真正识别时，Python Provider 用 `-ash/--apple_speech_helper` 指定辅助程序路径，把现有音频管线产生的单声道 PCM16 写入其 stdin，并读取版本为 1 的 NDJSON。Swift 侧将 `SpeechTranscriber` 的 volatile/final 结果映射为稳定 ID；撤回映射为公开增量 `caption_remove` 事件。final 仍只由统一 Session 触发一次外部翻译。系统音频来源继续复用现有 BlackHole 路径。

## 其他

### 通信规范

[caption engine api-doc](../api-docs/caption-engine.md)

### 程序入口

[main.py](../../engine/main.py)

### 开发建议

除音频转文字和翻译外，其他（音频获取、音频重采样、与主进程通信）建议直接复用本项目代码。如果这样，那么需要添加的内容为：

- `engine/providers/`：添加实现 `RecognitionProvider` 的识别适配器
- `engine/providers/registry.py`：注册 Provider 及其音频 Pipeline、翻译服务装配
- `engine/cli.py`：仅在模型确实需要新配置时添加参数；不要在 `main.py` 增加新的模型分支

完整职责和依赖规则见[当前 Python 引擎架构](architecture.md)。

### 打包

在完成字幕引擎的开发和测试后，需要将字幕引擎打包成可执行文件。一般使用 `pyinstaller` 进行打包。如果打包好的字幕引擎文件执行报错，可能是打包漏掉了某些依赖库，请检查是否缺少了依赖库。

### 运行

有了可以使用的字幕引擎，就可以在字幕软件窗口中通过指定字幕引擎的路径和字幕引擎的运行指令（参数）来启动字幕引擎了。

![](../img/02_zh.png)
