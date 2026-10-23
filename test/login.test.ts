import { describe, expect, it } from "bun:test";
import login_refresh_mod from "../module/login_refresh.js";
import login_status_mod from "../module/login_status.js";
import { cookieToJson, mergeLoginPayloadCookies } from "../util/cookie.js";
import { getStableGuid } from "../util/crypto.js";
import { createOption } from "../util/option.js";

describe("登录凭证续期", () => {
  it("mergeLoginPayloadCookies 合并嵌套字段、别名与过期时间", () => {
    const cookie: Record<string, string> = { uin: "1", qm_keyst: "old" };
    const merged = mergeLoginPayloadCookies(cookie, {
      code: 0,
      data: {
        musickey: "new",
        musicid: 123,
        encryptUin: "euin",
        refresh_token: "rt",
        refresh_key: "rk",
        openid: "oid",
        access_token: "at",
        loginType: 2,
        expired_at: 2_000_000_000,
        keyExpiresIn: 100,
      },
    });

    expect(merged.obtainedMusickey).toBe(true);
    expect(merged.expiresAt).toBe(2_000_000_000_000);
    expect(cookie).toMatchObject({
      uin: "123",
      qqmusic_uin: "123",
      qm_keyst: "new",
      qqmusic_key: "new",
      musickey: "new",
      refresh_token: "rt",
      refresh_key: "rk",
      openid: "oid",
      access_token: "at",
      tmeLoginType: "2",
      euin: "euin",
    });
  });

  it("旧 Cookie 没有 guid 时按账号派生稳定值", () => {
    const first = createOption({ cookie: "uin=123; qm_keyst=old" });
    const second = createOption({ cookie: "uin=123; qm_keyst=old" });
    expect(first.guid).toBe(second.guid);
    expect(first.guid).toBe(getStableGuid("123:"));
    expect(first.guid).toHaveLength(32);

    const explicit = createOption({ cookie: "uin=123; qm_keyst=old; guid=fixed_guid" });
    expect(explicit.guid).toBe("fixed_guid");
  });

  it("QQ 网页扫码走 QQLogin 续期并保留 refresh 字段", async () => {
    const calls: Array<{ module: string; method: string; param: any; options: any }> = [];
    const mockReq = async (module: string, method: string, param: any, options: any) => {
      calls.push({ module, method, param, options });
      return {
        status: 200,
        body: {
          code: 0,
          data: {
            musickey: "new_key",
            musicid: 123,
            refresh_token: "rt2",
            refresh_key: "rk2",
            openid: "oid2",
            expired_at: 2_000_000_000,
          },
        },
        cookie: ["qm_keyst=new_key"],
      };
    };

    const res = await login_refresh_mod(
      { cookie: "uin=123; qm_keyst=old_key" },
      mockReq as any
    );
    expect(res.body.code).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.module).toBe("QQConnectLogin.LoginServer");
    expect(calls[0]?.method).toBe("QQLogin");
    expect(calls[0]?.param).toMatchObject({
      expired_in: 7_776_000,
      musicid: "123",
      musickey: "old_key",
    });
    expect(calls[0]?.options.sign).toBe(true);
    expect(calls[0]?.options.guid).toBe(getStableGuid("123:"));

    const cookie = cookieToJson(res.body.cookieStr);
    expect(cookie.qm_keyst).toBe("new_key");
    expect(cookie.qqmusic_key).toBe("new_key");
    expect(cookie.refresh_token).toBe("rt2");
    expect(cookie.refresh_key).toBe("rk2");
    expect(cookie.openid).toBe("oid2");
    expect(cookie.guid).toBe(getStableGuid("123:"));
    expect(res.body.expiresAt).toBe(2_000_000_000_000);
  });

  it("QQLogin 拿不到新 key 时回退到 refresh-token 流程", async () => {
    const modules: string[] = [];
    const mockReq = async (module: string) => {
      modules.push(module);
      if (module === "music.login.LoginServer") {
        return {
          status: 200,
          body: { code: 0, data: { musickey: "mobile_key", refresh_token: "rt3" } },
          cookie: [],
        };
      }
      return { status: 200, body: { code: 1, data: {} }, cookie: [] };
    };

    const res = await login_refresh_mod(
      { cookie: "uin=123; qm_keyst=old_key" },
      mockReq as any
    );
    expect(res.body.code).toBe(200);
    expect(modules).toEqual([
      "QQConnectLogin.LoginServer",
      "QQConnectLogin.LoginServer",
      "music.login.LoginServer",
    ]);
    expect(cookieToJson(res.body.cookieStr).qm_keyst).toBe("mobile_key");
  });

  it("全部续期失败时返回非 200，不伪造新 key", async () => {
    const mockReq = async () => ({
      status: 200,
      body: { code: 1, data: {} },
      cookie: [],
    });
    const res = await login_refresh_mod(
      { cookie: "uin=123; qm_keyst=old_key" },
      mockReq as any
    );
    expect(res.body.code).not.toBe(200);
    expect(cookieToJson(res.body.cookieStr).qm_keyst).toBe("old_key");
  });

  it("login_status 把状态接口轮换的 Set-Cookie 回写到 cookieStr", async () => {
    const mockReq = async (module: string) => {
      if (module === "music.UserInfo.userInfoServer") {
        return {
          status: 200,
          body: { code: 0, user: { uin: 123, nick: "测试用户", headurl: "https://a" } },
          cookie: ["rotated=1"],
        };
      }
      return { status: 200, body: { code: 0, data: {} }, cookie: [] };
    };

    const res = await login_status_mod(
      { cookie: "uin=123; qm_keyst=old_key" },
      mockReq as any
    );
    expect(res.body.isLogin).toBe(true);
    expect(cookieToJson(res.body.cookieStr).rotated).toBe("1");
  });
});
