import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPlaybackQueue } from "../../src/tts/playback-queue.ts";

async function run() {
  const events: string[] = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talk-pi-pause-"));
  let finish: (() => void) | undefined;
  let secondStarted: (() => void) | undefined;
  const secondPlaying = new Promise<void>((resolve) => { secondStarted = resolve; });
  const queue = createPlaybackQueue({
    synthesize: async (text) => {
      events.push(`synthesize:${text}`);
      return { audioPath: path.join(dir, `${text}.wav`) };
    },
    player: {
      async play(filePath) {
        events.push(`play:${path.basename(filePath)}`);
        if (path.basename(filePath) === "second.wav") secondStarted?.();
        await new Promise<void>((resolve) => { finish = resolve; });
      },
      pause() { events.push("pause"); },
      resume() { events.push("resume"); },
      async stop() { events.push("stop"); finish?.(); },
      isPlaying() { return true; },
    },
  });

  assert.equal(queue.togglePause(), false);
  const first = queue.enqueue("first");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(queue.togglePause(), true);
  assert.equal(queue.isPaused(), true);
  assert.equal(queue.isPlaying(), true);
  await queue.enqueue("second");
  assert.deepEqual(events, ["synthesize:first", "play:first.wav", "pause"]);

  assert.equal(queue.togglePause(), true);
  assert.equal(queue.isPaused(), false);
  assert.deepEqual(events, ["synthesize:first", "play:first.wav", "pause", "resume"]);
  finish?.();
  await secondPlaying;
  assert.deepEqual(events.slice(-2), ["synthesize:second", "play:second.wav"]);
  assert.equal(queue.togglePause(), true);
  await queue.stop();
  await first;
  assert.equal(queue.isPaused(), false);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(queue.togglePause(), false);

  let releaseMuted: (() => void) | undefined;
  let failPause = true;
  const notifications: string[] = [];
  const mutedQueue = createPlaybackQueue({
    synthesize: async () => ({ audioPath: path.join(dir, "muted.wav") }),
    player: {
      async play() { await new Promise<void>((resolve) => { releaseMuted = resolve; }); },
      pause() { if (failPause) throw new Error("pause failed"); },
      resume() {},
      async stop() { releaseMuted?.(); },
      isPlaying() { return true; },
    },
    onNotify(message) { notifications.push(message); },
  });
  const mutedReply = mutedQueue.enqueue("muted");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(mutedQueue.togglePause(), false);
  assert.equal(mutedQueue.isPaused(), false);
  assert.deepEqual(notifications, ["pause failed"]);
  failPause = false;
  assert.equal(mutedQueue.togglePause(), true);
  await mutedQueue.setMuted(true);
  await mutedReply;
  assert.equal(mutedQueue.isPaused(), false);
  assert.equal(mutedQueue.isPlaying(), false);
  assert.equal(mutedQueue.togglePause(), false);
  fs.rmdirSync(dir);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
