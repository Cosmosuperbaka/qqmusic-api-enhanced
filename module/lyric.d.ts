import { request, type ApiResponse } from "../util/request.js";
/**
 * 获取歌曲歌词 (普通 LRC 与逐字 QRC 解密).
 *
 * @param query.id 歌曲 ID (纯数字) 或歌曲 MID
 * @param query.qrc 是否获取逐字歌词 (默认 true)
 * @param query.trans 是否获取歌词翻译 (默认 true)
 * @param query.roma 是否获取罗马音歌词 (默认 false)
 * @param query.cookie 登录 Cookie (可选)
 */
export default function lyric(query?: {
    id?: string | number;
    qrc?: boolean;
    trans?: boolean;
    roma?: boolean;
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse>;
