import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌手详细资料与百科背景.
 *
 * @param query.id 歌手 MID (例如: 0025NhlC2yWrP4)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function artist_detail(query?: {
    id?: string;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
