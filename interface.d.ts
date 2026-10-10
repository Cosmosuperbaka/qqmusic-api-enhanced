export interface RequestBaseConfig {
  cookie?: string | Record<string, string>;
  proxy?: string;
  realIP?: string;
  guid?: string;
  uin?: string | number;
  musickey?: string;
}

export interface Response<Body = any> {
  status: number;
  body: Body;
  cookie?: string[];
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
  cookie?: string[];
}

// ==============================
// 1. 登录与凭证模块 (Login & Auth)
// ==============================

export interface LoginQrCreateQuery extends RequestBaseConfig {
  /** 登录方式: 'qq' (默认手机QQ扫码) | 'wx' (微信扫码) | 'mobile' (QQ音乐移动端App扫码) */
  type?: "qq" | "wx" | "mobile";
}

export interface LoginQrCreateResult {
  code: number;
  type: "qq" | "wx" | "mobile";
  qrsig?: string;
  ptqrtoken?: string | number;
  uuid?: string;
  qrcode?: string;
  qrcodeID?: string;
  qrurl?: string;
  qrimg?: string;
  url?: string;
}

export interface LoginQrCheckQuery extends RequestBaseConfig {
  /** 登录方式: 'qq' | 'wx' | 'mobile' */
  type?: "qq" | "wx" | "mobile";
  /** 手机 QQ 轮询凭证，来源于 login_qr_create */
  qrsig?: string;
  /** 手机 QQ 轮询 token，来源于 login_qr_create */
  ptqrtoken?: string | number;
  /** 微信轮询凭证 uuid，来源于 login_qr_create */
  uuid?: string;
  /** QQ 音乐移动端 App 扫码 qrcodeID，来源于 login_qr_create */
  qrcodeID?: string;
  /** 兼容通用 key 参数 */
  key?: string;
}

export interface LoginQrCheckResult {
  code: number;
  message: string;
  uin?: string;
  musickey?: string;
  cookie?: Record<string, string>;
  cookieStr?: string;
  data?: Record<string, any>;
}

export interface NormalizedVipInfo {
  vipStatus: "vip" | "nonVip" | "unknown";
  vipTier?: "svip" | "vip";
  vipLevel?: number;
  vipYear?: boolean;
  vipExpireTime?: number;
}

export interface NormalizedLoginAccount {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  vipStatus: "vip" | "nonVip" | "unknown";
  vipTier?: "svip" | "vip";
  vipLevel?: number;
  vipYear?: boolean;
  vipExpireTime?: number;
}

export interface LoginStatusQuery extends RequestBaseConfig {}

export interface LoginStatusResult {
  code: number;
  isLogin: boolean;
  uin: string;
  nickname: string;
  avatarUrl?: string;
  vip: NormalizedVipInfo;
  account: NormalizedLoginAccount;
  data?: Record<string, any>;
  userInfo?: Record<string, any>;
}

export interface LoginRefreshQuery extends RequestBaseConfig {
  openid?: string;
  refresh_token?: string;
  refresh_key?: string;
}

export interface LoginRefreshResult {
  code: number;
  musickey?: string;
  cookieStr?: string;
  data?: Record<string, any>;
  raw?: Record<string, any>;
}

export interface UserVipInfoQuery extends RequestBaseConfig {}

export interface UserVipInfoResult {
  code: number;
  data: Record<string, any>;
  vip: NormalizedVipInfo;
}

// ==============================
// 2. 歌曲与播放 (Songs & Playback)
// ==============================

export interface SongDetailQuery extends RequestBaseConfig {
  /** 歌曲数字 ID 或 字母数字混合 MID */
  id?: string | number;
  /** 兼容 ids 参数 */
  ids?: string | number;
}

export interface SongDetailResult {
  code: number;
  data: Record<string, any>;
}

export interface SongUrlQuery extends RequestBaseConfig {
  /** 歌曲 mid (单条或数组) */
  id?: string | string[];
  /** 兼容 ids 参数 */
  ids?: string | string[];
  /** 音质: '128' (默认) | '320' | 'flac' | 'm4a' | 'try' */
  type?: "128" | "320" | "flac" | "m4a" | "try" | string;
}

