import { request, requestCgi, type ApiResponse } from "../util/request.js";
import { getGtk, getStableGuid } from "../util/crypto.js";
import {
  cookieToJson,
  cookieToString,
  mergeLoginPayloadCookies,
  parseSetCookie,
} from "../util/cookie.js";
import { getMobileSession, registerMobileSession } from "../util/mobile_qr_session.js";

/**
 * 轮询检查二维码登录状态.
 *
 * @param query.type 登录类型: 'qq' | 'wx' | 'mobile'
 * @param query.qrsig QQ 二维码凭证标识 (type=qq 时必填)
 * @param query.ptqrtoken QQ 二维码校验 token (type=qq 时必填)
 * @param query.uuid 微信登录会话 uuid (type=wx 时必填)
 * @param query.qrcodeID QQ 音乐 App 扫码 qrcodeID (type=mobile 时必填)
 */
export default async function login_qr_check(
  query: {
    type?: "qq" | "wx" | "mobile";
    qrsig?: string;
    ptqrtoken?: string | number;
    uuid?: string;
    qrcodeID?: string;
    key?: string;
    guid?: string;
  } = {},
  req = request
): Promise<ApiResponse> {
  const type = query.type || "qq";

  if (type === "qq") {
    const { qrsig, ptqrtoken } = query;
    if (!qrsig || ptqrtoken === undefined) {
      return {
        status: 400,
        body: { code: 400, message: "缺少必要参数 qrsig 或 ptqrtoken" },
      };
    }

    const checkUrl =
      `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump` +
      `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
      `&action=0-0-${Date.now()}&js_ver=20102616&js_type=1&pt_uistyle=40` +
      `&aid=716027609&daid=383&pt_3rd_aid=100497308&has_onekey=1`;

    const guid = query.guid || getStableGuid(qrsig);
    const checkRes = await fetch(checkUrl, {
      headers: {
        Referer: "https://xui.ptlogin2.qq.com/",
        Cookie: `qrsig=${qrsig}`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const text = await checkRes.text();
    const setCookies = checkRes.headers.getSetCookie?.() || [];
    let allCookies: Record<string, string> = {
      qrsig,
      ...parseSetCookie(setCookies),
    };

    if (text.includes("已失效")) {
      return {
        status: 200,
        body: { code: 800, message: "二维码已失效" },
      };
    }

    if (text.includes("未扫描") || text.includes("未失效")) {
      return {
        status: 200,
        body: { code: 801, message: "等待玩家扫码" },
      };
    }

    if (text.includes("认证中") || text.includes("本次登录需要")) {
      return {
        status: 200,
        body: { code: 802, message: "已扫码，等待移动端确认" },
      };
    }

    if (!text.includes("登录成功")) {
      return {
        status: 200,
        body: { code: 803, message: "扫码状态异常", raw: text },
      };
    }

    // 扫码成功，解析 check_sig 回调地址
    const matchUrl = text.match(/(?:'((?:https?|ftp):\/\/[^\s/$.?#].[^\s]*)')/g);
    if (!matchUrl || !matchUrl[0]) {
      return {
        status: 500,
        body: { code: 500, message: "无法解析登录回调地址", raw: text },
      };
    }

    const checkSigUrl = matchUrl[0].replace(/'/g, "");

    // 1. 请求 check_sig 换取 p_skey
    const sigRes = await fetch(checkSigUrl, {
      redirect: "manual",
      headers: {
        Cookie: cookieToString(allCookies),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const sigCookies = sigRes.headers.getSetCookie?.() || [];
    allCookies = { ...allCookies, ...parseSetCookie(sigCookies) };
    const pSkey = allCookies.p_skey || "";
    const gtk = getGtk(pSkey);

    // 2. 调用 QQ 互联 OAuth authorize 换取 code
    const authorizeFormData = new URLSearchParams();
    authorizeFormData.append("response_type", "code");
    authorizeFormData.append("client_id", "100497308");
    authorizeFormData.append(
      "redirect_uri",
      "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/"
    );
    authorizeFormData.append("scope", "get_user_info,get_app_friends");
    authorizeFormData.append("state", "state");
    authorizeFormData.append("switch", "");
    authorizeFormData.append("from_ptlogin", "1");
    authorizeFormData.append("src", "1");
    authorizeFormData.append("update_auth", "1");
    authorizeFormData.append("openapi", "1010_1030");
    authorizeFormData.append("g_tk", String(gtk));
    authorizeFormData.append("auth_time", String(Date.now()));
    authorizeFormData.append("ui", guid);

    const authRes = await fetch("https://graph.qq.com/oauth2.0/authorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieToString(allCookies),
      },
      body: authorizeFormData.toString(),
      redirect: "manual",
    });

    const authLocation = authRes.headers.get("Location") || "";
    const codeMatch = /[?&]code=([^&]+)/.exec(authLocation);
    if (!codeMatch || !codeMatch[1]) {
      return {
        status: 500,
        body: { code: 500, message: "OAuth 授权换码失败", location: authLocation },
      };
    }

    const code = codeMatch[1];

    // 3. 将 OAuth code 换取 QQ 音乐正式凭据
    const loginCgiRes = await requestCgi(
      "QQConnectLogin.LoginServer",
      "QQLogin",
      { code },
      {
        cookie: allCookies,
        headers: {
          Cookie: cookieToString(allCookies),
        },
      }
    );

    const resultCookie = loginCgiRes.cookie || [];
    const finalCookies = { ...allCookies, ...parseSetCookie(resultCookie) };
    // 登录响应里的 refresh_token / refresh_key / openid 是后续续期的关键，
    // 旧实现只取 musickey，导致 key 过期后无法恢复。
    const merged = mergeLoginPayloadCookies(finalCookies, loginCgiRes.body);
    finalCookies.guid = guid;

    const uin = finalCookies.uin || finalCookies.qqmusic_uin || "";
    const musickey = finalCookies.qm_keyst || finalCookies.qqmusic_key || "";

    return {
      status: 200,
      body: {
        code: 200,
        message: "登录成功",
        uin,
        musickey,
        guid,
        expiresAt: merged.expiresAt,
        data: loginCgiRes.body,
        cookieStr: cookieToString(finalCookies),
      },
      cookie: resultCookie,
    };
  }

  if (type === "mobile") {
    const qrcodeID = query.qrcodeID || query.key;
    if (!qrcodeID) {
      return {
        status: 400,
        body: { code: 400, message: "缺少必要参数 qrcodeID" },
      };
    }
    const guid = query.guid || getStableGuid(qrcodeID);

    // 1. 确保后台 MQTT 会话已启动
    let session = getMobileSession(qrcodeID);
    if (!session) {
      try {
        registerMobileSession(qrcodeID);
      } catch {}
      session = getMobileSession(qrcodeID);
    }

    // 2. 优先检查实时会话事件
    if (session && session.code === 200) {
      const cookieObj = cookieToJson(session.cookieStr);
      cookieObj.guid = cookieObj.guid || guid;
      return {
        status: 200,
        body: {
          code: 200,
          message: "登录成功",
          uin: session.uin || "",
          musickey: session.musickey || "",
          nickname: session.nickname || "",
          avatarUrl: session.avatarUrl || "",
          guid,
          cookieStr: cookieToString(cookieObj),
        },
      };
    }

    if (session && session.code === 802) {
      return {
        status: 200,
        body: { code: 802, message: session.message || "已扫码，等待确认" },
      };
    }

    if (session && session.code === 800) {
      return {
        status: 200,
        body: { code: 800, message: session.message || "二维码已过期，请刷新" },
      };
    }

    if (session && session.code === 803) {
      return {
        status: 200,
        body: { code: 803, message: session.message || "用户取消授权" },
      };
    }

    // 3. 兜底轮询 CheckQRCode CGI 状态
    try {
      const cgiRes = await req(
        "music.login.LoginServer",
        "CheckQRCode",
        {
          qrcodeID,
          tmeAppID: "qqmusic",
        },
        {
          platform: "android",
        }
      );

      const cgiBody = (cgiRes.body || {}) as any;
      const code = cgiBody.code !== undefined ? cgiBody.code : cgiBody.ret;

      if (code === 40001) {
        return {
          status: 200,
          body: { code: 802, message: "已扫码，等待确认" },
        };
      }
      if (code === 40002) {
        return {
          status: 200,
          body: { code: 800, message: "二维码已过期，请刷新" },
        };
      }
      if (code === 0) {
        const cookies = cgiRes.cookie || [];
        const cookieObj = parseSetCookie(cookies);
        // 与 QQ 网页扫码同一套合并逻辑：refresh_key/openid/access_token/过期时间都要留下。
        const merged = mergeLoginPayloadCookies(cookieObj, cgiBody);
        cookieObj.guid = guid;

        const cookieStr = cookieToString(cookieObj);
        return {
          status: 200,
          body: {
            code: 200,
            message: "登录成功",
            uin: cookieObj.uin || String(cgiBody.musicid || ""),
            musickey: cookieObj.qm_keyst || String(cgiBody.musickey || ""),
            guid,
            expiresAt: merged.expiresAt,
            cookieStr,
            data: cgiBody,
          },
          cookie: cookies,
        };
      }
    } catch {}

    return {
      status: 200,
      body: {
        code: session?.code || 801,
        message: session?.message || "等待 QQ 音乐 App 扫码",
      },
    };
  }

  // 微信扫码轮询
  const { uuid } = query;
  if (!uuid) {
    return {
      status: 400,
      body: { code: 400, message: "缺少必要参数 uuid" },
    };
  }
  const guid = query.guid || getStableGuid(uuid);

  const pollUrl = `https://lp.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&_=${Date.now()}`;
  const wxRes = await fetch(pollUrl, {
    headers: {
      Referer: "https://open.weixin.qq.com/",
    },
  });

  const wxText = await wxRes.text();
  const wxCodeMatch = /window\.wx_errcode=(\d+);window\.wx_code='([^']*)'/.exec(wxText);

  if (!wxCodeMatch) {
    return {
      status: 200,
      body: { code: 801, message: "等待扫码", raw: wxText },
    };
  }

  const errCode = Number(wxCodeMatch[1]);
  const wxCode = wxCodeMatch[2];

  if (errCode === 408) {
    return { status: 200, body: { code: 801, message: "等待微信扫码" } };
  }
  if (errCode === 404) {
    return { status: 200, body: { code: 802, message: "微信已扫码，等待确认" } };
  }
  if (errCode === 403) {
    return { status: 200, body: { code: 803, message: "微信用户取消授权" } };
  }
  if (errCode === 402) {
    return { status: 200, body: { code: 800, message: "微信二维码已过期" } };
  }

  if (errCode === 405 && wxCode) {
    // 微信授权成功，换取凭据
    const wxLoginRes = await requestCgi(
      "music.login.LoginServer",
      "Login",
      {
        code: wxCode,
        strAppid: "wx48db31d50e334801",
      },
      {
        platform: "web",
      }
    );

    const cookies = wxLoginRes.cookie || [];
    const cookieObj = parseSetCookie(cookies);
    const merged = mergeLoginPayloadCookies(cookieObj, wxLoginRes.body);
    cookieObj.guid = guid;

    return {
      status: 200,
      body: {
        code: 200,
        message: "微信登录成功",
        uin: cookieObj.wxuin || cookieObj.uin || "",
        musickey: cookieObj.qm_keyst || cookieObj.musickey || "",
        guid,
        expiresAt: merged.expiresAt,
        data: wxLoginRes.body,
        cookieStr: cookieToString(cookieObj),
      },
      cookie: cookies,
    };
  }

  return {
    status: 200,
    body: { code: errCode, message: "微信登录状态轮询中", raw: wxText },
  };
}
