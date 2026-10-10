import { request, type ApiResponse } from "../util/request.js";
/**
 * 轮询检查二维码登录状态.
 *
 * @param query.type 登录类型: 'qq' | 'wx' | 'mobile'
 * @param query.qrsig QQ 二维码凭证标识 (type=qq 时必填)
 * @param query.ptqrtoken QQ 二维码校验 token (type=qq 时必填)
 * @param query.uuid 微信登录会话 uuid (type=wx 时必填)
 * @param query.qrcodeID QQ 音乐 App 扫码 qrcodeID (type=mobile 时必填)
 */
export default function login_qr_check(query?: {
    type?: "qq" | "wx" | "mobile";
    qrsig?: string;
    ptqrtoken?: string | number;
    uuid?: string;
    qrcodeID?: string;
    key?: string;
}, req?: typeof request): Promise<ApiResponse>;
