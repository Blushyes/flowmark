# FlowMark

[English](./README.md)

FlowMark 是一个浏览器扩展，用于在你收藏网页后，自动推荐更合适的书签目录和标题。

## 特性

- 基于 `WXT`、`SolidJS` 和 `Tailwind CSS v4`
- 页面内使用 Shadow DOM 悬浮提示条
- 使用 `@webext-core/messaging` 做强类型通信
- 通过 Vercel AI SDK 对接任意 OpenAI-compatible 接口
- 支持重复书签检测与合并提示
- 支持页面质量过滤，可提醒登录页、搜索结果页和低信息密度页
- 支持为书签生成一句摘要，并在 popup 中读取当前页面摘要
- 支持英文和简体中文

## 工作方式

当你新建书签后，FlowMark 会：

1. 确认该书签仍然存在
2. 从当前标签页读取轻量页面上下文
3. 如果页面像登录页、搜索结果页或低信息密度页，会先给出质量提醒
4. 页面通过过滤或你选择继续后，再请求 AI 生成目录、标题、一句话摘要和置信度
5. 在页面右上角显示悬浮提示条
6. 支持接受、拒绝、倒计时后自动应用，或直接删除低质量书签

默认行为：

- 智能推荐：开启
- 自动接受：开启
- 自动接受倒计时：`5s`
- 发送整页正文：关闭
- 页面正文上限：`5000` 字符
- 语言：默认跟随浏览器 UI 语言
- 摘要语言：与当前 FlowMark 语言保持一致，`auto` 跟随浏览器，手动指定则强制使用对应语言

## Chrome 商店

当前商店链接：[Chrome Web Store](https://chromewebstore.google.com/detail/kbmjedeepcglnmllaklecppgijhgggdg?utm_source=item-share-cb)

说明：
- 当前 Chrome 商店里的版本仍然是之前的旧版
- 这个开源版后续会重新提交审核

## 开发

```bash
pnpm install
pnpm dev
```

其他命令：

```bash
pnpm compile
pnpm build
pnpm zip
pnpm dev:firefox
pnpm build:firefox
pnpm zip:firefox
```

## 配置

1. 打开 FlowMark popup。
2. 进入 `Settings`。
3. 填写 `Base URL`、`Model`，以及可选的 `API Key`。
4. 保存设置。
5. 授予 AI 接口 origin 对应的 host 权限。

示例：

- `https://api.openai.com/v1`
- `http://localhost:11434/v1`

## 权限

必需权限：

- `bookmarks`
- `storage`
- `tabs`

可选 host 权限：

- `https://*/*`
- `http://*/*`

## 当前状态

已实现：

- 重复书签检测与合并提示
- 收藏后智能推荐
- 页面质量过滤与提醒提示条
- 目录、标题与摘要建议
- popup 当前页摘要读取
- 接受 / 拒绝 / 自动接受流程
- popup 与设置页
- `en` / `zh-CN` 双语支持
