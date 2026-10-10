import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取用户创建及收藏的歌单列表.
 *
 * @param query.uin 目标用户 UIN (缺省时使用当前登录账号)
 * @param query.cookie 登录 Cookie
 */
export default function user_playlist(query?: {
    uin?: string | number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
