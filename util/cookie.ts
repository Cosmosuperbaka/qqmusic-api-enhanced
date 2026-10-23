/**
 * 将 Cookie 字符串解析为键值对对象.
 *
 * @param cookie Cookie 字符串或对象
 * @returns 解析后的键值对对象
 */
export function cookieToJson(
  cookie: string | Record<string, string> | undefined | null
): Record<string, string> {
  if (!cookie) return {};
  if (typeof cookie === "object") return { ...cookie };

  const cookieObj: Record<string, string> = {};
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
export function cookieToString(
  cookieObj: Record<string, string> | undefined | null
): string {
  if (!cookieObj) return "";
  return Object.entries(cookieObj)
    .map(([key, val]) => `${key}=${val}`)
    .join("; ");
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readText = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

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
export function mergeLoginPayloadCookies(
  cookieObj: Record<string, string>,
  payload: unknown
): LoginPayloadMergeResult {
  const record = asRecord(payload);
  const source = { ...asRecord(record.data), ...record };

  const musickey = readText(source.musickey);
  if (musickey) {
    cookieObj.qm_keyst = musickey;
    cookieObj.qqmusic_key = musickey;
    cookieObj.musickey = musickey;
  }

  const musicid = readText(source.musicid ?? source.uin ?? source.str_musicid);
  if (musicid) {
    cookieObj.uin = musicid;
    cookieObj.qqmusic_uin = musicid;
    cookieObj.musicid = musicid;
  }

  const encryptUin = readText(source.encryptUin ?? source.euin);
  if (encryptUin) {
    cookieObj.euin = encryptUin;
    cookieObj.encryptUin = encryptUin;
  }

  const refreshToken = readText(source.refresh_token);
  if (refreshToken) cookieObj.refresh_token = refreshToken;
  const refreshKey = readText(source.refresh_key);
  if (refreshKey) cookieObj.refresh_key = refreshKey;
  const openid = readText(source.openid);
  if (openid) cookieObj.openid = openid;
  const accessToken = readText(source.access_token);
  if (accessToken) cookieObj.access_token = accessToken;

  const loginType = readText(source.loginType ?? source.tmeLoginType);
  if (loginType) cookieObj.tmeLoginType = loginType;

  const expiredAt = Number(source.expired_at);
  const keyExpiresIn = Number(source.keyExpiresIn);
  if (Number.isFinite(expiredAt) && expiredAt > 0) cookieObj.expired_at = String(expiredAt);
  if (Number.isFinite(keyExpiresIn) && keyExpiresIn > 0) {
    cookieObj.keyExpiresIn = String(keyExpiresIn);
  }
  const createdAt = Number(source.musickeyCreateTime);
  if (Number.isFinite(createdAt) && createdAt > 0) {
    cookieObj.musickeyCreateTime = String(createdAt);
  }

  const expiresAt =
    Number.isFinite(expiredAt) && expiredAt > 0
      ? expiredAt > 1e12
        ? expiredAt
        : expiredAt * 1000
      : Number.isFinite(keyExpiresIn) && keyExpiresIn > 0
        ? Date.now() + keyExpiresIn * 1000
        : undefined;

  return { obtainedMusickey: Boolean(musickey), expiresAt };
}

/**
 * 从 HTTP 响应头解析 Set-Cookie 数组并提取最新的 Cookie 键值对.
 *
 * @param setCookieHeaders fetch 返回的 Set-Cookie (数组或单个字符串)
 * @returns Cookie 键值对对象
 */
export function parseSetCookie(
  setCookieHeaders: string[] | string | null | undefined
): Record<string, string> {
  if (!setCookieHeaders) return {};
  const list = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
  const cookies: Record<string, string> = {};

  for (const item of list) {
    if (!item) continue;
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
