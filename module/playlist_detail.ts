import { request, type ApiResponse } from "../util/request.js";

/**
 * 获取歌单基本信息与首屏歌曲.
 *
 * @param query.id 歌单 ID (disstid)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function playlist_detail(
  query: { id?: string | number; cookie?: any } = {},
  req = request
): Promise<ApiResponse> {
  const disstid = Number(query.id);
  if (!disstid) {
    return {
      status: 400,
      body: { code: 400, message: "缺少合法的歌单 ID" },
    };
  }

  const cgiRes = await req(
    "music.srfDissInfo.DissInfo",
    "CgiGetDiss",
    {
      disstid,
      dirid: 0,
      tag: 1,
      song_begin: 0,
      song_num: 30,
      userinfo: 1,
      orderlist: 1,
      onlysonglist: 0,
    },
    {
      cookie: query.cookie,
      platform: "web",
    }
  );

  return {
    status: cgiRes.status,
    body: {
      code: cgiRes.body?.code ?? 200,
      data: cgiRes.body,
    },
    cookie: cgiRes.cookie,
  };
}
