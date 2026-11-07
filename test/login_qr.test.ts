import { afterEach, describe, expect, it } from "bun:test";
import login_qr_check, {
  CookieJar,
  classifyLoginCode,
  describeLocation,
  extractAuthCode,
  parsePtqrloginText,
} from "../module/login_qr_check.js";
import {
  decodePackets,
  decodeVarInt,
  encodeConnect,
  encodePublish,
  encodeSubscribe,
  encodeVarInt,
} from "../util/mqtt.js";
import {
  ensureMobileQrSession,
  getMobileQrState,
  resetMobileQrSessions,
  type WebSocketLike,
} from "../util/mobile_qr_session.js";
import { cookieToJson } from "../util/cookie.js";

const enc = new TextEncoder();

describe("MQTT 5 编解码", () => {
  it("变长整数在边界值上往返一致", () => {
    for (const value of [0, 127, 128, 16_383, 16_384, 2_097_151, 2_097_152, 268_435_455]) {
      const bytes = Uint8Array.from(encodeVarInt(value));
      expect(decodeVarInt(bytes, 0)).toEqual({ value, length: bytes.length });
    }
    expect(() => encodeVarInt(268_435_456)).toThrow();
  });

  it("CONNECT 报文带协议名、级别 5、认证方法与用户属性", () => {
    const bytes = encodeConnect({
      clientId: "cid",
      keepAliveSeconds: 45,
      authenticationMethod: "pass",
      userProperties: { hashTag: "qr1" },
    });
    expect(bytes[0]).toBe(0x10);
    const text = Buffer.from(bytes).toString("latin1");
    expect(text).toContain("MQTT");
    expect(text).toContain("pass");
    expect(text).toContain("hashTag");
    const idx = Buffer.from(bytes).indexOf("MQTT") + 4;
    expect(bytes[idx]).toBe(5);
    expect(bytes[idx + 1]).toBe(0x02);
    expect(((bytes[idx + 2] ?? 0) << 8) | (bytes[idx + 3] ?? 0)).toBe(45);
  });

  it("SUBSCRIBE 使用 0x82 固定头并携带主题", () => {
    const bytes = encodeSubscribe(7, "a/b", { authorization: "tmelogin" });
    expect(bytes[0]).toBe(0x82);
    expect(Buffer.from(bytes).toString("latin1")).toContain("a/b");
  });

  it("PUBLISH 往返：topic、用户属性与负载完整，粘包与半包都能正确拆分", () => {
    const first = encodePublish("t/1", enc.encode('{"x":1}'), { type: "scanned" });
    const second = encodePublish("t/2", enc.encode("{}"), { type: "cookies" }, 1, 9);
    const joined = new Uint8Array(first.length + second.length);
    joined.set(first);
    joined.set(second, first.length);

    const whole = decodePackets(joined);
    expect(whole.packets).toHaveLength(2);
    expect(whole.packets[0]).toMatchObject({
      type: "publish",
      topic: "t/1",
      userProperties: { type: "scanned" },
    });
    expect(whole.packets[1]).toMatchObject({ qos: 1, packetId: 9, userProperties: { type: "cookies" } });
    expect(whole.rest.length).toBe(0);

    const partial = decodePackets(joined.subarray(0, first.length + 3));
    expect(partial.packets).toHaveLength(1);
    expect(partial.rest.length).toBe(3);
  });

  it("CONNACK 能读出原因码与 Server Reference", () => {
    const ref = enc.encode("node-7");
    const props = [0x1c, 0, ref.length, ...ref];
    const body = [0x00, 156, props.length, ...props];
    const packet = Uint8Array.from([0x20, body.length, ...body]);
    expect(decodePackets(packet).packets[0]).toEqual({
      type: "connack",
      reasonCode: 156,
      serverReference: "node-7",
    });
  });
});

/** 脚本化的假 WebSocket：记录发出的报文，并允许测试从“服务端”推送报文。 */
class FakeSocket implements WebSocketLike {
  binaryType = "blob";
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: Uint8Array[] = [];
  closed = false;
  constructor(public url: string) {}
  send(data: Uint8Array) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
  push(bytes: Uint8Array) {
    this.onmessage?.({
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });
  }
}

