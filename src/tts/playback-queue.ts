import fs from "node:fs/promises";
import { formatSpokenReplyStatus } from "../ui/spoken-reply-status.ts";
import { normalizeSpokenText } from "./spoken-text.ts";
import { createSpeechJob, type SpeechJobState } from "./speech-job.ts";
import { synthesizeSpeechToWav, type PiperClientOptions } from "./piper-client.ts";
import { createWavPlayer, type WavPlayer } from "./wav-player.ts";

export type PlaybackQueueItem = {
  text: string;
  createdAt: number;
};

export type PlaybackQueueOptions = {
  synthesize?: typeof synthesizeSpeechToWav;
  player?: WavPlayer;
  isRecordingBlocked?: () => boolean;
  onNotify?: (message: string, level: "info" | "warning" | "error") => void;
  onStatus?: (message: string) => void;
  piper?: PiperClientOptions | (() => PiperClientOptions | Promise<PiperClientOptions>);
};

export type PlaybackQueue = {
  enqueue(text: string): Promise<void>;
  setRecordingBlocked(blocked: boolean): Promise<void>;
  setMuted(muted: boolean): Promise<void>;
  drain(): Promise<void>;
  pendingCount(): number;
  stop(): Promise<boolean>;
  pause(): Promise<boolean>;
  resume(): Promise<boolean>;
  togglePause(): Promise<"paused" | "resumed" | "idle">;
  isPlaying(): boolean;
  isPaused(): boolean;
  isMuted(): boolean;
};

