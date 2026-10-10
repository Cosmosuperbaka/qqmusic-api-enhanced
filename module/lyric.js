import { request } from "../util/request.js";
import { qrcDecrypt } from "../util/crypto.js";
/**
 * 获取歌曲歌词 (普通 LRC 与逐字 QRC 解密).
 *
 * @param query.id 歌曲 ID (纯数字) 或歌曲 MID
 * @param query.qrc 是否获取逐字歌词 (默认 true)
 * @param query.trans 是否获取歌词翻译 (默认 true)
 * @param query.roma 是否获取罗马音歌词 (默认 false)
 * @param query.cookie 登录 Cookie (可选)
 */
export default async function lyric(query = {}, req = request) {
    const value = query.id?.toString().trim();
    if (!value) {
        return {
            status: 400,
            body: { code: 400, message: "缺少歌曲 id 或 mid" },
        };
    }
    const isNumeric = /^\d+$/.test(value);
    const param = {
        crypt: 1,
        lrc_t: 0,
        qrc: query.qrc !== false ? 1 : 0,
        qrc_t: 0,
        roma: query.roma ? 1 : 0,
        roma_t: 0,
        trans: query.trans !== false ? 1 : 0,
        trans_t: 0,
        type: 1,
    };
    if (isNumeric) {
        param.songId = Number(value);
    }
    else {
        param.songMid = value;
    }
    const cgiRes = await req("music.musichallSong.PlayLyricInfo", "GetPlayLyricInfo", param, {
        cookie: query.cookie,
        platform: "web",
    });
    const data = cgiRes.body || {};
    let lrc = data.lyric || "";
    let trans = data.trans || "";
    let roma = data.roma || "";
    // 如果内容为 QRC 加密 hex 字符串，自动调用 3DES 解密
    if (lrc && /^[0-9a-fA-F]+$/.test(lrc.trim())) {
        const decrypted = qrcDecrypt(lrc);
        if (decrypted) {
            lrc = decrypted;
        }
    }
    if (trans && /^[0-9a-fA-F]+$/.test(trans.trim())) {
        const decryptedTrans = qrcDecrypt(trans);
        if (decryptedTrans) {
            trans = decryptedTrans;
        }
    }
    if (roma && /^[0-9a-fA-F]+$/.test(roma.trim())) {
        const decryptedRoma = qrcDecrypt(roma);
        if (decryptedRoma) {
            roma = decryptedRoma;
        }
    }
    return {
        status: cgiRes.status,
        body: {
            code: cgiRes.body?.code ?? 200,
            lyric: lrc,
            trans,
            roma,
            raw: data,
        },
        cookie: cgiRes.cookie,
    };
}
