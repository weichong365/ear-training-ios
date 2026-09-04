# 练耳搭子 iOS

这是从微信小程序独立迁移出的 React Native + Expo SDK 57 工程。微信小程序源码不受影响；iOS 工程复用了原有乐理出题、答案判断、PCM 音频渲染和钢琴定音采样，并重新实现原生界面。

## 当前可用

- iPhone 首页、专项训练、模拟考试框架、错题复盘、练习统计和关于页面。
- 单音、音程、和弦、节奏、旋律以及智能强化题目生成。
- 标准音、预备拍和正题合成到一条音频时间轴。
- 播放未结束时禁止再次播放；音频一开始，五线谱即可写入。
- 离线钢琴采样、设备本地练习记录和错题本。
- 和弦三个音使用同一起始采样帧，避免出现轻微琶音。
- 节奏和四句式旋律写谱、拍号/调号选择与按小节安全布局。
- 全国 31 个省级入口；其中 16 个使用专属真题框架，其余自动使用全国通用框架，并支持断点恢复、交卷评分和逐题复盘。
- 1.0.0 免费首发版全部核心功能开放；订阅代码保留但功能开关关闭，RevenueCat 不初始化。
- EAS Production 构建与 App Store Connect 自动提交已跑通；最近成功提交的是 1.0.0 (33)，当前工作区中的界面、作答和省份优化尚未生成新构建。

## 上线前仍需完成

- 补齐运营主体、技术支持邮箱，并部署公开隐私政策和技术支持网址。
- 最终确认 App 图标，制作 App Store 截图并完成隐私标签。
- 上传当前源码后，在 TestFlight 真机完成音频中断、免费直达、16 省专属试卷与通用省份回退验收。

## 本地运行

要求 Node.js 22.13 或更高版本。Expo SDK 57 的 iOS 最低版本为 16.4。

```bash
npm install
npm run start
```

Windows 可运行 Web 预览和连接 Expo Go；正式 iOS 云构建可以使用 EAS，不要求本机拥有 Mac。

## 质量检查

```bash
npm run typecheck
npm run lint
npm run doctor
npm run test:core
npm run test:provinces
npm run test:answers
npm --prefix .. run test:sync
npm run export:web
```

`store-site` 中已准备隐私政策与技术支持静态页面；补齐运营主体和邮箱后即可部署为 App Store Connect 所需的公开网址。

## iOS 云构建

1. 安装并登录 EAS CLI：`npm install -g eas-cli`、`eas login`。
2. 当前 Bundle ID 为 `com.lianerdazi.app`，EAS 项目与 App Store Connect App ID `6806168169` 已绑定。
3. 生产构建并自动提交：`eas build --platform ios --profile production --auto-submit`。

第一次提交前请逐项完成 [App Store 上架清单](./docs/APP_STORE_CHECKLIST.md)。
