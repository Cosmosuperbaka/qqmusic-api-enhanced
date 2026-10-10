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
/**
 * 从 HTTP 响应头解析 Set-Cookie 数组并提取最新的 Cookie 键值对.
 *
 * @param setCookieHeaders fetch 返回的 Set-Cookie (数组或单个字符串)
 * @returns Cookie 键值对对象
 */
export declare function parseSetCookie(setCookieHeaders: string[] | string | null | undefined): Record<string, string>;
