import { request, requestCgi, type ApiResponse } from "../util/request.js";
import { type MobileQrDeps } from "../util/mobile_qr_session.js";
/**
 * 轮询检查二维码登录状态.
 *
 * 返回 `body.code` 约定：
 * - 200 登录成功（保证带有 musickey，调用方可以直接落库）
 * - 801 等待扫码 / 802 已扫码待确认
 * - 800 二维码过期
 * - 803 用户在手机上取消或拒绝授权
 * - 500 上游协议失败：带 `reason`（见 {@link LoginFailureReason}）、`stage`、`upstreamCode`，
 *   与“二维码过期 / 用户取消”区分开，调用方不应继续轮询同一个二维码
 *
 * @param query.type 登录类型: 'qq' | 'wx' | 'mobile'
 * @param query.qrsig QQ 二维码凭证标识 (type=qq 时必填)
 * @param query.ptqrtoken QQ 二维码校验 token (type=qq 时必填)
 * @param query.uuid 微信登录会话 uuid (type=wx 时必填)
 * @param query.qrcodeID QQ 音乐 App 扫码 qrcodeID (type=mobile 时必填)
 */
export type LoginFailureReason = "auth_invalid" | "rate_limited" | "device_limit" | "account_restricted" | "protocol";
/** 测试注入点：真实调用不需要传。 */
export interface LoginQrCheckDeps {
    fetch?: typeof fetch;
    cgi?: typeof requestCgi;
    mobile?: MobileQrDeps;
}
/** 业务码 → 失败原因。码表来自各登录入口的公开实现与实测（无效授权码返回 104400）。 */
export declare function classifyLoginCode(code: number | undefined): {
    reason: LoginFailureReason;
    message: string;
};
/**
 * 按域名隔离的 Cookie 罐，行为对齐浏览器。
 *
 * 登录网关会在同一次响应里给 `graph.qq.com` 下发 p_skey，再把 `qq.com` 的同名项清掉；
 * 不分域名合并时，清除指令会连真票据一起删掉，后面的 OAuth 就没有 g_tk 可算。
 */
export declare class CookieJar {
    private readonly entries;
    constructor(initial?: Record<string, string>);
    apply(setCookies: string[], requestHost?: string): void;
    /** 目标主机能看到的 Cookie；同名时取域最具体的一项。 */
    private visible;
    get(name: string, host?: string): string;
    toObject(host?: string): Record<string, string>;
    header(host?: string): string;
}
/** 解析 ptqrlogin 的 `ptuiCB('码','…','URL','…','提示','昵称')` 回调。 */
export declare function parsePtqrloginText(text: string): {
    status: "expired" | "waiting" | "scanned" | "refused" | "success" | "unknown";
    url?: string;
};
/** 从授权跳转里取 code；Location 之外也兜底扫描响应体里的跳转脚本。 */
export declare function extractAuthCode(location: string, body?: string): string;
/** 把 Location 概括成可安全进日志的形态：只留主机、路径和 error 类参数，不含 code/token。 */
export declare function describeLocation(location: string): Record<string, string>;
export default function login_qr_check(query?: {
    type?: "qq" | "wx" | "mobile";
    qrsig?: string;
    ptqrtoken?: string | number;
    uuid?: string;
    qrcodeID?: string;
    key?: string;
    guid?: string;
}, _req?: typeof request, deps?: LoginQrCheckDeps): Promise<ApiResponse>;
