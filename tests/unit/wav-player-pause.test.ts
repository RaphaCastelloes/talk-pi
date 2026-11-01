import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWavPlayer } from "../../src/tts/wav-player.ts";

function makeWav(sampleRate: number, sampleCount: number): Buffer {
  const data = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) data.writeInt16LE(index, index * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

type FakeProcess = {
  filePath: string;
  firstSample: number;
  killed: boolean;
  finish(error?: Error | null): void;
};

async function run() {
  if (process.platform === "win32") return;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talk-pi-pause-"));
  const audioPath = path.join(dir, "reply.wav");
  fs.writeFileSync(audioPath, makeWav(1000, 1000));

  let clock = 0;
  const processes: FakeProcess[] = [];
  const player = createWavPlayer(
    () => ({
      play(filePath: string, callback?: (error?: Error | null) => void) {
        const contents = fs.readFileSync(filePath);
        const fake: FakeProcess & { kill(): boolean } = {
          filePath,
          firstSample: contents.readInt16LE(44),
          killed: false,
          finish: (error) => callback?.(error),
          kill() {
            fake.killed = true;
            callback?.(new Error("killed"));
            return true;
          },
        };
        processes.push(fake);
        return fake;
      },
    }) as never,
    { now: () => clock },
  );

  let settled = false;
  const playing = player.play(audioPath).then(() => {
    settled = true;
  });
  assert.equal(player.isPlaying(), true);
  assert.equal(processes[0].firstSample, 0);

  clock = 300;
  assert.equal(await player.pause(), true);
  assert.equal(await player.pause(), false);
  assert.equal(processes[0].killed, true);
  assert.equal(player.isPlaying(), false);
  assert.equal(player.isPaused(), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(settled, false, "pausing must not finish playback");

  clock = 10_000;
  assert.equal(await player.resume(), true);
  assert.equal(player.isPlaying(), true);
  assert.equal(processes.length, 2);
  assert.equal(processes[1].filePath, `${audioPath}.resume.wav`);
  assert.equal(processes[1].firstSample, 300, "resume continues from the paused position");

  clock = 10_200;
  assert.equal(await player.pause(), true);
  assert.equal(fs.existsSync(`${audioPath}.resume.wav`), false);
  assert.equal(await player.resume(), true);
  assert.equal(processes[2].firstSample, 500, "pause offsets accumulate");

  processes[2].finish(null);
  await playing;
  assert.equal(settled, true);
  assert.equal(player.isPlaying(), false);
  assert.equal(player.isPaused(), false);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(fs.existsSync(`${audioPath}.resume.wav`), false);

  clock = 0;
  const stopped = player.play(audioPath);
  clock = 100;
  await player.pause();
  await player.stop();
  await stopped;
  assert.equal(player.isPaused(), false);
  assert.equal(await player.resume(), false);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
