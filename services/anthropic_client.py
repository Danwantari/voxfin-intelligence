import os
import re
import json
import anthropic

CLAUDE_MODEL = "claude-haiku-4-5"


def get_client(api_key: str = None):
    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    return anthropic.Anthropic(api_key=key) if key else None


def chat_json(client: "anthropic.Anthropic", messages: list, max_tokens: int = 2048, system: str = None) -> dict:
    """Call Claude and parse a JSON object out of its reply.

    Mirrors the Groq `response_format={"type": "json_object"}` behavior this
    pipeline used to rely on: Claude has no native JSON mode, so we instruct
    it to reply with raw JSON and strip markdown fences defensively.
    """
    kwargs = {"model": CLAUDE_MODEL, "max_tokens": max_tokens, "messages": messages}
    if system:
        kwargs["system"] = system

    response = client.messages.create(**kwargs)
    text = "".join(block.text for block in response.content if block.type == "text").strip()

    if text.startswith("```"):
        text = re.sub(r"^```(json)?", "", text).rsplit("```", 1)[0].strip()

    return json.loads(text)
