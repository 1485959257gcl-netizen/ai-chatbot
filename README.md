# AI 聊天机器人

一个基于 Flask + 原生前端（HTML/CSS/JS + axios）的 AI 聊天应用，对接 AMD Radeon 开发者平台的 DeepSeek-V4-Flash 大模型。

## 功能

- 💬 流式输出（打字机效果）
- 📂 多会话管理（新建 / 切换 / 删除，localStorage 持久化）
- 📋 Markdown 渲染（代码块、列表、加粗，代码一键复制）
- 📱 响应式布局，深色玻璃拟态风格
- 🧹 一键清空当前对话

## 使用方法

```bash
pip install flask requests
python app.py
```

浏览器打开 http://127.0.0.1:5000 即可使用。

## 目录结构

```
AI对话/
├── app.py           # Flask 后端（静态页面 + /api/chat 转发大模型）
├── static/
│   ├── index.html   # 页面结构
│   ├── style.css    # 样式
│   └── app.js       # 前端逻辑（会话管理、流式渲染）
└── README.md
```

## 配置

模型地址、API Key、模型名、系统提示词都在 `app.py` 顶部的配置区修改。
