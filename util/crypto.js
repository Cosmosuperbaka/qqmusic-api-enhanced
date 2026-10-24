import { createHash } from "node:crypto";
import { constants, inflateSync } from "node:zlib";
import { DECRYPT, tripleDesCrypt, tripleDesKeySetup } from "./des.js";
const QRC_3DES_KEY = Buffer.from("!@#)(*$%123ZXC!@!@#)(NHL");
/**
 * 经典 hash33 哈希算法 (常用于计算 ptqrtoken、g_tk 等).
 *
 * @param str 输入字符串
 * @param seed 初始种子 (默认 0)
 * @returns 32位正整型哈希
 */
export function hash33(str, seed = 0) {
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
export function getGtk(pSkey) {
    let hash = 5381;
    for (let i = 0; i < pSkey.length; i++) {
        hash += (hash << 5) + pSkey.charCodeAt(i);
    }
    return hash & 0x7fffffff;
}
/**
 * 生成设备与会话 GUID (32 位十六进制字符串).
 */
export function getGuid() {
    return "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        .replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    })
        .toLowerCase();
}
/**
 * 由稳定种子派生 GUID。
 *
 * QQ 音乐会把登录态与设备标识关联；同一份凭证每次请求都换 guid 会被当成新设备，
 * 容易触发风控或让登录态提前失效。二维码登录与旧版手填 Cookie 都走这里派生，
 * 保证同一账号/同一登录会话内 guid 不变。
 */
export function getStableGuid(seed) {
    return createHash("sha256").update(seed).digest("hex").slice(0, 32);
}
/**
 * 生成搜索 search_id.
 */
export function getSearchId() {
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
export function qrcDecrypt(encryptedQrc) {
    if (!encryptedQrc)
        return null;
    let encryptedBytes;
    if (typeof encryptedQrc === "string") {
        // 过滤空白或非法字符
        const cleanHex = encryptedQrc.trim().replace(/\s+/g, "");
        if (!cleanHex || cleanHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(cleanHex))
            return null;
        encryptedBytes = Buffer.from(cleanHex, "hex");
    }
    else {
        encryptedBytes = Buffer.from(encryptedQrc);
    }
    if (encryptedBytes.length === 0)
        return null;
    try {
        const schedule = tripleDesKeySetup(QRC_3DES_KEY, DECRYPT);
        const chunks = [];
        for (let i = 0; i < encryptedBytes.length; i += 8) {
            const slice = encryptedBytes.subarray(i, i + 8);
            const block = slice.length === 8
                ? slice
                : Buffer.concat([slice, Buffer.alloc(8 - slice.length)]);
            const decryptedBlock = tripleDesCrypt(block, schedule);
            chunks.push(Buffer.from(decryptedBlock));
        }
        const merged = Buffer.concat(chunks);
        // 真实 QRC 偶有尾部不完整的 zlib 流；Z_SYNC_FLUSH 容忍这种情况，
        // 与上游 lx-music 实现保持一致。
        const decompressed = inflateSync(merged, { finishFlush: constants.Z_SYNC_FLUSH });
        return decompressed.toString("utf8");
    }
    catch {
        return null;
    }
}
