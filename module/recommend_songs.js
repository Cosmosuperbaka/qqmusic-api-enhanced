import { request } from "../util/request.js";
/**
 * 获取推荐新歌列表.
 *
 * @param query.type 地区/风格筛选: 1=内地, 2=欧美, 3=日本, 4=韩国, 5=最新(默认), 6=港台
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function recommend_songs(query = {}, req = request) {
    const type = Number(query.type) || 5;
    const cgiRes = await req("newsong.NewSongServer", "get_new_song_info", {
        type,
    }, {
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