const connack = (reasonCode = 0, serverReference?: string) => {
  const props = serverReference
    ? [0x1c, 0, serverReference.length, ...enc.encode(serverReference)]
    : [];
  const body = [0x00, reasonCode, props.length, ...props];
  return Uint8Array.from([0x20, body.length, ...body]);
};
const suback = () => Uint8Array.from([0x90, 4, 0, 1, 0, 0]);
const event = (type: string, payload: unknown = {}) =>
  encodePublish("management.qrcode_login/x", enc.encode(JSON.stringify(payload)), { type });

const makeFactory = () => {
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    createSocket: (url: string) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket;
    },
  };
};

afterEach(() => resetMobileQrSessions());

describe("QQ 音乐 App 扫码（MQTT 会话）", () => {
  it("连接后订阅专属主题，扫码与确认依次推进状态并换取正式凭证", async () => {
    const f = makeFactory();
    const cgiCalls: any[] = [];
    const deps = {
      createSocket: f.createSocket,
      requestCgi: (async (module: string, method: string, param: any, options: any) => {
        cgiCalls.push({ module, method, param, options });
        return {
          status: 200,
          body: {
            musickey: "real_key",
            musicid: 123456,
            refresh_token: "rt",
            refresh_key: "rk",
            openid: "oid",
          },
          cookie: [],
        };
      }) as any,
    };
    ensureMobileQrSession("qr-ok", deps);
    const socket = f.sockets[0]!;
    expect(socket.url).toBe("wss://mu.y.qq.com/ws/handshake");
    socket.onopen?.({});
    expect(socket.sent[0]?.[0]).toBe(0x10);

    socket.push(connack());
    expect(socket.sent[1]?.[0]).toBe(0x82);
    expect(Buffer.from(socket.sent[1]!).toString("latin1")).toContain(
      "management.qrcode_login/qr-ok"
    );
    socket.push(suback());
    expect(getMobileQrState("qr-ok")?.code).toBe(801);

    socket.push(event("scanned"));
    expect(getMobileQrState("qr-ok")?.code).toBe(802);

    socket.push(
      event("cookies", {
        cookies: { qqmusic_uin: { value: "123456" }, qqmusic_key: { value: "tmp_key" } },
      })
    );
    await Bun.sleep(5);
    const state = getMobileQrState("qr-ok")!;
    expect(state.code).toBe(200);
    expect(cgiCalls[0]).toMatchObject({
      module: "music.login.LoginServer",
      method: "Login",
      param: { musicid: 123456, qrCodeID: "qr-ok", token: "tmp_key" },
    });
    const cookie = cookieToJson(state.cookieStr);
    expect(cookie.qm_keyst).toBe("real_key");
    expect(cookie.refresh_token).toBe("rt");
    expect(cookie.guid).toHaveLength(32);
    expect(socket.closed).toBe(true);
  });

  it("login_qr_check 对应返回 801 / 802 / 200，成功后会话被释放", async () => {
    const f = makeFactory();
    const deps = {
      mobile: {
        createSocket: f.createSocket,
        requestCgi: (async () => ({
          status: 200,
          body: { musickey: "k", musicid: 9 },
          cookie: [],
        })) as any,
      },
    };
    const first = await login_qr_check({ type: "mobile", qrcodeID: "qr-poll" }, undefined, deps);
    expect(first.body.code).toBe(801);
    const socket = f.sockets[0]!;
    socket.onopen?.({});
    socket.push(connack());
    socket.push(event("scanned"));
    expect(
      (await login_qr_check({ type: "mobile", qrcodeID: "qr-poll" }, undefined, deps)).body.code
    ).toBe(802);
    socket.push(event("cookies", { cookies: { uin: { value: "9" }, qm_keyst: { value: "tmp" } } }));
    await Bun.sleep(5);
    const done = await login_qr_check({ type: "mobile", qrcodeID: "qr-poll" }, undefined, deps);
    expect(done.body.code).toBe(200);
    expect(done.body.musickey).toBe("k");
    expect(getMobileQrState("qr-poll")).toBeUndefined();
  });

  it("用户取消与二维码超时是两种终态，且终态在 TTL 内保持不被重置为等待", async () => {
    const f = makeFactory();
    const deps = { mobile: { createSocket: f.createSocket } };
    const poll = (id: string) => login_qr_check({ type: "mobile", qrcodeID: id }, undefined, deps);
    await poll("qr-cancel");
    f.sockets[0]!.push(event("canceled"));
    expect((await poll("qr-cancel")).body.code).toBe(803);
    expect((await poll("qr-cancel")).body.code).toBe(803);
    expect(f.sockets).toHaveLength(1);

    await poll("qr-timeout");
    f.sockets[1]!.push(event("timeout"));
    expect((await poll("qr-timeout")).body.code).toBe(800);
  });

  it("CONNACK 要求换节点时按 Server Reference 重连", () => {
    const f = makeFactory();
    ensureMobileQrSession("qr-move", { createSocket: f.createSocket });
    f.sockets[0]!.push(connack(156, "node-7"));
    expect(f.sockets).toHaveLength(2);
    expect(f.sockets[1]!.url).toBe("wss://mu.y.qq.com/ws/handshake/node-7");
    expect(getMobileQrState("qr-move")?.code).toBe(801);
  });

  it("通道被拒绝或意外关闭上报 500 协议失败，不伪装成等待", async () => {
    const f = makeFactory();
    const deps = { mobile: { createSocket: f.createSocket } };
    const poll = (id: string) => login_qr_check({ type: "mobile", qrcodeID: id }, undefined, deps);
    await poll("qr-deny");
    f.sockets[0]!.push(connack(135));
    expect((await poll("qr-deny")).body).toMatchObject({
      code: 500,
      stage: "connack",
      upstreamCode: 135,
    });

    await poll("qr-close");
    f.sockets[1]!.onclose?.({});
    expect((await poll("qr-close")).body).toMatchObject({ code: 500, stage: "closed" });
  });

  it("没有全局 WebSocket 的运行时给出明确失败而不是一直等待", async () => {
    const deps = {
      mobile: {
        createSocket: () => {
          throw new Error("no ws");
        },
      },
    };
    const res = await login_qr_check({ type: "mobile", qrcodeID: "qr-nows" }, undefined, deps);
    expect(res.body).toMatchObject({ code: 500, stage: "connect" });
  });
});