export function createPlaybackQueue(options: PlaybackQueueOptions = {}): PlaybackQueue {
  const queue: PlaybackQueueItem[] = [];
  let busy = false;
  let recordingBlocked = false;
  let muted = false;
  let muteStopping = false;
  let stopping = false;
  let activePlayback = false;
  let paused = false;
  let currentAudioPath: string | undefined;

  const resolvePiper = async (): Promise<PiperClientOptions | undefined> => {
    if (typeof options.piper === "function") {
      return await options.piper();
    }
    return options.piper;
  };
  const synthesize = options.synthesize ?? ((text) => resolvePiper().then((piper) => synthesizeSpeechToWav(text, piper)));
  const player = options.player ?? createWavPlayer();
  const isBlocked = () => (options.isRecordingBlocked?.() ?? recordingBlocked) || muted;

  const notify = (message: string, level: "info" | "warning" | "error") => {
    options.onNotify?.(message, level);
  };

  const status = (kind: Parameters<typeof formatSpokenReplyStatus>[0], detail?: string) => {
    options.onStatus?.(formatSpokenReplyStatus(kind, detail));
  };

  const process = async (): Promise<void> => {
    if (busy || isBlocked() || !queue.length) return;
    busy = true;

    try {
      while (queue.length && !isBlocked()) {
        const item = queue.shift();
        if (!item) break;
        const text = normalizeSpokenText(item.text);
        if (!text) {
          status("deferred", "empty reply");
          continue;
        }

        const job = createSpeechJob(text);
        let audioPath: string | undefined;
        let jobState: SpeechJobState = "complete";
        try {
          job.setState("synthesizing");
          status("synthesizing", text.slice(0, 32));
          const result = await synthesize(text);
          audioPath = result.audioPath;
          currentAudioPath = audioPath;
          job.attachAudio(audioPath, result.cleanup);

          if (stopping || muteStopping) {
            jobState = "interrupted";
            if (muteStopping) {
              muteStopping = false;
            }
            status("stopped", pathBase(audioPath));
            break;
          }

          if (isBlocked()) {
            jobState = "interrupted";
            queue.unshift(item);
            status(muted ? "deferred" : "stopped", pathBase(audioPath));
            break;
          }

          status("ready", pathBase(audioPath));
          activePlayback = true;
          job.setState("playing");
          status("playing", pathBase(audioPath));
          await player.play(audioPath);
          activePlayback = false;
          paused = false;
          currentAudioPath = undefined;

          if (stopping || muteStopping) {
            jobState = "interrupted";
            if (muteStopping) {
              muteStopping = false;
            }
            status("stopped", pathBase(audioPath));
            break;
          }

          if (isBlocked()) {
            jobState = "interrupted";
            queue.unshift(item);
            status(muted ? "deferred" : "stopped", pathBase(audioPath));
            break;
          }

          status("success", pathBase(audioPath));
        } catch (error) {
          activePlayback = false;
          paused = false;
          currentAudioPath = undefined;
          jobState = stopping || muteStopping ? "interrupted" : "failed";
          if (stopping || muteStopping) {
            status("stopped", audioPath ? pathBase(audioPath) : undefined);
            break;
          }
          status("failure", error instanceof Error ? error.message : "playback failed");
          notify(error instanceof Error ? error.message : "playback failed", "error");
        } finally {
          if (audioPath) {
            await fs.unlink(audioPath).catch(() => undefined);
          }
          await job.finalize(jobState);
        }
      }
    } finally {
      busy = false;
      currentAudioPath = undefined;
      activePlayback = false;
      paused = false;
      const shouldRestart = queue.length > 0 && !isBlocked();
      stopping = false;
      if (shouldRestart) {
        void process();
      }
    }
  };

  return {
    async enqueue(text: string): Promise<void> {
      const reply = normalizeSpokenText(text);
      if (!reply) {
        status("deferred", "empty reply");
        return;
      }
      queue.push({ text: reply, createdAt: Date.now() });
      status("queued", reply.slice(0, 32));
      await process();
    },
    async setRecordingBlocked(blocked: boolean): Promise<void> {
      recordingBlocked = blocked;
      if (!blocked) {
        await process();
      }
    },
    async setMuted(nextMuted: boolean): Promise<void> {
      const wasMuted = muted;
      muted = nextMuted;
      if (muted && !wasMuted) {
        if (activePlayback) {
          muteStopping = true;
        }
        if (activePlayback || busy) {
          await player.stop().catch(() => undefined);
        }
        status("stopped", currentAudioPath ? pathBase(currentAudioPath) : undefined);
        activePlayback = false;
        paused = false;
      }
      if (!muted) {
        await process();
      }
    },
    async drain(): Promise<void> {
      await process();
    },
    pendingCount(): number {
      return queue.length + (busy ? 1 : 0);
    },
    isPlaying(): boolean {
      return activePlayback;
    },
    isMuted(): boolean {
      return muted;
    },
    isPaused(): boolean {
      return paused;
    },
    async pause(): Promise<boolean> {
      if (!activePlayback || paused || !player.pause) return false;
      const didPause = await player.pause();
      if (didPause && activePlayback) {
        paused = true;
        status("paused", currentAudioPath ? pathBase(currentAudioPath) : undefined);
      }
      return didPause;
    },
    async resume(): Promise<boolean> {
      if (!activePlayback || !paused || !player.resume) return false;
      paused = false;
      status("playing", currentAudioPath ? pathBase(currentAudioPath) : undefined);
      return await player.resume();
    },
    async togglePause(): Promise<"paused" | "resumed" | "idle"> {
      if (paused) {
        return (await this.resume()) ? "resumed" : "idle";
      }
      return (await this.pause()) ? "paused" : "idle";
    },
    async stop(): Promise<boolean> {
      if (!activePlayback && !busy) {
        return false;
      }

      stopping = true;
      queue.length = 0;
      activePlayback = false;
      paused = false;
      status("stopped", currentAudioPath ? pathBase(currentAudioPath) : undefined);
      currentAudioPath = undefined;
      if (busy) {
        void player.stop().catch(() => undefined);
      } else {
        await player.stop().catch(() => undefined);
      }
      return true;
    },
  };
}

function pathBase(audioPath: string): string {
  return audioPath.split(/[\\/]/).pop() ?? audioPath;
}
