# Avalon Miniprogram — Skin Asset Specification

> 这份文档是给 GPT / DALL-E 生成皮肤素材用的标准规范。  
> 每一条都包含：技术规格、命名规则、以及可直接粘贴进 GPT 的 prompt 模板。

---

## 一、资产总览

| 类别 | 数量 | 是否需要皮肤变体 | 说明 |
|------|------|----------------|------|
| 背景图 · 主页 (`home-bg`) | 6 | ✅ 每皮肤一张 | 全屏背景，主页/大厅 |
| 背景图 · 游戏中 (`in-game-bg`) | 6 | ✅ 每皮肤一张 | 全屏背景，游戏中/历史 |
| 圆桌贴图 (`table`) | 6 | ✅ 每皮肤一张 | 座位视图的桌面纹理 |
| 角色卡图 (`role-split/*`) | 11 × 6 = 66 | ✅ 每皮肤一套 | 11 个角色的半身画像 |
| UI 图标 · 历史 (`history_scroll`) | 1 | ⚪ 通用单版 | 导航按钮图标 |
| UI 图标 · 统计 (`stats_bars`) | 1 | ⚪ 通用单版 | 导航按钮图标 |
| UI 图标 · 刺杀 (`kill`) | 1 | ⚪ 通用单版 | 刺客/刺杀动画图标 |
| 任务结果 · 成功 (`quest-success`) | 1 | ⚪ 通用单版 | 任务完成弹出动画 |
| 任务结果 · 失败 (`quest-failed`) | 1 | ⚪ 通用单版 | 任务失败弹出动画 |
| 勋章图标 (`medals/*`) | 23 | ⚪ 通用单版 | 成就徽章，见附录 |

---

## 二、技术规格

### 背景图（home-bg / in-game-bg）
```
尺寸：750 × 1334 px（微信小程序标准竖屏）
格式：JPG，质量 85+
命名：{skin-id}-home-bg.jpg / {skin-id}-in-game-bg.jpg
用法：全屏 cover，上方叠加半透明深色遮罩（dark skins 约 0.7 透明度，light skins 不叠加遮罩）
注意：画面重心在上半部，底部 400px 会被 UI 面板覆盖
```

### 圆桌贴图（table）
```
尺寸：600 × 600 px
格式：PNG（需要透明背景，只画桌面圆形）
命名：{skin-id}-table.png
用法：圆形裁切展示，直径约 520px 有效区域
内容：俯视视角的圆桌桌面，中间空，用于 8 个座位围绕
```

### 角色卡图（role-split）
```
尺寸：400 × 480 px（4:4.8 接近正方形）
格式：PNG
命名：{skin-id}/merlin.png、{skin-id}/percival.png 等（见角色文件名列表）
用法：在 88 × 88 px 圆形区域展示，面部必须居中在图片上半部
构图：胸像/半身，主体占画面 70%+，背景配合皮肤风格
```

### UI 图标（ui-icons）
```
尺寸：120 × 120 px
格式：PNG，透明背景
命名：history_scroll.png / stats_bars.png / kill.png
用法：40 × 40 px 展示，细节要清晰
风格：统一使用带描边的厚线条图标，背景透明
```

### 任务结果图（quest-success / quest-failed）
```
尺寸：420 × 300 px
格式：PNG 或 JPG
命名：quest-success-420x300.png / quest-failed-420x300.png
用法：弹出卡片中展示，配合文字标题
内容：戏剧性插图（非 icon），表达任务胜利/失败的情绪
```

### 勋章图标（medals）
```
尺寸：120 × 120 px
格式：PNG，透明背景
命名：{medal-code}.png（见附录勋章列表）
用法：60 × 60 px 圆形展示
风格：徽章/勋章设计，中间主图标+外圈装饰框
```

---

## 三、皮肤视觉规范