const headersOf = (setCookie: string[] = [], location?: string) => {
  const h = new Headers();
  if (location) h.set("Location", location);
  (h as any).getSetCookie = () => setCookie;
  return h;
};

const scriptedFetch = (steps: Array<(url: string, init: any) => Response | Promise<Response>>) => {
  const calls: Array<{ url: string; init: any }> = [];
  const fn = (async (url: string, init: any) => {
    calls.push({ url: String(url), init });
    const step = steps[calls.length - 1];
    if (!step) throw new Error(`多余的请求: ${url}`);
    return step(String(url), init);
  }) as unknown as typeof fetch;
  return { fn, calls };
};

const textResponse = (body: string, setCookie: string[] = []) => {
  const res = new Response(body, { status: 200 });
  Object.defineProperty(res, "headers", { value: headersOf(setCookie) });
  return res;
};
const redirect = (location: string, setCookie: string[] = [], status = 302) => {
  const res = new Response(null, { status });
  Object.defineProperty(res, "headers", { value: headersOf(setCookie, location || undefined) });
  return res;
};

describe("QQ 音乐 App 扫码（会话回收）", () => {
  it("到期后转为过期并断开连接，保留期满回收状态", async () => {
    const f = makeFactory();
    ensureMobileQrSession("qr-ttl", { createSocket: f.createSocket, ttlMs: 20 });
    await Bun.sleep(30);
    expect(getMobileQrState("qr-ttl")?.code).toBe(800);
    expect(f.sockets[0]!.closed).toBe(true);
    await Bun.sleep(30);
    expect(getMobileQrState("qr-ttl")).toBeUndefined();
  });

  it("成功后无人取走的凭证到保留期也会被回收", async () => {
    const f = makeFactory();
    const deps = {
      createSocket: f.createSocket,
      ttlMs: 20,
      requestCgi: (async () => ({
        status: 200,
        body: { musickey: "real_key", musicid: 123456 },
        cookie: [],
      })) as any,
    };
    ensureMobileQrSession("qr-unclaimed", deps);
    const socket = f.sockets[0]!;
    socket.onopen?.({});
    socket.push(connack());
    socket.push(
      event("cookies", {
        cookies: { qqmusic_uin: { value: "123456" }, qqmusic_key: { value: "tmp_key" } },
      })
    );
    await Bun.sleep(5);
    expect(getMobileQrState("qr-unclaimed")?.code).toBe(200);
    await Bun.sleep(50);
    expect(getMobileQrState("qr-unclaimed")).toBeUndefined();
  });

  it("同时在线的订阅数有上限，超出时不再新开连接", () => {
    const f = makeFactory();
    for (let index = 0; index < 128; index += 1) {
      ensureMobileQrSession(`qr-cap-${index}`, { createSocket: f.createSocket });
    }
    const overflow = ensureMobileQrSession("qr-cap-overflow", { createSocket: f.createSocket });
    expect(overflow).toMatchObject({ code: 500, stage: "capacity" });
    expect(f.sockets).toHaveLength(128);
    expect(getMobileQrState("qr-cap-overflow")).toBeUndefined();
  });
});

