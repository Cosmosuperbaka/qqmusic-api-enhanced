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
    let uin = cookieObj.uin || cookieObj.qqmusic_uin || cookieObj.musicid || cookieObj.wxuin || "";
    const musickey = cookieObj.qm_keyst || cookieObj.qqmusic_key || cookieObj.musickey || "";
    let cgiRes = { status: 200, body: {} };
    try {
        cgiRes = await req("music.UserInfo.userInfoServer", "GetLoginUserInfo", {}, {
            cookie: query.cookie,
            platform: "android",
        });
    }
    catch { }
    const data = (cgiRes.body || {});
    const userData = data.user || data.userInfo || data;
    let isLogin = (data.code === 0 || (data.code === undefined && Boolean(userData.uin || userData.encryptUin))) &&
        Boolean(userData.uin || userData.encryptUin || uin);
    if (userData.uin) {
        uin = String(userData.uin).trim();
    }
    else if (!uin && userData.encryptUin) {
        uin = String(userData.encryptUin).trim();
    }
    let nickname = userData.nick || userData.nickname || "";
    let avatarUrl = userData.headurl || userData.avatar;
    // 并行获取用户主页资料与 VIP 信息（避免串行多次公网 RPC 导致进房等待过久）
    const needDetail = Boolean(uin && (!nickname || !avatarUrl));
    const needVip = Boolean(isLogin || uin);
    const [detailResult, vipResult] = await Promise.allSettled([
        needDetail ? user_detail_fn({ uin, cookie: query.cookie }, req) : Promise.resolve(null),
        needVip ? user_vip_info_fn({ cookie: query.cookie, uin }, req) : Promise.resolve(null),
    ]);
    if (detailResult.status === "fulfilled" && detailResult.value) {
        const detailData = detailResult.value.body?.data || {};
        if (detailData.nick && !nickname)
            nickname = detailData.nick;
        if (detailData.headurl && !avatarUrl)
            avatarUrl = detailData.headurl;
        if (detailData.nick && Boolean(musickey || uin)) {
            isLogin = true;
        }
    }
    if (!nickname) {
        nickname = uin ? `QQ用户_${uin.slice(-4)}` : "QQ音乐用户";
    }
    let vip = { vipStatus: "nonVip" };
    if (vipResult.status === "fulfilled" && vipResult.value) {
        vip = vipResult.value.body.vip;
    }
    else if (needVip) {
        vip = { vipStatus: "unknown" };
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
        status: cgiRes.status || 200,
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
