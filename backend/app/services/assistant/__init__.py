# File: app/services/assistant/__init__.py
"""In-app assistant: chat (NVIDIA NIM) + speech-to-text (Groq Whisper).

Read-only by design — see tools.py. The assistant can answer questions about
the user's own finances and point them at the screen that performs an action,
but it cannot write to the database itself.
"""
