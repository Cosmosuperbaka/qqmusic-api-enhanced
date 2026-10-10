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
function parseDateMs(val) {
    if (val === undefined || val === null || val === "" || val === 0)
        return undefined;
    if (typeof val === "number" && val > 0) {
        return val > 1e11 ? val : val * 1000;
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (!trimmed)
            return undefined;
        const num = Number(trimmed);
        if (!isNaN(num) && num > 0) {
            return num > 1e11 ? num : num * 1000;
        }
        const parsed = Date.parse(trimmed.replace(/-/g, "/"));
        if (!isNaN(parsed))
            return parsed;
    }
    return undefined;
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
    // 1. 分别提取 SVIP 专有到期时间
    let svipExpire = undefined;
    if (vipData.starend)
        svipExpire = parseDateMs(vipData.starend);
    else if (vipData.ystarend)
        svipExpire = parseDateMs(vipData.ystarend);
    else if (identity.SvipEnd || identity.svip_end)
        svipExpire = parseDateMs(identity.SvipEnd || identity.svip_end);
    else if (svip > 0 && Number(vipData.userinfo?.expire || 0) > 0) {
        svipExpire = parseDateMs(vipData.userinfo.expire);
    }
    // 2. 分别提取普通 VIP / 豪华绿钻专有到期时间
    let vipExpire = undefined;
    if (identity.HugeVipEnd)
        vipExpire = parseDateMs(identity.HugeVipEnd);
    else if (identity.twelveEnd)
        vipExpire = parseDateMs(identity.twelveEnd);
    else if (identity.eightEnd)
        vipExpire = parseDateMs(identity.eightEnd);
    else if (identity.overdate)
        vipExpire = parseDateMs(identity.overdate);
    else if (vipData.mygreen)
        vipExpire = parseDateMs(vipData.mygreen);
    else if (svip === 0 && Number(vipData.userinfo?.expire || 0) > 0) {
        vipExpire = parseDateMs(vipData.userinfo.expire);
    }
    const isSvipExpired = svipExpire !== undefined && svipExpire <= now;
    const isVipExpired = vipExpire !== undefined && vipExpire <= now;
    let vipStatus = "nonVip";
    let vipTier = undefined;
    let vipLevel = undefined;
    let vipYear = undefined;
    let vipExpireTime = undefined;
    // 1. 如果存在未过期的 SVIP
    if (svip > 0 && !isSvipExpired) {
        vipStatus = "vip";
        vipTier = "svip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
        vipExpireTime = svipExpire ?? (vipExpire && !isVipExpired ? vipExpire : undefined);
    }
    else if (isVip > 0 && !isVipExpired) {
        // 2. 如果存在普通 VIP（若 SVIP 已过期但 VIP 未过期，降级并展示未过期的 VIP 到期时间）
        vipStatus = "vip";
        vipTier = "vip";
        vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
        vipYear = isYear;
        vipExpireTime = vipExpire ?? (svipExpire && !isSvipExpired ? svipExpire : undefined);
    }
    // 3. 若 identity 未命中有效 VIP（例如 SVIP 已过期，且普通 VIP 缺少基础标志或需通过勋章校准）
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
            if (iconVip.vipTier === "vip" && vipExpire && vipExpire > now) {
                vipExpireTime = vipExpire;
            }
            else if (iconVip.vipTier === "svip" && svipExpire && svipExpire > now) {
                vipExpireTime = svipExpire;
            }
            else {
                vipExpireTime = undefined;
            }
        }
    }
    // 4. 严苛防线：任何已过期的到期时间绝对不允许外露
    if (vipExpireTime !== undefined && vipExpireTime <= now) {
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