### CDN 路径结构
```
https://www.awalon.top/mp-assets/
├── home-bg-optimized.jpg              ← 当前 dark-gold 主页背景
├── in-game-bg-optimized.jpg           ← 当前 dark-gold 游戏背景
├── table.png                          ← 当前 dark-gold 圆桌
├── role-split/                        ← 当前 dark-gold 角色图
│   ├── merlin.png
│   ├── percival.png
│   ├── arthur_loyal.png
│   ├── assassin.png
│   ├── morgana.png
│   ├── mordred.png
│   ├── oberon.png
│   ├── minion.png
│   ├── lancelot_good.png
│   └── lancelot_evil.png
├── ui-icons/
│   ├── history_scroll.png
│   ├── stats_bars.png
│   └── kill.png
├── quest-success-420x300.png
├── quest-failed-420x300.png
└── medals/
    └── {medal-code}.png

# 新皮肤资产放在子目录下，例如：
# mp-assets/skins/celestial/home-bg.jpg
# mp-assets/skins/celestial/role-split/merlin.png
# mp-assets/skins/celestial/table.png
```

---

### Skin 1：暗夜金（dark-gold）— 当前默认，已有素材

**视觉定义**
- 主题：中世纪黑暗奇幻，亚瑟王城堡，烛光石墙
- 底色：深海军蓝近黑 `#0f1115`，暖金 `#d9b36b`
- 氛围：神秘、高贵、压抑中透出微光
- 参考风格：dark fantasy oil painting，Gothic illuminated manuscript

**背景 prompt 模板**
```
[home-bg] Dark fantasy medieval castle great hall at night, 
candlelit stone walls with golden banners bearing a sword emblem, 
misty atmosphere, dramatic chiaroscuro lighting, deep navy and 
charcoal tones with warm gold highlights, cinematic, 
highly detailed oil painting style, 750x1334 vertical, 
no text, no UI elements, bottom third darker for UI overlay
```
```
[in-game-bg] Dark Arthurian throne room interior, round table 
at center obscured by shadow, candlelight glowing from wall 
sconces, stone arches, dramatic shadows, deep navy-black 
with gold and amber light, moody atmosphere, oil painting, 
750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of a medieval round table, dark oak wood texture 
with carved sword-and-shield emblem in center, gold inlay 
decorative border, worn stone surface underneath, dark fantasy 
aesthetic, 600x600 square, transparent PNG background, 
no chairs, no figures
```

---

### Skin 2：仙境（celestial）— 需要生成

**视觉定义**
- 主题：空灵仙境，云端宫殿，光与雾
- 底色：天蓝白 `#ddeeff`，宝蓝 `#2e7fc8`，大量白色留白
- 氛围：轻盈、纯净、如梦如幻
- 参考风格：Studio Ghibli background art, ethereal Chinese fairy tale, watercolor
- **Light skin — 不叠遮罩，背景要明亮**

**背景 prompt 模板**
```
[home-bg] Ethereal celestial palace floating above clouds, 
soft blue and white color palette, glowing fairy lights, 
misty waterfalls, delicate architecture, dream-like atmosphere, 
Studio Ghibli inspired, soft watercolor style, 
light and airy, 750x1334 vertical, no text, no UI
```
```
[in-game-bg] Enchanted celestial garden courtyard, 
circular stone platform surrounded by floating wisps of light, 
azure sky and white clouds, soft glowing atmosphere, 
gentle blue and white tones, dreamy illustration style, 
750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of an ethereal round table made of luminous crystal 
or white marble, delicate floral engravings, soft blue glow at 
edges, celestial fairy tale aesthetic, 600x600 square, 
transparent PNG background, no chairs, no figures
```

---

### Skin 3：水墨古风（ink-wash）— 需要生成

**视觉定义**
- 主题：中国水墨山水，宣纸质感
- 底色：暖米白 `#f4f0ea`，墨黑 `#2d2520`
- 氛围：古典、雅致、诗意
- 参考风格：中国传统水墨画（sumi-e），留白意境，范宽/马远山水
- **Light skin — 不叠遮罩，背景要有纸张质感**

