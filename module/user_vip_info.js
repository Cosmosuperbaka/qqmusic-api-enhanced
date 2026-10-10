import { request } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";
import user_detail_fn from "./user_detail.js";
export function parseVipFromIcons(iconList = [], icons = []) {
    for (const item of [...iconList, ...icons]) {
        if (!item)
            continue;
        const url = String(item.srcUrl || item.IconURL || "");
        const helptxt = String(item.Helptxt || item.Title || "");
        const m = url.match(/(?:^|\/)(n)?(s?vip)(\d+)\.(?:png|webp)/i);
        if (m) {
            const isYear = Boolean(m[1]) || helptxt.includes("年费");
            const tier = m[2].toLowerCase() === "svip" ? "svip" : "vip";
            const level = parseInt(m[3], 10);
            return {
                vipStatus: "vip",
                vipTier: tier,
                vipLevel: level > 0 ? Math.min(Math.max(level, 1), 10) : 1,
                vipYear: isYear,
            };
        }
    }
    return null;
}
export function deriveVipInfo(body) {
    if (!body) {
        return { vipStatus: "unknown" };
    }
    const vipData = body.data || body;
    const identity = vipData.identity || {};
    const svip = Number(vipData.svip || 0);
    const isVip = Number(identity.HugeVip || identity.vip || 0);
    const level = Number(identity.level || 0);
    const isYear = Boolean(Number(identity.HugeYearFlag || identity.yearflag || identity.is_year || identity.year_vip || 0) > 0 ||
        Number(vipData.ystar || vipData.year || 0) > 0);
    let vipStatus = "nonVip";
    let vipTier = undefined;
    let vipLevel = undefined;
    let vipYear = undefined;
    let vipExpireTime = undefined;
    if (svip > 0) {
        vipStatus = "vip";
        vipTier = "svip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
    }
    else if (isVip > 0) {
        vipStatus = "vip";
        vipTier = "vip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
    }
    // 若基本 identity 未命中 VIP，尝试从附加的 Info / NewIconInfo / Icons 解析
    if (vipStatus === "nonVip") {
        const info = vipData.Info || vipData.info || {};
        const iconList = info.NewIconInfo?.iconlist || vipData.NewIconInfo?.iconlist || [];
        const icons = info.Icons || vipData.Icons || [];
        const iconVip = parseVipFromIcons(iconList, icons);
        if (iconVip && iconVip.vipStatus === "vip") {
            vipStatus = "vip";
            vipTier = iconVip.vipTier;
            vipLevel = iconVip.vipLevel;
            vipYear = iconVip.vipYear;
        }
    }
    const expireTs = Number(vipData.userinfo?.expire || 0);
    if (expireTs > 0) {
        vipExpireTime = expireTs * 1000;
    }
    else if (identity.HugeVipEnd) {
        const parsed = Date.parse(identity.HugeVipEnd);
        if (!isNaN(parsed))
            vipExpireTime = parsed;
    }
    else if (identity.twelveEnd) {
        const parsed = Date.parse(identity.twelveEnd);
        if (!isNaN(parsed))
            vipExpireTime = parsed;
    }
    return {
        vipStatus,
        vipTier,
        vipLevel,
        vipYear,
        vipExpireTime,
    };
}
/**
 * 获取当前登录用户的 VIP 会员信息及身份明细.
 *
 * @param query.cookie 登录 Cookie
 * @param query.uin 用户 QQ/UIN
 */
export default async function user_vip_info(query = {}, req = request) {
    const cookieObj = cookieToJson(query.cookie);
    const uin = query.uin?.toString() ||
        cookieObj.uin ||
        cookieObj.qqmusic_uin ||
        cookieObj.musicid ||
        "0";
    let cgiRes = { status: 200, body: {} };
    try {
        cgiRes = await req("VipLogin.VipLoginInter", "vip_login_base", {}, {
            uin,
            cookie: query.cookie,
            platform: "android",
        });
    }
    catch { }
    let vip = deriveVipInfo(cgiRes.body);
    // 若 vip_login_base 无法推断出有效 VIP，自动通过主页头部接口获取勋章母版特征
    if (vip.vipStatus === "nonVip" && uin && uin !== "0") {
        try {
            const detailRes = await user_detail_fn({ uin, cookie: query.cookie }, req);
            const detailData = detailRes.body?.data || {};
            const fallbackVip = deriveVipInfo(detailData);
            if (fallbackVip.vipStatus === "vip") {
                vip = {
                    ...vip,
                    ...fallbackVip,
                };
            }
        }
        catch { }
    }
    return {
        status: cgiRes.status,
        body: {
            code: cgiRes.body?.code ?? 200,
            data: cgiRes.body,
            vip,
        },
        cookie: cgiRes.cookie,
    };
}
