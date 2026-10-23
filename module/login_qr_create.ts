import { request, type ApiResponse } from "../util/request.js";
import { getStableGuid, hash33 } from "../util/crypto.js";
import { parseSetCookie } from "../util/cookie.js";
import { registerMobileSession } from "../util/mobile_qr_session.js";

/**
 * 获取登录二维码 (QQ / 微信 / 移动端App).
 *
 * @param query.type 登录类型: 'qq' (默认), 'wx' (微信), 'mobile' (QQ音乐App)
 */
export default async function login_qr_create(
  query: { type?: "qq" | "wx" | "mobile"; cookie?: any; guid?: string } = {},
  req = request
): Promise<ApiResponse> {
  const type = query.type || "qq";

  if (type === "qq") {
    // 手机 QQ 快捷扫码
    const url =
      "https://ssl.ptlogin2.qq.com/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=" +
      Math.random() +
      "&daid=383&pt_3rd_aid=100497308&u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump";

    const res = await req(url, {
      headers: {
        Referer: "https://xui.ptlogin2.qq.com/",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const cookieObj = parseSetCookie(res.cookie);
    const qrsig = cookieObj.qrsig || "";
    const ptqrtoken = hash33(qrsig);
    // 与 login_qr_check 用同一个种子派生，登录成功时写入 Cookie，保证设备标识稳定。
    const guid = query.guid || getStableGuid(qrsig);

    // 二维码图片转 base64
    let qrimg = "";
    if (Buffer.isBuffer(res.body)) {
      qrimg = `data:image/png;base64,${res.body.toString("base64")}`;
    } else if (res.body instanceof Uint8Array) {
      qrimg = `data:image/png;base64,${Buffer.from(res.body).toString("base64")}`;
    } else if (typeof res.body === "string") {
      qrimg = res.body.startsWith("data:") ? res.body : `data:image/png;base64,${Buffer.from(res.body).toString("base64")}`;
    } else {
      qrimg = `data:image/png;base64,${Buffer.from(String(res.body || "")).toString("base64")}`;
    }

    return {
      status: 200,
      body: {
        code: 200,
        type: "qq",
        qrsig,
        ptqrtoken,
        qrimg,
        url,
        guid,
      },
      cookie: res.cookie,
    };
  }

  if (type === "wx") {
    // 微信网页扫码
    const connectUrl =
      "https://open.weixin.qq.com/connect/qrconnect?appid=wx48db31d50e334801&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D2%26surl%3Dhttps%3A%2F%2Fy.qq.com%2F&response_type=code&scope=snsapi_login&state=STATE&href=https%3A%2F%2Fy.qq.com%2Fmediastyle%2Fmusic_v17%2Fsrc%2Fcss%2Fpopup_wechat.css%23wechat_redirect";

    const res = await req(connectUrl, {
      headers: {
        Referer: "https://y.qq.com/",
      },
    });

    const htmlText = typeof res.body === "string" ? res.body : JSON.stringify(res.body);
    const match = /uuid=([^"&]+)/.exec(htmlText);
    const uuid = match ? match[1] : "";

    const qrcodeUrl = uuid
      ? `https://open.weixin.qq.com/connect/qrcode/${uuid}`
      : "";
    const guid = query.guid || (uuid ? getStableGuid(uuid) : "");

    return {
      status: 200,
      body: {
        code: 200,
        type: "wx",
        uuid,
        qrurl: qrcodeUrl,
        guid,
      },
      cookie: res.cookie,
    };
  }

  // 手机 QQ 音乐 App 扫码
  const cgiRes = await req(
    "music.login.LoginServer",
    "CreateQRCode",
    {
      tmeAppID: "qqmusic",
    },
    { platform: "android" }
  );

  const qrcodeID = cgiRes.body?.qrcodeID;
  if (qrcodeID) {
    try {
      registerMobileSession(qrcodeID);
    } catch {}
  }
  const guid = query.guid || (qrcodeID ? getStableGuid(qrcodeID) : "");

  return {
    status: cgiRes.status,
    body: {
      code: 200,
      type: "mobile",
      qrcode: cgiRes.body?.qrcode,
      qrcodeID,
      guid,
    },
    cookie: cgiRes.cookie,
  };
}
