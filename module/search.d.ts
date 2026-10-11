import { request, type ApiResponse } from "../util/request.js";
/**
 * 歌曲/歌手/专辑/歌单/歌词综合搜索.
 *
 * @param query.keywords 搜索关键词 (也兼容 keyword)
 * @param query.type 搜索类型: 0-单曲(默认), 1-歌手, 2-专辑, 3-歌单, 7-歌词
 * @param query.page 页码 (默认 1)
 * @param query.limit 每页数量 (默认 20)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function search(query?: {
    keywords?: string;
    keyword?: string;
    type?: number | string;
    page?: number;
    limit?: number;
    cookie?: any;
    searchid?: string;
    platform?: string;
}, req?: typeof request): Promise<ApiResponse>;
