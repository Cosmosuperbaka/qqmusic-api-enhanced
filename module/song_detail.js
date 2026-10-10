import { request } from "../util/request.js";
/**
 * 获取歌曲详细信息与元数据.
 *
 * @param query.id 歌曲 ID (纯数字) 或歌曲 MID (字母数字混合，如 0039MnYb0qxYAc)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function song_detail(query = {}, req = request) {
    const value = (query.id ?? query.ids)?.toString().trim();
    if (!value) {
        return {
            status: 400,
            body: { code: 400, message: "缺少歌曲 id 或 mid" },
        };
    }
    const isNumeric = /^\d+$/.test(value);
    const param = isNumeric ? { song_id: Number(value) } : { song_mid: value };
    const cgiRes = await req("music.pf_song_detail_svr", "get_song_detail_yqq", param, {
        cookie: query.cookie,
        platform: "web",
    });
    return {
        status: cgiRes.status,
        body: {
            code: cgiRes.body?.code ?? 200,
            data: cgiRes.body,
        },
        cookie: cgiRes.cookie,
    };
}
