import { request, type ApiResponse } from "../util/request.js";

export interface NormalizedVipInfo {
  vipStatus: "vip" | "nonVip" | "unknown";
  vipTier?: "svip" | "vip";
  vipLevel?: number;
  vipYear?: boolean;
  vipExpireTime?: number;
}

export function deriveVipInfo(body: any): NormalizedVipInfo {
  if (!body) {
    return { vipStatus: "unknown" };
  }
  const vipData = body.data || body;
  const identity = vipData.identity || {};
  const svip = Number(vipData.svip || 0);
  const isVip = Number(identity.HugeVip || identity.vip || 0);
  const level = Number(identity.level || 0);
  const isYear = Boolean(
    Number(identity.is_year || identity.year_vip || identity.HugeVipYear || identity.year || 0) > 0 ||
    Number(vipData.year || vipData.is_year || 0) > 0
  );

  let vipStatus: "vip" | "nonVip" | "unknown" = "nonVip";
  let vipTier: "svip" | "vip" | undefined = undefined;
  let vipLevel: number | undefined = undefined;
  let vipYear: boolean | undefined = undefined;
  let vipExpireTime: number | undefined = undefined;

  if (svip > 0) {
    vipStatus = "vip";
    vipTier = "svip";
    vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
    vipYear = isYear;
  } else if (isVip > 0) {
    vipStatus = "vip";
    vipTier = "vip";
    vipLevel = level > 0 ? Math.min(Math.max(level, 1), 10) : 1;
    vipYear = isYear;
  }

  const expireTs = Number(vipData.userinfo?.expire || 0);
  if (expireTs > 0) {
    vipExpireTime = expireTs * 1000;
  } else if (identity.HugeVipEnd) {
    const parsed = Date.parse(identity.HugeVipEnd);
    if (!isNaN(parsed)) vipExpireTime = parsed;
  } else if (identity.twelveEnd) {
    const parsed = Date.parse(identity.twelveEnd);
    if (!isNaN(parsed)) vipExpireTime = parsed;
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
 */
export default async function user_vip_info(
  query: { cookie?: any } = {},
  req = request
): Promise<ApiResponse<{ code: number; data: any; vip: NormalizedVipInfo }>> {
  const cgiRes = await req(
    "VipLogin.VipLoginInter",
    "vip_login_base",
    {},
    {
      cookie: query.cookie,
      platform: "web",
    }
  );

  const vip = deriveVipInfo(cgiRes.body);

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
