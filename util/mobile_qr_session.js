import { decodePackets, encodeConnect, encodeDisconnect, encodePingreq, encodePuback, encodeSubscribe, } from "./mqtt.js";
import { requestCgi } from "./request.js";
import { cookieToString, mergeLoginPayloadCookies, parseSetCookie } from "./cookie.js";
import { getStableGuid } from "./crypto.js";
const MQTT_HOST = "wss://mu.y.qq.com";
const SESSION_TTL_MS = 5 * 60_000;
/** 过期后终态再留一个 TTL 供轮询读取，之后连同内存里的凭证一起回收。 */
const SESSION_RETAIN_FACTOR = 2;
/** 每个二维码占一条到上游的长连接，同时在线数必须有上限。 */
const MAX_LIVE_SESSIONS = 128;
const KEEP_ALIVE_SECONDS = 45;
const MAX_REDIRECTS = 3;
const CONNACK_MOVED = new Set([156, 157]);
const sessions = new Map();
const defaultSocketFactory = (url) => {
    const Ctor = globalThis
        .WebSocket;
    if (!Ctor)
        throw new Error("当前运行时没有全局 WebSocket，无法监听 QQ 音乐 App 扫码");
    return new Ctor(url, ["mqtt"]);
};
const readText = (value) => {
    if (typeof value === "string")
        return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    return "";
};
/** 取某个二维码当前的会话状态；还没有会话时返回 undefined。 */
export function getMobileQrState(qrcodeID) {
    return sessions.get(qrcodeID)?.state;
}
/** 丢弃会话（登录完成或过期后释放连接）。 */
export function dropMobileQrSession(qrcodeID) {
    const entry = sessions.get(qrcodeID);
    if (!entry)
        return;
    entry.close();
    sessions.delete(qrcodeID);
}
/** 清掉所有会话，测试收尾用。 */
export function resetMobileQrSessions() {
    for (const id of [...sessions.keys()])
        dropMobileQrSession(id);
}
/**
 * 确保该二维码有一条在线订阅；已有未过期会话时直接复用。
 * 连接建立失败不抛错，而是把状态置为 500 协议失败，交给轮询方上报。
 */
