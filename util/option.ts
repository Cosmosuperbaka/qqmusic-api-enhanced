import { cookieToJson } from "./cookie.js";
import { getGuid, getGtk } from "./crypto.js";

export type PlatformType = "web" | "android" | "desktop";

export interface RequestOptions {
  platform?: PlatformType;
  sign?: boolean;
  cookie?: string | Record<string, string>;
  proxy?: string;
  realIP?: string;
  guid?: string;
  uin?: string | number;
  musickey?: string;
  headers?: Record<string, string>;
  timeout?: number;
  comm?: Record<string, any>;
}

export interface NormalizedOptions {
  platform: PlatformType;
  sign: boolean;
  cookie: Record<string, string>;
  proxy?: string;
  realIP?: string;
  guid: string;
  uin: string;
  musickey: string;
  headers: Record<string, string>;
  timeout: number;
  comm?: Record<string, any>;
}

/**
 * 格式化并补全请求配置选项.
 *
 * @param query 调用方传入的 query 参数
 * @param defaultPlatform 默认平台类型
 * @returns 规范化后的请求配置
 */
export function createOption(
  query: Record<string, any> = {},
  defaultPlatform: PlatformType = "web"
): NormalizedOptions {
  const cookie = cookieToJson(query.cookie);
  const guid = query.guid || cookie.guid || getGuid();

  // 从 cookie 中识别 uin 与 musickey
  const uin =
    query.uin?.toString() ||
    cookie.uin ||
    cookie.qqmusic_uin ||
    cookie.wxuin ||
    cookie.musicid ||
    "0";

  const musickey =
    query.musickey ||
    cookie.qm_keyst ||
    cookie.qqmusic_key ||
    cookie.musickey ||
    "";

  const platform: PlatformType = query.platform || defaultPlatform;
  const sign = Boolean(query.sign);

  const headers: Record<string, string> = {
    Referer: "https://y.qq.com/",
    Origin: "https://y.qq.com",
    "User-Agent":
      platform === "android"
        ? "QQMusic 20090008(android 14)"
        : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ...(query.headers || {}),
  };

  if (query.realIP) {
    headers["X-Real-IP"] = query.realIP;
    headers["X-Forwarded-For"] = query.realIP;
  }

  return {
    platform,
    sign,
    cookie,
    proxy: query.proxy,
    realIP: query.realIP,
    guid,
    uin: uin.replace(/\D/g, "") || "0",
    musickey,
    headers,
    timeout: query.timeout || 10000,
    comm: query.comm,
  };
}

/**
 * 构建 CGI 请求所需的通用 comm 参数对象.
 */
export function buildComm(options: NormalizedOptions): Record<string, any> {
  const gTk = options.musickey ? getGtk(options.musickey) : 5381;

  let baseComm: Record<string, any>;
  if (options.platform === "android") {
    baseComm = {
      ct: 11,
      cv: 20090008,
      v: 20090008,
      chid: "10003505",
      qq: options.uin !== "0" ? options.uin : undefined,
      authst: options.musickey || undefined,
      tmeAppID: "qqmusic",
      guid: options.guid,
    };
  } else if (options.platform === "desktop") {
    baseComm = {
      ct: 19,
      cv: 2201,
      guid: options.guid,
      uin: Number(options.uin) || 0,
    };
  } else {
    // Web 平台
    baseComm = {
      ct: 24,
      cv: 4747474,
      platform: "yqq.json",
      chid: "0",
      uin: Number(options.uin) || 0,
      g_tk: gTk,
      g_tk_new_20200303: gTk,
      format: "json",
      inCharset: "utf-8",
      outCharset: "utf-8",
      notice: 0,
      need_new_code: 1,
    };
  }

  if (options.comm) {
    for (const [k, v] of Object.entries(options.comm)) {
      if (v === undefined || v === null) {
        delete baseComm[k];
      } else {
        baseComm[k] = v;
      }
    }
  }

  return baseComm;
}
