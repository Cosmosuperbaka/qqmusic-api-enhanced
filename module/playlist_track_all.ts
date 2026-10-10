import { request, type ApiResponse } from "../util/request.js";

/**
 * 分页获取歌单全量歌曲列表.
 *
 * @param query.id 歌单 ID (disstid)
 * @param query.limit 本次获取数量 (默认 100, 上限 1000)
 * @param query.offset 偏移量 (默认 0)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function playlist_track_all(
  query: {
    id?: string | number;
    limit?: number;
    offset?: number;
    cookie?: any;
  } = {},
  req = request
): Promise<ApiResponse> {
  const disstid = Number(query.id);
  if (!disstid) {
    return {
      status: 400,
      body: { code: 400, message: "缺少合法的歌单 ID" },
    };
  }

  const offset = Number(query.offset) || 0;
  const limit = Math.min(Number(query.limit) || 100, 1000);

  const cgiRes = await req(
    "music.srfDissInfo.DissInfo",
    "CgiGetDiss",
    {
      disstid,
      dirid: 0,
      tag: 0,
      song_begin: offset,
      song_num: limit,
      userinfo: 0,
      orderlist: 1,
      onlysonglist: 1,
    },
    {
      cookie: query.cookie,
      platform: "web",
    }
  );

  const raw = cgiRes.body || {};
  const songs = raw.songlist || raw.cdlist?.[0]?.songlist || [];
  const total = raw.total_song_num || raw.cdlist?.[0]?.total_song_num || songs.length;

  return {
    status: cgiRes.status,
    body: {
      code: cgiRes.body?.code ?? 200,
      songs,
      total,
      raw,
    },
    cookie: cgiRes.cookie,
  };
}
