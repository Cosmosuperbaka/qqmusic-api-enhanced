import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取推荐新歌列表.
 *
 * @param query.type 地区/风格筛选: 1=内地, 2=欧美, 3=日本, 4=韩国, 5=最新(默认), 6=港台
 * @param query.cookie 登录 Cookie (可选)
 */
export default function recommend_songs(query?: {
    type?: number;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
