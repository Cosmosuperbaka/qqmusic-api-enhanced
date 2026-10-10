/**
 * 计算 QQ 音乐客户端请求的 zzc 签名.
 * 逆向自 QQ 音乐 Web/Desktop 端 zzc 签名算法.
 *
 * @param payload 待签名的明文字符串或 Buffer
 * @returns 签名字符串 (例如: zzc...)
 */
export declare function zzcSign(payload: string | Uint8Array): string;
