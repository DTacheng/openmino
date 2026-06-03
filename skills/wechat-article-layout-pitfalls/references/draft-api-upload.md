# 一键上传到公众号草稿箱（draft API）

**核心结论（2026-06-03 核实官方文档 + 实测口径）：** 公众号草稿箱接口 `draft/add` 是真实可用的，能把一篇 HTML 文章直接推进后台「草稿箱」，省掉手动 Ctrl+V。**关于谁能用、和一个大坑：**

1. **账号权限（别写死"只有认证号能用"）：**
   - **创建草稿这一步，个人/未认证订阅号实测可行**。135 / 壹伴等第三方工具能把文章同步进个人号草稿箱，走的就是 `draft/add`。
   - **2025-07 被回收的是 API 自动"群发/发布"（freepublish）能力**——"直接推给粉丝"那一步，对个人主体/未认证号关闭。**创建草稿 ≠ 发布**，两件事分开。早期 skill 把"草稿 API"整体当死路、说"个人号一律走不通"是**把这两步混为一谈了，已纠正**。
   - 官方口径不统一：少数个人号**直连** `draft/add` 报 `48001 api unauthorized`，而开发者平台又显示有权限——平台侧不一致。遇到就按下面错误码表的 48001 处理。
   - **不变的是最后一步**：个人/未认证号的"发布/群发给粉丝"必须人工在手机端【公众号助手】点，API 不代劳。本 skill 脚本只做到草稿箱为止，正好落在个人号能用的范围内。
2. **大坑 —— 正文里的图片不能用 base64**。`draft/add` 的 `content` 字段虽然支持 HTML，但官方明确："涉及图片 url 必须来源'上传图文消息内的图片'接口获取，外部图片 url 将被过滤"。**base64 data URI 会被直接过滤掉**。所以草稿 API 工作流和手动粘贴工作流的图片处理是相反的：手动粘贴只认 base64，草稿 API 只认微信图床 URL。

> 两条工作流并存：
> - **手动粘贴**（本 skill 主线）：图片走 base64，Ctrl+V 进编辑器。任何账号都能用。
> - **草稿 API**（本文）：图片先传微信换 URL，一键进草稿箱。个人/未认证号通常也能用（至少创建草稿），需要一台能跑脚本、IP 可加白名单的机器。

---

## 一、前置配置（公众号后台，一次性）

1. **账号类型**：个人/未认证订阅号通常也能创建草稿（见上文「核心结论」）。若直连报 48001，再考虑认证或走第三方授权。注意"发布/群发给粉丝"个人号仍需手机端手动点。
2. **拿 AppID / AppSecret**：mp.weixin.qq.com →「设置与开发 → 开发 → 基本配置」。AppSecret 只在重置时显示一次，妥善保存。
3. **配 IP 白名单**：同页「公众号开发信息 → IP 白名单」，把**运行脚本那台机器的公网出口 IP** 加进去。不加的话 `stable_token` 会报 `40164 invalid ip not in whitelist`。
   - 本地家用宽带 IP 会变，建议用固定公网 IP 的云服务器；或每次跑前更新白名单。
4. **草稿箱开关**：新号若调 `draft/add` 报错提示草稿箱未开启，调一次「草稿箱开关设置」`draft/switch` 打开（多数已认证号默认已开）。

---

## 二、完整接口链路

四步，全部在服务器端用 HTTPS 调用（不能在前端/网页直接调，access_token 一旦泄露等于账号被接管）。

### 步骤 1：获取 access_token（用稳定版）

```
POST https://api.weixin.qq.com/cgi-bin/stable_token
Body(JSON): {"grant_type":"client_credential","appid":"APPID","secret":"APPSECRET"}
→ {"access_token":"...", "expires_in":7200}
```

- 有效期 7200 秒，**自己缓存复用**，别每次都拉（强制刷新每天限 20 次）。
- 推荐 `stable_token` 而非老的 `cgi-bin/token`，两者隔离、更稳。

### 步骤 2：正文图片逐张上传，换成微信 URL（最关键）

正文 HTML 里每个 `<img>`（base64 / 本地文件 / 外链都一样）都要先传到微信图床：

```
POST https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=ACCESS_TOKEN
Body(form-data): media=@图片文件
→ {"url":"https://mmbiz.qpic.cn/XXXX", "errcode":0}
```

- **只支持 jpg/png，大小必须 < 1MB**（base64 ≤135KB 的图换算后远低于 1MB，没问题）。
- 不占用素材库 10 万张配额。
- 把返回的 `url` 替换回 HTML 里对应 `<img src="...">`。

### 步骤 3：封面图上传为永久素材，拿 thumb_media_id

