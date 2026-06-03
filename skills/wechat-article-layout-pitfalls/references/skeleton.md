# 最小可粘贴 HTML 模板

按白名单标签写的完整模板。直接复制到本地文件，替换占位内容后 Ctrl+V 粘贴到公众号编辑器。

```html
<!--
  公众号推文 HTML 模板
  基于 ProseMirror 编辑器白名单实测（2026-05-26）
  使用前跑一遍 pre-paste-checklist.md 做 lint
-->

<!-- 标题 -->
<h1 style="text-align:center; font-size:24px; color:#333; margin:24px 0 8px;">
  这是标题
</h1>

<!-- 正文 -->
<p style="margin:16px 0; font-size:16px; line-height:1.8; color:#333; text-align:justify;">
  这是正文段落。所有正文必须带 text-align:justify，否则中英文混排右侧参差不齐。
</p>

<!-- 卡片容器：外层 section padding:0 24px 对齐正文；width="100%" 属性；底色 bgcolor 双写 -->
<section style="padding:0 24px; margin:24px 0;">
<table width="100%" bgcolor="#F5F5F5" style="border:0; border-collapse:separate; background-color:#F5F5F5; border-radius:12px;">
  <tr>
    <td bgcolor="#F5F5F5" style="border:0; background-color:#F5F5F5; border-radius:12px;
               border-left:6px solid #3B82F6; padding:24px;">
      <p style="margin:0; font-size:16px; color:#333; text-align:justify;">
        这是卡片内容。用 table>tr>td 做容器（不用 div）。
      </p>
    </td>
  </tr>
</table>
</section>

<!-- 分割线 -->
<table width="100%" style="border:0;">
  <tr><td style="border:0; height:1px; background:#E5E5E5; font-size:0; line-height:1;">&nbsp;</td></tr>
</table>

<!-- 行内高亮 -->
<p style="margin:16px 0; font-size:16px; line-height:1.8; color:#333; text-align:justify;">
  这是正文，其中
  <strong style="background:linear-gradient(180deg, transparent 70%, #FEF3C7 70%);">
    这部分是高亮
  </strong>
  文字。
</p>

<!-- 图片（base64） -->
<!-- 单图编码后 ≤135KB（实测安全线），大图先缩到 800px 宽 -->
<!-- <img src="data:image/png;base64,..."
     style="display:block; width:100%; margin:16px auto;" alt="图片说明"/> -->

<!-- SVG 插图 -->
<!-- 参考 references/svg-pitfalls.md 的完整规则 -->
<!--
<svg xmlns="http://www.w3.org/2000/svg"
     width="800" height="450" viewBox="0 0 800 450"
     style="display: block; vertical-align: middle; max-width: 100%; height: auto; margin: 16px auto;"
     role="img" aria-label="插图">
  <rect width="800" height="450" fill="#F5F5F5" rx="10"/>
</svg>
-->

<!-- 引用块 -->
<blockquote style="margin:24px 0; padding:16px 24px;
                  border-left:4px solid #3B82F6; background:#F8F9FA;">
  <p style="margin:0; font-size:15px; color:#666; text-align:justify;">
    这是引用内容。
  </p>
</blockquote>
```