/**
 * 将 Cookie 字符串解析为键值对对象.
 *
 * @param cookie Cookie 字符串或对象
 * @returns 解析后的键值对对象
 */
export function cookieToJson(cookie) {
    if (!cookie)
        return {};
    if (typeof cookie === "object")
        return { ...cookie };
    const cookieObj = {};
    cookie
        .split(";")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
        const idx = item.indexOf("=");
        if (idx > -1) {
            const key = item.substring(0, idx).trim();
            const value = item.substring(idx + 1).trim();
            if (key) {
                cookieObj[key] = value;
            }
        }
    });
    return cookieObj;
}
/**
 * 将 Cookie 键值对对象序列化为 Header 字符串.
 *
 * @param cookieObj Cookie 键值对对象
 * @returns Cookie 头部字符串
 */
export function cookieToString(cookieObj) {
    if (!cookieObj)
        return "";
    return Object.entries(cookieObj)
        .map(([key, val]) => `${key}=${val}`)
        .join("; ");
}
/**
 * 从 HTTP 响应头解析 Set-Cookie 数组并提取最新的 Cookie 键值对.
 *
 * @param setCookieHeaders fetch 返回的 Set-Cookie (数组或单个字符串)
 * @returns Cookie 键值对对象
 */
export function parseSetCookie(setCookieHeaders) {
    if (!setCookieHeaders)
        return {};
    const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    const cookies = {};
    for (const item of list) {
        if (!item)
            continue;
        const parts = item.split(";")[0]?.trim();
        if (parts) {
            const idx = parts.indexOf("=");
            if (idx > -1) {
                const key = parts.substring(0, idx).trim();
                const val = parts.substring(idx + 1).trim();
                if (key) {
                    cookies[key] = val;
                }
            }
        }
    }
    return cookies;
}