`article_type=news`（普通图文）的封面 `thumb_media_id` **必填**，且必须是**永久** MediaID：

```
POST https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=ACCESS_TOKEN&type=image
Body(form-data): media=@封面图.jpg
→ {"media_id":"...", "url":"..."}
```

- 这个 `media_id` 才能填进 `thumb_media_id`。注意它**会**占用永久素材配额（步骤 2 的 uploadimg 不占）。
- 封面图建议单独准备一张（1:1 或 2.35:1），没有就拿正文首图。

### 步骤 4：新增草稿

```
POST https://api.weixin.qq.com/cgi-bin/draft/add?access_token=ACCESS_TOKEN
Body(JSON):
{
  "articles": [{
    "article_type": "news",
    "title": "标题（≤32字）",
    "author": "作者（≤16字）",
    "digest": "摘要（≤128字，留空则抓正文前54字）",
    "content": "<整篇 HTML，图片已是 mmbiz URL>",
    "content_source_url": "阅读原文链接（可选）",
    "thumb_media_id": "步骤3拿到的封面 media_id",
    "need_open_comment": 0,
    "only_fans_can_comment": 0
  }]
}
→ {"media_id":"草稿的 media_id"}
```

成功后到 mp.weixin.qq.com 后台「草稿箱」就能看到这篇，可以再人工预览、调封面、群发/发布。

> **注意：草稿 API 只负责"进草稿箱"，不自动群发。** 真正推送给粉丝要么后台手动点发表，要么再调「发布草稿」`freepublish/submit`（认证订阅号每天群发次数仍受平台限制）。本 skill 的脚本只做到草稿箱为止——更安全，留人工最后一道关。

---

## 三、content 字段的约束（写 HTML 时注意）

- `content` 支持 HTML 标签，但 **JS 会被去除**。
- **总大小 < 1MB、字符数 < 20000**。base64 图片被过滤后正文体积通常很小，反而是没替换干净的 base64 会撑爆 1MB。
- 图片 URL **只认微信图床域名**（mmbiz.qpic.cn 等），外链/base64 一律过滤 → 步骤 2 必须做。
- 草稿 API 的 content 会经过一次服务端清洗，清洗规则与"编辑器粘贴白名单"**不完全相同**。本 skill 的 HTML 排版规则（table 容器、inline style、bgcolor 双写等）依然适用且更保险。
- **inline `<svg>` 经 draft API 是否保留没有官方保证**（编辑器手动粘贴是确认零过滤的，但接口清洗链路不同）。稳妥做法：走草稿 API 时把 SVG 先栅格化成 PNG（≤1MB）当普通图片走步骤 2；需要保留 SVG 动画就回退到手动粘贴工作流。

---

## 四、常见错误码

| 错误码 | 含义 | 处理 |
|---|---|---|
| 40164 | IP 不在白名单 | 把出口 IP 加进后台 IP 白名单 |
| 48001 | api unauthorized / 无此接口权限 | 个别个人号直连会遇到（平台口径不一致）。①后台「接口权限」确认草稿/素材项；②改走第三方平台授权 authorizer_access_token；③后台反馈申诉。不代表所有个人号都不能用 |
| 40013 | invalid appid | 检查 AppID |
| 40125 | invalid appsecret | 检查 AppSecret，必要时后台重置 |
| 45009 | 超天级调用频率 | 次日恢复，或调 clear_quota |
| 40005 / 40009 | 图片格式不对 / 尺寸太大 | uploadimg 只收 jpg/png 且 <1MB |
| 53404~53406 | 带货/商品相关 | 与图文上传无关，检查是否误传 product_info |

---

## 五、配套脚本

`scripts/upload_to_draft.py` —— 输入一个 `_公众号可粘贴版.html`，自动完成步骤 1–4：取 token（带本地缓存）、把 base64 / 本地图片逐张 uploadimg 换 URL、上传封面拿 thumb_media_id、调 draft/add，最后打印草稿 media_id。用法见脚本头部注释。

凭证通过环境变量传入，**不要把 AppSecret 写进代码或提交到 git**：

```bash
export WX_APPID=wx......
export WX_APPSECRET=........
python3 scripts/upload_to_draft.py 13_xxx_公众号可粘贴版.html --title "标题" --author "作者" --cover 封面.jpg
```

---

## 六、来源

- 新增草稿 draft/add：https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html
- 上传发表内容中的图片 uploadimg：https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_uploadimage.html
- 获取稳定版 access_token：https://developers.weixin.qq.com/doc/subscription/api/base/api_getstableaccesstoken.html
- 账号权限相关社区讨论（口径不一，含个人号直连 48001 与第三方授权可用的案例）：https://developers.weixin.qq.com/community/minihome/doc/000a80660141289144b4b9d4b6bc00
