/**
 * compressor.ts
 *
 * Takes a RegionFile, encodes it with msgpack, then compresses with zstd.
 *
 * Node.js side: uses zstd-codec for compression (supports both compress/decompress)
 * Browser side: uses fzstd for decompression only
 */

import { encode } from "@msgpack/msgpack";
import { RegionFile } from "../types";

// Lazy-loaded ZstdCodec (it has async init)
let zstdCompressFn: ((input: Uint8Array) => Uint8Array) | null = null;

async function getZstdCompress(): Promise<(input: Uint8Array) => Uint8Array> {
  if (zstdCompressFn) return zstdCompressFn;

  const { ZstdCodec } = await import("zstd-codec");

  return new Promise((resolve, reject) => {
    ZstdCodec.run((zstd: any) => {
      const simple = new zstd.Simple();
      zstdCompressFn = (input: Uint8Array) => {
        const result = simple.compress(input, 3); // compression level 3 (balanced)
        if (!result) throw new Error("Zstd compression returned null");
        return result;
      };
      resolve(zstdCompressFn);
    });
  });
}

/**
 * Encode a RegionFile as msgpack + zstd compressed buffer.
 *
 * Pipeline:  JSON object → msgpack binary → zstd compressed
 *
 * @returns Buffer of compressed data
 */
export async function compressRegionFile(
  regionFile: RegionFile,
): Promise<Buffer> {
  // Step 1: msgpack encode
  const packed = encode(regionFile);

  // Step 2: zstd compress
  const compress = await getZstdCompress();
  const compressed = compress(new Uint8Array(packed));

  return Buffer.from(compressed);
}

/**
 * Get stats about compression for logging.
 */
export async function compressionStats(
  originalJson: RegionFile,
  compressed: Buffer,
): Promise<{
  jsonSize: number;
  msgpackSize: number;
  compressedSize: number;
  ratio: string;
}> {
  const jsonStr = JSON.stringify(originalJson);
  const packed = encode(originalJson);

  return {
    jsonSize: Buffer.byteLength(jsonStr),
    msgpackSize: packed.byteLength,
    compressedSize: compressed.length,
    ratio:
      ((compressed.length / Buffer.byteLength(jsonStr)) * 100).toFixed(1) + "%",
  };
}
