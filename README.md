# Little Moments · 随身拍照亭

A phone-first, local-only photo booth built with Next.js, React, and TypeScript.
使用 Next.js、React 和 TypeScript 开发的移动优先拍照亭，照片仅在本机处理。

## Run / 运行

```sh
npm install
npm run dev
```

Open http://localhost:3000 on this computer. / 在本机打开 http://localhost:3000。

```sh
npm test
npm run typecheck
npm run build
```

## Use / 使用

1. Enable the camera; the photo booth prefers the rear camera. / 开启相机，拍照亭默认优先使用后置摄像头。
2. Choose Single (default) or a four-photo strip, then tap the shutter. Each shot gets a 3–2–1 countdown and a white flash. / 默认单张，也可选择四张长条；每次拍摄有 3–2–1 倒计时及白色闪光。
3. Save the white-bordered PNG strip. On supported phones, Save opens the native file share sheet; choose Save Image on iPhone. Computers download the PNG. / 保存白边 PNG 照片条；支持的手机会打开系统分享菜单，iPhone 可选择“存储图像”；电脑直接下载。
4. Retake starts a new camera session. / 点击 Retake 重新拍摄。

The site opens directly in the camera screen with no white introduction sidebar. Choose **No frame**, **Dungeon feast**, **These two**, or **小猪 / Pig** above the preview. The illustrated food-adventure frame is included in each saved photo; Black & white affects the camera photo while the frame stays colorful. / 网站直接进入拍照界面，无白色介绍侧栏。可在预览上方选择“无相框”、“Dungeon feast（迷宫饭美食主题）”、“These two（原图两个人物）”或“小猪 / Pig”；相框会保存在每张照片里，黑白滤镜仅影响相机照片，相框保持彩色。

Rear-camera previews and saved photos keep their natural orientation. A front-camera fallback uses a mirrored selfie preview and matching capture. On desktop, the frame fills the camera panel. On phones, the camera is 9:16 portrait and the frame fills all four edges. Saved photos match the full preview; the strip keeps each photo’s aspect ratio. Color / B&W applies to all four shots. Switching away stops the camera and cancels an unfinished sequence. Photos are never uploaded or stored on a server. / 后置预览与成片保持正常方向，回退到前置摄像头时使用镜像自拍；电脑相框贴合拍摄区域四边，手机为 9:16 竖屏，相框与成片构图一致；支持彩色和黑白。切换离开页面会停止相机并取消未完成的拍摄。照片不会上传或保存在服务器。

## iPhone / 安装到 iPhone

Camera access and file sharing require HTTPS (localhost is allowed on the same computer). A phone visiting an HTTP LAN IP cannot use the camera. For a real iPhone, use an HTTPS deployment or trusted HTTPS development URL. / 相机及文件分享需要 HTTPS；本机 localhost 是例外。手机通过普通 HTTP 局域网 IP 访问无法使用相机，请使用 HTTPS 部署或受信任的 HTTPS 开发地址。

In Safari, tap Share → Add to Home Screen, then open Little Moments from its icon. The manifest, standalone display mode, PNG icons, Apple web app metadata, and safe-area padding are included. / 在 Safari 中选择“分享 → 添加到主屏幕”，再通过图标打开。已提供 manifest、standalone 显示模式、PNG 图标、Apple Web App 元数据及安全区域间距。

If camera access is denied, use Safari's page menu → Website Settings → Camera → Allow, then tap Try again. On desktop browsers, use the site controls beside the address bar. / 如拒绝了相机权限，请在 Safari 页面菜单 → 网站设置 → 相机中选择允许，再点击 Try again；桌面浏览器可使用地址栏旁的网站权限设置。

A service worker is registered only in production, so it cannot serve stale pages during development. No external services or environment variables are required. / Service Worker 仅在生产环境注册，避免影响开发热更新。无需外部服务或环境变量。

## Original-photo frame / 原图人物相框

**These two** uses the supplied photograph as its pixel source and clips each figure to its original silhouette at render time. Faces and linework are not regenerated. The same clipping renderer is used for the live preview and saved photos. / **These two** 直接使用提供照片的原始像素，沿人物轮廓裁切显示，不重新生成表情或线条；预览与保存照片使用同一绘制方式。

## Meme Face / 表情包换脸

Open the **表情包换脸 / Meme Face** entry in the photo booth, or visit `/meme`.

1. Choose Single (default) or a four-photo strip. / 默认单张，也可选四张长条。
2. Enable the camera. The translucent original pose overlays the camera, with dashed eye openings. The original example remains visible while shooting. / 开相机后可透过半透明模板，将双眼对准虚线眼框，旁边保留原图示例。
3. Make an expression and tap the shutter. Facial landmarks are detected locally, and eye/brow, nose, and mouth pixels are isolated, softened into grayscale, and placed at the same anchors used by the guide. Hair, the outer face contour and background are excluded. / 做好表情再按快门；本机识别五官，黑白处理后逐个对齐模板眼框，保留动作，排除头发、外轮廓和背景。
4. Retake, optionally adjust feature size/position/ink strength, or save a PNG. iPhone uses the native share sheet when available; desktop downloads. / 可重拍、微调或保存 PNG；支持的 iPhone 使用系统分享菜单，电脑直接下载。

The blank pose and reference example are the user-supplied images. **Try sample** exercises the actual local landmark and rendering pipeline using the supplied example; in four-photo demo mode it repeats that one sample in the strip.

MediaPipe runtime files and the face-landmark model are served from `public/mediapipe` and `public/models`, so camera photos are not sent to an external face-processing service. See `docs/meme-face.md` for asset sources and implementation notes.

## Pig frame / 小猪拍照贴纸

The Pig option uses the original pixels from the supplied pig photograph, clipped to the character and its white dotted gesture. Both the preview and saved photos use the same renderer. These two figures are 30% larger than their earlier size, with their proportions preserved. / 小猪相框直接使用所提供图片中的原始像素，沿角色及白色虚线轮廓显示；预览与成片共用绘制方式。两个黑白人物较原来放大 30%，保持原比例。
