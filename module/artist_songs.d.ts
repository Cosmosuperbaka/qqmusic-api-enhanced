import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌手单曲列表 (支持最热 / 最新排序).
 *
 * @param query.id 歌手 MID
 * @param query.page 页码 (默认 1)
 * @param query.limit 每页数量 (默认 30)
 * @param query.order 排序方式: 'hot' (默认最热) | 'latest' (最新)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function artist_songs(query?: {
    id?: string;
    page?: number;
    limit?: number;
    order?: "hot" | "latest" | number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
