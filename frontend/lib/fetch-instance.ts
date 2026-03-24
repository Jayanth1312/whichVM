import { getDataUrl } from "./api-utils";
import { cachedFetch } from "./cache";
import { decompress as zstdDecompress } from "fzstd";
import { decode } from "@msgpack/msgpack";

export interface RawInstance {
  n: string; // name
  f: string; // family
  v: number; // vcpu
  m: number; // memory
  p: string; // processor
  a: string; // architecture
  s: string; // storage
  nw: string; // network
  g: boolean; // gpu
  gc: number; // gpu count
  gn: string | null; // gpu name
  pr: Record<string, number>; // pricing
  [key: string]: any;
}

export async function fetchInstanceData(provider: string, region: string, instanceName: string): Promise<RawInstance | null> {
  try {
    const url = getDataUrl(`/${provider.toLowerCase()}/${region}.msgpack.zst`);
    const response = await cachedFetch(url);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const decompressed = zstdDecompress(new Uint8Array(arrayBuffer));
    const regionFile: any = decode(decompressed);

    if (regionFile?.instances) {
      return regionFile.instances.find((inst: any) => inst.n === instanceName) || null;
    }
    return null;
  } catch {
    return null;
  }
}
