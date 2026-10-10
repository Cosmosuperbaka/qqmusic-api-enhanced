import { request, type ApiResponse } from "../util/request.js";
import { cookieToJson, cookieToString, parseSetCookie } from "../util/cookie.js";

/**
 * 刷新登录凭证.
 *
 * @param query.cookie 登录 Cookie
 * @param query.openid 微信/QQ openid (可选)
 * @param query.refresh_token 刷新令牌 (可选)
 */
export default async function login_refresh(
  query: {
    cookie?: any;
    openid?: string;
    refresh_token?: string;
    refresh_key?: string;
  } = {},
  req = request
): Promise<ApiResponse<{ code: number; data: any; cookieStr: string }>> {
  const cookieObj = cookieToJson(query.cookie);
  const uin = cookieObj.uin || cookieObj.qqmusic_uin || cookieObj.wxuin || "0";
  const musickey = cookieObj.qm_keyst || cookieObj.qqmusic_key || "";

  const loginType = cookieObj.tmeLoginType || (musickey.startsWith("W_X") ? "1" : "2");

  const param = {
    openid: query.openid || cookieObj.openid || "",
    refresh_token: query.refresh_token || cookieObj.refresh_token || "",
    refresh_key: query.refresh_key || cookieObj.refresh_key || "",
    access_token: cookieObj.access_token || "",
    musicid: Number(uin) || 0,
    str_musicid: uin,
    musickey,
    loginMode: 2,
  };

  const cgiRes = await req(
    "music.login.LoginServer",
    "Login",
    param,
    {
      cookie: query.cookie,
      platform: "android",
      comm: { tmeLoginType: Number(loginType) || 2 },
    }
  );

  const resBody = (cgiRes.body || {}) as any;
  const newCookies = parseSetCookie(cgiRes.cookie || []);
  const mergedCookies = { ...cookieObj, ...newCookies };

  if (resBody.musickey) {
    mergedCookies.qm_keyst = resBody.musickey;
    mergedCookies.qqmusic_key = resBody.musickey;
    mergedCookies.musickey = resBody.musickey;
  }
  if (resBody.musicid) {
    mergedCookies.uin = String(resBody.musicid);
    mergedCookies.qqmusic_uin = String(resBody.musicid);
    mergedCookies.musicid = String(resBody.musicid);
  }
  if (resBody.encryptUin) {
    mergedCookies.euin = resBody.encryptUin;
    mergedCookies.encryptUin = resBody.encryptUin;
  }
  if (resBody.refresh_token) {
    mergedCookies.refresh_token = resBody.refresh_token;
  }
  const cookieStr = cookieToString(mergedCookies);

  return {
    status: cgiRes.status,
    body: {
      code: resBody.code ?? (cgiRes.status === 200 ? 200 : 500),
      data: resBody,
      cookieStr,
    },
    cookie: cgiRes.cookie,
  };
}
