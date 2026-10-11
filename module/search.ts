import { request, type ApiResponse } from "../util/request.js";
import { getSearchId } from "../util/crypto.js";

/**
 * 歌曲/歌手/专辑/歌单/歌词综合搜索.
 *
 * @param query.keywords 搜索关键词 (也兼容 keyword)
 * @param query.type 搜索类型: 0-单曲(默认), 1-歌手, 2-专辑, 3-歌单, 7-歌词
 * @param query.page 页码 (默认 1)
 * @param query.limit 每页数量 (默认 20)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function search(
  query: {
    keywords?: string;
    keyword?: string;
    type?: number | string;
    page?: number;
    limit?: number;
    cookie?: any;
    searchid?: string;
    platform?: string;
  } = {},
  req = request
): Promise<ApiResponse> {
  const keyword = (query.keywords || query.keyword || "").trim();
  if (!keyword) {
    return {
      status: 400,
      body: { code: 400, message: "搜索关键词不能为空" },
    };
  }

  const searchType = Number(query.type) || 0;
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const searchId = query.searchid || getSearchId();
  const platform = query.platform || "desktop";

  const cgiRes = await req(
    "music.search.SearchCgiService",
    "DoSearchForQQMusicMobile",
    {
      query: keyword,
      search_type: searchType,
      num_per_page: limit,
      page_num: page,
      search_id: searchId,
      highlight: 1,
    },
    {
      cookie: query.cookie,
      platform,
    }
  );

  const rawBody = cgiRes.body || {};
  const dataBody = rawBody.body || rawBody.data?.body || rawBody.data || rawBody;
  const songItems = dataBody.item_song || dataBody.song?.list || dataBody.songs || [];
  const rawSongs = Array.isArray(songItems) ? songItems : (songItems.items || []);
  const strip = (str: unknown) => (typeof str === "string" ? str.replace(/<[^>]+>/g, "").trim() : str);
  const songs = rawSongs.map((s: any) => {
    if (!s || typeof s !== "object") return s;
    const clean = { ...s };
    if (clean.title) clean.title = strip(clean.title);
    if (clean.name) clean.name = strip(clean.name);
    if (clean.songname) clean.songname = strip(clean.songname);
    if (clean.albumname) clean.albumname = strip(clean.albumname);
    if (clean.album?.name) clean.album = { ...clean.album, name: strip(clean.album.name) };
    if (Array.isArray(clean.singer)) {
      clean.singer = clean.singer.map((singer: any) => {
        if (!singer || typeof singer !== "object") return singer;
        return {
          ...singer,
          name: strip(singer.name),
          title: strip(singer.title),
        };
      });
    }
    return clean;
  });

  return {
    status: cgiRes.status,
    body: {
      code: cgiRes.body?.code ?? 200,
      data: cgiRes.body,
      songs,
    },
    cookie: cgiRes.cookie,
  };
}
