import { request } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";
import user_detail_fn from "./user_detail.js";
export function parseVipFromIcons(iconList = [], icons = []) {
    // 1. 优先从用户主页活跃佩戴的 iconList (NewIconInfo.iconlist) 查找
    for (const item of iconList) {
        if (!item)
            continue;
        if (item.GreyURL && String(item.GreyURL).trim().length > 0)
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
    // 2. 其次才从旧版快捷入口 icons 查找
    for (const item of icons) {
        if (!item)
            continue;
        if (item.GreyURL && String(item.GreyURL).trim().length > 0)
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
export function deriveVipInfo(body, now = Date.now()) {
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
    // 解析各个可能的过期时间
    const expireTs = Number(vipData.userinfo?.expire || 0);
    let parsedExpire = undefined;
    if (expireTs > 0) {
        parsedExpire = expireTs * 1000;
    }
    else if (identity.HugeVipEnd) {
        const parsed = Date.parse(identity.HugeVipEnd);
        if (!isNaN(parsed))
            parsedExpire = parsed;
    }
    else if (identity.twelveEnd) {
        const parsed = Date.parse(identity.twelveEnd);
        if (!isNaN(parsed))
            parsedExpire = parsed;
    }
    else if (vipData.starend) {
        const parsed = Date.parse(vipData.starend);
        if (!isNaN(parsed))
            parsedExpire = parsed;
    }
    else if (vipData.ystarend) {
        const parsed = Date.parse(vipData.ystarend);
        if (!isNaN(parsed))
            parsedExpire = parsed;
    }
    const isExpired = parsedExpire !== undefined && parsedExpire <= now;
    let vipStatus = "nonVip";
    let vipTier = undefined;
    let vipLevel = undefined;
    let vipYear = undefined;
    let vipExpireTime = undefined;
    // 1. 如果存在未过期的 SVIP
    if (svip > 0 && !isExpired) {
        vipStatus = "vip";
        vipTier = "svip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
        vipExpireTime = parsedExpire;
    }
    else if (isVip > 0) {
        // 2. 如果存在普通 VIP（若 svip 已过期但 isVip 存在，降级为未过期 VIP）
        vipStatus = "vip";
        vipTier = "vip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
        vipExpireTime = isExpired ? undefined : parsedExpire;
    }
    // 3. 若基本 identity 未命中有效 VIP，或虽推导为 SVIP 但已过期，从附加的 Info / NewIconInfo / Icons 解析当前活跃佩戴勋章
    if (vipStatus === "nonVip" || (vipTier === "svip" && isExpired)) {
        const info = vipData.Info || vipData.info || {};
        const iconList = info.NewIconInfo?.iconlist || vipData.NewIconInfo?.iconlist || [];
        const icons = info.Icons || vipData.Icons || [];
        const iconVip = parseVipFromIcons(iconList, icons);
        if (iconVip && iconVip.vipStatus === "vip") {
            vipStatus = "vip";
            vipTier = iconVip.vipTier;
            vipLevel = iconVip.vipLevel;
            vipYear = iconVip.vipYear;
            vipExpireTime = isExpired ? undefined : (vipExpireTime ?? iconVip.vipExpireTime);
        }
    }
    // 4. 若最终状态仍为已过期且无未过期档位，重置为 nonVip 并清除过期时间
    if (isExpired && vipTier === "svip") {
        vipStatus = "nonVip";
        vipTier = undefined;
        vipLevel = undefined;
        vipYear = undefined;
        vipExpireTime = undefined;
    }
    else if (isExpired && vipExpireTime && vipExpireTime <= now) {
        vipExpireTime = undefined;
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
    // 若 vip_login_base 无法推断出有效 VIP，或推断出的 SVIP 已经过期，或需要主页勋章校准，
    // 自动通过主页头部接口获取勋章母版特征
    if ((vip.vipStatus === "nonVip" || vip.vipTier === "svip") && uin && uin !== "0") {
        try {
            const detailRes = await user_detail_fn({ uin, cookie: query.cookie }, req);
            const detailData = detailRes.body?.data || {};
            const fallbackVip = deriveVipInfo(detailData);
            if (fallbackVip.vipStatus === "vip") {
                if (vip.vipStatus === "nonVip" || fallbackVip.vipTier === "vip" || !vip.vipExpireTime || vip.vipExpireTime <= Date.now()) {
                    vip = {
                        ...vip,
                        ...fallbackVip,
                        vipExpireTime: (vip.vipExpireTime && vip.vipExpireTime > Date.now()) ? vip.vipExpireTime : fallbackVip.vipExpireTime,
                    };
                }
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
