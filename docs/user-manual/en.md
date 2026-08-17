# Auto Caption User Manual

Corresponding Version: v2.16.0

**Note: Due to limited personal resources, the English and Japanese documentation files for this project (except for the README document) will no longer be maintained. The content of this document may not be consistent with the latest version of the project. If you are willing to help with translation, please submit relevant Pull Requests.**

## Software Introduction

Auto Caption is a cross-platform caption display software that can real-time capture system audio input (recording) or output (playback) streaming data and use an audio-to-text model to generate captions for the corresponding audio. The default caption engine provided by the software (using Alibaba Cloud Gummy model) supports recognition and translation in nine languages (Chinese, English, Japanese, Korean, German, French, Russian, Spanish, Italian).

The default caption engine currently has full functionality on Windows, macOS, and Linux platforms. Additional configuration is required to capture system audio output on macOS.

The following operating system versions have been tested and confirmed to work properly. The software cannot guarantee normal operation on untested OS versions.

| OS Version         | Architecture | Audio Input Capture | Audio Output Capture |
| ------------------ | ------------ | ------------------- | -------------------- |
| Windows 11 24H2    | x64          | ✅                   | ✅                    |
| macOS Sequoia 15.5 | arm64        | ✅ Additional config required  | ✅          |
| Ubuntu 24.04.2     | x64          | ✅                   | ✅                    |
| Kali Linux 2022.3  | x64          | ✅                   | ✅                    |
| Kylin Server V10 SP3 | x64 | ✅ | ✅ |

![](../../assets/media/main_en.png)

### Software Limitations

To use the Gummy caption engine, you need to obtain an API KEY from Alibaba Cloud.

Additional configuration is required to capture audio output on macOS platform.

The software is built using Electron, so the software size is inevitably large.

## Preparation for Using Gummy Engine

To use the default caption engine provided by the software (Alibaba Cloud Gummy), you need to obtain an API KEY from the Alibaba Cloud Bailian platform. Then add the API KEY to the software settings or configure it in environment variables (only Windows platform supports reading API KEY from environment variables).

**The international version of Alibaba Cloud services does not provide the Gummy model, so non-Chinese users currently cannot use the default caption engine.**

Alibaba Cloud provides detailed tutorials for this part, which can be referenced:

