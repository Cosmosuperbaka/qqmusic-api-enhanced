/**
 * 经典 hash33 哈希算法 (常用于计算 ptqrtoken、g_tk 等).
 *
 * @param str 输入字符串
 * @param seed 初始种子 (默认 0)
 * @returns 32位正整型哈希
 */
export declare function hash33(str: string, seed?: number): number;
/**
 * 计算 QQ 互联与登录所需的 g_tk 参数.
 *
 * @param pSkey 会话 p_skey
 * @returns g_tk 数值
 */
export declare function getGtk(pSkey: string): number;
/**
 * 生成设备与会话 GUID (32 位十六进制字符串).
 */
export declare function getGuid(): string;
/**
 * 生成搜索 search_id.
 */
export declare function getSearchId(): string;
/**
 * QQ 音乐 QRC 逐字歌词解密.
 * 底层基于定制的 Triple-DES 算法分块解密后，再经 zlib inflate 解压.
 *
 * @param encryptedQrc 16进制字符串或二进制 Buffer
 * @returns 明文歌词字符串 (若解密失败返回 null)
 */
export declare function qrcDecrypt(encryptedQrc: string | Uint8Array): string | null;
