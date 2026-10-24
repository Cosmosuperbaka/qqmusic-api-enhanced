import { describe, expect, it } from "bun:test";
import api, {
  artist_detail,
  artist_songs,
  login_qr_check,
  login_qr_create,
  login_refresh,
  login_status,
  lyric,
  playlist_detail,
  playlist_track_all,
  recommend_songs,
  search,
  song_detail,
  song_url,
  user_detail,
  user_playlist,
} from "../main.js";

import song_detail_mod from "../module/song_detail.js";
import song_url_mod from "../module/song_url.js";
import lyric_mod from "../module/lyric.js";
import playlist_detail_mod from "../module/playlist_detail.js";
import playlist_track_all_mod from "../module/playlist_track_all.js";
import artist_detail_mod from "../module/artist_detail.js";
import artist_songs_mod from "../module/artist_songs.js";
import search_mod from "../module/search.js";
import user_detail_mod from "../module/user_detail.js";
import user_playlist_mod from "../module/user_playlist.js";
import recommend_songs_mod from "../module/recommend_songs.js";

describe("业务模块参数校验", () => {
  it("song_detail 缺少 ID 应返回 400", async () => {
    const res = await song_detail({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少歌曲 id 或 mid");
  });

  it("song_url 缺少 ID 应返回 400", async () => {
    const res = await song_url({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少歌曲 mid");
  });

  it("lyric 缺少 ID 应返回 400", async () => {
    const res = await lyric({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少歌曲 id 或 mid");
  });

  it("playlist_detail 缺少 ID 应返回 400", async () => {
    const res = await playlist_detail({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少合法的歌单 ID");
  });

  it("playlist_track_all 缺少 ID 应返回 400", async () => {
    const res = await playlist_track_all({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少合法的歌单 ID");
  });

  it("artist_detail 缺少 ID 应返回 400", async () => {
    const res = await artist_detail({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少歌手 mid");
  });

  it("artist_songs 缺少 ID 应返回 400", async () => {
    const res = await artist_songs({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("缺少歌手 mid");
  });

  it("search 缺少关键词应返回 400", async () => {
    const res = await search({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("搜索关键词不能为空");
  });
});

describe("业务模块调度与 Mock 契约验证", () => {
  it("song_detail 能够正确分发歌曲 mid 与数字 id", async () => {
    let captured: any = null;
    const mockReq = async (mod: string, meth: string, param: any, opts: any) => {
      captured = { mod, meth, param, opts };
      return { status: 200, body: { code: 0, track_info: { mid: param.song_mid, name: "晴天" } } };
    };

    const resMid = await song_detail_mod({ id: "0039MnYb0qxYAc" }, mockReq as any);
    expect(captured.mod).toBe("music.pf_song_detail_svr");
    expect(captured.meth).toBe("get_song_detail_yqq");
    expect(captured.param.song_mid).toBe("0039MnYb0qxYAc");
    expect(resMid.status).toBe(200);

    const resId = await song_detail_mod({ id: "107192078" }, mockReq as any);
    expect(captured.param.song_id).toBe(107192078);
    expect(resId.status).toBe(200);
  });

  it("song_url 能够正确构造文件名并拼接 CDN 播放直链", async () => {
    let captured: any = null;
    const mockReq = async (mod: string, meth: string, param: any, opts: any) => {
      captured = { mod, meth, param, opts };
      return {
        status: 200,
        body: {
          code: 0,
          midurlinfo: [
            {
              songmid: "0039MnYb0qxYAc",
              purl: "C4000039MnYb0qxYAc0039MnYb0qxYAc.m4a?vkey=mock_vkey",
            },
          ],
          sip: ["https://ws.stream.qqmusic.qq.com/"],
        },
      };
    };

    const res = await song_url_mod(
      { id: "0039MnYb0qxYAc", type: "m4a", cookie: "uin=12345; qm_keyst=mock_key" },
      mockReq as any
    );

    expect(captured.mod).toBe("music.vkey.GetVkey");
    expect(captured.meth).toBe("UrlGetVkey");
    expect(captured.param.filename[0]).toBe("C4000039MnYb0qxYAc0039MnYb0qxYAc.m4a");
    expect(res.status).toBe(200);
    expect(res.body.data[0].url).toBe(
      "https://ws.stream.qqmusic.qq.com/C4000039MnYb0qxYAc0039MnYb0qxYAc.m4a?vkey=mock_vkey"
    );
  });

  it("lyric 能够自动解密返回的 QRC 歌词", async () => {
    const mockReq = async () => {
      return {
        status: 200,
        body: {
          code: 0,
          lyric: "32dabb4c5e9846fa560469176a34222ea5058d71027000f69c774f9ee9d586615e1b72af417869a3",
          trans: "",
        },
      };
    };

    const res = await lyric_mod({ id: "0039MnYb0qxYAc" }, mockReq as any);
    expect(res.status).toBe(200);
    expect(res.body.lyric).toBe("[00:01.00]Hello QQ Music QRC");
  });

  it("playlist_track_all 能够处理歌曲列表展开", async () => {
    let captured: any = null;
    const mockReq = async (mod: string, meth: string, param: any) => {
      captured = param;
      return {
        status: 200,
        body: {
          code: 0,
          songlist: [{ id: 1, name: "Song A" }, { id: 2, name: "Song B" }],
          total_song_num: 2,
        },
      };
    };

    const res = await playlist_track_all_mod({ id: "8888", limit: 50, offset: 10 }, mockReq as any);
    expect(captured.disstid).toBe(8888);
    expect(captured.song_begin).toBe(10);
    expect(captured.song_num).toBe(50);
    expect(res.status).toBe(200);
    expect(res.body.songs.length).toBe(2);
  });

  it("search 能够传递搜索分类与分页参数", async () => {
    let captured: any = null;
    const mockReq = async (mod: string, meth: string, param: any) => {
      captured = param;
      return {
        status: 200,
        body: {
          code: 0,
          data: { song: { list: [{ name: "测试歌曲" }] } },
        },
      };
    };

    const res = await search_mod({ keywords: "周杰伦", type: 0, page: 2, limit: 30 }, mockReq as any);
    expect(captured.query).toBe("周杰伦");
    expect(captured.search_type).toBe(0);
    expect(captured.page_num).toBe(2);
    expect(captured.num_per_page).toBe(30);
    expect(res.status).toBe(200);
    expect(Array.isArray((res.body as any).songs)).toBe(true);
  });

  it("main 聚合对象导出所有模块", () => {
    expect(typeof api.song_detail).toBe("function");
    expect(typeof api.song_url).toBe("function");
    expect(typeof api.lyric).toBe("function");
    expect(typeof api.playlist_detail).toBe("function");
    expect(typeof api.playlist_track_all).toBe("function");
    expect(typeof api.artist_detail).toBe("function");
    expect(typeof api.artist_songs).toBe("function");
    expect(typeof api.search).toBe("function");
    expect(typeof api.user_detail).toBe("function");
    expect(typeof api.user_playlist).toBe("function");
    expect(typeof api.recommend_songs).toBe("function");
    expect(typeof api.login_qr_create).toBe("function");
    expect(typeof api.login_qr_check).toBe("function");
    expect(typeof api.login_status).toBe("function");
    expect(typeof api.login_refresh).toBe("function");
    expect(typeof (api as any).user_vip_info).toBe("function");
    expect(typeof (api as any).deriveVipInfo).toBe("function");
  });

  it("deriveVipInfo 能够正确推导豪华绿钻、超级会员与到期时间", async () => {
    const { deriveVipInfo } = await import("../main.js");
    const sampleVipData = {
      svip: 1,
      identity: {
        level: 6,
        is_year: 1,
        HugeVipEnd: "2027-10-10",
      },
    };
    const vip = deriveVipInfo(sampleVipData);
    expect(vip.vipStatus).toBe("vip");
    expect(vip.vipTier).toBe("svip");
    expect(vip.vipLevel).toBe(6);
    expect(vip.vipYear).toBe(true);
    expect(vip.vipExpireTime).toBeGreaterThan(0);

    // 验证官方字段 HugeYearFlag 与 HugeVip (年豪华绿钻 6 级)
    const officialVipData = {
      identity: {
        HugeVip: 1,
        level: 6,
        HugeYearFlag: 1,
        HugeVipEnd: "2028-05-20",
      },
    };
    const officialVip = deriveVipInfo(officialVipData);
    expect(officialVip.vipStatus).toBe("vip");
    expect(officialVip.vipTier).toBe("vip");
    expect(officialVip.vipLevel).toBe(6);
    expect(officialVip.vipYear).toBe(true);

    // 验证从主页官方勋章母版特征（nvip6.png）兜底推导
    const badgeVipData = {
      Info: {
        NewIconInfo: {
          iconlist: [
            {
              srcUrl: "https://y.qq.com/mediastyle/lv-icon/v14/2x/nvip6.png",
              Helptxt: "年费绿钻",
            },
          ],
        },
      },
    };
    const badgeVip = deriveVipInfo(badgeVipData);
    expect(badgeVip.vipStatus).toBe("vip");
    expect(badgeVip.vipTier).toBe("vip");
    expect(badgeVip.vipLevel).toBe(6);
    expect(badgeVip.vipYear).toBe(true);

    // 验证账号存在已过期 SVIP (2025/9/12) 与未过期年费绿钻 (HugeVipEnd: 2027/9/12) 时：
    // 正确降级为 vip，且必须展示未过期的有效绿钻到期时间，不得隐藏
    const expiredSvipWithActiveVipEndData = {
      svip: 1,
      starend: "2025-09-12 00:00:00",
      userinfo: {
        expire: 1757635200, // 2025-09-12 (SVIP 已过期)
      },
      identity: {
        HugeVip: 1,
        level: 6,
        HugeYearFlag: 1,
        HugeVipEnd: "2027-09-12 00:00:00", // 豪华绿钻未过期
      },
    };
    const testNow = Date.parse("2026-10-11T00:00:00Z");
    const downgradedWithDate = deriveVipInfo(expiredSvipWithActiveVipEndData, testNow);
    expect(downgradedWithDate.vipStatus).toBe("vip");
    expect(downgradedWithDate.vipTier).toBe("vip");
    expect(downgradedWithDate.vipLevel).toBe(6);
    expect(downgradedWithDate.vipYear).toBe(true);
    expect(downgradedWithDate.vipExpireTime).toBe(Date.parse("2027/09/12 00:00:00"));

    // 验证无 HugeVipEnd 专有字段，但 userinfo.expire 下发有效未过期时间 (2027/9/12)，
    // 且 starend 为已过期 SVIP (2025/9/12) 的实际接口数据形态
    const expiredSvipWithUserinfoExpireData = {
      svip: 1,
      starend: "2025-09-12 00:00:00",
      userinfo: {
        expire: 1820793600, // 2027-09-12
      },
      identity: {
        HugeVip: 1,
        level: 6,
        HugeYearFlag: 1,
      },
    };
    const downgradedWithUserinfoExpire = deriveVipInfo(expiredSvipWithUserinfoExpireData, testNow);
    expect(downgradedWithUserinfoExpire.vipStatus).toBe("vip");
    expect(downgradedWithUserinfoExpire.vipTier).toBe("vip");
    expect(downgradedWithUserinfoExpire.vipLevel).toBe(6);
    expect(downgradedWithUserinfoExpire.vipYear).toBe(true);
    expect(downgradedWithUserinfoExpire.vipExpireTime).toBe(1820793600000);

    // 验证若 SVIP 与绿钻两者均已过期（如均为 2025 年），但主页佩戴有勋章兜底时：
    // 降级为 vip，过期的失效时间被安全清除为 undefined
    const allExpiredWithBadgeData = {
      svip: 1,
      userinfo: {
        expire: 1757635200,
      },
      identity: {
        HugeVip: 1,
        HugeVipEnd: "2025-09-12 00:00:00",
        level: 6,
        HugeYearFlag: 1,
      },
      Info: {
        NewIconInfo: {
          iconlist: [
            {
              srcUrl: "https://y.qq.com/mediastyle/lv-icon/v14/2x/nvip6.png",
              Helptxt: "年费绿钻",
            },
          ],
        },
      },
    };
    const allExpired = deriveVipInfo(allExpiredWithBadgeData, testNow);
    expect(allExpired.vipStatus).toBe("vip");
    expect(allExpired.vipTier).toBe("vip");
    expect(allExpired.vipLevel).toBe(6);
    expect(allExpired.vipYear).toBe(true);
    expect(allExpired.vipExpireTime).toBeUndefined();
  });


  it("login_qr_check 支持 mobile App 扫码轮询", async () => {
    const login_qr_check_mod = (await import("../module/login_qr_check.js")).default;
    const { cookieToJson } = await import("../util/cookie.js");

    const missingRes = await login_qr_check_mod({ type: "mobile" });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.message).toContain("缺少必要参数 qrcodeID");

    const waitingReq = async () => ({
      status: 200,
      body: { code: 40000 },
      cookie: [],
    });
    const waitingRes = await login_qr_check_mod(
      { type: "mobile", qrcodeID: "test_qr_123" },
      waitingReq as any
    );
    expect(waitingRes.status).toBe(200);
    expect(waitingRes.body.code).toBe(801);

    const authReq = async () => ({
      status: 200,
      body: {
        code: 0,
        musicid: 12345678,
        musickey: "test_musickey_val",
        openid: "test_openid",
        refresh_token: "test_refresh_token",
      },
      cookie: ["qm_keyst=test_musickey_val"],
    });
    const authRes = await login_qr_check_mod(
      { type: "mobile", qrcodeID: "test_qr_auth" },
      authReq as any
    );
    expect(authRes.status).toBe(200);
    expect(authRes.body.code).toBe(200);
    expect(authRes.body.uin).toBe("12345678");
    expect(authRes.body.musickey).toBe("test_musickey_val");
    expect(authRes.body.guid).toHaveLength(32);

    const cookie = cookieToJson(authRes.body.cookieStr);
    expect(cookie.qm_keyst).toBe("test_musickey_val");
    expect(cookie.openid).toBe("test_openid");
    expect(cookie.refresh_token).toBe("test_refresh_token");
    expect(cookie.guid).toBe(authRes.body.guid);
  });

  it("user_detail 与 login_status 能够从主页接口完整提取真实用户名、头像及年豪华绿钻", async () => {
    const user_detail_mod = (await import("../module/user_detail.js")).default;
    const login_status_mod = (await import("../module/login_status.js")).default;

    const mockHomepageReq = async (module: string, method: string, param: any, options: any) => {
      if (module === "music.UnifiedHomepage.UnifiedHomepageSrv" && method === "GetHomepageHeader") {
        return {
          status: 200,
          body: {
            code: 0,
            data: {
              Info: {
                BaseInfo: {
                  Name: "淋雨之前",
                  Avatar: "http://example.com/avatar_small.jpg",
                  BigAvatar: "http://example.com/avatar_big.jpg",
                },
                NewIconInfo: {
                  iconlist: [
                    {
                      srcUrl: "https://y.qq.com/mediastyle/lv-icon/v14/2x/nvip6.png",
                      Helptxt: "年费绿钻",
                    },
                  ],
                },
              },
            },
          },
          cookie: [],
        };
      }
      if (module === "music.UserInfo.userInfoServer" && method === "GetLoginUserInfo") {
        // 严格鉴权口径下未登录是 code=1000；这里要测的是已登录后的资料补全与 VIP 推导。
        return {
          status: 200,
          body: { code: 0, user: { uin: "1762201051" } },
          cookie: [],
        };
      }
      if (module === "VipLogin.VipLoginInter" && method === "vip_login_base") {
        return {
          status: 200,
          body: { code: 0, data: {} },
          cookie: [],
        };
      }
      return { status: 200, body: {}, cookie: [] };
    };

    const detailRes = await user_detail_mod({ uin: "1762201051" }, mockHomepageReq as any);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.nick).toBe("淋雨之前");
    expect(detailRes.body.avatarUrl).toBe("http://example.com/avatar_big.jpg");

    const statusRes = await login_status_mod(
      { cookie: "uin=1762201051; qm_keyst=test_key;" },
      mockHomepageReq as any
    );
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.isLogin).toBe(true);
    expect(statusRes.body.account.nickname).toBe("淋雨之前");
    expect(statusRes.body.account.avatarUrl).toBe("http://example.com/avatar_big.jpg");
    expect(statusRes.body.account.vipStatus).toBe("vip");
    expect(statusRes.body.account.vipTier).toBe("vip");
    expect(statusRes.body.account.vipLevel).toBe(6);
    expect(statusRes.body.account.vipYear).toBe(true);
  });
});

