# File: app/schemas/assistant_schema.py
from typing import Literal, Optional, List
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """One turn of conversation as sent by the client.

    History lives on the device (AsyncStorage), not in our DB, so the client
    replays it on every request. We never trust it blindly — the router trims
    it and always prepends its own system prompt, so a tampered client can't
    inject a replacement system message.
    """
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=40)
    # The month the user is currently looking at (YYYY-MM). Lets the model
    # answer "how am I doing?" without first having to ask "which month?".
    month: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}$")


class TranscriptionOut(BaseModel):
    text: str


class AssistantHealth(BaseModel):
    """Capability report driving the client's UI state.

    `chat` and `voice` are deliberately independent: the mic renders disabled
    when voice is False while text chat stays fully usable, and vice versa.
    """
    chat: bool
    voice: bool
    voice_reason: Optional[str] = None
