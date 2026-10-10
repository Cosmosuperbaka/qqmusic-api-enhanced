import { request } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";
import user_detail_fn from "./user_detail.js";
import user_vip_info_fn from "./user_vip_info.js";
/**
 * 校验当前 Cookie 登录状态及获取用户信息与 VIP 等级.
 *
 * @param query.cookie 登录凭据 Cookie
 */
export default async function login_status(query = {}, req = request) {
    const cookieObj = cookieToJson(query.cookie);
    let uin = cookieObj.uin || cookieObj.qqmusic_uin || cookieObj.wxuin || "";
    const cgiRes = await req("music.UserInfo.userInfoServer", "GetLoginUserInfo", {}, {
        cookie: query.cookie,
        platform: "web",
    });
    const data = (cgiRes.body || {});
    const userData = data.user || data.userInfo || data;
    const isLogin = data.code === 0 && Boolean(userData.uin || userData.encryptUin || uin);
    if (userData.uin) {
        uin = String(userData.uin).trim();
    }
    else if (!uin && userData.encryptUin) {
        uin = String(userData.encryptUin).trim();
    }
    let nickname = userData.nick || userData.nickname || "";
    let avatarUrl = userData.headurl || userData.avatar;
    // 若基本信息不全且处于已登录状态，尝试从 user_detail 补全昵称与头像
    if (isLogin && (!nickname || !avatarUrl)) {
        try {
            const detailRes = await user_detail_fn({ uin, cookie: query.cookie }, req);
            const header = detailRes.body?.data?.data || detailRes.body?.data || {};
            if (header.nick && !nickname)
                nickname = header.nick;
            if (header.headurl && !avatarUrl)
                avatarUrl = header.headurl;
        }
        catch { }
    }
    if (!nickname) {
        nickname = uin ? `QQ用户_${uin.slice(-4)}` : "QQ音乐用户";
    }
    // 补全 VIP 会员信息
    let vip = { vipStatus: "nonVip" };
    if (isLogin) {
        try {
            const vipRes = await user_vip_info_fn({ cookie: query.cookie }, req);
            vip = vipRes.body.vip;
        }
        catch {
            vip = { vipStatus: "unknown" };
        }
    }
    const account = {
        userId: uin,
        nickname,
        avatarUrl,
        vipStatus: vip.vipStatus,
        vipTier: vip.vipTier,
        vipLevel: vip.vipLevel,
        vipYear: vip.vipYear,
        vipExpireTime: vip.vipExpireTime,
    };
    return {
        status: cgiRes.status,
        body: {
            code: isLogin ? 200 : 301,
            isLogin,
            uin,
            nickname,
            avatarUrl,
            vip,
            account,
            data,
        },
        cookie: cgiRes.cookie,
    };
}
