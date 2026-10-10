import artist_detail_fn from "./module/artist_detail.js";
import artist_songs_fn from "./module/artist_songs.js";
import login_qr_check_fn from "./module/login_qr_check.js";
import login_qr_create_fn from "./module/login_qr_create.js";
import login_refresh_fn from "./module/login_refresh.js";
import login_status_fn from "./module/login_status.js";
import lyric_fn from "./module/lyric.js";
import playlist_detail_fn from "./module/playlist_detail.js";
import playlist_track_all_fn from "./module/playlist_track_all.js";
import recommend_songs_fn from "./module/recommend_songs.js";
import search_fn from "./module/search.js";
import song_detail_fn from "./module/song_detail.js";
import song_url_fn from "./module/song_url.js";
import user_detail_fn from "./module/user_detail.js";
import user_playlist_fn from "./module/user_playlist.js";
import user_vip_info_fn, { deriveVipInfo, } from "./module/user_vip_info.js";
import { cookieToJson, cookieToString, parseSetCookie } from "./util/cookie.js";
import { getGtk, getGuid, getSearchId, hash33, qrcDecrypt } from "./util/crypto.js";
import { request, requestCgi, requestRaw } from "./util/request.js";
import { zzcSign } from "./util/sign.js";
export const artist_detail = (query = {}) => artist_detail_fn(query, request);
export const artist_songs = (query = {}) => artist_songs_fn(query, request);
export const login_qr_check = (query = {}) => login_qr_check_fn(query, request);
export const login_qr_create = (query = {}) => login_qr_create_fn(query, request);
export const login_refresh = (query = {}) => login_refresh_fn(query, request);
export const login_status = (query = {}) => login_status_fn(query, request);
export const lyric = (query = {}) => lyric_fn(query, request);
export const playlist_detail = (query = {}) => playlist_detail_fn(query, request);
export const playlist_track_all = (query = {}) => playlist_track_all_fn(query, request);
export const recommend_songs = (query = {}) => recommend_songs_fn(query, request);
export const search = (query = {}) => search_fn(query, request);
export const song_detail = (query = {}) => song_detail_fn(query, request);
export const song_url = (query = {}) => song_url_fn(query, request);
export const user_detail = (query = {}) => user_detail_fn(query, request);
export const user_playlist = (query = {}) => user_playlist_fn(query, request);
export const user_vip_info = (query = {}) => user_vip_info_fn(query, request);
export { request, requestCgi, requestRaw, zzcSign, qrcDecrypt, hash33, getGtk, getGuid, getSearchId, cookieToJson, cookieToString, parseSetCookie, deriveVipInfo, };
const api = {
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
    user_vip_info,
    deriveVipInfo,
    request,
    requestCgi,
    requestRaw,
    zzcSign,
    qrcDecrypt,
    hash33,
    getGtk,
    getGuid,
    getSearchId,
    cookieToJson,
    cookieToString,
    parseSetCookie,
};
export default api;
