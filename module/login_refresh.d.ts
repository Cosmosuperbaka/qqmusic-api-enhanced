import { request, type ApiResponse } from "../util/request.js";
export interface LoginRefreshQuery {
    cookie?: any;
    openid?: string;
    refresh_token?: string;
    refresh_key?: string;
    guid?: string;
}
export interface LoginRefreshBody {
    code: number;
    musickey?: string;
    cookieStr: string;
    expiresAt?: number;
    data?: any;
    message?: string;
}
/**
 * 刷新登录凭证。
 *
 * QQ 音乐不同登录入口的续期接口并不一样：
 * - 手机 QQ / QQ 互联网页扫码拿到的是 `uin + qm_keyst`，续期走
 *   `QQConnectLogin.LoginServer/QQLogin`（带 `expired_in` 与旧 `musickey`），
 *   这是上游长期使用的稳定路径；
 * - QQ 音乐 App / 微信等移动端登录会额外拿到 `refresh_token` / `refresh_key`，
 *   续期走 `music.login.LoginServer/Login` 的 refresh-token 流程。
 *
 * 旧实现无条件走后者，网页扫码的 Cookie 没有 refresh_token，续期会失败，
 * 账号随后被判失效。这里先走 QQLogin，再回退到 refresh-token 流程。
 *
 * @param query.cookie 登录 Cookie
 * @param query.openid 微信/QQ openid (可选)
 * @param query.refresh_token 刷新令牌 (可选)
 * @param query.refresh_key 刷新密钥 (可选)
 * @param query.guid 设备标识；缺省从 Cookie/账号派生，保持稳定
 */
export default function login_refresh(query?: LoginRefreshQuery, req?: typeof request): Promise<ApiResponse<LoginRefreshBody>>;