export function ensureMobileQrSession(qrcodeID, deps = {}) {
    const now = deps.now ?? Date.now;
    const ttlMs = deps.ttlMs ?? SESSION_TTL_MS;
    const retainMs = ttlMs * SESSION_RETAIN_FACTOR;
    const existing = sessions.get(qrcodeID);
    if (existing) {
        if (now() - existing.state.createdAt < retainMs)
            return existing.state;
        dropMobileQrSession(qrcodeID);
    }
    // 顺手回收别的过期会话，避免无人轮询的二维码一直占着连接。
    for (const [id, entry] of sessions) {
        if (now() - entry.state.createdAt >= retainMs)
            dropMobileQrSession(id);
    }
    if (sessions.size >= MAX_LIVE_SESSIONS) {
        return {
            code: 500,
            message: "QQ 音乐扫码通道繁忙，请稍后重试",
            stage: "capacity",
            createdAt: now(),
        };
    }
    const state = { code: 801, message: "等待 QQ 音乐 App 扫码", createdAt: now() };
    let socket;
    let pingTimer;
    let ttlTimer;
    let closed = false;
    let exchanging = false;
    let redirects = 0;
    const closeConnection = () => {
        if (closed)
            return;
        closed = true;
        if (pingTimer)
            clearInterval(pingTimer);
        if (ttlTimer)
            clearTimeout(ttlTimer);
        try {
            socket?.send(encodeDisconnect());
        }
        catch { }
        try {
            socket?.close();
        }
        catch { }
    };
    // 到期先断开连接并把状态标成过期，否则轮询会给失效的二维码重建会话、一直显示等待。
    ttlTimer = setTimeout(() => {
        if (state.code === 801 || state.code === 802) {
            state.code = 800;
            state.message = "二维码已过期，请刷新";
        }
        closeConnection();
    }, ttlMs);
    ttlTimer.unref?.();
    // 回收定时器不随连接关闭取消：成功后无人取走的凭证也不能留在内存里。
    const reapTimer = setTimeout(() => dropMobileQrSession(qrcodeID), retainMs);
    reapTimer.unref?.();
    sessions.set(qrcodeID, {
        state,
        close: () => {
            clearTimeout(reapTimer);
            closeConnection();
        },
    });
    const fail = (stage, message, upstreamCode) => {
        if (state.code === 200 || state.code === 800 || state.code === 803)
            return;
        state.code = 500;
        state.message = message;
        state.stage = stage;
        state.upstreamCode = upstreamCode;
    };
    const finishWithCookies = async (packet) => {
        let payload = {};
        try {
            payload = JSON.parse(new TextDecoder().decode(packet.payload));
        }
        catch {
            return fail("cookies-parse", "扫码确认消息无法解析");
        }
        const cookies = (payload.cookies ?? {});
        const uin = readText(cookies.qqmusic_uin?.value ?? cookies.uin?.value ?? payload.uin);
        const key = readText(cookies.qqmusic_key?.value ?? cookies.qm_keyst?.value ?? payload.musickey);
        if (!uin || !key)
            return fail("cookies-empty", "扫码确认消息缺少账号信息");
        const request = deps.requestCgi ?? requestCgi;
        let loginData = {};
        let resultCookies = {};
        try {
            // 用推送里的临时 key 换取正式凭证（含 refresh 字段与过期时间）。
            const loginRes = await request("music.login.LoginServer", "Login", { musicid: Number(uin), qrCodeID: qrcodeID, token: key }, { platform: "android", comm: { tmeLoginType: 6 } });
            loginData = loginRes.body ?? {};
            resultCookies = parseSetCookie(loginRes.cookie ?? []);
        }
        catch (error) {
            return fail("login-request", `QQ 音乐凭证换取请求失败: ${String(error)}`);
        }
        // 推送里的 key 只是一次性换票凭据，拿它直接请求会被判未登录（code 1000）。
        // 换取失败必须如实上报，不能退回临时 key 冒充成功——否则调用方随后的状态校验必然失败，
        // 玩家只会看到笼统的“校验未通过”，上游码也丢了。
        const realKey = readText(loginData.musickey);
        if (!realKey) {
            const rawCode = Number(loginData.code);
            return fail("login", "QQ 音乐未签发登录凭证", Number.isFinite(rawCode) ? rawCode : undefined);
        }
        const realUin = readText(loginData.musicid) || uin;
        const cookieObj = {
            uin: realUin,
            qqmusic_uin: realUin,
            musicid: realUin,
            qm_keyst: realKey,
            qqmusic_key: realKey,
            musickey: realKey,
            tmeAppID: "qqmusic",
            tmeLoginType: readText(loginData.loginType) || readText(cookies.tmeLoginType?.value) || "6",
        };
        for (const [name, item] of Object.entries(cookies)) {
            if (item && typeof item.value === "string" && !cookieObj[name])
                cookieObj[name] = item.value;
        }
        Object.assign(cookieObj, resultCookies);
        const merged = mergeLoginPayloadCookies(cookieObj, loginData);
        cookieObj.guid = getStableGuid(qrcodeID);
        state.code = 200;
        state.message = "登录成功";
        state.uin = realUin;
        state.musickey = realKey;
        state.expiresAt = merged.expiresAt;
        state.cookieStr = cookieToString(cookieObj);
        closeConnection();
    };
    const handlePublish = (packet) => {
        const type = packet.userProperties.type;
        if (type === "scanned") {
            if (state.code === 801) {
                state.code = 802;
                state.message = "已扫码，等待在 QQ 音乐 App 内确认";
            }
        }
        else if (type === "timeout") {
            state.code = 800;
            state.message = "二维码已过期，请刷新";
            closeConnection();
        }
        else if (type === "canceled") {
            state.code = 803;
            state.message = "已在 QQ 音乐 App 内取消登录";
            closeConnection();
        }
        else if (type === "cookies") {
            // 一次性 token 只能换一次：QoS 1 重投或重复推送再换必然失败，还会把已成功的凭证覆盖掉。
            if (exchanging || state.code === 200)
                return;
            exchanging = true;
            void finishWithCookies(packet);
        }
    };
    const connect = (path) => {
        if (closed)
            return;
        let buffer = new Uint8Array(0);
        try {
            socket = (deps.createSocket ?? defaultSocketFactory)(`${MQTT_HOST}${path}`);
        }
        catch (error) {
            fail("connect", String(error instanceof Error ? error.message : error));
            return;
        }
        const current = socket;
        current.binaryType = "arraybuffer";
        current.onopen = () => {
            current.send(encodeConnect({
                clientId: `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`,
                keepAliveSeconds: KEEP_ALIVE_SECONDS,
                authenticationMethod: "pass",
                userProperties: {
                    tmeAppID: "qqmusic",
                    business: "management",
                    hashTag: qrcodeID,
                    clientTag: "management.user",
                    userID: qrcodeID,
                },
            }));
        };
        current.onmessage = (event) => {
            const chunk = new Uint8Array(event.data);
            const merged = new Uint8Array(buffer.length + chunk.length);
            merged.set(buffer);
            merged.set(chunk, buffer.length);
            let decoded;
            try {
                decoded = decodePackets(merged);
            }
            catch (error) {
                return fail("decode", `MQTT 报文解析失败: ${String(error)}`);
            }
            buffer = decoded.rest;
            for (const packet of decoded.packets) {
                if (packet.type === "connack") {
                    if (packet.reasonCode === 0) {
                        current.send(encodeSubscribe(1, `management.qrcode_login/${qrcodeID}`, {
                            authorization: "tmelogin",
                            pubsub: "unicast",
                        }));
                        pingTimer = setInterval(() => {
                            try {
                                current.send(encodePingreq());
                            }
                            catch { }
                        }, (KEEP_ALIVE_SECONDS / 2) * 1000);
                        pingTimer.unref?.();
                    }
                    else if (CONNACK_MOVED.has(packet.reasonCode) && packet.serverReference) {
                        // 网关把这个二维码分给了另一个节点：按 Server Reference 重连。
                        if (redirects >= MAX_REDIRECTS)
                            return fail("redirect", "MQTT 节点重定向过多");
                        redirects += 1;
                        if (pingTimer)
                            clearInterval(pingTimer);
                        current.onclose = null;
                        try {
                            current.close();
                        }
                        catch { }
                        connect(`/ws/handshake/${packet.serverReference}`);
                        return;
                    }
                    else {
                        return fail("connack", "QQ 音乐扫码通道拒绝连接", packet.reasonCode);
                    }
                }
                else if (packet.type === "suback") {
                    if (packet.reasonCodes.some((code) => code >= 0x80)) {
                        return fail("suback", "QQ 音乐扫码通道拒绝订阅", packet.reasonCodes[0]);
                    }
                }
                else if (packet.type === "publish") {
                    if (packet.qos === 1 && packet.packetId !== undefined) {
                        current.send(encodePuback(packet.packetId));
                    }
                    handlePublish(packet);
                }
                else if (packet.type === "disconnect") {
                    fail("disconnect", "QQ 音乐扫码通道被服务端断开", packet.reasonCode);
                }
            }
        };
        current.onerror = () => fail("socket", "QQ 音乐扫码通道连接出错");
        current.onclose = () => {
            if (!closed && (state.code === 801 || state.code === 802)) {
                fail("closed", "QQ 音乐扫码通道意外关闭");
            }
        };
    };
    connect("/ws/handshake");
    return state;
}
