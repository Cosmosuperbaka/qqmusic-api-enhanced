import { describe, expect, it } from "bun:test";
import { zzcSign } from "../util/sign.js";

describe("zzcSign 签名算法", () => {
  it("签名应当以 zzc 开头并且格式符合规范", () => {
    const payload = JSON.stringify({ comm: { ct: 24, cv: 0 }, req_0: { module: "music.vkey.GetVkey", method: "UrlGetVkey", param: {} } });
    const sign = zzcSign(payload);

    expect(sign.startsWith("zzc")).toBe(true);
    expect(sign.length).toBeGreaterThan(10);
    // 签名应替换特殊字符，不含 '/'
    expect(sign).not.toContain("/");
  });

  it("相同输入应当产生确定性的签名", () => {
    const payload = JSON.stringify({ test: "baka", num: 12345 });
    const sign1 = zzcSign(payload);
    const sign2 = zzcSign(payload);

    expect(sign1).toBe(sign2);
  });

  it("支持 Buffer 输入", () => {
    const buf = Buffer.from("hello qq music sign");
    const sign = zzcSign(buf);

    expect(sign.startsWith("zzc")).toBe(true);
  });
});
