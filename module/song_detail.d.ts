import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌曲详细信息与元数据.
 *
 * @param query.id 歌曲 ID (纯数字) 或歌曲 MID (字母数字混合，如 0039MnYb0qxYAc)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function song_detail(query?: {
    id?: string | number;
    ids?: string | number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
