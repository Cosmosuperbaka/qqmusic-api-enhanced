import { request, type ApiResponse } from "../util/request.js";

/**
 * 获取歌手详细资料与百科背景.
 *
 * @param query.id 歌手 MID (例如: 0025NhlC2yWrP4)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function artist_detail(
  query: { id?: string; cookie?: any } = {},
  req = request
): Promise<ApiResponse> {
  const mid = query.id?.trim();
  if (!mid) {
    return {
      status: 400,
      body: { code: 400, message: "缺少歌手 mid" },
    };
  }

  const cgiRes = await req(
    "music.musichallSinger.SingerInfoInter",
    "GetSingerDetail",
    {
      singer_mids: [mid],
      group_singer: 1,
      wiki_singer: 1,
      ex_singer: 1,
      pic: 1,
      photos: 1,
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
