import mqtt from "mqtt";
export interface MobileLoginState {
    code: number;
    message: string;
    uin?: string;
    musickey?: string;
    nickname?: string;
    avatarUrl?: string;
    cookieStr?: string;
    expiresAt?: number;
    createdAt: number;
    client?: mqtt.MqttClient;
}
export declare function registerMobileSession(qrcodeId: string): void;
export declare function getMobileSession(qrcodeId: string): MobileLoginState | undefined;
