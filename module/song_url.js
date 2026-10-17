import { request } from "../util/request.js";
import { getGuid } from "../util/crypto.js";
import { cookieToJson } from "../util/cookie.js";
const FILE_PREFIXES = {
    "128": { prefix: "M500", ext: ".mp3" },
    "320": { prefix: "M800", ext: ".mp3" },
    flac: { prefix: "F000", ext: ".flac" },
    m4a: { prefix: "C400", ext: ".m4a" },
    try: { prefix: "C400", ext: ".m4a" },
};
/**
 * 获取歌曲播放音频 URL (VKey 直链提取).
 *
 * @param query.id 歌曲 mid (单条或数组)
 * @param query.type 音质: '128' (默认) | '320' | 'flac' | 'm4a' | 'try'
 * @param query.cookie 登录 Cookie (VIP 歌曲需携带有效凭证)
 */
export default async function song_url(query = {}, req = request) {
    const rawIds = query.id ?? query.ids;
    if (!rawIds) {
        return {
            status: 400,
            body: { code: 400, message: "缺少歌曲 mid" },
        };
    }
    const mids = (Array.isArray(rawIds) ? rawIds : [rawIds])
        .map((item) => String(item).trim())
        .filter(Boolean);
    if (mids.length === 0) {
        return {
            status: 400,
            body: { code: 400, message: "歌曲 mid 列表为空" },
        };
    }
    const quality = (query.type || "128").toLowerCase();
    const format = FILE_PREFIXES[quality] || FILE_PREFIXES["128"];
    const cookieObj = cookieToJson(query.cookie);
    const uin = cookieObj.uin ||
        cookieObj.qqmusic_uin ||
        cookieObj.wxuin ||
        cookieObj.musicid ||
        "0";
    const guid = query.guid || cookieObj.guid || getGuid();
    const filenames = mids.map((mid) => `${format.prefix}${mid}${mid}${format.ext}`);
    const songtypes = mids.map(() => 0);
    const param = {
        filename: filenames,
        guid,
        songmid: mids,
        songtype: songtypes,
        uin: String(uin),
        ctx: 0,
    };
    const cgiRes = await req("music.vkey.GetVkey", "UrlGetVkey", param, {
        cookie: query.cookie,
        guid,
        platform: "web",
    });
    const data = cgiRes.body || {};
    const midurlinfo = data.midurlinfo || [];
    const sips = data.sip || [
        "https://ws.stream.qqmusic.qq.com/",
        "https://isure.stream.qqmusic.qq.com/",
    ];
    const primaryDomain = (sips[0] || "https://ws.stream.qqmusic.qq.com/").replace(/^http:\/\//i, "https://");
    const urls = {};
    const list = midurlinfo.map((item) => {
        const mid = item.songmid;
        let url = "";
        if (item.purl) {
            url = `${primaryDomain}${item.purl}`;
        }
        urls[mid] = url;
        return {
            mid,
            url,
            purl: item.purl || "",
            vkey: item.vkey || "",
        };
    });
    return {
        status: cgiRes.status,
        body: {
            code: 200,
            data: list,
            urls,
            raw: data,
        },
        cookie: cgiRes.cookie,
    };
}
