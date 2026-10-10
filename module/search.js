import { request } from "../util/request.js";
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
export default async function search(query = {}, req = request) {
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
    const cgiRes = await req("music.search.SearchCgiService", "DoSearchForQQMusicMobile", {
        query: keyword,
        search_type: searchType,
        num_per_page: limit,
        page_num: page,
        search_id: searchId,
        highlight: 1,
    }, {
        cookie: query.cookie,
        platform: "android",
    });
    return {
        status: cgiRes.status,
        body: {
            code: cgiRes.body?.code ?? 200,
            data: cgiRes.body,
        },
        cookie: cgiRes.cookie,
    };
}
