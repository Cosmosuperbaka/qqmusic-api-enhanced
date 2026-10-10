import { zzcSign } from "./sign.js";
import { cookieToString, parseSetCookie } from "./cookie.js";
import { buildComm, createOption, type NormalizedOptions, type RequestOptions } from "./option.js";

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  cookie?: string[];
}

export interface CgiPayloadItem {
  module: string;
  method: string;
  param: Record<string, any>;
}

const MUSICU_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const MUSICS_URL = "https://u.y.qq.com/cgi-bin/musics.fcg";

/**
 * 执行 QQ 音乐统一 CGI 接口请求 (musicu.fcg / musics.fcg).
 *
 * @param module CGI 模块名称 (例如: music.vkey.GetVkey)
 * @param method CGI 方法名称 (例如: UrlGetVkey)
 * @param param 业务请求参数
 * @param options 请求配置 (平台、Cookie、是否签名等)
 * @returns 统一响应结构 { status, body, cookie }
 */
export async function requestCgi<T = any>(
  module: string,
  method: string,
  param: Record<string, any> = {},
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const opts: NormalizedOptions = createOption(options);
  const comm = buildComm(opts);

  const payload: Record<string, any> = {
    comm,
    req_0: {
      module,
      method,
      param,
    },
  };

  const payloadStr = JSON.stringify(payload);

  let targetUrl = MUSICU_URL;
  if (opts.sign) {
    const timestamp = Date.now();
    const sign = zzcSign(payloadStr);
    targetUrl = `${MUSICS_URL}?_=${timestamp}&sign=${sign}`;
  }

  // 注入鉴权 Cookie
  const cookieObj = { ...opts.cookie };
  if (opts.uin && opts.uin !== "0") {
    cookieObj.uin = opts.uin;
    cookieObj.qqmusic_uin = opts.uin;
  }
  if (opts.musickey) {
    cookieObj.qm_keyst = opts.musickey;
    cookieObj.qqmusic_key = opts.musickey;
  }
  if (opts.guid) {
    cookieObj.guid = opts.guid;
  }

  const cookieHeader = cookieToString(cookieObj);
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=utf-8",
    ...opts.headers,
  };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), opts.timeout);

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: payloadStr,
      signal: controller.signal,
    });

    const setCookieHeaders = res.headers.getSetCookie?.() || [];
    const responseJson = (await res.json()) as any;

    // 解包 req_0
    const req0 = responseJson?.req_0;
    let resultBody: any = responseJson;
    if (req0) {
      if (req0.data !== undefined && req0.data !== null && typeof req0.data === "object") {
        resultBody = Array.isArray(req0.data) ? req0.data : { ...req0.data };
        if (!Array.isArray(resultBody) && resultBody.code === undefined && req0.code !== undefined) {
          resultBody.code = req0.code;
        }
      } else if (req0.data !== undefined) {
        resultBody = req0.data;
      } else {
        resultBody = req0;
      }
    }

    return {
      status: res.status,
      body: resultBody as T,
      cookie: setCookieHeaders,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }
}

function isBinaryBuffer(buf: Buffer, contentType: string): boolean {
  if (
    contentType.includes("image/") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("audio/") ||
    contentType.includes("video/")
  ) {
    return true;
  }
  if (buf.length >= 4) {
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
    if (buf[0] === 0xff && buf[1] === 0xd8) return true; // JPEG
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true; // GIF
    if (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString("ascii") === "RIFF" &&
      buf.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return true; // WEBP
    }
  }
  return false;
}

/**
 * 执行原始 HTTP/HTTPS 请求 (用于扫码、验证码或第三方 OAuth 接口).
 *
 * @param url 目标 URL
 * @param init 请求配置
 * @returns 统一响应结构
 */
export async function requestRaw(
  url: string,
  init: RequestInit & { timeout?: number } = {}
): Promise<{ status: number; data: any; headers: Headers; cookie: string[]; text: string }> {
  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), init.timeout || 10000);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const cookie = res.headers.getSetCookie?.() || [];
    const contentType = res.headers.get("content-type") || "";
    const buffer = Buffer.from(await res.arrayBuffer());

    if (isBinaryBuffer(buffer, contentType)) {
      return {
        status: res.status,
        data: buffer,
        text: "",
        headers: res.headers,
        cookie,
      };
    }

    const text = buffer.toString("utf-8");
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // 保持原始文本
    }

    return {
      status: res.status,
      data,
      text,
      headers: res.headers,
      cookie,
    };
  } finally {
    clearTimeout(timeoutTimer);
  }
}

/**
 * 兼容 NeteaseCloudMusicApi 签名的统一 request 调度器函数.
 * 若首个参数为以 http 开头的完整 URL，执行原始请求；
 * 否则视为 CGI 请求：request(module, method, param, options).
 */
export async function request(
  arg1: string,
  arg2?: any,
  arg3?: any,
  arg4?: any
): Promise<ApiResponse> {
  if (arg1.startsWith("http://") || arg1.startsWith("https://")) {
    const rawRes = await requestRaw(arg1, arg2);
    return {
      status: rawRes.status,
      body: rawRes.data,
      cookie: rawRes.cookie,
    };
  }

  // CGI 请求分发
  return requestCgi(arg1, arg2, arg3, arg4);
}

export default request;
