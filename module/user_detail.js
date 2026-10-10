import { request } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";
/**
 * 获取用户个人主页及资料.
 *
 * @param query.uin 目标用户的 QQ/UIN (缺省时使用当前登录账号)
 * @param query.cookie 登录 Cookie
 */
export default async function user_detail(query = {}, req = request) {
    const cookieObj = cookieToJson(query.cookie);
    const targetUin = query.uin?.toString() ||
        cookieObj.uin ||
        cookieObj.qqmusic_uin ||
        cookieObj.wxuin ||
        "0";
    const cgiRes = await req("music.userHomepage.UserHomepage", "GetHomepageHeader", {
        uin: Number(targetUin) || 0,
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
