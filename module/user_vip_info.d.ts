import { request, type ApiResponse } from "../util/request.js";
export interface NormalizedVipInfo {
    vipStatus: "vip" | "nonVip" | "unknown";
    vipTier?: "svip" | "vip";
    vipLevel?: number;
    vipYear?: boolean;
    vipExpireTime?: number;
}
export declare function deriveVipInfo(body: any): NormalizedVipInfo;
/**
 * 获取当前登录用户的 VIP 会员信息及身份明细.
 *
 * @param query.cookie 登录 Cookie
 */
export default function user_vip_info(query?: {
    cookie?: any;
}, req?: typeof request): Promise<ApiResponse<{
    code: number;
    data: any;
    vip: NormalizedVipInfo;
}>>;
