import artist_detail_fn from "./module/artist_detail.js";
import artist_songs_fn from "./module/artist_songs.js";
import login_qr_check_fn from "./module/login_qr_check.js";
import login_qr_create_fn from "./module/login_qr_create.js";
import login_refresh_fn from "./module/login_refresh.js";
import login_status_fn, {
  type LoginStatusResult,
  type NormalizedLoginAccount,
} from "./module/login_status.js";
import lyric_fn from "./module/lyric.js";
import playlist_detail_fn from "./module/playlist_detail.js";
import playlist_track_all_fn from "./module/playlist_track_all.js";
import recommend_songs_fn from "./module/recommend_songs.js";
import search_fn from "./module/search.js";
import song_detail_fn from "./module/song_detail.js";
import song_url_fn from "./module/song_url.js";
import user_detail_fn from "./module/user_detail.js";
import user_playlist_fn from "./module/user_playlist.js";
import user_vip_info_fn, {
  deriveVipInfo,
  type NormalizedVipInfo,
} from "./module/user_vip_info.js";

import { cookieToJson, cookieToString, parseSetCookie } from "./util/cookie.js";
import { getGtk, getGuid, getSearchId, hash33, qrcDecrypt } from "./util/crypto.js";
import { request, requestCgi, requestRaw, type ApiResponse } from "./util/request.js";
import { zzcSign } from "./util/sign.js";

export const artist_detail = (query: Parameters<typeof artist_detail_fn>[0] = {}) =>
  artist_detail_fn(query, request);

export const artist_songs = (query: Parameters<typeof artist_songs_fn>[0] = {}) =>
  artist_songs_fn(query, request);

export const login_qr_check = (query: Parameters<typeof login_qr_check_fn>[0] = {}) =>
  login_qr_check_fn(query, request);

export const login_qr_create = (query: Parameters<typeof login_qr_create_fn>[0] = {}) =>
  login_qr_create_fn(query, request);

export const login_refresh = (query: Parameters<typeof login_refresh_fn>[0] = {}) =>
  login_refresh_fn(query, request);

export const login_status = (query: Parameters<typeof login_status_fn>[0] = {}) =>
  login_status_fn(query, request);

export const lyric = (query: Parameters<typeof lyric_fn>[0] = {}) =>
  lyric_fn(query, request);

export const playlist_detail = (query: Parameters<typeof playlist_detail_fn>[0] = {}) =>
  playlist_detail_fn(query, request);

export const playlist_track_all = (query: Parameters<typeof playlist_track_all_fn>[0] = {}) =>
  playlist_track_all_fn(query, request);

export const recommend_songs = (query: Parameters<typeof recommend_songs_fn>[0] = {}) =>
  recommend_songs_fn(query, request);

export const search = (query: Parameters<typeof search_fn>[0] = {}) =>
  search_fn(query, request);

export const song_detail = (query: Parameters<typeof song_detail_fn>[0] = {}) =>
  song_detail_fn(query, request);

export const song_url = (query: Parameters<typeof song_url_fn>[0] = {}) =>
  song_url_fn(query, request);

export const user_detail = (query: Parameters<typeof user_detail_fn>[0] = {}) =>
  user_detail_fn(query, request);

export const user_playlist = (query: Parameters<typeof user_playlist_fn>[0] = {}) =>
  user_playlist_fn(query, request);

export const user_vip_info = (query: Parameters<typeof user_vip_info_fn>[0] = {}) =>
  user_vip_info_fn(query, request);

export {
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
  deriveVipInfo,
  type ApiResponse,
  type NormalizedVipInfo,
  type NormalizedLoginAccount,
  type LoginStatusResult,
};

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
