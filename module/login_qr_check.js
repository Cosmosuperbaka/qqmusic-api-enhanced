import { request, requestCgi } from "../util/request.js";
import { getGtk, getStableGuid } from "../util/crypto.js";
import { cookieToString, mergeLoginPayloadCookies, parseSetCookie, } from "../util/cookie.js";
import { dropMobileQrSession, ensureMobileQrSession, } from "../util/mobile_qr_session.js";
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const HTTP_TIMEOUT_MS = 12_000;
/** 微信 lp 长轮询最长约 25s；留一点余量，超时按“还在等待”处理。 */
const WX_LONG_POLL_TIMEOUT_MS = 30_000;
const MAX_REDIRECT_HOPS = 4;
const LOGIN_HOST = "ssl.ptlogin2.qq.com";
const OAUTH_HOST = "graph.qq.com";
const MUSIC_HOST = "u.y.qq.com";
/** 业务码 → 失败原因。码表来自各登录入口的公开实现与实测（无效授权码返回 104400）。 */
export function classifyLoginCode(code) {
    switch (code) {
        case 104400:
        case 104401:
        case 1000:
            return { reason: "auth_invalid", message: "登录授权已失效或已被使用，请重新扫码" };
        case 104604:
            return { reason: "rate_limited", message: "QQ 音乐登录请求过于频繁，请稍后再试" };
        case 20279:
            return { reason: "device_limit", message: "该账号登录设备数量已达上限" };
        case 20277:
        case 20278:
        case 20450:
            return { reason: "account_restricted", message: "该账号当前被 QQ 音乐限制登录" };
        default:
            return { reason: "protocol", message: "QQ 音乐返回了无法识别的登录结果" };
    }
}
const failure = (stage, message, extra = {}) => ({
    status: 200,
    body: {
        code: 500,
        message,
        stage,
        reason: extra.reason ?? "protocol",
        upstreamCode: extra.upstreamCode,
        detail: extra.detail,
    },
});
/** Cookie 域是否覆盖目标主机：空域是构造时给的初始值，对所有主机生效。 */
const domainCovers = (domain, host) => !domain || !host || host === domain || host.endsWith(`.${domain}`);
/**
 * 按域名隔离的 Cookie 罐，行为对齐浏览器。
 *
 * 登录网关会在同一次响应里给 `graph.qq.com` 下发 p_skey，再把 `qq.com` 的同名项清掉；
 * 不分域名合并时，清除指令会连真票据一起删掉，后面的 OAuth 就没有 g_tk 可算。
 */
