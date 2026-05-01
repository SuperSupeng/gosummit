# GO Summit 网站 — 待办清单

> 仓库：`git@github.com:SuperSupeng/gosummit.git`  
> 本地：`/data/develop/gosummit/`  
> 最近一次更新：2026-05-01

---

## 站点结构（已落地）

```
/                       品牌主页（Hero · 12 城 marquee · #tour 卡片网格 · Voices · Partners · CTA · Footer）
/cities/<slug>/   ×9    单场活动详情页（Hero+CTA · Agenda · Speakers · Next Stops · Footer）
                        slugs: shanghai-apr / shenzhen-may / singapore-jun / shanghai-jul /
                               hongkong-aug / hangzhou-sep / singapore-oct / shenzhen-nov / dubai-dec
/partner/               sponsor + speaker 招商页（Series / Tour / Stop 三档 + Series / Stop 两档）
/contact/               Monica & Darren 名片（mailto 模版）
```

导航：`ABOUT | TOUR | PARTNER | CONTACT`（4 项）

旧三页 `/agenda` `/speakers` `/attend` 已废弃且已删除（见 #15）。

---

## 待办（7 项 · 5 类）

### 🟡 你 / 团队人工执行

- [x] **#14** 删 4 个图像处理临时文件（已完成：当前无 `assets/*-clean.png`）  
  ```
  rm /data/develop/gosummit/assets/*-clean.png
  ```
- [x] **#15** 删已废弃的 `/agenda` `/speakers` `/attend` 三个目录（已完成）  
  ```
  rm -rf /data/develop/gosummit/{agenda,speakers,attend}
  ```
- [x] **#19** 填 Shenzhen May 真实内容（已完成：日期、场地、21 位确认嘉宾 + 头像）  
  位置：`cities/shenzhen-may/index.html`  
  字段（HTML 里有 `TODO` 注释）：
  - 日期 `<b>May 23, 2026</b>`
  - 场地 `<b>The Westin Shenzhen Nanshan</b>`
  - 嘉宾已替换为确认名单（21 人，含头像）
  - 议程时间细节后续如需再微调
- [ ] **#20** Monica 在 Luma 建 9 个 event  
  - 每城一个独立 event
  - 全部挂到一个 GO Summit Calendar / Series 下
  - 给 Claude 9 个 evt-id（或完整 lu.ma URL）触发 #21

### 🎨 等设计师素材

- [ ] **#16** 透明 logo（PNG with alpha 或 SVG）  
  `assets/go-summit-logo.png` `assets/just-go-logo.png` `assets/agivilla-white-logo.png`  
  当前文件后缀是 .png，实际是 JPEG（无 alpha 通道）
- [ ] **#17** 透明头像 `assets/contact-darren.png` `assets/contact-monica.png`
- [ ] **#22** Partners logo 收齐  
  - 首页 `#partners` 段 12 格
  - `/partner` 页 `#past` 段 6 格

### ⚖️ 你拍板

- [x] **#23** 部署平台选型（已确认 Vercel）  
  当前选择：Vercel
- [x] **#24** 域名邮箱 + 发件方案（已拍板）  
  收件：企业微信邮箱（`info@agivilla.com` 已可收信）  
  发件：Resend（`hello@agivilla.com`）  
  待执行：确认 `hello@agivilla.com` 在 Resend 已验证并完成 SPF/DKIM/DMARC

### 🛠 Claude 能做（被上面事项 block）

- [ ] **#18** 收到透明素材 → CSS 切换  
  blocked by #16 #17  
  - 5 页 nav `.wordmark-logo` 从 `mask-image:luminance` 改为直接 `background-image` / `<img>`
  - `/contact` 头像去掉 `border:1px solid var(--line)`
- [ ] **#21** 把 Luma URL 填进 9 城 CTA  
  blocked by #20  
  - 替换每页 hero `.btn.primary` 的 mailto 为 `https://lu.ma/<id>` `target="_blank"`
  - 未建的城市保留 Notify-me mailto fallback
- [x] **#25** 首页 footer Subscribe 接后端（已完成代码）  
  当前：默认调用 `/api/subscribe`；失败时回退 `mailto`。  
  Vercel 环境变量：`RESEND_API_KEY`、`RESEND_AUDIENCE_ID`、`RESEND_FROM_EMAIL`
- [x] **#27** 城市页 Hero 加 Add to Calendar 按钮（ICS）  
  已决策：不做该功能（非必要，避免维护成本）

### 🚀 部署上线

- [ ] **#26** agivilla.com DNS（MX/SPF/DKIM/DMARC）+ gosummit.ai 部署到选定平台 + 生产环境验证  
  当前状态：#23/#24 已拍板，待做 Vercel 环境变量 + DNS 终验 + 线上回归

---

## 关键解锁路径

```
最该先动的两条线：

  #23 部署平台 ──┐
                 ├──→ #25 Subscribe 后端
  #24 邮箱方案 ──┤
                 └──→ #26 部署上线

  #19 Shenzhen 内容 ───→ #27 ICS 按钮 ───→ 网站脱离"占位状态"

  #20 Luma events ─────→ #21 9 城 CTA 替换 ───→ 报名链路全活
```

---

## 已确认架构决策

- **网站只做"展示 + 路由"**，每个真功能 outsource：
  - 报名 → **Luma**（每城一 event，挂到一个 series；点击跳转新标签，不嵌入 iframe）
  - Speak → **mailto monica@agivilla.com**（带模版）
  - Sponsor → **mailto darren@agivilla.com**（带模版）
  - Subscribe → **Resend**（`/api/subscribe` 已就绪，待线上环境变量生效）
  - Inbound 收件 → **企业微信邮箱**（`info@/monica@/darren@agivilla.com` 已可收信）
- **邮箱域**：`agivilla.com`（不是 gosummit.ai；后者只是网站域）
- **Speak / Sponsor 双轨**：series-level + per-stop，统一进 `/partner`，不再嵌在每个城市页底部
- **数据架构暂不自建 DB**：每条线让专业 SaaS 各自管自己的数据（Luma 管报名，Resend 管订阅），未来需要时再做汇总层

---

## mailto 域分布（共 31 处）

```
22 × info@agivilla.com    （9 城 Notify me + 各页 footer + 兜底）
 5 × darren@agivilla.com  （/partner Series/Tour/Stop 各 1 + 兜底 + /contact）
 4 × monica@agivilla.com  （/partner Series/Stop 各 1 + 兜底 + /contact）
```

模版字段统一格式：`subject` 中英双语、`body` 含必填字段引导（Name / Title·Company / City / 等）。
