import { describe, expect, it } from "bun:test";
import { getGtk, getGuid, getSearchId, hash33, qrcDecrypt } from "../util/crypto.js";

describe("crypto 工具集", () => {
  it("hash33 计算散列值", () => {
    expect(hash33("")).toBe(0);
    expect(hash33("", 5381)).toBe(5381);
    expect(typeof hash33("qrsig_test_token")).toBe("number");
    expect(hash33("qrsig_test_token")).toBeGreaterThan(0);
  });

  it("getGtk 计算 g_tk", () => {
    const gtk = getGtk("skey_test");
    expect(typeof gtk).toBe("number");
    expect(gtk).toBeGreaterThan(0);
  });

  it("getGuid 生成 32 位十六进制字符串", () => {
    const guid = getGuid();
    expect(guid).toMatch(/^[0-9a-f]{32}$/);
  });

  it("getSearchId 生成纯数字 ID 字符串", () => {
    const searchId = getSearchId();
    expect(searchId).toMatch(/^\d+$/);
  });

  it("qrcDecrypt 能够正确解密 3DES 加密且 zlib 压缩的 QRC 歌词", () => {
    const hex = "32dabb4c5e9846fa560469176a34222ea5058d71027000f69c774f9ee9d586615e1b72af417869a3";
    const plain = qrcDecrypt(hex);

    expect(plain).toBe("[00:01.00]Hello QQ Music QRC");
  });

  it("qrcDecrypt 处理非法输入时返回 null 或空字符串", () => {
    expect(qrcDecrypt("")).toBeNull();
    expect(qrcDecrypt("1234")).toBeNull();
    expect(qrcDecrypt("invalid_hex_string")).toBeNull();
  });
});
