import { request } from "../util/request.js";
import { cookieToJson, cookieToString, mergeLoginPayloadCookies, parseSetCookie, } from "../util/cookie.js";
import { getStableGuid } from "../util/crypto.js";
/**
 * 刷新登录凭证。
 *
 * QQ 音乐不同登录入口的续期接口并不一样：
 * - 手机 QQ / QQ 互联网页扫码拿到的是 `uin + qm_keyst`，续期走
 *   `QQConnectLogin.LoginServer/QQLogin`（带 `expired_in` 与旧 `musickey`），
 *   这是上游长期使用的稳定路径；
 * - QQ 音乐 App / 微信等移动端登录会额外拿到 `refresh_token` / `refresh_key`，
 *   续期走 `music.login.LoginServer/Login` 的 refresh-token 流程。
 *
 * 旧实现无条件走后者，网页扫码的 Cookie 没有 refresh_token，续期会失败，
 * 账号随后被判失效。这里先走 QQLogin，再回退到 refresh-token 流程。
 *
 * @param query.cookie 登录 Cookie
 * @param query.openid 微信/QQ openid (可选)
 * @param query.refresh_token 刷新令牌 (可选)
 * @param query.refresh_key 刷新密钥 (可选)
 * @param query.guid 设备标识；缺省从 Cookie/账号派生，保持稳定
 */
export default async function login_refresh(query = {}, req = request) {
    const cookieObj = cookieToJson(query.cookie);
    const uin = cookieObj.uin || cookieObj.qqmusic_uin || cookieObj.wxuin || "";
    const musickey = cookieObj.qm_keyst || cookieObj.qqmusic_key || cookieObj.musickey || "";
    // 旧 Cookie 可能没有 guid：按账号派生一个稳定值，避免续期时被当成新设备。
    const guid = query.guid || cookieObj.guid || getStableGuid(`${uin}:${cookieObj.openid ?? ""}`);
    cookieObj.guid = guid;
    if (!uin || !musickey) {
        return {
            status: 200,
            body: {
                code: 301,
                cookieStr: cookieToString(cookieObj),
                message: "缺少 uin 或 musickey，无法续期",
            },
        };
    }
    const loginType = cookieObj.tmeLoginType || (musickey.startsWith("W_X") ? "1" : "2");
    let lastBody = {};
    let lastExpiresAt;
    const tryRefresh = async (module, method, param, options) => {
        const beforeKey = cookieObj.qm_keyst || cookieObj.qqmusic_key || "";
        const res = await req(module, method, param, { cookie: cookieObj, guid, ...options });
        Object.assign(cookieObj, parseSetCookie(res.cookie || []));
        const merged = mergeLoginPayloadCookies(cookieObj, res.body);
        lastBody = res.body;
        lastExpiresAt = merged.expiresAt;
        const afterKey = cookieObj.qm_keyst || cookieObj.qqmusic_key || "";
        const obtained = merged.obtainedMusickey || (Boolean(afterKey) && afterKey !== beforeKey);
        if (!obtained)
            return false;
        // 有的线路只在 Set-Cookie 里回新 key，这里把三个别名补齐。
        cookieObj.qm_keyst = afterKey;
        cookieObj.qqmusic_key = afterKey;
        cookieObj.musickey = afterKey;
        cookieObj.guid = guid;
        return true;
    };
    // 1. QQ 互联网页扫码：用旧 musickey 直接换新 key。签名与非签名各试一次，
    //    不同部署/线路对 musics.fcg 的签名要求不一致。
    for (const sign of [true, false]) {
        try {
            const refreshed = await tryRefresh("QQConnectLogin.LoginServer", "QQLogin", { expired_in: 7_776_000, musicid: uin, musickey }, { platform: "android", sign });
            if (refreshed) {
                return {
                    status: 200,
                    body: {
                        code: 200,
                        musickey: cookieObj.qm_keyst,
                        cookieStr: cookieToString(cookieObj),
                        expiresAt: lastExpiresAt,
                        data: lastBody,
                    },
                };
            }
        }
        catch (error) {
            lastBody = { error: String(error) };
        }
    }
    // 2. 移动端/微信：refresh-token 流程。二维码登录若拿到了 refresh_token，
    //    即使旧 musickey 已过期也能在这里恢复。
    try {
        const refreshed = await tryRefresh("music.login.LoginServer", "Login", {
            openid: query.openid || cookieObj.openid || "",
            refresh_token: query.refresh_token || cookieObj.refresh_token || "",
            refresh_key: query.refresh_key || cookieObj.refresh_key || "",
            access_token: cookieObj.access_token || "",
            musicid: Number(uin) || 0,
            str_musicid: uin,
            musickey,
            loginMode: 2,
        }, {
            platform: "android",
            comm: { tmeLoginType: Number(loginType) || 2 },
        });
        if (refreshed) {
            return {
                status: 200,
                body: {
                    code: 200,
                    musickey: cookieObj.qm_keyst,
                    cookieStr: cookieToString(cookieObj),
                    expiresAt: lastExpiresAt,
                    data: lastBody,
                },
            };
        }
    }
    catch (error) {
        lastBody = { error: String(error) };
    }
    return {
        status: 200,
        body: {
            code: Number(lastBody?.code) || 301,
            cookieStr: cookieToString(cookieObj),
            data: lastBody,
            message: "登录凭证续期失败，请重新扫码登录",
        },
    };
}
