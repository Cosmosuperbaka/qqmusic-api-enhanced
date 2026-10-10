import { request, type ApiResponse } from "../util/request.js";
/**
 * 分页获取歌单全量歌曲列表.
 *
 * @param query.id 歌单 ID (disstid)
 * @param query.limit 本次获取数量 (默认 100, 上限 1000)
 * @param query.offset 偏移量 (默认 0)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function playlist_track_all(query?: {
    id?: string | number;
    limit?: number;
    offset?: number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
