import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTalkPiConfig } from "../../src/config.ts";
import { defaultTemporaryWavRoot } from "../../src/tts/temp-wav.ts";
import { createToolPathFixture } from "./tools-test-utils.ts";

function run(): void {
  const config = loadTalkPiConfig({
    TALK_PI_SEND_TRANSCRIPT_KEY: " F8 ",
    TALK_PI_INSERT_TRANSCRIPT_KEY: " F7 ",
    TALK_PI_PIPER_BIN: " /opt/piper/bin/piper ",
    TALK_PI_PIPER_MODEL_PATH: " /opt/piper/voices/voice.onnx ",
    TALK_PI_TTS_OUTPUT_DIR: " /tmp/talk-pi-tts ",
    TALK_PI_WHISPER_MODEL_PATH: " /tmp/whisper.bin ",
    TALK_PI_WHISPER_MODEL_URL: " https://example.com/whisper.bin ",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(config.shortcuts, {
    sendTranscriptKey: "f8",
    insertTranscriptKey: "f7",
    pausePlaybackKey: "alt+p",
  });
  assert.deepEqual(config.piper, {
    binaryPath: "/opt/piper/bin/piper",
    modelPath: "/opt/piper/voices/voice.onnx",
    outputDir: "/tmp/talk-pi-tts",
  });
  assert.deepEqual(config.whisper, {
    modelPath: "/tmp/whisper.bin",
    modelUrl: "https://example.com/whisper.bin",
  });

  const toolsDir = fs.mkdtempSync(path.join(os.tmpdir(), "talk-pi-tools-"));
  const localFixture = createToolPathFixture();
  const defaults = loadTalkPiConfig({
    ...localFixture.env,
    TALK_PI_TOOLS_DIR: toolsDir,
    TALK_PI_PIPER_MODEL_PATH: "/opt/piper/voices/voice.onnx",
  } as NodeJS.ProcessEnv);

  assert.equal(defaults.piper.binaryPath, path.join(toolsDir, "piper", process.platform === "win32" ? "piper.exe" : "piper"));
  assert.equal(defaults.piper.outputDir, defaultTemporaryWavRoot());
  assert.equal(defaults.piper.outputDir, path.join(os.homedir(), ".pi", "agent", "extensions", "talk-pi", "tts"));
  assert.equal(defaults.piper.modelPath, "/opt/piper/voices/voice.onnx");
  assert.equal(
    defaults.whisper.modelPath,
    path.join(toolsDir, "whisper", "models", "ggml-base.bin"),
  );

  const fixture = createToolPathFixture({ withHomePi: true });
  const userDefaults = loadTalkPiConfig({ ...fixture.env } as NodeJS.ProcessEnv);
  assert.equal(
    userDefaults.piper.binaryPath,
    path.join(fixture.homeToolsDir, "piper", process.platform === "win32" ? "piper.exe" : "piper"),
  );
  assert.equal(
    userDefaults.piper.modelPath,
    path.join(fixture.homeToolsDir, "piper", "models", "pt_BR-faber-medium.onnx"),
  );
  assert.equal(
    userDefaults.whisper.modelPath,
    path.join(fixture.homeToolsDir, "whisper", "models", "ggml-base.bin"),
  );
}

run();
