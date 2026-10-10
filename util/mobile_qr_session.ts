import { Duplex } from "node:stream";
import ws from "ws";
import mqtt from "mqtt";
import { requestCgi } from "./request.js";
import { cookieToString, parseSetCookie } from "./cookie.js";

// Polyfill ws.createWebSocketStream for Bun runtime
const isBun = typeof (globalThis as any).Bun !== "undefined";
if (isBun || typeof (ws as any).createWebSocketStream !== "function") {
  (ws as any).createWebSocketStream = function (socket: any) {
    const duplex = new Duplex({
      read() {},
      write(chunk, enc, cb) {
        if (socket.readyState === 1) {
          socket.send(chunk, cb);
        } else {
          socket.once("open", () => socket.send(chunk, cb));
        }
      },
    });
    socket.on("message", (data: any) => duplex.push(Buffer.isBuffer(data) ? data : Buffer.from(data)));
    socket.on("close", () => duplex.push(null));
    socket.on("error", (err: any) => duplex.destroy(err));
    return duplex;
  };
}

export interface MobileLoginState {
  code: number;
  message: string;
  uin?: string;
  musickey?: string;
  cookieStr?: string;
  createdAt: number;
  client?: mqtt.MqttClient;
}

const mobileSessions = new Map<string, MobileLoginState>();

export function registerMobileSession(qrcodeId: string) {
  if (!qrcodeId) return;

  const existing = mobileSessions.get(qrcodeId);
  if (existing && existing.code === 200) return;
  if (existing && Date.now() - existing.createdAt < 120_000 && existing.client && !existing.client.disconnected) {
    return;
  }

  const now = Date.now();
  for (const [key, s] of mobileSessions.entries()) {
    if (now - s.createdAt > 300_000) {
      try {
        s.client?.end(true);
      } catch {}
      mobileSessions.delete(key);
    }
  }

  const state: MobileLoginState = {
    code: 801,
    message: "等待扫码",
    createdAt: now,
  };
  mobileSessions.set(qrcodeId, state);

  function connectMqtt(path = "/ws/handshake", redirectCount = 0) {
    const clientId = `${Date.now()}${Math.floor(Math.random() * 9000 + 1000)}`;
    const client = mqtt.connect(`wss://mu.y.qq.com${path}`, {
      protocolVersion: 5,
      clientId,
      properties: {
        authenticationMethod: "pass",
        userProperties: {
          tmeAppID: "qqmusic",
          business: "management",
          hashTag: qrcodeId,
          clientTag: "management.user",
          userID: qrcodeId,
        },
      },
    });
    state.client = client;

    client.on("packetreceive", (packet: any) => {
      if (packet.cmd === "connack") {
        if ((packet.reasonCode === 156 || packet.reasonCode === 157) && packet.properties?.serverReference) {
          try {
            client.end(true);
          } catch {}
          if (redirectCount < 3) {
            connectMqtt(`/ws/handshake/${packet.properties.serverReference}`, redirectCount + 1);
          }
        }
      }
    });

    client.on("connect", () => {
      client.subscribe(
        `management.qrcode_login/${qrcodeId}`,
        {
          properties: {
            userProperties: {
              authorization: "tmelogin",
              pubsub: "unicast",
            },
          },
        },
      );
    });

    client.on("message", async (_topic, message, packet: any) => {
      try {
        const type = packet.properties?.userProperties?.type || packet.properties?.type;
        const payload = JSON.parse(message.toString());

        if (type === "scanned") {
          state.code = 802;
          state.message = "已扫码，等待移动端确认";
        } else if (type === "timeout") {
          state.code = 800;
          state.message = "二维码已失效";
          try {
            client.end(true);
          } catch {}
        } else if (type === "canceled") {
          state.code = 803;
          state.message = "用户取消授权";
          try {
            client.end(true);
          } catch {}
        } else if (type === "cookies") {
          const cookies = payload?.cookies || {};
          const uin = cookies.qqmusic_uin?.value || cookies.uin?.value || payload?.uin;
          const key = cookies.qqmusic_key?.value || cookies.qm_keyst?.value || payload?.musickey;
          if (uin && key) {
            let resultCookies: Record<string, string> = {};
            try {
              const loginRes = await requestCgi(
                "music.login.LoginServer",
                "Login",
                {
                  musicid: Number(uin),
                  qrCodeID: qrcodeId,
                  token: String(key),
                },
                { platform: "android" },
              );
              resultCookies = parseSetCookie(loginRes.cookie || []);
            } catch {}

            const cookieObj: Record<string, string> = {
              uin: String(uin),
              qqmusic_uin: String(uin),
              qm_keyst: String(key),
              qqmusic_key: String(key),
            };

            for (const [cookieName, cookieItem] of Object.entries(cookies as Record<string, any>)) {
              if (cookieItem && typeof cookieItem.value === "string") {
                cookieObj[cookieName] = cookieItem.value;
              }
            }

            Object.assign(cookieObj, resultCookies);

            state.code = 200;
            state.message = "登录成功";
            state.uin = String(uin);
            state.musickey = String(key);
            state.cookieStr = cookieToString(cookieObj);
            try {
              client.end(true);
            } catch {}
          }
        }
      } catch {}
    });

    client.on("error", () => {});
  }

  try {
    connectMqtt();
  } catch {}
}

export function getMobileSession(qrcodeId: string): MobileLoginState | undefined {
  return mobileSessions.get(qrcodeId);
}
