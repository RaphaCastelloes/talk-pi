import { spawn } from "node:child_process";
import { createRequire } from "node:module";

type PlayerFactory = (opts?: Record<string, unknown>) => {
  play(filePath: string, options?: Record<string, unknown>, callback?: (error?: Error | null) => void): unknown;
};

function createWindowsWavProcess(filePath: string) {
  // MCI can pause a WAV at its current position, unlike SoundPlayer.PlaySync.
  const script = `
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
using System.Text;
public static class TalkPiMci {
  [DllImport("winmm.dll", CharSet = CharSet.Unicode)]
  public static extern int mciSendString(string command, StringBuilder result, int length, System.IntPtr callback);
}
'@
function Send-Mci([string]$command, [System.Text.StringBuilder]$result = $null) {
  $length = if ($null -eq $result) { 0 } else { $result.Capacity }
  $code = [TalkPiMci]::mciSendString($command, $result, $length, [IntPtr]::Zero)
  if ($code -ne 0) { throw "Audio playback command failed ($code): $command" }
}
try {
  Send-Mci ('open "' + $env:TALK_PI_WAV_FILE + '" type waveaudio alias talkpi')
  Send-Mci 'play talkpi'
  $inputReader = New-Object System.IO.StreamReader ([Console]::OpenStandardInput())
  $inputTask = $inputReader.ReadLineAsync()
  while ($true) {
    if ($inputTask.IsCompleted) {
      $command = $inputTask.Result
      if ($null -eq $command) { break }
      if ($command -eq 'pause' -or $command -eq 'resume') { Send-Mci "$command talkpi" }
      $inputTask = $inputReader.ReadLineAsync()
    }
    $mode = New-Object System.Text.StringBuilder 128
    Send-Mci 'status talkpi mode' $mode
    if ($mode.ToString() -eq 'stopped') { break }
    Start-Sleep -Milliseconds 50
  }
} finally {
  [void][TalkPiMci]::mciSendString('close talkpi', $null, 0, [IntPtr]::Zero)
}`;
  return spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    stdio: ["pipe", "ignore", "pipe"],
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
  pause(): void;
  resume(): void;
};

export function createWavPlayer(createPlayer?: PlayerFactory): WavPlayer {
  const player = globalThis.process.platform === "win32" ? undefined
    : (createPlayer ?? createRequire(import.meta.url)("play-sound") as PlayerFactory)({});
  let activeProcess: { pid?: number; stdin?: { write(data: string): boolean } | null; kill(signal?: NodeJS.Signals | number): boolean; once(event: "close", listener: () => void): void } | undefined;

  const clear = () => {
    activeProcess = undefined;
  };

  const control = (command: "pause" | "resume") => {
    if (!activeProcess) throw new Error("No audio is playing");
    if (globalThis.process.platform === "win32") {
      if (!activeProcess.stdin) throw new Error("Audio player cannot be controlled");
      activeProcess.stdin.write(`${command}\n`);
    } else if (!activeProcess.kill(command === "pause" ? "SIGSTOP" : "SIGCONT")) {
      throw new Error(`Unable to ${command} audio playback`);
    }
  };

  return {
    isPlaying(): boolean {
      return activeProcess !== undefined;
    },
    pause() { control("pause"); },
    resume() { control("resume"); },
    play(filePath: string): Promise<void> {
      return new Promise((resolve, reject) => {
        if (globalThis.process.platform === "win32") {
          const child = createWindowsWavProcess(filePath);
          activeProcess = child;
          child.stdin?.on("error", () => {
            // A command can race with the player exiting.
          });
          let stderr = "";
          child.stderr?.on("data", (chunk) => {
            stderr += String(chunk);
          });
          child.once("error", (error) => {
            if (activeProcess === child) clear();
            reject(error);
          });
          child.once("close", (code) => {
            if (activeProcess === child) clear();
            if (code && code !== 0) {
              reject(new Error(stderr.trim() || `Windows audio playback failed with code ${code}`));
              return;
            }
            resolve();
          });
          return;
        }

        const process = player!.play(filePath, (error?: Error | null) => {
          if (activeProcess === process) {
            clear();
          }
          if (error) {
            reject(error);
            return;
          }
          resolve();
        }) as typeof activeProcess;

        if (!process) {
          clear();
          reject(new Error("Unable to spawn audio player process"));
          return;
        }

        activeProcess = process;
      });
    },
    async stop(): Promise<void> {
      const childProcess = activeProcess;
      if (!childProcess) return;

      clear();
      const pid = childProcess.pid;
      if (!pid) {
        try {
          childProcess.kill("SIGKILL");
        } catch {
          // ignore stop errors; the process is being torn down
        }
        return;
      }

      if (globalThis.process.platform === "win32") {
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
    },
  };
}
