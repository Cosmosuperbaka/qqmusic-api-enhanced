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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** MQTT 变长整数编码（最多 4 字节）。 */
export function encodeVarInt(value: number): number[] {
  if (!Number.isInteger(value) || value < 0 || value > 268_435_455) {
    throw new RangeError(`MQTT 变长整数越界: ${value}`);
  }
  const bytes: number[] = [];
  let rest = value;
  do {
    let byte = rest % 128;
    rest = Math.floor(rest / 128);
    if (rest > 0) byte |= 0x80;
    bytes.push(byte);
  } while (rest > 0);
  return bytes;
}

/** 读取变长整数；数据不足返回 undefined。 */
export function decodeVarInt(
  data: Uint8Array,
  offset: number
): { value: number; length: number } | undefined {
  let multiplier = 1;
  let value = 0;
  for (let i = 0; i < 4; i += 1) {
    const byte = data[offset + i];
    if (byte === undefined) return undefined;
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) return { value, length: i + 1 };
    multiplier *= 128;
  }
  throw new Error("MQTT 变长整数格式错误");
}

const encodeString = (value: string): number[] => {
  const bytes = textEncoder.encode(value);
  return [(bytes.length >> 8) & 0xff, bytes.length & 0xff, ...bytes];
};

const encodeUserProperties = (props: UserProperties | undefined): number[] => {
  const out: number[] = [];
  for (const [key, value] of Object.entries(props ?? {})) {
    out.push(0x26, ...encodeString(key), ...encodeString(value));
  }
  return out;
};

const frame = (firstByte: number, body: number[]): Uint8Array =>
  Uint8Array.from([firstByte, ...encodeVarInt(body.length), ...body]);

export interface ConnectOptions {
  clientId: string;
  keepAliveSeconds: number;
  authenticationMethod?: string;
  userProperties?: UserProperties;
}

export function encodeConnect(options: ConnectOptions): Uint8Array {
  const props: number[] = [];
  if (options.authenticationMethod) {
    props.push(0x15, ...encodeString(options.authenticationMethod));
  }
  props.push(...encodeUserProperties(options.userProperties));
  const body = [
    ...encodeString("MQTT"),
    5, // 协议级别：MQTT 5.0
    0x02, // 连接标志：Clean Start
    (options.keepAliveSeconds >> 8) & 0xff,
    options.keepAliveSeconds & 0xff,
    ...encodeVarInt(props.length),
    ...props,
    ...encodeString(options.clientId),
  ];
  return frame(0x10, body);
}

export function encodeSubscribe(
  packetId: number,
  topic: string,
  userProperties?: UserProperties
): Uint8Array {
  const props = encodeUserProperties(userProperties);
  const body = [
    (packetId >> 8) & 0xff,
    packetId & 0xff,
    ...encodeVarInt(props.length),
    ...props,
    ...encodeString(topic),
    0x00, // 订阅选项：QoS 0
  ];
  return frame(0x82, body);
}

export const encodePuback = (packetId: number): Uint8Array =>
  frame(0x40, [(packetId >> 8) & 0xff, packetId & 0xff]);
export const encodePingreq = (): Uint8Array => Uint8Array.from([0xc0, 0x00]);
export const encodeDisconnect = (): Uint8Array => Uint8Array.from([0xe0, 0x00]);

interface ParsedProperties {
  userProperties: UserProperties;
  serverReference?: string;
  end: number;
}

const readString = (data: Uint8Array, offset: number): { value: string; end: number } => {
  const length = ((data[offset] ?? 0) << 8) | (data[offset + 1] ?? 0);
  const end = offset + 2 + length;
  if (end > data.length) throw new Error("MQTT 字符串越界");
  return { value: textDecoder.decode(data.subarray(offset + 2, end)), end };
};