export interface SongUrlResult {
  code: number;
  data: Array<{
    id?: number;
    mid: string;
    url: string;
    type: string;
    sip: string[];
    purl: string;
    expiration?: number;
  }>;
}

// ==============================
// 3. 歌词与解密 (Lyrics & QRC)
// ==============================

export interface LyricQuery extends RequestBaseConfig {
  /** 歌曲 ID 或 MID */
  id?: string | number;
  /** 是否拉取并解密逐字歌词 (默认 true) */
  qrc?: boolean;
  /** 是否拉取翻译歌词 (默认 true) */
  trans?: boolean;
  /** 是否拉取罗马音歌词 (默认 false) */
  roma?: boolean;
}

export interface LyricResult {
  code: number;
  lyric: string;
  trans: string;
  roma: string;
  raw: Record<string, any>;
}

// ==============================
// 4. 歌单模块 (Playlists)
// ==============================

export interface PlaylistDetailQuery extends RequestBaseConfig {
  /** 歌单 ID (disstid) */
  id?: string | number;
}

export interface PlaylistDetailResult {
  code: number;
  data: Record<string, any>;
}

export interface PlaylistTrackAllQuery extends RequestBaseConfig {
  /** 歌单 ID (disstid) */
  id?: string | number;
  /** 抓取数量 (默认 100, 上限 1000) */
  limit?: number;
  /** 分页偏移量 (默认 0) */
  offset?: number;
}

export interface PlaylistTrackAllResult {
  code: number;
  songs: any[];
  total: number;
  raw: Record<string, any>;
}

// ==============================
// 5. 歌手模块 (Artists)
// ==============================

export interface ArtistDetailQuery extends RequestBaseConfig {
  /** 歌手 MID (如 0025NhlC2yWrP4) */
  id?: string;
}

export interface ArtistDetailResult {
  code: number;
  data: Record<string, any>;
}

export interface ArtistSongsQuery extends RequestBaseConfig {
  /** 歌手 MID */
  id?: string;
  /** 分页页码 (从 1 开始，默认 1) */
  page?: number;
  /** 每页数量 (默认 20, 上限 100) */
  limit?: number;
  /** 排序: 0-最新, 1-最热(默认) */
  order?: number;
}

export interface ArtistSongsResult {
  code: number;
  songs: any[];
  total: number;
  raw: Record<string, any>;
}

// ==============================
// 6. 搜索模块 (Search)
// ==============================

export interface SearchQuery extends RequestBaseConfig {
  /** 搜索关键词 */
  keywords?: string;
  /** 兼容 keyword 参数 */
  keyword?: string;
  /** 搜索类型: 0-单曲(默认), 1-歌手, 2-专辑, 3-歌单, 7-歌词 */
  type?: number | string;
  /** 页码 (默认 1) */
  page?: number;
  /** 每页大小 (默认 20) */
  limit?: number;
  searchid?: string;
}

export interface SearchResult {
  code: number;
  data: Record<string, any>;
}

// ==============================
// 7. 用户模块 (User)
// ==============================

export interface UserDetailQuery extends RequestBaseConfig {
  /** 用户数字 QQ/uin 或加密 encrypt_uin (为空时默认当前登录账号) */
  id?: string | number;
}

export interface UserDetailResult {
  code: number;
  data: Record<string, any>;
}

export interface UserPlaylistQuery extends RequestBaseConfig {
  /** 用户数字 QQ/uin 或加密 encrypt_uin */
  id?: string | number;
  /** 歌单数量限制 (默认 100) */
  limit?: number;
}

export interface UserPlaylistResult {
  code: number;
  playlists: any[];
  total: number;
  raw: Record<string, any>;
}

// ==============================
// 8. 推荐模块 (Recommendations)
// ==============================

export interface RecommendSongsQuery extends RequestBaseConfig {
  /** 地区分类: 1-华语, 2-欧美, 3-韩国, 4-日本 (默认 1) */
  type?: number | string;
}

