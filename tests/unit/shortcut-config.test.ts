import assert from "node:assert/strict";
import { getTalkPiShortcutConfig } from "../../src/input/shortcut-config.ts";

assert.deepEqual(getTalkPiShortcutConfig({} as NodeJS.ProcessEnv), {
  sendTranscriptKey: "f9",
  insertTranscriptKey: "f10",
  pausePlaybackKey: "alt+p",
});

assert.deepEqual(
  getTalkPiShortcutConfig(
    {
      TALK_PI_SEND_TRANSCRIPT_KEY: " F8 ",
      TALK_PI_INSERT_TRANSCRIPT_KEY: " F7 ",
      TALK_PI_PAUSE_PLAYBACK_KEY: " Ctrl+P ",
    } as NodeJS.ProcessEnv,
  ),
  {
    sendTranscriptKey: "f8",
    insertTranscriptKey: "f7",
    pausePlaybackKey: "ctrl+p",
  },
);

assert.deepEqual(
  getTalkPiShortcutConfig(
    {
      TALK_PI_SEND_TRANSCRIPT_KEY: "f9",
      TALK_PI_INSERT_TRANSCRIPT_KEY: "f9",
    } as NodeJS.ProcessEnv,
  ),
  {
    sendTranscriptKey: "f9",
    insertTranscriptKey: "f10",
    pausePlaybackKey: "alt+p",
  },
);
