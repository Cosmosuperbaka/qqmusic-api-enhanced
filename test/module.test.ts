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
  });

  it("login_qr_check 支持 mobile App 扫码分支", async () => {
    const login_qr_check_mod = (await import("../module/login_qr_check.js")).default;
    const { registerMobileSession, getMobileSession } = await import("../util/mobile_qr_session.js");

    const missingRes = await login_qr_check_mod({ type: "mobile" });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.message).toContain("缺少必要参数 qrcodeID");

    const mockReq = async () => ({
      status: 200,
      body: { code: 40000 },
      cookie: [],
    });
    const waitingRes = await login_qr_check_mod({ type: "mobile", qrcodeID: "test_qr_123" }, mockReq as any);
    expect(waitingRes.status).toBe(200);
    expect(waitingRes.body.code).toBe(801);

    // 验证实时会话状态注入响应
    registerMobileSession("test_qr_auth");
    const session = getMobileSession("test_qr_auth");
    if (session) {
      session.code = 200;
      session.uin = "12345678";
      session.musickey = "test_musickey_val";
      session.cookieStr = "uin=12345678; qm_keyst=test_musickey_val";
    }

    const authRes = await login_qr_check_mod({ type: "mobile", qrcodeID: "test_qr_auth" }, mockReq as any);
    expect(authRes.status).toBe(200);
    expect(authRes.body.code).toBe(200);
    expect(authRes.body.uin).toBe("12345678");
    expect(authRes.body.musickey).toBe("test_musickey_val");
    expect(authRes.body.cookieStr).toContain("qm_keyst=test_musickey_val");
  });
});

