import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPlaybackQueue } from "../../src/tts/playback-queue.ts";

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talk-pi-queue-pause-"));
  const events: string[] = [];
  let releasePlayback: (() => void) | undefined;

  const queue = createPlaybackQueue({
    synthesize: async (text) => {
      const audioPath = path.join(dir, `${text}.wav`);
      fs.writeFileSync(audioPath, text);
      return { audioPath };
    },
    player: {
      async play(filePath: string) {
        events.push(`play:${fs.readFileSync(filePath, "utf8")}`);
        await new Promise<void>((resolve) => {
          releasePlayback = resolve;
        });
      },
      async stop() {
        events.push("stop");
        releasePlayback?.();
      },
      async pause() {
        events.push("pause");
        return true;
      },
      async resume() {
        events.push("resume");
        return true;
      },
      isPlaying: () => true,
    },
    onStatus(message) {
      events.push(message);
    },
  });

  assert.equal(await queue.togglePause(), "idle");
  assert.equal(events.includes("pause"), false);

  const first = queue.enqueue("first");
  const second = queue.enqueue("second");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(await queue.togglePause(), "paused");
  assert.equal(queue.isPaused(), true);
  assert.equal(queue.isPlaying(), true, "paused playback still counts as active so Esc can stop it");
  assert.equal(events.includes("Paused: first.wav"), true);

  assert.equal(await queue.togglePause(), "resumed");
  assert.equal(queue.isPaused(), false);
  assert.deepEqual(events.filter((event) => event === "pause" || event === "resume"), ["pause", "resume"]);

  releasePlayback?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(events.includes("play:second"), true, "queued replies continue after resume");

  assert.equal(await queue.togglePause(), "paused");
  assert.equal(await queue.stop(), true);
  assert.equal(queue.isPaused(), false);
  await Promise.allSettled([first, second]);
  assert.equal(queue.pendingCount(), 0);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
