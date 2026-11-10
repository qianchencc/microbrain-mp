# 观察设备产品图补全交接 · 2026-10-19

## 交付范围

按既有中央空调、格栅灯、门禁产品图的风格补全环境、电表、监控、烟感、燃气和水浸共六张类别示意图；不代表现场设备型号或实物照片。

- 图片目录：`static/device-art/`，透明 PNG，768×512。
- 映射入口：`pages/agent/device-art/catalog.js`；公司抽屉保留 `subtype` 交给映射，区域抽屉继续使用同一入口。
- 消防按 `smoke/gas/water` 分图；旧 `flooding` 映射到水浸；未知子类型保留已有兜底，不按名称猜类型。
- 保留既有空调、门禁、灯具图；不修改楼层归组、目录刷新或设备控制。

## 生成方式与提示词

使用用户指定的代理 API 和 `gpt-image-2.5`，通过 imagegen 技能的现成 `image_gen.py edit` 调用。`central-ac-cassette.png` 仅为材质、光照与写实风格参考，生成新主体。请求 1536×1024、high、透明 PNG；交付图等比缩小到既有 768×512 规格并保留 alpha。凭据不写入仓库。

完整最终提示词 = 以下通用提示词 + `Subject: ` + 对应设备提示词。

### 通用提示词

```text
Use case: product-mockup. Create ONE new isolated enterprise IoT device product illustration, matching the supplied image ONLY as an art-direction reference, not the subject. The reference is our existing central air conditioner catalogue asset: photorealistic restrained industrial product visualization, off-white polymer and satin light-gray metal, soft neutral studio illumination from upper left, crisp engineered details, subtle perspective, no cartoon styling. Replace the air conditioner entirely with the requested device. Deliver a single clean object centered in a landscape 3:2 canvas, comfortably within the frame with about 10 percent breathing room. Transparent alpha background, no scene, no room, no wall or floor plane, no drop-shadow plate, no border, no text labels, no logo, no watermark, no graphic overlays, no green glow. The image will appear at small size in an enterprise device card: bold recognizable silhouette, believable construction, uncluttered details. Do not copy the air conditioner grille onto unrelated products. Do not render a checkerboard pattern.
```

### 设备提示词

#### 环境传感器 · `environment-air-quality-sensor.png`

```text
A commercial wall-mount indoor air-quality monitor. Compact softly rounded rectangular off-white housing with a dark charcoal inset LCD near the upper front, small discreet ventilation slits along the lower edge and side. The dim LCD has only simple tiny abstract segmented numerals, no readable words, no units or invented charts. Three-quarter front view showing front and right side, gently elevated viewpoint. A single hardware unit, no mounting wall or accessories.
```

#### 电表 · `energy-digital-meter.png`

```text
A professional three-phase DIN-rail electronic electricity meter. One compact vertically oriented off-white industrial module with softly beveled corners, a small recessed desaturated gray-green LCD on the upper front, restrained dark keys beneath it and two rows of covered screw-terminal blocks at the top and bottom. Fine realistic mold seams and fastening details, no branding, no legible labels, no invented power charts. Three-quarter front view showing front and right side. One meter only, no electric cabinet, no exposed wires or rail.
```

#### 视频监控 · `video-dome-camera.png`

```text
One professional ceiling-mounted turret security camera: compact circular off-white mounting base, pale-gray rotating ball housing with a dark black circular lens insert and a subtle blue-black optical reflection. Recognizable industrial surveillance camera, not a film camera, no tripod, no wall, no cables. Three-quarter view with the lens pointing slightly toward viewer left, see both the body and the base. Fine realistic seams and restrained mounting screws.
```

#### 烟感 · `safety-smoke-detector.png`

```text
One professional photoelectric smoke detector: a low circular off-white ceiling sensor with clean layered circular vent slots around its perimeter, a small discreet indicator aperture and fine molding seams. Show a three-quarter underside view so the round face and shallow body depth are both clear. It is a smoke detector, not a camera or air-conditioning unit. No smoke, no flames, no emergency graphics, no ceiling.
```

