import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌曲播放音频 URL (VKey 直链提取).
 *
 * @param query.id 歌曲 mid (单条或数组)
 * @param query.type 音质: '128' (默认) | '320' | 'flac' | 'm4a' | 'try'
 * @param query.cookie 登录 Cookie (VIP 歌曲需携带有效凭证)
 */
export default function song_url(query?: {
    id?: string | string[];
    ids?: string | string[];
    type?: "128" | "320" | "flac" | "m4a" | "try" | string;
    cookie?: any;
    guid?: string;
}, req?: typeof request): Promise<ApiResponse>;
