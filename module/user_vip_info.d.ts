import { request, type ApiResponse } from "../util/request.js";
export interface NormalizedVipInfo {
    vipStatus: "vip" | "nonVip" | "unknown";
    vipTier?: "svip" | "vip";
    vipLevel?: number;
    vipYear?: boolean;
    vipExpireTime?: number;
}
export declare function parseVipFromIcons(iconList?: any[], icons?: any[]): Partial<NormalizedVipInfo> | null;
export declare function deriveVipInfo(body: any): NormalizedVipInfo;
/**
 * 获取当前登录用户的 VIP 会员信息及身份明细.
 *
 * @param query.cookie 登录 Cookie
 * @param query.uin 用户 QQ/UIN
 */
export default function user_vip_info(query?: {
    cookie?: any;
    uin?: string | number;
}, req?: typeof request): Promise<ApiResponse<{
    code: number;
    data: any;
    vip: NormalizedVipInfo;
}>>;
