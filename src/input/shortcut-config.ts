import { loadTalkPiConfig } from "../config.ts";

export type TalkPiShortcutConfig = {
  sendTranscriptKey: string;
  insertTranscriptKey: string;
  pausePlaybackKey: string;
};

export function getTalkPiShortcutConfig(env: NodeJS.ProcessEnv = process.env): TalkPiShortcutConfig {
  const { sendTranscriptKey, insertTranscriptKey, pausePlaybackKey } = loadTalkPiConfig(env).shortcuts;
  return { sendTranscriptKey, insertTranscriptKey, pausePlaybackKey };
}
