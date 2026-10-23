/**
 * 将 Cookie 字符串解析为键值对对象.
 *
 * @param cookie Cookie 字符串或对象
 * @returns 解析后的键值对对象
 */
export declare function cookieToJson(cookie: string | Record<string, string> | undefined | null): Record<string, string>;
/**
 * 将 Cookie 键值对对象序列化为 Header 字符串.
 *
 * @param cookieObj Cookie 键值对对象
 * @returns Cookie 头部字符串
 */
export declare function cookieToString(cookieObj: Record<string, string> | undefined | null): string;
export interface LoginPayloadMergeResult {
    /** 本次响应是否给出了新的 musickey（决定续期成功与否）。 */
    obtainedMusickey: boolean;
    /** 新凭证的过期时刻（毫秒）；上游没给时为空。 */
    expiresAt?: number;
}
/**
 * 把登录/续期响应里的凭证字段并入 Cookie。
 *
 * QQ 音乐不同登录方式返回的字段位置不一致（顶层、`data` 里、Set-Cookie 里），
 * 这里统一兜底合并。refresh_token/refresh_key/openid/access_token 是后续续期的关键，
 * 不能只取 musickey；否则 musickey 一过期就再也换不回来。
 */
export declare function mergeLoginPayloadCookies(cookieObj: Record<string, string>, payload: unknown): LoginPayloadMergeResult;
/**
 * 从 HTTP 响应头解析 Set-Cookie 数组并提取最新的 Cookie 键值对.
 *
 * @param setCookieHeaders fetch 返回的 Set-Cookie (数组或单个字符串)
 * @returns Cookie 键值对对象
 */
export declare function parseSetCookie(setCookieHeaders: string[] | string | null | undefined): Record<string, string>;
