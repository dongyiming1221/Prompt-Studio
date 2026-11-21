# Prompt Studio 2.0

移动端优先的静态网页/PWA 原型。当前提供免费本地规则扩写、提示词复制、历史记录和离线缓存基础能力。

## 本地运行

最简单的方法：在项目目录运行：

```bash
python -m http.server 8000
```

然后在浏览器打开 `http://localhost:8000`。

也可以使用 VS Code 的 Live Server 扩展。

## 部署成公开网址

本项目是纯静态网站，可部署到 GitHub Pages、Netlify 或 Cloudflare Pages。

### Netlify（简单方式）
1. 解压项目 ZIP。
2. 打开 Netlify 并登录。
3. 将整个 `prompt-studio-2` 文件夹拖入 Netlify 的手动部署区域。
4. 等待完成后，Netlify 会分配一个公开 HTTPS 网址。

### GitHub Pages
1. 将项目文件上传到一个 GitHub 仓库。
2. 进入仓库 Settings → Pages。
3. 在 Build and deployment 中选择 Deploy from a branch。
4. 选择 `main` 分支和 `/ (root)`，保存并等待部署。

## 添加到手机主屏幕
部署到 HTTPS 网址后，用手机浏览器打开网站：
- iPhone：Safari 分享菜单 → 添加到主屏幕
- Android：Chrome 菜单 → 安装应用/添加到主屏幕

## 当前能力边界
- 提示词生成目前是浏览器端规则扩写，不是大模型语义推理。
- 历史记录保存在当前浏览器本地，不跨设备同步。
- 英文选项目前只转换标题标签，不会自动翻译完整正文。
- AI 增强 API 尚未接入。正式接入时需要后端代理保存 API Key，切勿把密钥写进 `app.js` 或网页源代码。
- 部署网站需要你自己的托管账号；此源码包不会自动创建公开网址。
