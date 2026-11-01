import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { writeTrimmedWav } from "./wav-trim.ts";

const defaultCreatePlayer = createRequire(import.meta.url)("play-sound") as (opts?: Record<string, unknown>) => {
  play(filePath: string, optionsOrCallback?: Record<string, unknown> | ((error?: Error | null) => void), callback?: (error?: Error | null) => void): unknown;
};

const WINDOWS_STARTED_SIGNAL = "talk-pi:started";

function createWindowsWavProcess(filePath: string) {
  const script = `$path = $env:TALK_PI_WAV_FILE; $player = New-Object System.Media.SoundPlayer $path; $player.Load(); [Console]::Out.WriteLine('${WINDOWS_STARTED_SIGNAL}'); [Console]::Out.Flush(); $player.PlaySync()`;
  return spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      TALK_PI_WAV_FILE: filePath,
    },
  });
}

export type WavPlayer = {
  play(filePath: string): Promise<void>;
  stop(): Promise<void>;
  isPlaying(): boolean;
  pause?(): Promise<boolean>;
  resume?(): Promise<boolean>;
  isPaused?(): boolean;
};

type PlayerProcess = { pid?: number; kill(signal?: NodeJS.Signals | number): boolean };

type ActivePlayback = {
  filePath: string;
  resolve: () => void;
  reject: (error: Error) => void;
  offsetMs: number;
  paused: boolean;
  token: number;
  child?: PlayerProcess;
  startedAt?: number;
  segmentPath?: string;
};

export type WavPlayerOptions = {
  now?: () => number;
};

async function killProcess(childProcess: PlayerProcess): Promise<void> {
  const pid = childProcess.pid;
  if (pid && globalThis.process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const child = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      child.once("error", () => resolve());
      child.once("exit", () => resolve());
    });
    return;
  }

  try {
    childProcess.kill("SIGKILL");
  } catch {
    // ignore stop errors; the process is being torn down
  }
}

export function createWavPlayer(createPlayer = defaultCreatePlayer, options: WavPlayerOptions = {}): WavPlayer {
  const player = createPlayer({});
  const now = options.now ?? Date.now;
  let active: ActivePlayback | undefined;
  let nextToken = 0;

  const removeSegment = async (playback: ActivePlayback): Promise<void> => {
    const segmentPath = playback.segmentPath;
    playback.segmentPath = undefined;
    if (segmentPath) {
      await fs.unlink(segmentPath).catch(() => undefined);
    }
  };

  const finish = (playback: ActivePlayback, error?: Error): void => {
    if (active === playback) active = undefined;
    void removeSegment(playback);
    if (error) {
      playback.reject(error);
    } else {
      playback.resolve();
    }
  };

  const startSegment = (playback: ActivePlayback, filePath: string): void => {
    const token = ++nextToken;
    playback.token = token;
    playback.startedAt = undefined;
    const isCurrent = () => active === playback && playback.token === token;
    const done = (error?: Error) => {
      if (!isCurrent()) return;
      playback.child = undefined;
      finish(playback, error);
    };

    if (globalThis.process.platform === "win32") {
      const child = createWindowsWavProcess(filePath);
      playback.child = child;
      let stderr = "";
      child.stdout?.on("data", (chunk) => {
        if (isCurrent() && playback.startedAt === undefined && String(chunk).includes(WINDOWS_STARTED_SIGNAL)) {
          playback.startedAt = now();
        }
      });
      child.stderr?.on("data", (chunk) => {
        stderr += String(chunk);
      });
      child.once("error", (error) => done(error));
      child.once("close", (code) => {
        if (code && code !== 0) {
          done(new Error(stderr.trim() || `Windows audio playback failed with code ${code}`));
          return;
        }
        done();
      });
      return;
    }

    const child = player.play(filePath, (error?: Error | null) => done(error ?? undefined)) as PlayerProcess | undefined;
    if (!child) {
      done(new Error("Unable to spawn audio player process"));
      return;
    }
    playback.child = child;
    playback.startedAt = now();
  };

  return {
    isPlaying(): boolean {
      return active !== undefined && !active.paused;
    },
    isPaused(): boolean {
      return active?.paused ?? false;
    },
    play(filePath: string): Promise<void> {
      return new Promise((resolve, reject) => {
        const playback: ActivePlayback = { filePath, resolve, reject, offsetMs: 0, paused: false, token: 0 };
        active = playback;
        startSegment(playback, filePath);
      });
    },
    async pause(): Promise<boolean> {
      const playback = active;
      if (!playback || playback.paused || !playback.child) return false;

      if (playback.startedAt !== undefined) {
        playback.offsetMs += Math.max(0, now() - playback.startedAt);
      }
      playback.paused = true;
      playback.token = ++nextToken;
      const child = playback.child;
      playback.child = undefined;
      await killProcess(child);
      await removeSegment(playback);
      return true;
    },
    async resume(): Promise<boolean> {
      const playback = active;
      if (!playback || !playback.paused) return false;

      playback.paused = false;
      if (playback.offsetMs <= 0) {
        startSegment(playback, playback.filePath);
        return true;
      }

      const segmentPath = `${playback.filePath}.resume.wav`;
      try {
        const hasRemainingAudio = await writeTrimmedWav(playback.filePath, segmentPath, playback.offsetMs);
        if (active !== playback || playback.paused) {
          await fs.unlink(segmentPath).catch(() => undefined);
          return false;
        }
        if (!hasRemainingAudio) {
          finish(playback);
          return true;
        }
        playback.segmentPath = segmentPath;
        startSegment(playback, segmentPath);
      } catch (error) {
        if (active === playback) {
          finish(playback, error instanceof Error ? error : new Error(String(error)));
        }
      }
      return true;
    },
    async stop(): Promise<void> {
      const playback = active;
      if (!playback) return;

      active = undefined;
      playback.token = ++nextToken;
      const child = playback.child;
      playback.child = undefined;
      if (child) {
        await killProcess(child);
      }
      await removeSegment(playback);
      playback.resolve();
    },
  };
}
