import { request, type ApiResponse } from "../util/request.js";
import { cookieToJson } from "../util/cookie.js";

/**
 * 获取用户个人主页及资料.
 *
 * @param query.uin 目标用户的 QQ/UIN (缺省时使用当前登录账号)
 * @param query.cookie 登录 Cookie
 */
export default async function user_detail(
  query: { uin?: string | number; cookie?: any } = {},
  req = request
): Promise<ApiResponse> {
  const cookieObj = cookieToJson(query.cookie);
  const targetUin =
    query.uin?.toString() ||
    cookieObj.uin ||
    cookieObj.qqmusic_uin ||
    cookieObj.musicid ||
    cookieObj.wxuin ||
    cookieObj.euin ||
    "0";

  const cgiRes = await req(
    "music.UnifiedHomepage.UnifiedHomepageSrv",
    "GetHomepageHeader",
    {
      uin: targetUin,
      IsQueryTabDetail: 1,
    },
    {
      uin: targetUin,
      cookie: query.cookie,
      platform: "android",
    }
  );

  const rawData = cgiRes.body?.data || cgiRes.body || {};
  const info = rawData.Info || rawData.info || {};
  const baseInfo = info.BaseInfo || info.base_info || {};
  const newIconInfo = info.NewIconInfo || info.new_icon_info || {};
  const icons = info.Icons || info.icons || [];

  const nick = String(baseInfo.Name || baseInfo.name || "").trim();
  const avatarUrl = String(baseInfo.BigAvatar || baseInfo.Avatar || baseInfo.avatar || "").trim();

  const formattedData = {
    ...rawData,
    nick,
    headurl: avatarUrl,
    avatar: avatarUrl,
    BaseInfo: baseInfo,
    NewIconInfo: newIconInfo,
    Icons: icons,
    Info: info,
  };

  return {
    status: cgiRes.status,
    body: {
      code: cgiRes.body?.code ?? 200,
      data: formattedData,
      nick,
      avatarUrl,
    },
    cookie: cgiRes.cookie,
  };
}
