# job-hunt 岗位收藏夹（Chrome 插件）

配合 [job-hunt skill](https://github.com/JPCwhj/job-hunt) 使用。

## 支持平台

| 平台 | 详情页 URL 格式 |
|------|----------------|
| Boss 直聘 | `zhipin.com/job_detail/*` |
| 前程无忧 51job | `jobs.51job.com/*/*.html` |
| 智联招聘 | `zhaopin.com/jobdetail/*` |
| 猎聘 | `liepin.com/job/*.shtml` |

## 安装（开发者模式）

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序"，选择本目录（`chrome-extension/`）
4. 安装完成后在地址栏右侧能看到插件图标

## 使用

1. 打开以上任意平台的岗位详情页
2. 页面右下角出现"⭐ 加入清单"悬浮按钮，点击收藏
   - 按钮可自由拖拽到屏幕任意位置，位置会自动记住（四个平台共享同一位置）
   - 已收藏的岗位按钮变灰，再次点击可取消收藏
3. 点击浏览器右上角插件图标，查看收藏清单，勾选要导出的岗位
4. 点"导出"按钮，`.jobs.json` 文件下载到浏览器默认 Downloads 目录
5. 把 `.jobs.json` 文件传给 Claude Code 的 `/job-hunt` 流程（拖入对话框即可）

## 维护与开发

详见 [DEVELOPMENT.md](./DEVELOPMENT.md)，内容包括：
- 各平台 DOM 字段映射表
- Boss 直聘反爬机制说明（PUA 字体、DevTools 检测）
- DOM 诊断工作流与模板脚本
- 新增平台操作清单
