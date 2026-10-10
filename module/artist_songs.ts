import { request, type ApiResponse } from "../util/request.js";

/**
 * 获取歌手单曲列表 (支持最热 / 最新排序).
 *
 * @param query.id 歌手 MID
 * @param query.page 页码 (默认 1)
 * @param query.limit 每页数量 (默认 30)
 * @param query.order 排序方式: 'hot' (默认最热) | 'latest' (最新)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function artist_songs(
  query: {
    id?: string;
    page?: number;
    limit?: number;
    order?: "hot" | "latest" | number;
    cookie?: any;
  } = {},
  req = request
): Promise<ApiResponse> {
  const mid = query.id?.trim();
  if (!mid) {
    return {
      status: 400,
      body: { code: 400, message: "缺少歌手 mid" },
    };
  }

  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 100);
  const orderVal = query.order === "latest" || query.order === 0 ? 0 : 1;

  const cgiRes = await req(
    "musichall.song_list_server",
    "GetSingerSongList",
    {
      singerMid: mid,
      order: orderVal,
      number: limit,
      begin: (page - 1) * limit,
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