#### 燃气 · `safety-gas-detector.png`

```text
One professional wall-mounted combustible gas detector: compact upright off-white rectangular housing, narrow rounded corners, clearly visible horizontal air-intake vent slots covering the upper portion, a small recessed central indicator lens and a discreet circular test button below. Three-quarter front view showing the right side. No LCD, no smoke, no flames, no pipe, no wall, no alarm graphics. A credible unobtrusive industrial building sensor.
```

#### 水浸 · `safety-water-leak-sensor.png`

```text
One compact water-leak sensor assembly for commercial building monitoring: a small low-profile off-white rounded rectangular sensor puck, with two short metallic detection contacts visibly integrated in its underside edge. Three-quarter elevated front view, clear simple housing and realistic mold seam. A single unified sensor body, no loose accessories or cable, no puddle, no droplets, no room or floor, no warning graphics.
```

## 验证

- 六张 768×512 RGBA PNG 均含透明像素，总计约 1.37 MiB；轮廓与材质已目检。
- 浏览器检查整组六张及既有参考图片全部成功加载；按公司抽屉 64px 图槽检查。整组预览见 [设备图预览](assets/2026-10-19-observation-device-art.png)。
- 从公共 `resolveDeviceArtwork` 与 `regionDeviceGroups` 检查六种设备、flooding 兼容及未知类型兜底；所有映射路径存在。
- `npm run test:agent`：104/104 通过。
- HBuilderX 微信编译成功；六张 dist 图片与源文件 SHA-256 一致。既有 check/detail 与鸿蒙兼容警告保留。
- 微信真机显示仍待实际加载最新开发包确认。

## 工作区边界

本次仅提交六张素材、共用映射、公司抽屉 subtype 传递、预览和本文档。已有楼层位置调查、能耗、Company 浮层、领域文档及其他原型并行改动保持独立。API 凭据未写入文件；临时生成日志及原始高分辨率文件不进入业务提交。

## 2026-11-05：撤回新增兜底图，沿用原素材

- 用户否决本轮新生成的 `generic-device.png`、`lighting-generic.png`、`safety-sensor.png`，删除这三张素材并恢复三个目录项的 `src: null`，使用既有 CSS 中性兜底；原有十张产品图不变。
- 格栅灯、灯带按既有名称规则选图；消防按实际 `subtype` 选烟感、燃气、水浸图，不把“照明开关”或未知消防类型冒充具体型号。
- 公司、区域抽屉已保留分类字段；任务提案卡原先仅传 kind/name，现保留设备字段，避免丢失 subtype、visualKey 和 location 导致已有图片无法命中。
- 运行选图冒烟：十张原图路径存在且选图正确，三个未知分类恢复中性兜底；任务提案烟感 subtype 场景修复前落兜底、修复后选中原烟感图。
- `npm run test:agent`：301/301 通过；HBuilderX 微信开发编译完成，既有 check/detail、img 选择器及鸿蒙兼容提示保留。未完成本轮微信界面／真机验收，以上不替代前端证据。

## 2026-11-10：照明开关复用物联页面原图

- 按用户要求复用物联页面已有的产品图，不使用旧首页的 `/static/light.png` 灯泡图标，也不新增素材。
- `lighting-generic` 改用既有 `lighting-grille-luminaire.png` 作为照明类别示意；保留「照明 / 设备」标签，不宣称开关的具体型号。灯带、格栅灯的原有匹配规则不变。
- 选图冒烟确认普通照明开关、格栅灯、灯带、显式通用照明分类及非照明兜底；图片路径存在，Prettier 检查和微信开发编译通过。
- 同一登录账号在微信开发者工具打开「物联助手 → 设备目录 → 照明」，卡片已实际显示产品图，见[前端截图](assets/2026-11-10-lighting-switch-existing-art.png)；「27楼展厅2」首项照明开关的原生图片节点也确认使用格栅灯图。该分组未单独截图，真机未验收。
