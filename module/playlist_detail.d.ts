import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌单基本信息与首屏歌曲.
 *
 * @param query.id 歌单 ID (disstid)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function playlist_detail(query?: {
    id?: string | number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
