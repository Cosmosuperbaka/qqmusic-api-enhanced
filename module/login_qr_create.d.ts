import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取登录二维码 (QQ / 微信 / 移动端App).
 *
 * @param query.type 登录类型: 'qq' (默认), 'wx' (微信), 'mobile' (QQ音乐App)
 */
export default function login_qr_create(query?: {
    type?: "qq" | "wx" | "mobile";
    cookie?: any;
    guid?: string;
}, req?: typeof request): Promise<ApiResponse>;
