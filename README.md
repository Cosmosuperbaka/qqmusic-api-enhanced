# qqmusic-api-enhanced

QQ 音乐增强版 Node.js / Bun API 客户端，基于 QQ 音乐逆向协议与签名机制实现。项目架构与设计风格严格对齐 `@neteasecloudmusicapienhanced/api`，旨在为音乐播放器、猜歌游戏（如 SonGuessr）、数据分析等应用提供开箱即用、零外部生产依赖的纯 TypeScript 解决方案。

---

## 特性亮点

- **零外部生产依赖**：纯 TypeScript 编写，直接利用 Node.js / Bun 原生 `crypto`、`zlib`、`fetch`，无需安装 heavy C++ 插件或额外加密包。
- **全平台扫码登录**：支持手机 QQ 快捷扫码、微信网页扫码、QQ 音乐移动端 App 扫码，玩家可自主完成身份凭据提取与长效刷新。
- **VKey 播放直链提取**：基于 `UrlGetVkey` 逆向调度，支持 128kbps (mp3)、320kbps (高品质 mp3)、FLAC (无损)、M4A 以及试听片段直链解析。
- **QRC 逐字歌词解密**：内置原生定制版 Triple-DES（支持 QQ 音乐特定 PC-2 偏移置换）及 zlib 解压算法，自动将加密 QRC 转换为带时间戳的明文逐字歌词。
- **完整类型支持**：提供详尽的 `interface.d.ts` 类型定义，全面涵盖入参参数、返回格式与枚举项。

---

## 安装

```bash
# npm
npm install qqmusic-api-enhanced

# pnpm
pnpm add qqmusic-api-enhanced

# bun
bun add qqmusic-api-enhanced
```

---

## 快速上手

### 1. 基础调用与默认导出

```typescript
import qqmusic, { song_detail, song_url, lyric } from "qqmusic-api-enhanced";

// 获取歌曲详情 (支持数字 ID 或字符串 MID)
const detail = await song_detail({ id: "0039MnYb0qxYAc" });
console.log(detail.body.data.track_info.name); // 晴天

// 获取播放音频 CDN 直链 (支持 '128' | '320' | 'flac' | 'm4a' | 'try')
const urlRes = await song_url({
  id: "0039MnYb0qxYAc",
  type: "320",
  cookie: "uin=12345678; qm_keyst=YOUR_COOKIE_KEY", // VIP/付费歌曲需传入有效 Cookie
});
console.log(urlRes.body.data[0].url);

// 获取歌词 (包含普通 LRC 与自动解密的逐字 QRC)
const lyricRes = await lyric({ id: "0039MnYb0qxYAc", qrc: true });
console.log(lyricRes.body.lyric);
```

### 2. 玩家自助扫码登录流程

```typescript
import { login_qr_create, login_qr_check, login_status } from "qqmusic-api-enhanced";

// 第一步：生成二维码 (支持 'qq' | 'wx' | 'mobile')
const qr = await login_qr_create({ type: "qq" });
console.log("扫码链接:", qr.body.url);
console.log("二维码 Base64 图片:", qr.body.qrimg);

// 第二步：轮询扫码状态 (需传入 第一步返回的 qrsig 或 uuid)
const timer = setInterval(async () => {
  const check = await login_qr_check({
    type: "qq",
    qrsig: qr.body.qrsig,
  });

  if (check.body.code === 200) {
    clearInterval(timer);
    console.log("登录成功！用户 uin:", check.body.uin);
    console.log("获取到的 Cookie 字符串:", check.body.cookieStr);

    // 第三步：验证登录状态
    const status = await login_status({ cookie: check.body.cookieStr });
    console.log("用户信息:", status.body.userInfo);
  } else if (check.body.code === 800) {
    clearInterval(timer);
    console.log("二维码已过期，请重新生成");
  } else {
    console.log("等待用户扫码/确认中:", check.body.message);
  }
}, 2000);
```

---

## API 列表

