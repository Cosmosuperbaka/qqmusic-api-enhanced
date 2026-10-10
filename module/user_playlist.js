import { request } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";
/**
 * 获取用户创建及收藏的歌单列表.
 *
 * @param query.uin 目标用户 UIN (缺省时使用当前登录账号)
 * @param query.cookie 登录 Cookie
 */
export default async function user_playlist(query = {}, req = request) {
    const cookieObj = cookieToJson(query.cookie);
    const targetUin = query.uin?.toString() ||
        cookieObj.uin ||
        cookieObj.qqmusic_uin ||
        cookieObj.wxuin ||
        "0";
    const cgiRes = await req("music.musicasset.PlaylistBaseRead", "GetPlaylistByUin", {
        uin: targetUin,
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