- [Obtaining API KEY (Chinese)](https://help.aliyun.com/zh/model-studio/get-api-key)
- [Configuring API Key through Environment Variables (Chinese)](https://help.aliyun.com/zh/model-studio/configure-api-key-through-environment-variables)


## Preparation for GLM Engine

You need to obtain an API KEY first, refer to: [Quick Start](https://docs.bigmodel.cn/en/guide/start/quick-start).

## Preparation for Fun-ASR Realtime

Create or select an Alibaba Cloud Model Studio Workspace, then use an API key, Workspace ID, and dedicated WebSocket endpoint from that same Workspace and region. The endpoint must be an official Beijing or Singapore URL in the form `wss://<WorkspaceId>.<region>.maas.aliyuncs.com/api-ws/v1/inference`, and the embedded Workspace ID must match the configured value. This online service may incur charges; review the [official WebSocket API documentation](https://help.aliyun.com/zh/model-studio/fun-asr-realtime-websocket-api) and current pricing before use.

The UI exposes the model, semantic punctuation, maximum sentence silence (200–6000 ms), and heartbeat settings. Final Fun-ASR sentences use the existing external translation configuration.

The caption engine initializes the operating system's native CA trust store at startup: macOS Security and Keychain trust, Windows CryptoAPI, and the system OpenSSL certificate paths on Linux. Install an enterprise proxy or private CA into the system trust store first. The application does not disable TLS certificate verification and does not depend on a separate CA file that may be absent from the packaged Python runtime.

Hotwords under More Settings have two levels. Level 1 accepts an existing vocabulary ID and its target model plus one context term per line. Context is unweighted, limited to 400 combined characters, and can be used with the vocabulary. Click Apply Changes before a recognition task uses this draft. Level 2 uses the applied API-key owner account, Workspace, region, and model to list, create, fully replace, or delete remote vocabularies. Remote writes take effect immediately and Cancel Changes cannot undo them. Delete shows the full target and requires confirmation. The vocabulary model must exactly match the recognition model; Alibaba Cloud currently states that Singapore sub-workspaces do not support hotwords.

## Preparation for Using Vosk Engine

To use the Vosk local caption engine, first download your required model from the [Vosk Models](https://alphacephei.com/vosk/models) page. Then extract the downloaded model package locally and add the corresponding model folder path to the software settings.

![](../../assets/media/config_en.png)

## Using SOSV Model

The way to use the SOSV model is the same as Vosk. The download address is as follows: https://github.com/HiMeditator/auto-caption/releases/tag/sosv-model

## Capturing System Audio Output on macOS

> Based on the [Setup Multi-Output Device](https://github.com/ExistentialAudio/BlackHole/wiki/Multi-Output-Device) tutorial

The caption engine cannot directly capture system audio output on macOS platform and requires additional driver installation. The current caption engine uses [BlackHole](https://github.com/ExistentialAudio/BlackHole). First open Terminal and execute one of the following commands (recommended to choose the first one):

```bash
brew install blackhole-2ch
brew install blackhole-16ch
brew install blackhole-64ch
```

![](../img/03.png)

After installation completes, open `Audio MIDI Setup` (searchable via `cmd + space`). Check if BlackHole appears in the device list - if not, restart your computer.

![](../img/04.png)

Once BlackHole is confirmed installed, in the `Audio MIDI Setup` page, click the plus (+) button at bottom left and select "Create Multi-Output Device". Include both BlackHole and your desired audio output destination in the outputs. Finally, set this multi-output device as your default audio output device.

![](../img/05.png)

Now the caption engine can capture system audio output and generate captions.

## Getting System Audio Output on Linux

First execute in the terminal:

```bash
pactl list short sources
```

If you see output similar to the following, no additional configuration is needed:

```bash
220     alsa_output.pci-0000_02_02.0.3.analog-stereo.monitor    PipeWire        s16le 2ch 48000Hz       SUSPENDED
221     alsa_input.pci-0000_02_02.0.3.analog-stereo     PipeWire        s16le 2ch 48000Hz       SUSPENDED
```

Otherwise, install `pulseaudio` and `pavucontrol` using the following commands:

```bash
# For Debian/Ubuntu etc.
sudo apt install pulseaudio pavucontrol
# For CentOS etc.
sudo yum install pulseaudio pavucontrol
```

## Software Usage

### Modifying Settings

Caption settings can be divided into three categories: general settings, caption engine settings, and caption style settings. Note that changes to general settings take effect immediately. For the other two categories, after making changes, you need to click the "Apply" option in the upper right corner of the corresponding settings module for the changes to take effect. If you click "Cancel Changes," the current modifications will not be saved and will revert to the previous state.

The minimum caption control window size is 900×600. When its content area is narrower than 1200px, the settings panel collapses into a Settings rail on the left. Hover over or focus the rail with the keyboard to open it temporarily, or click it to keep it open. Click it again, click outside the settings area, or press Esc to close it. Unapplied caption engine and caption style drafts remain intact while the panel opens, closes, or crosses the responsive breakpoint. At panel widths up to 480px, form labels and controls use a consistent stacked layout; language, theme, color, caption-line, and switch controls remain complete units instead of breaking into orphaned rows. The caption style preview is docked at the bottom of the right pane and uses at most 35% of the content height; excess preview content scrolls inside that area instead of covering caption records.

The current version uses a layered configuration file with `schemaVersion: 5`. Complete V2 configurations migrate through V3 and V4 to V5, while V3 and V4 continue through the remaining steps. Display Mode defaults to Sentence View and Sentence Boundaries defaults to Break at Sentences, so upgrading preserves existing behavior. Unversioned configuration still falls back to defaults.

Caption engine settings show the languages and provider fields for the selected engine. Disabling translation hides and omits translation-service parameters; after enabling it, "Configure Translation Engine" expands the provider, model, Base URL, and API key fields. "More Settings" shows the selected engine's credentials or local model path plus shared settings. Switching engines preserves saved settings, and changes are saved only after clicking "Apply Changes."

### Starting and Stopping Captions

After completing all configurations, click the "Start Caption Engine" button on the interface to start the captions. If you need a separate caption display window, click the "Open Caption Window" button to activate the independent caption display window. To pause caption recognition, click the "Stop Caption Engine" button.

### Adjusting the Caption Display Window

The following image shows the caption display window, which displays the latest captions in real time. Streaming updates for one sentence replace it in place, and a final sentence cannot be overwritten by a delayed partial result. Caption Style offers Sentence View and Line Rolling. Sentence View preserves the existing most-recent-caption behavior, and both modes display text within symmetric safe margins. Line Rolling always wraps using the actual content width, font, and size. Only complete rows produced by automatic wrapping are justified; rows ended by sentence boundaries and the current final row stay left-aligned. Source and translated text each retain the configured number of visual rows and scroll independently, so a delayed translation cannot displace source rows. Line Rolling also offers Break at Sentences or Continuous Layout. The first starts every normalized sentence on a new line; the second lets the next caption continue at the end of the previous sentence until the actual width requires wrapping. One selection controls source and translation together, while both tracks remain independent. A new tail row moves older rows in the same track upward with an approximately 500 ms animation; historical translation backfill, resizing, and font changes reflow without pretending to be new captions. The animation is disabled when the operating system requests reduced motion. The toolbar on the right hides automatically and reappears when the pointer enters the window or toolbar, or when it receives keyboard focus; it is an overlay and does not consume caption layout width. Its three buttons close the caption window, open the control window, and enable mouse pass-through. Adjust the window width by dragging its left or right edge.

![](../img/01.png)

### Exporting Caption Records

In the caption control window, you can see the records of all collected captions. Click the "Export Log" button to export the caption records as a JSON or SRT file.

### Saving the Complete Debug Log

The Software Log view continues to show the existing INFO, WARN, and ERROR entries and does not display DEBUG. For troubleshooting, click "Save Complete Debug Log" to export the complete session since this software launch as a `.jsonl` file. Clearing the visible Software Log does not erase that session file. Structured diagnostics and exception stacks are preserved, while API keys, tokens, passwords, and Authorization values are always redacted. The export contains records produced up to the time the button is clicked.

## Caption Engine

The so-called caption engine is essentially a subprogram that captures real-time streaming data from system audio input (recording) or output (playback), and invokes speech-to-text models to generate corresponding captions. The generated captions are converted into JSON-formatted strings and passed to the main program through standard output. The main program reads the caption data, processes it, and displays it in the window.

The software provides five built-in caption engines. Choose "Add Custom Engine…" in the engine menu, enter a display name, and the new entry is selected and retained in that menu. A delete button appears on the right of each custom entry. The engine path is the custom executable location, while the command contains its runtime arguments.

![](../img/02_en.png)

Note that when using a custom caption engine, all previous caption engine settings will be ineffective, and the configuration of the custom caption engine is entirely done through the engine command.

If you are a developer and want to develop a custom caption engine, please refer to the [Caption Engine Explanation Document](../engine-manual/en.md).

## Using Caption Engine Standalone

### Runtime Parameter Description

> The following content assumes users have some knowledge of running programs via terminal.

The complete set of runtime parameters available for the caption engine is shown below:

![](../img/06.png)

However, when used standalone, some parameters may not need to be used or should not be modified.

The following parameter descriptions only include necessary parameters.

#### `-e , --caption_engine`

The caption engine model to select; five options are available: `gummy, glm, vosk, sosv, fun_asr`.

The default value is `gummy`.

This applies to all models.

#### `-a, --audio_type`

The audio type to recognize, where `0` represents system audio output and `1` represents microphone audio input.

The default value is `0`.

This applies to all models.

#### `-d, --display_caption`

Whether to display captions in the console, `0` means do not display, `1` means display.

The default value is `0`, but it's recommended to choose `1` when using only the caption engine.

This applies to all models.

#### `-t, --target_language`

> Note that Vosk and SOSV models have poor sentence segmentation, which can make translated content difficult to understand. It's not recommended to use translation with these two models.

Target language for translation. All models support the following translation languages:

- `none` No translation
- `zh` Simplified Chinese
- `en` English
- `ja` Japanese
- `ko` Korean

Additionally, `vosk` and `sosv` models also support the following translations:

- `de` German
- `fr` French
- `ru` Russian
- `es` Spanish
- `it` Italian

The default value is `none`.

This applies to all models.

#### `-s, --source_language`

Source language for recognition. Default value is `auto`, meaning no specific source language.

Specifying the source language can improve recognition accuracy to some extent. You can specify the source language using the language codes above.

This applies to Gummy, GLM, SOSV, and Fun-ASR models.

The Gummy model can use all the languages mentioned above, plus Cantonese (`yue`).

The GLM model supports specifying the following languages: English, Chinese, Japanese, Korean.

The SOSV model supports specifying the following languages: English, Chinese, Japanese, Korean, and Cantonese.

Fun-ASR supports `auto` plus Chinese, English, Japanese, Korean, German, French, Russian, Spanish, and Italian hints.

#### `-k, --api_key`

Specify the Alibaba Cloud API KEY required for the `Gummy` model.

Default value is empty.

This only applies to the Gummy model.

#### `-gkey, --glm_api_key`  

Specifies the API KEY required for the `glm` model. The default value is empty.  

#### `-gmodel, --glm_model`  

Specifies the model name to be used for the `glm` model. The default value is `glm-asr-2512`.  

#### `-gurl, --glm_url`  

Specifies the API URL required for the `glm` model. The default value is: `https://open.bigmodel.cn/api/paas/v4/audio/transcriptions`.  

#### Fun-ASR-specific parameters

- `-fmodel, --fun_asr_model`: `fun-asr-realtime` (default) or `fun-asr-realtime-2025-11-07`.
- `-furl, --fun_asr_url`: the Workspace-specific WSS endpoint.
- `-fworkspace, --fun_asr_workspace`: the Workspace ID.
- `-fkey, --fun_asr_api_key`: the Model Studio API key; when empty, `DASHSCOPE_API_KEY` is used.
- `-fsemantic, --fun_asr_semantic_punctuation`: semantic punctuation, `0` off (default), `1` on.
- `-fsilence, --fun_asr_max_sentence_silence`: maximum sentence silence in milliseconds, default `1300`, range 200–6000.
- `-fheartbeat, --fun_asr_heartbeat`: heartbeat, `1` on (default), `0` off.
- `-fvocabulary, --fun_asr_vocabulary_id`: an existing precompiled vocabulary ID; empty disables it.
- `-fvmodel, --fun_asr_vocabulary_model`: the vocabulary target model; it must match `-fmodel`.
- `-fcontext, --fun_asr_context_term`: a repeatable, unweighted context term; all terms together are limited to 400 characters.

Standalone example:

```bash
python main.py -e fun_asr -fworkspace <workspace-id> \
  -furl wss://<workspace-id>.cn-beijing.maas.aliyuncs.com/api-ws/v1/inference \
  -fkey <dashscope-api-key> -fvocabulary <vocabulary-id> \
  -fcontext "Auto Caption" -fcontext "Alibaba Cloud" -s en -t none -d 1
```

#### `-tm, --translation_model`

Specify the translation method for Vosk and SOSV models. Default is `ollama`.

Supported values are:

- `ollama` Use local Ollama model for translation. Users need to install Ollama software and corresponding models
- `google` Use Google Translate API for translation. No additional configuration needed, but requires network access to Google

This only applies to Vosk and SOSV models.

#### `-omn, --ollama_name`

Specifies the name of the translation model to be used, which can be either a local Ollama model or a cloud model compatible with the OpenAI API. If the Base URL field is not filled in, the local Ollama service will be called by default; otherwise, the API service at the specified address will be invoked via the Python OpenAI library.  

If using an Ollama model, it is recommended to use a model with fewer than 1B parameters, such as `qwen2.5:0.5b` or `qwen3:0.6b`. The corresponding model must be downloaded in Ollama for normal use.  

The default value is empty and applies to models other than Gummy.  

#### `-ourl, --ollama_url`

The base request URL for calling the OpenAI API. If left blank, the local Ollama model on the default port will be called.  

The default value is empty and applies to models other than Gummy.  

#### `-okey, --ollama_api_key`

Specifies the API KEY for calling OpenAI-compatible models.  

The default value is empty and applies to models other than Gummy.  

#### `-vosk, --vosk_model`

Specify the path to the local folder of the Vosk model to call. Default value is empty.

This only applies to the Vosk model.

#### `-sosv, --sosv_model`

Specify the path to the local folder of the SOSV model to call. Default value is empty.

This only applies to the SOSV model.

### Running Caption Engine Using Source Code

> The following content assumes users who use this method have knowledge of Python environment configuration and usage.

First, download the project source code locally. The caption engine source code is located in the  `engine` directory of the project. Then configure the Python environment, where the project dependencies are listed in the `requirements.txt` file in the `engine` directory.

After configuration, enter the `engine` directory and execute commands to run the caption engine.

For example, to use the Gummy model, specify audio type as system audio output, source language as English, and target language as Chinese, execute the following command:

> Note: For better visualization, the commands below are written on multiple lines. If execution fails, try removing backslashes and executing as a single line command.

```bash
python main.py \
-e gummy \
-k sk-******************************** \
-a 0 \
-d 1 \
-s en \
-t zh
```

To specify the Vosk model, audio type as system audio output, translate to English, and use Ollama `qwen3:0.6b` model for translation:

```bash
python main.py \
-e vosk \
-vosk D:\Projects\auto-caption\engine\models\vosk-model-small-cn-0.22 \
-a 0 \
-d 1 \
-t en \
```

To specify the SOSV model, audio type as microphone, automatically select source language, and no translation:

```bash
python main.py \
-e sosv \
-sosv D:\\Projects\\auto-caption\\engine\\models\\sosv-int8 \
-a 1 \
-d 1 \
-s auto \
-t none
```

Running result using the Gummy model is shown below:

![](../img/07.png)

### Running Subtitle Engine Executable File

First, download the executable file for your platform from [GitHub Releases](https://github.com/HiMeditator/auto-caption/releases/tag/engine) (currently only Windows and Linux platform executable files are provided).

Then open a terminal in the directory containing the caption engine executable file and execute commands to run the caption engine.

Simply replace `python main.py` in the above commands with the executable file name (for example: `engine-win.exe`).
