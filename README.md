# talk-pi

Talk-Pi is Pi extension for local voice capture, Whisper transcription, and Piper TTS playback.

## What it does

- `/talk-pi` opens unified voice menu
- push-to-talk records audio and sends it to Whisper
- replies are spoken with Piper
- voice model and output language can be selected between English and Portuguese
- Voice Language and mute state are saved and restored on the next open
- downloads show `Talk-pi: Downloading 📥`

## Install

```bash
pi install npm:talk-pi
```

`pi install` brings Talk-Pi package plus bundled tools. At runtime, Talk-Pi prefers `~/.pi/agent/extensions/talk-pi` when `~/.pi` exists, otherwise it creates/uses local `./tools`, so no PATH setup is needed.

## Requirements

- Node.js 24+
- `~/.pi/agent/extensions/talk-pi` when a user-scoped `.pi` folder exists, otherwise local `./tools`
- `./tools/piper/piper` or `./tools/piper/piper.exe`
- voice capture uses bundled microphone support
- Piper voice model under `./tools/piper/models/`
- Whisper model under `./tools/whisper/models/`

Talk-Pi prefers `~/.pi/agent/extensions/talk-pi` when available and falls back to local `./tools` for fresh installs.

## Setup & Configuration

1. Copy `.env.example` to `.env`.
2. Run `pi install npm:talk-pi` to bring bundled tools automatically.
3. If `~/.pi` exists, keep user-scoped tools under `~/.pi/agent/extensions/talk-pi`.
4. If `~/.pi` does not exist, Talk-Pi creates and uses local `./tools` in the install folder.
5. Adjust `TALK_PI_TOOLS_DIR` only if the local `tools/` folder lives somewhere else.

| Variable | Default / Note |
| --- | --- |
| `TALK_PI_SEND_TRANSCRIPT_KEY` | `F9` |
| `TALK_PI_INSERT_TRANSCRIPT_KEY` | `F10` |
| `TALK_PI_PAUSE_PLAYBACK_KEY` | `Alt+P` (pause / resume spoken reply) |
| `TALK_PI_TOOLS_DIR` | `./tools` (override) |
| `TALK_PI_PIPER_BIN` | `./tools/piper/piper` |
| `TALK_PI_PIPER_MODEL_PATH` | `./tools/piper/models/pt_BR-faber-medium.onnx` |
| `TALK_PI_TTS_OUTPUT_DIR` | `~/.pi/agent/extensions/talk-pi/tts` |
| `TALK_PI_WHISPER_MODEL_PATH` | `./tools/whisper/models/ggml-base.bin` |
| `TALK_PI_WHISPER_MODEL_URL` | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin` |
| `TALK_PI_TRANSCRIBE_TIMEOUT_MS` | `60000` |
| `TALK_PI_TRANSCRIBE_FIRST_TIMEOUT_MS` | `600000` |

## Usage

1. Open `/talk-pi`.
2. Choose push-to-talk.
3. Record speech.
4. Wait for Whisper transcription.
5. Listen to Piper reply, or send/insert transcript as needed.

## Platform notes

- Windows, Linux, and macOS use same setup.
- Unzip Piper into `~/.pi/agent/extensions/talk-pi/piper` when using a user-scoped `.pi` folder, or `./tools/piper` for a local install.
- No separate recorder install needed.
- Put voice and Whisper models under `~/.pi/agent/extensions/talk-pi/piper/models` or `./tools/piper/models`, and the Whisper model under the matching `whisper/models` folder.
- `TALK_PI_TOOLS_DIR` is only needed if the tools folder lives elsewhere.

## Publish

```bash
npm publish --access public
```

