# job-hunt 岗位收藏夹（Chrome 插件）

配合 [job-hunt skill](../README.md) 使用。

## 安装（开发者模式）

1. 打开 Chrome，访问 `chrome://extensions/`
2. 右上角打开"开发者模式"
3. 点"加载已解压的扩展程序"，选择本目录（`chrome-extension/`）
4. 安装完成后在地址栏右侧能看到插件图标

## 使用

1. 打开 Boss 直聘任意岗位详情页（如 https://www.zhipin.com/job_detail/xxx.html）
2. 页面右下角会出现"⭐ 加入清单"悬浮按钮，点击收藏
3. 点击浏览器右上角插件图标，查看清单，勾选要导出的岗位
4. 点"导出"按钮，文件下载到浏览器默认 Downloads 目录
5. 把 `.jobs.json` 文件拖给 Claude Code 的 `/job-hunt` 流程

## 仅支持 Boss 直聘

第一版只覆盖 Boss 直聘，其他平台请用截图方式上传给 skill。