**背景 prompt 模板**
```
[home-bg] Traditional Chinese ink wash painting landscape, 
misty mountains with pine trees, calligraphy-style brushwork, 
warm parchment and off-white tones with deep ink black accents, 
vast empty sky with subtle cloud wash, 
classical Chinese sumi-e style, 750x1334 vertical, no text
```
```
[in-game-bg] Chinese ink painting of a pavilion interior 
overlooking misty mountain valley, bamboo forest glimpsed 
through windows, ink wash brushstrokes, warm paper texture 
background, minimal color, elegant and poetic mood, 
sumi-e style, 750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of a traditional Chinese tea ceremony table, 
dark lacquered wood with ink-brushed phoenix or dragon emblem 
in center, carved wooden border, warm parchment tones, 
Chinese antique aesthetic, 600x600 square, 
transparent PNG background, no objects on table
```

---

### Skin 4：赛博霓虹（cyber-neon）— 需要生成

**视觉定义**
- 主题：赛博朋克霓虹都市，雨夜霓虹
- 底色：极深紫黑 `#0d0b16`，霓虹粉紫 `#e879f9`
- 氛围：躁动、压抑、电子感、危险
- 参考风格：Blade Runner 2049, cyberpunk neon noir, digital glitch art

**背景 prompt 模板**
```
[home-bg] Cyberpunk neon city rooftop at night, rain-slicked 
surfaces reflecting neon lights, towering skyscrapers with 
holographic advertisements, deep purple-black atmosphere with 
neon pink and cyan highlights, Blade Runner aesthetic, 
cinematic, digital painting, 750x1334 vertical, no text, no UI
```
```
[in-game-bg] Cyberpunk underground gaming den, neon-lit 
circular table in dark room, holographic displays floating, 
magenta and purple neon glow, rain outside floor-to-ceiling 
windows, dystopian atmosphere, Blade Runner 2049 style, 
750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of a futuristic cyberpunk round table, 
dark metal surface with glowing neon pink circuit-board pattern 
in center, holographic edge lighting, cyberpunk aesthetic, 
600x600 square, transparent PNG background, no figures
```

---

### Skin 5：暗黑地牢（dark-dungeon）— 需要生成

**视觉定义**
- 主题：哥特地牢，黑暗骑士，烛火骷髅
- 底色：近黑暖棕 `#0e0a07`，琥珀橙 `#c8902a`
- 氛围：压抑、诡异、原始恐惧、黑暗中世纪
- 参考风格：Diablo III art, dark Gothic dungeon, grimdark medieval

**背景 prompt 模板**
```
[home-bg] Dark Gothic dungeon hall, rough stone walls with 
iron torches burning amber, skulls and chains as decoration, 
oppressive low ceiling with stalactites, dark warm brown 
and amber color palette, grimdark medieval atmosphere, 
Diablo-inspired oil painting, 750x1334 vertical, no text, no UI
```
```
[in-game-bg] Dungeon torture chamber repurposed as a secret 
meeting room, torchlit stone alcoves, animal skull trophies, 
ancient rusted weapons mounted on walls, deep brown-black 
with amber torch glow, sinister atmosphere, dark fantasy, 
750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of a dungeon round table, rough-hewn dark stone 
with a carved pentagram or rune circle, iron bolts and chains 
embedded at edges, amber torch-glow highlights, grimdark 
aesthetic, 600x600 square, transparent PNG background
```

---

### Skin 6：深渊（abyss）— 需要生成

**视觉定义**
- 主题：深渊深海或宇宙虚空，克苏鲁意味
- 底色：极深近黑冷色 `#050507`，冷宝蓝 `#4060c0`
- 氛围：虚无、古老、令人恐惧的宏大、寂静
- 参考风格：H.P. Lovecraft cosmic horror, deep sea bioluminescence, dark sci-fi void

**背景 prompt 模板**
```
[home-bg] Abyssal deep ocean or cosmic void, bioluminescent 
creatures barely visible in pitch black depths, faint blue 
light from unknown ancient structures below, oppressive 
emptiness, Lovecraftian scale, deep sea or outer space 
ambiguity, cold deep blue and black palette, 
750x1334 vertical, no text, no UI
```
```
[in-game-bg] Ancient underwater stone chamber in the abyss, 
walls covered in unknowable runes, eerie cold blue 
bioluminescent glow, vast dark water above, cosmic horror 
atmosphere, impossible geometry, H.P. Lovecraft inspired, 
750x1334 vertical, no text
```

