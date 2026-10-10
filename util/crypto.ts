import { inflateSync } from "node:zlib";
import { DECRYPT, tripleDesCrypt, tripleDesKeySetup } from "./des.js";

const QRC_3DES_KEY = Buffer.from("!@#)(*$%123ZXC!@!@#)(NHL");

/**
 * 经典 hash33 哈希算法 (常用于计算 ptqrtoken、g_tk 等).
 *
 * @param str 输入字符串
 * @param seed 初始种子 (默认 0)
 * @returns 32位正整型哈希
 */
export function hash33(str: string, seed = 0): number {
  let hash = seed;
  for (let i = 0; i < str.length; i++) {
    hash += (hash << 5) + str.charCodeAt(i);
  }
  return 2147483647 & hash;
}

/**
 * 计算 QQ 互联与登录所需的 g_tk 参数.
 *
 * @param pSkey 会话 p_skey
 * @returns g_tk 数值
 */
export function getGtk(pSkey: string): number {
  let hash = 5381;
  for (let i = 0; i < pSkey.length; i++) {
    hash += (hash << 5) + pSkey.charCodeAt(i);
  }
  return hash & 0x7fffffff;
}

/**
 * 生成设备与会话 GUID (32 位十六进制字符串).
 */
export function getGuid(): string {
  return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    .replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
    .toLowerCase();
}

/**
 * 生成搜索 search_id.
 */
export function getSearchId(): string {
  const e = Math.floor(Math.random() * 1e18);
  const t = Math.floor(Date.now() / 1000);
  return `${e}${t}`;
}

/**
 * QQ 音乐 QRC 逐字歌词解密.
 * 底层基于定制的 Triple-DES 算法分块解密后，再经 zlib inflate 解压.
 *
 * @param encryptedQrc 16进制字符串或二进制 Buffer
 * @returns 明文歌词字符串 (若解密失败返回 null)
 */
export function qrcDecrypt(encryptedQrc: string | Uint8Array): string | null {
  if (!encryptedQrc) return null;
  let encryptedBytes: Buffer;
  if (typeof encryptedQrc === "string") {
    // 过滤空白或非法字符
    const cleanHex = encryptedQrc.trim().replace(/\s+/g, "");
    if (!cleanHex || cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanHex)) return null;
    encryptedBytes = Buffer.from(cleanHex, "hex");
  } else {
    encryptedBytes = Buffer.from(encryptedQrc);
  }

  if (encryptedBytes.length === 0) return null;

  try {
    const schedule = tripleDesKeySetup(QRC_3DES_KEY, DECRYPT);
    const chunks: Buffer[] = [];
    for (let i = 0; i < encryptedBytes.length; i += 8) {
      const slice = encryptedBytes.subarray(i, i + 8);
      const block =
        slice.length === 8
          ? slice
          : Buffer.concat([slice, Buffer.alloc(8 - slice.length)]);
      const decryptedBlock = tripleDesCrypt(block, schedule);
      chunks.push(Buffer.from(decryptedBlock));
    }
    const merged = Buffer.concat(chunks);
    const decompressed = inflateSync(merged);
    return decompressed.toString("utf8");
  } catch {
    return null;
  }
}
