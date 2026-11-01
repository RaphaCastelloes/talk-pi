import fs from "node:fs/promises";

type WavLayout = {
  fmtChunk: Buffer;
  byteRate: number;
  blockAlign: number;
  dataStart: number;
  dataLength: number;
};

function parseWav(buffer: Buffer): WavLayout {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("Unsupported audio file: expected a WAV file");
  }

  let fmtChunk: Buffer | undefined;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;
    if (id === "fmt ") {
      fmtChunk = buffer.subarray(offset, bodyStart + size);
    } else if (id === "data") {
      if (!fmtChunk || fmtChunk.length < 24) break;
      return {
        fmtChunk,
        byteRate: fmtChunk.readUInt32LE(16),
        blockAlign: fmtChunk.readUInt16LE(20) || 1,
        dataStart: bodyStart,
        dataLength: Math.min(size, buffer.length - bodyStart),
      };
    }
    offset = bodyStart + size + (size % 2);
  }

  throw new Error("Unsupported audio file: WAV format or data chunk missing");
}

export function trimWavStart(buffer: Buffer, offsetMs: number): Buffer | undefined {
  const layout = parseWav(buffer);
  const rawOffset = Math.floor((Math.max(0, offsetMs) / 1000) * layout.byteRate);
  const byteOffset = rawOffset - (rawOffset % layout.blockAlign);
  if (byteOffset >= layout.dataLength) return undefined;

  const data = buffer.subarray(layout.dataStart + byteOffset, layout.dataStart + layout.dataLength);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + layout.fmtChunk.length + 8 + data.length, 4);
  header.write("WAVE", 8, "ascii");
  const dataHeader = Buffer.alloc(8);
  dataHeader.write("data", 0, "ascii");
  dataHeader.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, layout.fmtChunk, dataHeader, data]);
}

export async function writeTrimmedWav(sourcePath: string, targetPath: string, offsetMs: number): Promise<boolean> {
  const trimmed = trimWavStart(await fs.readFile(sourcePath), offsetMs);
  if (!trimmed) return false;
  await fs.writeFile(targetPath, trimmed);
  return true;
}
