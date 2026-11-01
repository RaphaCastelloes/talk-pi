import assert from "node:assert/strict";
import { trimWavStart } from "../../src/tts/wav-trim.ts";

function makeWav(sampleRate: number, samples: number[]): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((sample, index) => data.writeInt16LE(sample, index * 2));
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

const wav = makeWav(1000, Array.from({ length: 1000 }, (_, index) => index));

const half = trimWavStart(wav, 500);
assert.ok(half);
assert.equal(half.toString("ascii", 0, 4), "RIFF");
assert.equal(half.readUInt32LE(4), half.length - 8);
assert.equal(half.readUInt32LE(40), 1000);
assert.equal(half.length, 44 + 1000);
assert.equal(half.readInt16LE(44), 500);

const unchanged = trimWavStart(wav, 0);
assert.deepEqual(unchanged, wav);

assert.equal(trimWavStart(wav, 1000), undefined);
assert.equal(trimWavStart(wav, 5000), undefined);

const odd = trimWavStart(wav, 1.7);
assert.ok(odd);
assert.equal(odd.readInt16LE(44), 1);

assert.throws(() => trimWavStart(Buffer.from("not a wav"), 10), /expected a WAV file/);
