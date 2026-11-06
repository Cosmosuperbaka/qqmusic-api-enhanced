/**
 * 极简 MQTT 5.0 编解码（仅覆盖 QQ 音乐 App 扫码推送所需的报文）。
 *
 * 为什么自己写：QQ 音乐 App 扫码的状态只通过 `wss://mu.y.qq.com` 上的 MQTT 5 推送下发，
 * `CheckQRCode` CGI 对任何阶段都只回 40000，轮询拿不到“已扫码/已确认”。
 * 引入完整的 mqtt.js 会把整棵 ws/readable-stream 依赖树带进包里，所以这里只实现
 * CONNECT / CONNACK / SUBSCRIBE / SUBACK / PUBLISH / PUBACK / PINGREQ / PINGRESP / DISCONNECT。
 * 协议依据 OASIS MQTT 5.0 规范，不含第三方代码。
 */
export type UserProperties = Record<string, string>;
export interface MqttConnack {
    type: "connack";
    reasonCode: number;
    serverReference?: string;
}
export interface MqttSuback {
    type: "suback";
    packetId: number;
    reasonCodes: number[];
}
export interface MqttPublish {
    type: "publish";
    topic: string;
    qos: 0 | 1 | 2;
    packetId?: number;
    payload: Uint8Array;
    userProperties: UserProperties;
}
export interface MqttSimple {
    type: "pingresp" | "disconnect" | "puback" | "other";
    reasonCode?: number;
}
export type MqttPacket = MqttConnack | MqttSuback | MqttPublish | MqttSimple;
/** MQTT 变长整数编码（最多 4 字节）。 */
export declare function encodeVarInt(value: number): number[];
/** 读取变长整数；数据不足返回 undefined。 */
export declare function decodeVarInt(data: Uint8Array, offset: number): {
    value: number;
    length: number;
} | undefined;
export interface ConnectOptions {
    clientId: string;
    keepAliveSeconds: number;
    authenticationMethod?: string;
    userProperties?: UserProperties;
}
export declare function encodeConnect(options: ConnectOptions): Uint8Array;
export declare function encodeSubscribe(packetId: number, topic: string, userProperties?: UserProperties): Uint8Array;
export declare const encodePuback: (packetId: number) => Uint8Array;
export declare const encodePingreq: () => Uint8Array;
export declare const encodeDisconnect: () => Uint8Array;
/** 从缓冲区切出完整报文；返回解析结果与剩余字节。数据不足时 packets 可能为空。 */
export declare function decodePackets(buffer: Uint8Array): {
    packets: MqttPacket[];
    rest: Uint8Array;
};
/** 编码 PUBLISH（QoS 0/1）。本库只订阅不发布，主要给测试夹具与回环验证用。 */
export declare function encodePublish(topic: string, payload: Uint8Array, userProperties?: UserProperties, qos?: 0 | 1, packetId?: number): Uint8Array;