export interface RecommendSongsResult {
  code: number;
  songs: any[];
  raw: Record<string, any>;
}

// ==============================
// 函数签名声明
// ==============================

export function artist_detail(query?: ArtistDetailQuery): Promise<Response<ArtistDetailResult>>;
export function artist_songs(query?: ArtistSongsQuery): Promise<Response<ArtistSongsResult>>;
export function login_qr_check(query?: LoginQrCheckQuery): Promise<Response<LoginQrCheckResult>>;
export function login_qr_create(query?: LoginQrCreateQuery): Promise<Response<LoginQrCreateResult>>;
export function login_refresh(query?: LoginRefreshQuery): Promise<Response<LoginRefreshResult>>;
export function login_status(query?: LoginStatusQuery): Promise<Response<LoginStatusResult>>;
export function lyric(query?: LyricQuery): Promise<Response<LyricResult>>;
export function playlist_detail(query?: PlaylistDetailQuery): Promise<Response<PlaylistDetailResult>>;
export function playlist_track_all(query?: PlaylistTrackAllQuery): Promise<Response<PlaylistTrackAllResult>>;
export function recommend_songs(query?: RecommendSongsQuery): Promise<Response<RecommendSongsResult>>;
export function search(query?: SearchQuery): Promise<Response<SearchResult>>;
export function song_detail(query?: SongDetailQuery): Promise<Response<SongDetailResult>>;
export function song_url(query?: SongUrlQuery): Promise<Response<SongUrlResult>>;
export function user_detail(query?: UserDetailQuery): Promise<Response<UserDetailResult>>;
export function user_playlist(query?: UserPlaylistQuery): Promise<Response<UserPlaylistResult>>;
export function user_vip_info(query?: UserVipInfoQuery): Promise<Response<UserVipInfoResult>>;
export function deriveVipInfo(body: any): NormalizedVipInfo;

// 基础网络调度器与工具函数
export function request(arg1: string, arg2?: any, arg3?: any, arg4?: any): Promise<ApiResponse>;
export function requestCgi<T = any>(module: string, method: string, param?: Record<string, any>, options?: any): Promise<ApiResponse<T>>;
export function requestRaw(url: string, options?: any): Promise<{ status: number; data: any; headers: any; cookie: string[] }>;
export function zzcSign(data: string): string;
export function qrcDecrypt(hexData: string): string | null;
export function hash33(str: string): number;
export function getGtk(skey: string): number;
export function getGuid(): string;
export function getSearchId(): string;
export function cookieToJson(cookie: string | Record<string, string> | undefined | null): Record<string, string>;
export function cookieToString(cookieObj: Record<string, string> | undefined | null): string;
export function parseSetCookie(setCookieHeaders?: string[]): Record<string, string>;

declare const api: {
  artist_detail: typeof artist_detail;
  artist_songs: typeof artist_songs;
  login_qr_check: typeof login_qr_check;
  login_qr_create: typeof login_qr_create;
  login_refresh: typeof login_refresh;
  login_status: typeof login_status;
  lyric: typeof lyric;
  playlist_detail: typeof playlist_detail;
  playlist_track_all: typeof playlist_track_all;
  recommend_songs: typeof recommend_songs;
  search: typeof search;
  song_detail: typeof song_detail;
  song_url: typeof song_url;
  user_detail: typeof user_detail;
  user_playlist: typeof user_playlist;
  user_vip_info: typeof user_vip_info;
  deriveVipInfo: typeof deriveVipInfo;
  request: typeof request;
  requestCgi: typeof requestCgi;
  requestRaw: typeof requestRaw;
  zzcSign: typeof zzcSign;
  qrcDecrypt: typeof qrcDecrypt;
  hash33: typeof hash33;
  getGtk: typeof getGtk;
  getGuid: typeof getGuid;
  getSearchId: typeof getSearchId;
  cookieToJson: typeof cookieToJson;
  cookieToString: typeof cookieToString;
  parseSetCookie: typeof parseSetCookie;
};

export default api;