| 模块名称 | 功能说明 | 关键参数 | 备注 |
|---|---|---|---|
| `login_qr_create` | 创建登录二维码 | `type?: 'qq' \| 'wx' \| 'mobile'` | 返回二维码 Base64 图片与轮询凭据 |
| `login_qr_check` | 轮询二维码扫码结果 | `type, qrsig?, uuid?` | 登录成功后直接返回完整 Cookie |
| `login_status` | 校验当前登录态 | `cookie?: string` | 检查 Cookie 有效性与用户账号信息 |
| `login_refresh` | 刷新登录凭证 | `cookie?: string` | 延长 musickey / qm_keyst 有效期 |
| `song_detail` | 歌曲详情元数据 | `id: string \| number` | 支持纯数字 song_id 或字符串 mid |
| `song_url` | 提取歌曲音频 CDN 直链 | `id, type?: '128'\|'320'\|'flac'\|'m4a'\|'try'` | 自动计算 VKey 与 CDN 地址拼接 |
| `lyric` | 获取歌曲歌词 | `id, qrc?: boolean, trans?: boolean` | 自动执行定制 Triple-DES 解密 QRC |
| `playlist_detail` | 获取歌单基本信息 | `id: string \| number` | 歌单 disstid |
| `playlist_track_all` | 歌单全量曲目分页展开 | `id, limit?: number, offset?: number` | 最大支持每次抓取 1000 首歌曲 |
| `artist_detail` | 歌手主页详情 | `id: string` (歌手 mid) | 歌手基本资料与统计信息 |
| `artist_songs` | 歌手单曲列表分页 | `id, page?: number, limit?: number, order?: number` | 分页拉取歌手所有歌曲 |
| `search` | 综合分类检索 | `keywords, type?: 0\|1\|2\|3\|7, page?, limit?` | 0-单曲, 1-歌手, 2-专辑, 3-歌单, 7-歌词 |
| `user_detail` | 用户主页信息 | `id?: string \| number` (uin) | 查询指定或当前登录用户的公开资料 |
| `user_playlist` | 用户创建与收藏歌单 | `id?: string \| number, limit?: number` | 获取用户歌单列表 |
| `recommend_songs` | 热门与新歌推荐 | `type?: 1\|2\|3\|4` | 1-华语, 2-欧美, 3-韩国, 4-日本 |

---

## 底层工具集导出

本包同时导出所有基础密码学与网络方法，便于深度定制：

```typescript
import {
  zzcSign,     // 计算 QQ 音乐客户端请求的 zzc 签名
  qrcDecrypt,  // 独立解密 QRC 逐字歌词 (Triple-DES 变体 + zlib)
  hash33,      // 经典 hash33 哈希计算
  getGtk,      // 从 skey 计算 g_tk
  getGuid,     // 生成设备与会话 32 位 GUID
  getStableGuid, // 由账号/二维码会话派生稳定设备 GUID
  mergeLoginPayloadCookies, // 合并登录/续期响应中的凭证字段
  request,     // 统一网络调度器 (自动判断 cgi 或 raw http)
  requestCgi,  // 请求 musicu.fcg / musics.fcg
  requestRaw,  // 原始 fetch 包装
} from "qqmusic-api-enhanced";
```

---

## 发布

版本号在 `package.json`；发布由 GitHub Actions 自动完成：

1. 修改 `package.json` 的 `version`，提交并推送。
2. 打标签并推送：`git tag v1.0.7 && git push origin v1.0.7`。
3. `.github/workflows/publish.yml` 会安装依赖、构建、测试，并通过 npm Trusted Publishing（OIDC）执行 `npm publish --provenance`；不需要 `NPM_TOKEN`，也不需要 OTP。

首次配置（npm 控制台，一次性）：

- 打开 npmjs.com 上 `qqmusic-api-enhanced` 的 Settings → Trusted Publisher。
- 选择 GitHub Actions，填写仓库 `owner/repo`、workflow 文件名 `publish.yml`、Environment 留空。
- workflow 文件名必须与 npm 侧逐字一致；如果 npm 侧填了 Environment，要同步把它加到 workflow 的 job 上。

也可以在 Actions 页面手动 `workflow_dispatch` 重跑；tag 触发时会先校验 tag 与 `package.json` 版本一致，不一致直接失败，避免发错版本。

---

## 协议与免责声明

本项目仅供个人学习、技术研究与教育用途。所有接口数据与媒体资源版权归腾讯公司所有。请勿将本项目用于任何商业用途或违反相关法律法规的场景。