describe("QQ 网页扫码", () => {
  const SUCCESS =
    "ptuiCB('0','0','https://ptlogin2.graph.qq.com/check_sig?ptsigx=abc','0','登录成功！','昵称');";

  it("ptqrlogin 文本按数字码识别各状态", () => {
    expect(parsePtqrloginText("ptuiCB('66','0','','0','二维码未失效。','')").status).toBe("waiting");
    expect(parsePtqrloginText("ptuiCB('67','0','','0','二维码认证中。','')").status).toBe("scanned");
    expect(parsePtqrloginText("ptuiCB('65','0','','0','二维码已失效。','')").status).toBe("expired");
    expect(parsePtqrloginText("ptuiCB('68','0','','0','本次登录已被拒绝。','')").status).toBe(
      "refused"
    );
    expect(parsePtqrloginText(SUCCESS)).toEqual({
      status: "success",
      url: "https://ptlogin2.graph.qq.com/check_sig?ptsigx=abc",
    });
    expect(parsePtqrloginText("???").status).toBe("unknown");
  });

  it("CookieJar 遇到空值或过期的 Set-Cookie 会删除而不是覆盖成空串", () => {
    const jar = new CookieJar({ p_skey: "old", keep: "1" });
    jar.apply([
      "p_skey=; Max-Age=0; Path=/",
      "keep=2; Path=/",
      "gone=x; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ]);
    expect(jar.get("p_skey")).toBe("");
    expect(jar.get("keep")).toBe("2");
    expect(jar.toObject()).toEqual({ keep: "2" });
  });

  it("CookieJar 按域隔离：清除 qq.com 的同名项不影响 graph.qq.com 的真票据", () => {
    const jar = new CookieJar({ qrsig: "sig" });
    jar.apply(
      [
        "p_skey=REAL; Path=/; Domain=graph.qq.com; Secure",
        "p_skey=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=qq.com",
        "pt4_token=T; Path=/; Domain=graph.qq.com",
        "RK=rk; Path=/; Domain=.qq.com",
        "local=1; Path=/",
      ],
      "ssl.ptlogin2.graph.qq.com"
    );
    expect(jar.get("p_skey", "graph.qq.com")).toBe("REAL");
    // 子域能看到父域的 Cookie，看不到兄弟域或仅限更深子域的 Cookie。
    expect(jar.toObject("graph.qq.com")).toEqual({
      qrsig: "sig",
      p_skey: "REAL",
      pt4_token: "T",
      RK: "rk",
    });
    expect(jar.toObject("u.y.qq.com")).toEqual({ qrsig: "sig", RK: "rk" });
    expect(jar.header("ssl.ptlogin2.graph.qq.com")).toContain("local=1");
  });

  it("CookieJar 同名时取域最具体的一项", () => {
    const jar = new CookieJar();
    jar.apply(["a=parent; Domain=qq.com", "a=child; Domain=graph.qq.com"]);
    expect(jar.get("a", "graph.qq.com")).toBe("child");
    expect(jar.get("a", "y.qq.com")).toBe("parent");
  });

  it("授权码与跳转概括只保留可入日志的字段", () => {
    expect(extractAuthCode("https://y.qq.com/portal/wx_redirect.html?code=ABC123&state=state")).toBe(
      "ABC123"
    );
    expect(extractAuthCode("", "location.href='https://y.qq.com/x?code=Z9&a=1'")).toBe("Z9");
    expect(extractAuthCode("https://graph.qq.com/oauth2.0/show?which=Login")).toBe("");
    const described = describeLocation("https://graph.qq.com/oauth2.0/show?which=Login&code=SECRET");
    expect(described).toEqual({ host: "graph.qq.com", path: "/oauth2.0/show", which: "Login" });
    expect(JSON.stringify(described)).not.toContain("SECRET");
  });

  it("完整成功链路：check_sig 跟随跳转、authorize 带来源头、QQLogin 产出凭证", async () => {
    const { fn, calls } = scriptedFetch([
      () => textResponse(SUCCESS, ["uin=o123; Path=/", "pt4_token=t; Path=/"]),
      () =>
        redirect("https://graph.qq.com/oauth2.0/login_jump", [
          // 与线上 check_sig 的真实顺序一致：先发票据，再清 qq.com 的同名项。
          "p_skey_forbid=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=graph.qq.com",
          "p_skey=PSKEY; Path=/; Domain=graph.qq.com; Secure",
          "pt_oauth_token=tok; Path=/; Domain=graph.qq.com",
          "p_skey=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; Domain=qq.com",
        ]),
      () => textResponse(""),
      () => redirect("https://y.qq.com/portal/wx_redirect.html?login_type=1&code=AUTHCODE&state=state"),
    ]);
    const cgiCalls: any[] = [];
    const cgi = (async (module: string, method: string, param: any) => {
      cgiCalls.push({ module, method, param });
      return {
        status: 200,
        body: { musickey: "Q_H_L_key", musicid: 123, refresh_token: "rt", openid: "oid" },
        cookie: [],
      };
    }) as any;
    const res = await login_qr_check({ type: "qq", qrsig: "sig", ptqrtoken: 1 }, undefined, {
      fetch: fn,
      cgi,
    });
    expect(res.body.code).toBe(200);
    expect(res.body.uin).toBe("123");
    expect(res.body.musickey).toBe("Q_H_L_key");
    const cookie = cookieToJson(res.body.cookieStr);
    expect(cookie.qrsig).toBeUndefined();
    expect(cookie.p_skey).toBeUndefined();
    expect(cookie.refresh_token).toBe("rt");

    const authCall = calls[3]!;
    expect(authCall.url).toBe("https://graph.qq.com/oauth2.0/authorize");
    expect(authCall.init.headers.Referer).toContain("graph.qq.com");
    expect(authCall.init.headers.Origin).toBe("https://graph.qq.com");
    expect(authCall.init.headers["User-Agent"]).toContain("Mozilla");
    expect(authCall.init.headers.Cookie).toContain("p_skey=PSKEY");
    expect(cgiCalls[0]).toMatchObject({ method: "QQLogin", param: { code: "AUTHCODE" } });
  });

  it("等待 / 已扫码 / 过期 / 取消 各自返回独立状态码", async () => {
    const run = async (text: string) =>
      (
        await login_qr_check({ type: "qq", qrsig: "s", ptqrtoken: 1 }, undefined, {
          fetch: scriptedFetch([() => textResponse(text)]).fn,
        })
      ).body.code;
    expect(await run("ptuiCB('66','0','','0','未失效','')")).toBe(801);
    expect(await run("ptuiCB('67','0','','0','认证中','')")).toBe(802);
    expect(await run("ptuiCB('65','0','','0','已失效','')")).toBe(800);
    expect(await run("ptuiCB('68','0','','0','拒绝','')")).toBe(803);
  });

  it("授权换码失败返回 500 协议失败并带阶段和跳转概括，而不是当作成功", async () => {
    const { fn } = scriptedFetch([
      () => textResponse(SUCCESS),
      () => textResponse("", ["p_skey=P; Domain=graph.qq.com"]),
      () => redirect("https://graph.qq.com/oauth2.0/show?which=Login&display=pc", [], 302),
    ]);
    const res = await login_qr_check({ type: "qq", qrsig: "s", ptqrtoken: 1 }, undefined, {
      fetch: fn,
    });
    expect(res.body).toMatchObject({
      code: 500,
      stage: "authorize",
      reason: "protocol",
      detail: { httpStatus: 302, host: "graph.qq.com", path: "/oauth2.0/show" },
    });
  });

  it("缺少 p_skey 时在 check_sig 阶段失败", async () => {
    const { fn } = scriptedFetch([() => textResponse(SUCCESS), () => textResponse("")]);
    const res = await login_qr_check({ type: "qq", qrsig: "s", ptqrtoken: 1 }, undefined, {
      fetch: fn,
    });
    expect(res.body).toMatchObject({ code: 500, stage: "check_sig" });
  });

  it("QQLogin 返回空 musickey 时不再谎报登录成功，并按业务码归类", async () => {
    const { fn } = scriptedFetch([
      () => textResponse(SUCCESS),
      () => textResponse("", ["p_skey=P; Domain=graph.qq.com"]),
      () => redirect("https://y.qq.com/x?code=C1"),
    ]);
    const cgi = (async () => ({
      status: 200,
      body: { musickey: "", musicid: 0, code: 104400 },
      cookie: [],
    })) as any;
    const res = await login_qr_check({ type: "qq", qrsig: "s", ptqrtoken: 1 }, undefined, {
      fetch: fn,
      cgi,
    });
    expect(res.body).toMatchObject({
      code: 500,
      stage: "qqlogin",
      reason: "auth_invalid",
      upstreamCode: 104400,
    });
    expect(res.body.cookieStr).toBeUndefined();
  });

  it("轮询自身网络抖动按等待处理", async () => {
    const fn = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const res = await login_qr_check({ type: "qq", qrsig: "s", ptqrtoken: 1 }, undefined, {
      fetch: fn,
    });
    expect(res.body.code).toBe(801);
  });
});

describe("微信扫码", () => {
  const wx = (errcode: number, code = "") =>
    scriptedFetch([
      () => textResponse(`window.wx_errcode=${errcode};window.wx_code='${code}'`),
    ]).fn;

  it("各微信状态码映射到独立状态", async () => {
    const run = async (n: number) =>
      (await login_qr_check({ type: "wx", uuid: "u" }, undefined, { fetch: wx(n) })).body.code;
    expect(await run(408)).toBe(801);
    expect(await run(404)).toBe(802);
    expect(await run(403)).toBe(803);
    expect(await run(402)).toBe(800);
    expect(
      (await login_qr_check({ type: "wx", uuid: "u" }, undefined, { fetch: wx(999) })).body
    ).toMatchObject({ code: 500, stage: "wx-poll", upstreamCode: 999 });
  });

  it("确认后换码请求带官方页面一致的 comm，成功时落出完整凭证", async () => {
    const seen: any[] = [];
    const cgi = (async (module: string, method: string, param: any, options: any) => {
      seen.push({ module, method, param, options });
      return {
        status: 200,
        body: { musickey: "W_X_key", musicid: 777, openid: "o", refresh_token: "r" },
        cookie: [],
      };
    }) as any;
    const res = await login_qr_check({ type: "wx", uuid: "u" }, undefined, {
      fetch: wx(405, "WXCODE"),
      cgi,
    });
    expect(res.body.code).toBe(200);
    expect(res.body.musickey).toBe("W_X_key");
    expect(seen[0].param).toEqual({ code: "WXCODE", strAppid: "wx48db31d50e334801" });
    expect(seen[0].options.comm).toEqual({ tmeAppID: "qqmusic", tmeLoginType: "1" });
  });

  it("换码得到空凭证时返回 500 而不是登录成功（回归：旧实现无条件成功，导致后续报登录态失效）", async () => {
    const cgi = (async () => ({
      status: 200,
      body: { musickey: "", musicid: 0, code: 104400 },
      cookie: [],
    })) as any;
    const res = await login_qr_check({ type: "wx", uuid: "u" }, undefined, {
      fetch: wx(405, "X"),
      cgi,
    });
    expect(res.body).toMatchObject({
      code: 500,
      stage: "wx-login",
      reason: "auth_invalid",
      upstreamCode: 104400,
    });
  });

  it("长轮询超时按仍在等待处理", async () => {
    const fn = (async () => {
      throw new DOMException("timeout", "TimeoutError");
    }) as unknown as typeof fetch;
    expect(
      (await login_qr_check({ type: "wx", uuid: "u" }, undefined, { fetch: fn })).body.code
    ).toBe(801);
  });
});

describe("登录失败码归类", () => {
  it("已知业务码区分原因，未知码归为协议失败", () => {
    expect(classifyLoginCode(104400).reason).toBe("auth_invalid");
    expect(classifyLoginCode(104604).reason).toBe("rate_limited");
    expect(classifyLoginCode(20279).reason).toBe("device_limit");
    expect(classifyLoginCode(20450).reason).toBe("account_restricted");
    expect(classifyLoginCode(42).reason).toBe("protocol");
    expect(classifyLoginCode(undefined).reason).toBe("protocol");
  });
});
