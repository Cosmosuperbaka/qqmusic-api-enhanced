import { request, type ApiResponse } from "../util/request.js";
import { type NormalizedVipInfo } from "./user_vip_info.js";
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
export interface LoginStatusResult {
    code: number;
    isLogin: boolean;
    uin: string;
    nickname: string;
    avatarUrl?: string;
    vip: NormalizedVipInfo;
    account: NormalizedLoginAccount;
    data: any;
}
/**
 * 校验当前 Cookie 登录状态及获取用户信息与 VIP 等级.
 *
 * @param query.cookie 登录凭据 Cookie
 */
export default function login_status(query?: {
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse<LoginStatusResult>>;
