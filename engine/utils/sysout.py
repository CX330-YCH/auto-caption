import sys
import json
import sherpa_onnx
import threading

display_caption = False
caption_index = -1
display = sherpa_onnx.Display()
_stdout_lock = threading.Lock()
_stderr_lock = threading.Lock()

def stdout(text: str):
    stdout_cmd("print", text)

def stdout_err(text: str):
    stdout_cmd("error", text)

def stdout_cmd(command: str, content = ""):
    msg = { "command": command, "content": content }
    with _stdout_lock:
        sys.stdout.write(json.dumps(msg) + "\n")
        sys.stdout.flush()

def change_caption_display(val: bool):
    global display_caption
    display_caption = val

def caption_display(obj):
    global display_caption
    global caption_index
    global display

    if caption_index >=0 and caption_index != int(obj['index']):
        display.finalize_current_sentence()
    caption_index = int(obj['index'])
    full_text = f"{obj['text']}\n{obj['translation']}"
    if obj['translation']:
        full_text += "\n"
    display.update_text(full_text)
    display.display()

def translation_display(obj):
    global original_caption
    global display
    full_text = f"{obj['text']}\n{obj['translation']}"
    if obj['translation']:
        full_text += "\n"
    display.update_text(full_text)
    display.display()
    display.finalize_current_sentence()

def stdout_obj(obj):
    global display_caption
    if obj['command'] == 'caption' and display_caption:
        caption_display(obj)
        return
    if obj['command'] == 'translation' and display_caption:
        translation_display(obj)
        return
    with _stdout_lock:
        sys.stdout.write(json.dumps(obj) + "\n")
        sys.stdout.flush()

def stderr(text: str):
    with _stderr_lock:
        sys.stderr.write(text + "\n")
        sys.stderr.flush()
