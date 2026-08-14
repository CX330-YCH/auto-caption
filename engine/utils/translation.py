from ollama import chat, Client
from ollama import ChatResponse
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
import asyncio
from googletrans import Translator
from .sysout import stdout_obj

lang_map = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'zh-cn': 'Chinese'
}

def ollama_translate(
    model: str,
    target: str,
    text: str,
    time_s: str,
    caption_id: int,
    url: str = '',
    key: str = '',
):
    content = ""
    if url:
        if OpenAI:
            client = OpenAI(base_url=url, api_key=key if key else "ollama")
            openai_response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": f"/no_think Translate the following content into {lang_map[target]}, and do not output any additional information."},
                    {"role": "user", "content": text}
                ]
            )
            content = openai_response.choices[0].message.content or ""
        else:
            client = Client(host=url)
            response: ChatResponse = client.chat(
                model=model,
                messages=[
                    {"role": "system", "content": f"/no_think Translate the following content into {lang_map[target]}, and do not output any additional information."},
                    {"role": "user", "content": text}
                ]
            )
            content = response.message.content or ""
    else:
        response: ChatResponse = chat(
            model=model,
            messages=[
                {"role": "system", "content": f"/no_think Translate the following content into {lang_map[target]}, and do not output any additional information."},
                {"role": "user", "content": text}
            ]
        )
        content = response.message.content or ""

    if content.startswith('<think>'):
        index = content.find('</think>')
        if index != -1:
            content = content[index+8:]
    stdout_obj({
        "command": "translation",
        "caption_id": caption_id,
        "time_s": time_s,
        "text": text,
        "translation": content.strip()
    })

def google_translate(
    model: str,
    target: str,
    text: str,
    time_s: str,
    caption_id: int,
):
    translator = Translator()
    res = asyncio.run(translator.translate(text, dest=target))
    stdout_obj({
        "command": "translation",
        "caption_id": caption_id,
        "time_s": time_s,
        "text": text,
        "translation": res.text
    })