/** 解析属性块；只关心 User Property 与 Server Reference，其余类型按规范长度跳过。 */
function parseProperties(data: Uint8Array, offset: number): ParsedProperties {
  const header = decodeVarInt(data, offset);
  if (!header) throw new Error("MQTT 属性长度缺失");
  let cursor = offset + header.length;
  const end = cursor + header.value;
  if (end > data.length) throw new Error("MQTT 属性越界");
  const userProperties: UserProperties = {};
  let serverReference: string | undefined;

  while (cursor < end) {
    const id = data[cursor] ?? 0;
    cursor += 1;
    if (id === 0x26) {
      const key = readString(data, cursor);
      const value = readString(data, key.end);
      userProperties[key.value] = value.value;
      cursor = value.end;
    } else if (id === 0x1c) {
      const ref = readString(data, cursor);
      serverReference = ref.value;
      cursor = ref.end;
    } else if ([0x03, 0x08, 0x09, 0x12, 0x15, 0x16, 0x1a, 0x1f].includes(id)) {
      // 字符串/二进制类：2 字节长度前缀
      const length = ((data[cursor] ?? 0) << 8) | (data[cursor + 1] ?? 0);
      cursor += 2 + length;
    } else if ([0x01, 0x17, 0x19, 0x24, 0x25, 0x28, 0x29, 0x2a].includes(id)) {
      cursor += 1; // 单字节
    } else if ([0x13, 0x21, 0x22, 0x23].includes(id)) {
      cursor += 2; // 双字节
    } else if ([0x02, 0x11, 0x18, 0x27].includes(id)) {
      cursor += 4; // 四字节
    } else if (id === 0x0b) {
      const v = decodeVarInt(data, cursor);
      if (!v) throw new Error("MQTT 属性变长整数缺失");
      cursor += v.length;
    } else {
      throw new Error(`未知 MQTT 属性 0x${id.toString(16)}`);
    }
  }
  return { userProperties, serverReference, end };
}

/** 从缓冲区切出完整报文；返回解析结果与剩余字节。数据不足时 packets 可能为空。 */
export function decodePackets(buffer: Uint8Array): { packets: MqttPacket[]; rest: Uint8Array } {
  const packets: MqttPacket[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const first = buffer[offset] ?? 0;
    const len = decodeVarInt(buffer, offset + 1);
    if (!len) break;
    const bodyStart = offset + 1 + len.length;
    const bodyEnd = bodyStart + len.value;
    if (bodyEnd > buffer.length) break;
    const body = buffer.subarray(bodyStart, bodyEnd);
    packets.push(decodeBody(first, body));
    offset = bodyEnd;
  }
  return { packets, rest: buffer.slice(offset) };
}

function decodeBody(first: number, body: Uint8Array): MqttPacket {
  const type = first >> 4;
  if (type === 2) {
    // CONNACK: 确认标志、原因码、属性
    const reasonCode = body[1] ?? 0;
    let serverReference: string | undefined;
    if (body.length > 2) serverReference = parseProperties(body, 2).serverReference;
    return { type: "connack", reasonCode, serverReference };
  }
  if (type === 9) {
    const packetId = ((body[0] ?? 0) << 8) | (body[1] ?? 0);
    const props = decodeVarInt(body, 2);
    const start = props ? 2 + props.length + props.value : 2;
    return { type: "suback", packetId, reasonCodes: Array.from(body.subarray(start)) };
  }
  if (type === 3) {
    const qos = ((first >> 1) & 0x03) as 0 | 1 | 2;
    const topic = readString(body, 0);
    let cursor = topic.end;
    let packetId: number | undefined;
    if (qos > 0) {
      packetId = ((body[cursor] ?? 0) << 8) | (body[cursor + 1] ?? 0);
      cursor += 2;
    }
    const props = parseProperties(body, cursor);
    return {
      type: "publish",
      topic: topic.value,
      qos,
      packetId,
      payload: body.slice(props.end),
      userProperties: props.userProperties,
    };
  }
  if (type === 13) return { type: "pingresp" };
  if (type === 14) return { type: "disconnect", reasonCode: body[0] };
  if (type === 4) return { type: "puback" };
  return { type: "other" };
}

/** 编码 PUBLISH（QoS 0/1）。本库只订阅不发布，主要给测试夹具与回环验证用。 */
export function encodePublish(
  topic: string,
  payload: Uint8Array,
  userProperties?: UserProperties,
  qos: 0 | 1 = 0,
  packetId = 1
): Uint8Array {
  const props = encodeUserProperties(userProperties);
  const body = [
    ...encodeString(topic),
    ...(qos > 0 ? [(packetId >> 8) & 0xff, packetId & 0xff] : []),
    ...encodeVarInt(props.length),
    ...props,
    ...payload,
  ];
  return frame(0x30 | (qos << 1), body);
}
