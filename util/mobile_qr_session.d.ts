import { requestCgi } from "./request.js";
/**
 * QQ 音乐 App 扫码的实时会话。
 *
 * 状态只经 `wss://mu.y.qq.com` 的 MQTT 5 推送下发（`CheckQRCode` CGI 任何阶段都回 40000），
 * 所以每个二维码在创建时开一条订阅连接，状态落在内存里，后续轮询读取即可。
 */
export interface MobileQrState {
    /** 801 等待 / 802 已扫码待确认 / 800 过期 / 803 用户取消 / 200 成功 / 500 协议失败 */
    code: 200 | 500 | 800 | 801 | 802 | 803;
    message: string;
    /** 协议失败时的阶段与上游码，便于调用方区分原因（不含任何凭证）。 */
    stage?: string;
    upstreamCode?: number;
    uin?: string;
    musickey?: string;
    expiresAt?: number;
    cookieStr?: string;
    createdAt: number;
}
/** 与全局 WebSocket 兼容的最小形状，测试可注入假实现。 */
export interface WebSocketLike {
    binaryType: string;
    onopen: ((event: unknown) => void) | null;
    onmessage: ((event: {
        data: unknown;
    }) => void) | null;
    onclose: ((event: unknown) => void) | null;
    onerror: ((event: unknown) => void) | null;
    send(data: Uint8Array): void;
    close(): void;
}
export type WebSocketFactory = (url: string) => WebSocketLike;
export type CgiRequester = typeof requestCgi;
export interface MobileQrDeps {
    createSocket?: WebSocketFactory;
    requestCgi?: CgiRequester;
    now?: () => number;
    /** 二维码有效期，测试用；缺省 {@link SESSION_TTL_MS}。 */
    ttlMs?: number;
}
/** 取某个二维码当前的会话状态；还没有会话时返回 undefined。 */
export declare function getMobileQrState(qrcodeID: string): MobileQrState | undefined;
/** 丢弃会话（登录完成或过期后释放连接）。 */
export declare function dropMobileQrSession(qrcodeID: string): void;
/** 清掉所有会话，测试收尾用。 */
export declare function resetMobileQrSessions(): void;
/**
 * 确保该二维码有一条在线订阅；已有未过期会话时直接复用。
 * 连接建立失败不抛错，而是把状态置为 500 协议失败，交给轮询方上报。
 */
export declare function ensureMobileQrSession(qrcodeID: string, deps?: MobileQrDeps): MobileQrState;
