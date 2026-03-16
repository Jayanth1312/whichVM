declare module "zstd-codec" {
  export class ZstdCodec {
    static run(callback: (zstd: any) => void): void;
  }
}
