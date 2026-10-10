import { request, type ApiResponse } from "../util/request.js";
/**
 * 刷新登录凭证.
 *
 * @param query.cookie 登录 Cookie
 * @param query.openid 微信/QQ openid (可选)
 * @param query.refresh_token 刷新令牌 (可选)
 */
export default function login_refresh(query?: {
    cookie?: any;
    openid?: string;
    refresh_token?: string;
    refresh_key?: string;
}, req?: typeof request): Promise<ApiResponse<{
    code: number;
    data: any;
    cookieStr: string;
}>>;