**圆桌 prompt**
```
Top-down view of an ancient cosmic round table, black stone 
or void material with glowing cold blue rune engravings, 
tentacle or eye motifs, Lovecraftian elder sign in center, 
abyss aesthetic, 600x600 square, transparent PNG background
```

---

## 四、角色卡图规范

### 角色文件名映射

| 中文名 | 文件名 | 阵营 | 身份定位 |
|--------|--------|------|----------|
| 梅林 | `merlin.png` | 正义 | 全知预言家，睿智老者 |
| 派西维尔 | `percival.png` | 正义 | 圣杯骑士，忠诚卫士 |
| 忠臣 / 亚瑟的忠臣 | `arthur_loyal.png` | 正义 | 亚瑟王的普通骑士 |
| 兰斯洛特（正义） | `lancelot_good.png` | 正义 | 最强骑士，但立场变换 |
| 刺客 | `assassin.png` | 邪恶 | 暗杀者，神秘面具 |
| 莫甘娜 | `morgana.png` | 邪恶 | 黑暗女巫，魅惑者 |
| 莫德雷德 | `mordred.png` | 邪恶 | 叛逆骑士，阴谋家 |
| 奥伯伦 | `oberon.png` | 邪恶 | 孤狼，连邪恶同伴也不信任 |
| 爪牙 | `minion.png` | 邪恶 | 普通邪恶爪牙 |
| 兰斯洛特（邪恶） | `lancelot_evil.png` | 邪恶 | 最强骑士，堕落一侧 |

### 角色通用构图规范
```
- 构图：半身像/胸像，主体人物占画面 60-70%
- 面部：清晰居中，位于图片上 40% 区域（因圆形裁切）
- 背景：配合皮肤主题，但比背景图更聚焦人物
- 分辨率：400 × 480 px，PNG
- 正义阵营：整体偏暖光、正面神情
- 邪恶阵营：整体偏冷光/阴影、神秘或险恶神情
```

### 角色 prompt 模板（以 dark-gold 皮肤为例，替换 [SKIN_STYLE] 即可）

```
[SKIN_STYLE] = 
  dark-gold:    "dark fantasy oil painting, candlelit, medieval, gold and navy tones"
  celestial:    "ethereal watercolor, soft light, fairy tale, blue and white tones"
  ink-wash:     "Chinese ink wash painting, sumi-e style, monochrome with warm accents"
  cyber-neon:   "cyberpunk digital art, neon lighting, holographic, magenta and purple"
  dark-dungeon: "grimdark illustration, torchlit, gothic, amber and dark brown"
  abyss:        "cosmic horror illustration, bioluminescent, cold blue void, Lovecraftian"
```

**梅林（merlin）**
```
Portrait of Merlin, wise elderly wizard with long silver beard 
and penetrating knowing eyes, wearing deep blue robes with 
star patterns, holding a glowing staff, [SKIN_STYLE], 
half-body portrait, face centered in upper half, 
400x480px, PNG, no background text
```

**派西维尔（percival）**
```
Portrait of Percival, young noble knight in polished silver armor, 
earnest and loyal expression, holding a holy grail symbol, 
bright honorable demeanor, [SKIN_STYLE], 
half-body portrait, face centered in upper half, 400x480px, PNG
```

**忠臣（arthur_loyal）**
```
Portrait of a loyal Knight of the Round Table, average build, 
wearing standard silver chainmail and blue tunic, 
honest and determined expression, [SKIN_STYLE], 
half-body portrait, face centered in upper half, 400x480px, PNG
```

**兰斯洛特·正义（lancelot_good）**
```
Portrait of Lancelot the greatest knight, confident and powerful, 
golden armor with lion crest, noble handsome face, 
good and honorable, warm light, [SKIN_STYLE], 
half-body portrait, face centered in upper half, 400x480px, PNG
```

