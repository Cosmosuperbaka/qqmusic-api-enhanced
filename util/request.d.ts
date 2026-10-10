import { type RequestOptions } from "./option.js";
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
/**
 * 执行 QQ 音乐统一 CGI 接口请求 (musicu.fcg / musics.fcg).
 *
 * @param module CGI 模块名称 (例如: music.vkey.GetVkey)
 * @param method CGI 方法名称 (例如: UrlGetVkey)
 * @param param 业务请求参数
 * @param options 请求配置 (平台、Cookie、是否签名等)
 * @returns 统一响应结构 { status, body, cookie }
 */
export declare function requestCgi<T = any>(module: string, method: string, param?: Record<string, any>, options?: RequestOptions): Promise<ApiResponse<T>>;
/**
 * 执行原始 HTTP/HTTPS 请求 (用于扫码、验证码或第三方 OAuth 接口).
 *
 * @param url 目标 URL
 * @param init 请求配置
 * @returns 统一响应结构
 */
export declare function requestRaw(url: string, init?: RequestInit & {
    timeout?: number;
}): Promise<{
    status: number;
    data: any;
    headers: Headers;
    cookie: string[];
    text: string;
}>;
/**
 * 兼容 NeteaseCloudMusicApi 签名的统一 request 调度器函数.
 * 若首个参数为以 http 开头的完整 URL，执行原始请求；
 * 否则视为 CGI 请求：request(module, method, param, options).
 */
export declare function request(arg1: string, arg2?: any, arg3?: any, arg4?: any): Promise<ApiResponse>;
export default request;
