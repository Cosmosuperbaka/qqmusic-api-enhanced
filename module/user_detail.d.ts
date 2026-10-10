import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取用户个人主页及资料.
 *
 * @param query.uin 目标用户的 QQ/UIN (缺省时使用当前登录账号)
 * @param query.cookie 登录 Cookie
 */
export default function user_detail(query?: {
    uin?: string | number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