**刺客（assassin）**
```
Portrait of a deadly Assassin, wearing dark hooded cloak, 
face half-shadowed with cold calculating eyes, 
holding a concealed dagger, sinister and dangerous, [SKIN_STYLE], 
half-body portrait, face centered in upper half, 400x480px, PNG
```

**莫甘娜（morgana）**
```
Portrait of Morgana, dark sorceress with black hair and 
piercing eyes, elegant dark dress with purple magic aura, 
seductive and dangerous expression, mimicking holy light, 
[SKIN_STYLE], half-body portrait, face centered upper half, 
400x480px, PNG
```

**莫德雷德（mordred）**
```
Portrait of Mordred, treacherous black knight, dark full armor 
with red accents, scheming expression behind visor, 
the betrayer of Arthur, ominous and powerful, [SKIN_STYLE], 
half-body portrait, face centered upper half, 400x480px, PNG
```

**奥伯伦（oberon）**
```
Portrait of Oberon, lone wolf evil character, wild untamed look, 
rough clothing, suspicious eyes that trust no one, 
even among allies he is a stranger, [SKIN_STYLE], 
half-body portrait, face centered upper half, 400x480px, PNG
```

**爪牙（minion）**
```
Portrait of a generic evil Minion of Mordred, shadowy 
hooded figure, unidentifiable features, menacing presence, 
dark cloak, [SKIN_STYLE], 
half-body portrait, face centered upper half, 400x480px, PNG
```

**兰斯洛特·邪恶（lancelot_evil）**
```
Portrait of Lancelot corrupted, once-greatest knight now fallen, 
cracked golden armor with dark energy seeping through, 
conflicted tormented expression, good and evil at war within, 
[SKIN_STYLE], half-body portrait, face centered upper half, 
400x480px, PNG
```

---

## 五、UI 图标规范（通用，单版）

### history_scroll（历史记录按钮）
```
Icon of an ancient scroll with a quill pen or historical records, 
thick outlined style, white on transparent background, 
clean icon design, 120x120px, PNG transparent, 
no gradients, single color stroke
```

### stats_bars（统计数据按钮）
```
Icon of bar chart with a small sword or shield overlay, 
representing battle statistics, thick outlined style, 
white on transparent background, clean icon, 
120x120px, PNG transparent
```

### kill（刺杀图标）
```
Icon of a dagger or assassin's blade, dramatic angle, 
blood drop optional, thick outlined icon style, 
white on transparent background, 120x120px, PNG transparent, 
used for assassin kill action
```

---

## 六、任务结果图规范（通用，单版）

### quest-success（任务成功）
```
Dramatic illustration of a quest success moment, 
knights raising their shields triumphantly, golden light 
breaking through clouds, cinematic composition, 
no text overlay, warm triumphant colors, 420x300px, PNG
```

### quest-failed（任务失败）
```
Dramatic illustration of a mission failure, 
dark figure sabotaging, flames or broken seal, 
red and dark tones, sense of betrayal and doom, 
cinematic, no text overlay, 420x300px, PNG
```

---

## 七、勋章图标规范（附录）

所有勋章使用统一的徽章框架设计，内部图标根据描述生成。

**通用 prompt 格式**
```
Achievement badge medal icon: [内部图标描述], 
round medal shape with ornate border, 
[good/evil faction color: gold/red], 
120x120px, PNG transparent background, 
badge illustration style, no text
```

