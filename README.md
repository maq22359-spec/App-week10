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

1. Enable the front camera. / 开启前置摄像头。
2. Tap the shutter. Each of four shots gets a 3–2–1 countdown and a white flash. / 点击快门，四次拍摄各有 3–2–1 倒计时及白色闪光。
3. Save the white-bordered PNG strip. On supported phones, Save opens the native file share sheet; choose Save Image on iPhone. Computers download the PNG. / 保存白边 PNG 照片条；支持的手机会打开系统分享菜单，iPhone 可选择“存储图像”；电脑直接下载。
4. Retake starts a new camera session. / 点击 Retake 重新拍摄。

The preview is mirrored and the 4:3 corner guide matches the saved crop. Color / B&W applies to all four shots. Switching away stops the camera and cancels an unfinished sequence. Photos are never uploaded or stored on a server. / 预览为镜像，4:3 取景框与成片一致；支持彩色和黑白。切换离开页面会停止相机并取消未完成的拍摄。照片不会上传或保存在服务器。

## iPhone / 安装到 iPhone

Camera access and file sharing require HTTPS (localhost is allowed on the same computer). A phone visiting an HTTP LAN IP cannot use the camera. For a real iPhone, use an HTTPS deployment or trusted HTTPS development URL. / 相机及文件分享需要 HTTPS；本机 localhost 是例外。手机通过普通 HTTP 局域网 IP 访问无法使用相机，请使用 HTTPS 部署或受信任的 HTTPS 开发地址。

In Safari, tap Share → Add to Home Screen, then open Little Moments from its icon. The manifest, standalone display mode, PNG icons, Apple web app metadata, and safe-area padding are included. / 在 Safari 中选择“分享 → 添加到主屏幕”，再通过图标打开。已提供 manifest、standalone 显示模式、PNG 图标、Apple Web App 元数据及安全区域间距。

If camera access is denied, use Safari's page menu → Website Settings → Camera → Allow, then tap Try again. On desktop browsers, use the site controls beside the address bar. / 如拒绝了相机权限，请在 Safari 页面菜单 → 网站设置 → 相机中选择允许，再点击 Try again；桌面浏览器可使用地址栏旁的网站权限设置。

A service worker is registered only in production, so it cannot serve stale pages during development. No external services or environment variables are required. / Service Worker 仅在生产环境注册，避免影响开发热更新。无需外部服务或环境变量。