export class CookieJar {
    entries = new Map();
    constructor(initial = {}) {
        for (const [name, value] of Object.entries(initial)) {
            this.entries.set(`${name}\0`, { name, value, domain: "" });
        }
    }
    apply(setCookies, requestHost = "") {
        for (const line of setCookies) {
            const segments = line.split(";").map((part) => part.trim());
            const pair = segments[0] ?? "";
            const idx = pair.indexOf("=");
            if (idx <= 0)
                continue;
            const name = pair.slice(0, idx).trim();
            const value = pair.slice(idx + 1).trim();
            const attrs = segments.slice(1).map((part) => part.toLowerCase());
            const maxAge = attrs.find((part) => part.startsWith("max-age="));
            const expires = attrs.find((part) => part.startsWith("expires="));
            const declared = attrs.find((part) => part.startsWith("domain="));
            const domain = (declared?.slice(7) ?? requestHost).replace(/^\./, "");
            const key = `${name}\0${domain}`;
            const expired = (maxAge !== undefined && Number(maxAge.slice(8)) <= 0) ||
                (expires !== undefined && Date.parse(expires.slice(8)) < Date.now());
            if (!value || expired)
                this.entries.delete(key);
            else
                this.entries.set(key, { name, value, domain });
        }
    }
    /** 目标主机能看到的 Cookie；同名时取域最具体的一项。 */
    visible(host) {
        const out = new Map();
        for (const entry of this.entries.values()) {
            if (!domainCovers(entry.domain, host))
                continue;
            const current = out.get(entry.name);
            if (!current || entry.domain.length >= current.domain.length)
                out.set(entry.name, entry);
        }
        return out;
    }
    get(name, host = "") {
        return this.visible(host).get(name)?.value ?? "";
    }
    toObject(host = "") {
        return Object.fromEntries([...this.visible(host)].map(([name, entry]) => [name, entry.value]));
    }
    header(host = "") {
        return cookieToString(this.toObject(host));
    }
}
const withTimeout = (ms) => AbortSignal.timeout(ms);
/** 解析 ptqrlogin 的 `ptuiCB('码','…','URL','…','提示','昵称')` 回调。 */
export function parsePtqrloginText(text) {
    const cb = /ptuiCB\('(\d+)'\s*,\s*'[^']*'\s*,\s*'([^']*)'/.exec(text);
    const numeric = cb?.[1];
    if (numeric === "0")
        return { status: "success", url: cb?.[2] || undefined };
    if (numeric === "65")
        return { status: "expired" };
    if (numeric === "66")
        return { status: "waiting" };
    if (numeric === "67")
        return { status: "scanned" };
    if (numeric === "68")
        return { status: "refused" };
    // 兜底：没有数字码时回退到文案判断（旧版页面）。
    if (text.includes("已失效"))
        return { status: "expired" };
    if (text.includes("未扫描") || text.includes("未失效"))
        return { status: "waiting" };
    if (text.includes("认证中") || text.includes("本次登录需要"))
        return { status: "scanned" };
    if (text.includes("拒绝"))
        return { status: "refused" };
    if (text.includes("登录成功")) {
        const match = /'(https?:\/\/[^'\s]+)'/.exec(text);
        return { status: "success", url: match?.[1] };
    }
    return { status: "unknown" };
}
/** 从授权跳转里取 code；Location 之外也兜底扫描响应体里的跳转脚本。 */
export function extractAuthCode(location, body = "") {
    const fromLocation = /[?&]code=([^&#\s]+)/.exec(location);
    if (fromLocation?.[1])
        return fromLocation[1];
    const fromBody = /[?&]code=([A-Za-z0-9]+)/.exec(body);
    return fromBody?.[1] ?? "";
}
/** 把 Location 概括成可安全进日志的形态：只留主机、路径和 error 类参数，不含 code/token。 */
export function describeLocation(location) {
    if (!location)
        return { location: "(无)" };
    try {
        const url = new URL(location, "https://graph.qq.com");
        const out = { host: url.host, path: url.pathname };
        for (const key of ["error", "error_description", "err_code", "which"]) {
            const value = url.searchParams.get(key);
            if (value)
                out[key] = value.slice(0, 80);
        }
        return out;
    }
    catch {
        return { location: "(无法解析)" };
    }
}
/** 校验登录 CGI 的响应：必须真的拿到 musickey 才算成功，否则按业务码归类失败。 */
function finishCgiLogin(res, guid, stage, successMessage) {
    const cookies = res.cookie || [];
    const cookieObj = parseSetCookie(cookies);
    const merged = mergeLoginPayloadCookies(cookieObj, res.body);
    const musickey = cookieObj.qm_keyst || cookieObj.qqmusic_key || "";
    if (!merged.obtainedMusickey && !musickey) {
        const rawCode = Number(res.body?.code);
        const upstreamCode = Number.isFinite(rawCode) ? rawCode : undefined;
        const classified = classifyLoginCode(upstreamCode);
        return failure(stage, classified.message, { reason: classified.reason, upstreamCode });
    }
    cookieObj.guid = guid;
    return {
        status: 200,
        body: {
            code: 200,
            message: successMessage,
            uin: cookieObj.uin || cookieObj.qqmusic_uin || "",
            musickey: cookieObj.qm_keyst || musickey,
            guid,
            expiresAt: merged.expiresAt,
            data: res.body,
            cookieStr: cookieToString(cookieObj),
        },
        cookie: cookies,
    };
}
async function checkQq(query, fetchImpl, cgi) {
    const { qrsig, ptqrtoken } = query;
    if (!qrsig || ptqrtoken === undefined) {
        return { status: 400, body: { code: 400, message: "缺少必要参数 qrsig 或 ptqrtoken" } };
    }
    const guid = query.guid || getStableGuid(qrsig);
    const jar = new CookieJar({ qrsig });
    const checkUrl = `https://ssl.ptlogin2.qq.com/ptqrlogin?u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump` +
        `&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052` +
        `&action=0-0-${Date.now()}&js_ver=20102616&js_type=1&pt_uistyle=40` +
        `&aid=716027609&daid=383&pt_3rd_aid=100497308&has_onekey=1`;
    let text;
    try {
        const checkRes = await fetchImpl(checkUrl, {
            headers: {
                Referer: "https://xui.ptlogin2.qq.com/",
                Cookie: jar.header(LOGIN_HOST),
                "User-Agent": BROWSER_UA,
            },
            signal: withTimeout(HTTP_TIMEOUT_MS),
        });
        jar.apply(checkRes.headers.getSetCookie?.() || [], LOGIN_HOST);
        text = await checkRes.text();
        if (checkRes.status >= 400) {
            return failure("ptqrlogin", `QQ 登录网关返回 HTTP ${checkRes.status}`, {
                detail: { httpStatus: checkRes.status },
            });
        }
    }
    catch (error) {
        // 轮询自身的网络抖动不是登录失败：继续等待，下一轮再查。
        return { status: 200, body: { code: 801, message: "等待玩家扫码", warn: String(error) } };
    }
    const parsed = parsePtqrloginText(text);
    if (parsed.status === "expired") {
        return { status: 200, body: { code: 800, message: "二维码已失效" } };
    }
    if (parsed.status === "waiting") {
        return { status: 200, body: { code: 801, message: "等待玩家扫码" } };
    }
    if (parsed.status === "scanned") {
        return { status: 200, body: { code: 802, message: "已扫码，等待移动端确认" } };
    }
    if (parsed.status === "refused") {
        return { status: 200, body: { code: 803, message: "已在手机上取消登录" } };
    }
    if (parsed.status !== "success") {
        // 只留回调开头的状态码：后面的字段可能带昵称，不进日志。
        return failure("ptqrlogin", "QQ 扫码状态无法识别", { detail: { head: text.slice(0, 20) } });
    }
    if (!parsed.url) {
        return failure("ptqrlogin", "无法解析登录回调地址");
    }
    // 1. check_sig 换取 p_skey。可能多跳，逐跳手动跟随并收集 Set-Cookie。
    let hopUrl = parsed.url;
    let hops = 0;
    try {
        while (hopUrl && hops < MAX_REDIRECT_HOPS) {
            const hopHost = new URL(hopUrl).hostname;
            const sigRes = await fetchImpl(hopUrl, {
                redirect: "manual",
                headers: { Cookie: jar.header(hopHost), "User-Agent": BROWSER_UA },
                signal: withTimeout(HTTP_TIMEOUT_MS),
            });
            jar.apply(sigRes.headers.getSetCookie?.() || [], hopHost);
            const next = sigRes.headers.get("Location");
            hopUrl =
                next && sigRes.status >= 300 && sigRes.status < 400 ? new URL(next, hopUrl).href : undefined;
            hops += 1;
        }
    }
    catch (error) {
        return failure("check_sig", `换取 QQ 登录票据失败: ${String(error)}`);
    }
    const pSkey = jar.get("p_skey", OAUTH_HOST);
    if (!pSkey) {
        return failure("check_sig", "QQ 登录票据缺少 p_skey，登录态未建立", {
            detail: { cookieNames: Object.keys(jar.toObject()).sort().join(",") },
        });
    }
    // 2. QQ 互联 OAuth authorize 换取 code
    const authorizeFormData = new URLSearchParams({
        response_type: "code",
        client_id: "100497308",
        redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/",
        scope: "get_user_info,get_app_friends",
        state: "state",
        switch: "",
        from_ptlogin: "1",
        src: "1",
        update_auth: "1",
        openapi: "1010_1030",
        g_tk: String(getGtk(pSkey)),
        auth_time: String(Date.now()),
        ui: guid,
    });
    let authLocation = "";
    let authBody = "";
    let authStatus = 0;
    try {
        const authRes = await fetchImpl("https://graph.qq.com/oauth2.0/authorize", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Cookie: jar.header(OAUTH_HOST),
                "User-Agent": BROWSER_UA,
                // 授权接口按浏览器表单提交校验来源：带上与官方页面一致的 Referer / Origin。
                Referer: "https://graph.qq.com/oauth2.0/show",
                Origin: "https://graph.qq.com",
            },
            body: authorizeFormData.toString(),
            redirect: "manual",
            signal: withTimeout(HTTP_TIMEOUT_MS),
        });
        authStatus = authRes.status;
        authLocation = authRes.headers.get("Location") || "";
        if (!authLocation)
            authBody = (await authRes.text()).slice(0, 4000);
    }
    catch (error) {
        return failure("authorize", `QQ 互联授权请求失败: ${String(error)}`);
    }
    const code = extractAuthCode(authLocation, authBody);
    if (!code) {
        return failure("authorize", "OAuth 授权换码失败", {
            detail: { httpStatus: authStatus, ...describeLocation(authLocation) },
        });
    }
    // 3. 将 OAuth code 换取 QQ 音乐正式凭据（只保留音乐侧凭证，不带 ptlogin 的一堆 Cookie）。
    const loginCgiRes = await cgi("QQConnectLogin.LoginServer", "QQLogin", { code }, {
        cookie: jar.toObject(MUSIC_HOST),
        headers: { Cookie: jar.header(MUSIC_HOST) },
    });
    return finishCgiLogin(loginCgiRes, guid, "qqlogin", "登录成功");
}
async function checkWx(query, fetchImpl, cgi) {
    const { uuid } = query;
    if (!uuid) {
        return { status: 400, body: { code: 400, message: "缺少必要参数 uuid" } };
    }
    const guid = query.guid || getStableGuid(uuid);
    const pollUrl = `https://lp.open.weixin.qq.com/connect/l/qrconnect?uuid=${encodeURIComponent(uuid)}&_=${Date.now()}`;
    let wxText;
    try {
        const wxRes = await fetchImpl(pollUrl, {
            headers: { Referer: "https://open.weixin.qq.com/", "User-Agent": BROWSER_UA },
            signal: withTimeout(WX_LONG_POLL_TIMEOUT_MS),
        });
        wxText = await wxRes.text();
    }
    catch {
        // 长轮询超时/抖动：二维码仍然有效，继续等。
        return { status: 200, body: { code: 801, message: "等待微信扫码" } };
    }
    const wxCodeMatch = /window\.wx_errcode=(\d+);window\.wx_code='([^']*)'/.exec(wxText);
    if (!wxCodeMatch) {
        return { status: 200, body: { code: 801, message: "等待微信扫码" } };
    }
    const errCode = Number(wxCodeMatch[1]);
    const wxCode = wxCodeMatch[2] ?? "";
    if (errCode === 408)
        return { status: 200, body: { code: 801, message: "等待微信扫码" } };
    if (errCode === 404)
        return { status: 200, body: { code: 802, message: "微信已扫码，等待确认" } };
    if (errCode === 403)
        return { status: 200, body: { code: 803, message: "已在微信内取消授权" } };
    if (errCode === 402 || errCode === 500) {
        return { status: 200, body: { code: 800, message: "微信二维码已过期" } };
    }
    if (errCode !== 405 || !wxCode) {
        return failure("wx-poll", `微信返回了未知状态 ${errCode}`, { upstreamCode: errCode });
    }
    // 微信授权成功，用一次性 code 换 QQ 音乐凭据。comm 与 y.qq.com 官方跳转页一致：
    // tmeAppID=qqmusic、tmeLoginType="1"（字符串）。
    const wxLoginRes = await cgi("music.login.LoginServer", "Login", { code: wxCode, strAppid: "wx48db31d50e334801" }, { platform: "web", comm: { tmeAppID: "qqmusic", tmeLoginType: "1" } });
    return finishCgiLogin(wxLoginRes, guid, "wx-login", "微信登录成功");
}
async function checkMobile(query, deps) {
    const qrcodeID = query.qrcodeID || query.key;
    if (!qrcodeID) {
        return { status: 400, body: { code: 400, message: "缺少必要参数 qrcodeID" } };
    }
    const guid = query.guid || getStableGuid(qrcodeID);
    // QQ 音乐 App 扫码的状态只经 MQTT 推送下发，CheckQRCode 轮询永远回 40000。
    const state = ensureMobileQrSession(qrcodeID, deps);
    if (state.code === 200 && state.cookieStr) {
        dropMobileQrSession(qrcodeID);
        return {
            status: 200,
            body: {
                code: 200,
                message: "登录成功",
                uin: state.uin || "",
                musickey: state.musickey || "",
                guid,
                expiresAt: state.expiresAt,
                cookieStr: state.cookieStr,
            },
        };
    }
    if (state.code === 500) {
        // 失败后释放连接；调用方若重新轮询会得到一条新会话。
        dropMobileQrSession(qrcodeID);
        // 换票阶段带回的是业务码，按统一码表区分限流 / 设备上限 / 账号受限，其余阶段是通道问题。
        const classified = state.stage === "login" && state.upstreamCode !== undefined
            ? classifyLoginCode(state.upstreamCode)
            : undefined;
        return failure(state.stage ?? "mobile", classified?.message ?? state.message, {
            reason: classified?.reason,
            upstreamCode: state.upstreamCode,
        });
    }
    // 800/803 的终态保留到会话 TTL：立刻丢弃会让下一轮轮询重新建会话、又回到“等待”。
    return { status: 200, body: { code: state.code, message: state.message } };
}
export default async function login_qr_check(query = {}, _req = request, deps = {}) {
    const type = query.type || "qq";
    const fetchImpl = deps.fetch ?? fetch;
    const cgi = deps.cgi ?? requestCgi;
    if (type === "qq")
        return checkQq(query, fetchImpl, cgi);
    if (type === "mobile")
        return checkMobile(query, { requestCgi: cgi, ...deps.mobile });
    return checkWx(query, fetchImpl, cgi);
}