| medal_code | 中文名 | 阵营 | 内部图标描述 |
|-----------|--------|------|------------|
| good_blocker | 挡刀侠 | 正义/金色 | a sword thrusting toward a knight's shield |
| good_clean_captain | 老司机 | 正义/金色 | a steady driver's hands on a steering wheel |
| good_wolf_trust | 钻狼窝 | 正义/金色 | a knight surrounded by wolf shadows |
| merlin_survivor | 梅林是狗 | 正义/金色 | Merlin pretending to be nonchalant |
| merlin_three_fail_lose | 心累 | 正义/金色 | a tired wizard with a drooping staff |
| good_clean_trust | 开眼玩家 | 正义/金色 | an eye with a divine glow |
| percival_morgana_trust | 晕头转向 | 正义/金色 | two identical figures confusing Percival |
| good_first_round_clean_captain | 盲人骑瞎马 | 正义/金色 | blindfolded figure hitting a bullseye |
| good_three_evil_team_captain | 错到极致也是对 | 正义/金色 | arrows all pointing wrong but looping back right |
| good_three_fail_lose | 不嘻嘻 | 正义/金色 | a sad frustrated face |
| good_comeback_win | 开往春田花花 | 正义/金色 | a cheerful school bus (麦兜 reference) |
| good_three_success_participant | 正义王 | 正义/金色 | a golden crown with a shield emblem |
| assassin_early_hit_merlin | 刺客大师 | 邪恶/红色 | a dagger piercing through Merlin's star robe |
| morgana_percival_fail_master | 洗头大师 | 邪恶/红色 | Morgana's seductive silhouette |
| oberon_no_fail_with_evil | 找到组织 | 邪恶/红色 | Oberon finally finding his evil teammates |
| oberon_double_fail_with_evil | 撞车 | 邪恶/红色 | two cars crashing into each other |
| evil_protect_round_fail | 保护轮也炸了 | 邪恶/红色 | a shield exploding |
| evil_three_fail_win | 炸三塔 | 邪恶/红色 | three towers exploding in sequence |
| evil_hide_votes_master | 藏票大师 | 邪恶/红色 | a shadow figure hiding a vote card |
| evil_all_fail_non_protect | 毫无默契 | 邪恶/红色 | two evil figures walking in opposite directions |
| evil_first_three_fail_win | 车胎炸了 | 邪恶/红色 | a car tire exploding |
| evil_three_fail_participant | 狼王 | 邪恶/红色 | a wolf crown |
| evil_no_fail_win | 演技派 | 邪恶/红色 | a theater mask (Infernal Affairs reference) |
| evil_fake_good_voter | 我想当个正义 | 邪恶/红色 | an evil figure wearing a good-side mask |

---

## 八、生成批次建议

建议按以下顺序生成，优先级从高到低：

### 第一批（已有 dark-gold 默认素材，跳过）
- 暗夜金（dark-gold）所有素材 — 已有，CDN 已部署

### 第二批（高优先级，视觉差异最大）
1. `celestial` 仙境 — 背景 × 2 + 圆桌 × 1（light skin，效果对比强烈）
2. `ink-wash` 水墨古风 — 背景 × 2 + 圆桌 × 1（light skin，特色鲜明）

### 第三批（dark skins，补完体验）
3. `cyber-neon` 赛博霓虹 — 背景 × 2 + 圆桌 × 1
4. `dark-dungeon` 暗黑地牢 — 背景 × 2 + 圆桌 × 1
5. `abyss` 深渊 — 背景 × 2 + 圆桌 × 1

### 第四批（角色图，工作量最大）
- 每皮肤 10 张角色图（minion/lancelot_evil 可合并为 evil variant）
- 建议先只做 dark-gold 和 ink-wash 两套，差异化最明显

### 第五批（通用素材）
- 3 个 UI 图标
- 2 张任务结果图
- 23 枚勋章（低优先级，无皮肤变体）

---

## 九、skins.js 接入方式（开发参考）

生成资产上传到 CDN 后，按如下方式填入 `skins.js`：

```js
{
  id: 'celestial',
  imageBase: 'https://www.awalon.top/mp-assets/skins/celestial/role-split',
  bgImage: 'url(https://www.awalon.top/mp-assets/skins/celestial/in-game-bg.jpg)',
  // bgImage 值直接用作 CSS var(--aw-bg-image) 的内容
}
```

`bgImage` 会自动通过 `--aw-bg-image` CSS 变量传给 `.page` 的 `background-image`。  
`imageBase` 会被 `roleImageFor(role, skinId)` 用作角色图片的前缀路径。
