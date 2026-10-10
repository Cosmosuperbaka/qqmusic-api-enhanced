export type PlatformType = "web" | "android" | "desktop";
export interface RequestOptions {
    platform?: PlatformType;
    sign?: boolean;
    cookie?: string | Record<string, string>;
    proxy?: string;
    realIP?: string;
    guid?: string;
    uin?: string | number;
    musickey?: string;
    headers?: Record<string, string>;
    timeout?: number;
}
export interface NormalizedOptions {
    platform: PlatformType;
    sign: boolean;
    cookie: Record<string, string>;
    proxy?: string;
    realIP?: string;
    guid: string;
    uin: string;
    musickey: string;
    headers: Record<string, string>;
    timeout: number;
}
/**
 * 格式化并补全请求配置选项.
 *
 * @param query 调用方传入的 query 参数
 * @param defaultPlatform 默认平台类型
 * @returns 规范化后的请求配置
 */
export declare function createOption(query?: Record<string, any>, defaultPlatform?: PlatformType): NormalizedOptions;
/**
 * 构建 CGI 请求所需的通用 comm 参数对象.
 */
export declare function buildComm(options: NormalizedOptions): Record<string, any>;
