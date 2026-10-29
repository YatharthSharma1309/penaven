# Free LLM path (no payment)

You do **not** need a paid Google plan to develop or demo Penaven.

## Default free path: OpenRouter

1. Create a free key: https://openrouter.ai/keys  
2. In `.env`:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_CHAT_MODEL=openrouter/free
AI_PROVIDER_PREFERENCE=openrouter
```

`AI_PROVIDER_PREFERENCE=openrouter` (or `free`) **skips Gemini**, so a zero-quota Gemini key will not break chat with 429s.

## Gemini when quota is available (still free)

Google AI Studio free generate quota is optional. OpenRouter remains the fallback.

1. https://aistudio.google.com/apikey — try a **new project** if generate returns quota limit 0
2. Set `GEMINI_API_KEY` + `AI_PROVIDER_PREFERENCE=auto`
3. OpenRouter remains the automatic fallback if Gemini fails

Firebase Realtime Database Spark is also free for agent-run evidence — see [GCP_AND_GEMINI_SETUP.md](./GCP_AND_GEMINI_SETUP.md).

## Health check

`GET /api/health` returns `status`, `database`, and `timestamp`. It does not report which LLM is configured. Confirm Gemini by sending a widget message and reading the execution log model column.
