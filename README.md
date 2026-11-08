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

敏感信息通过**环境变量**配置（推荐），或修改 `app.py` 顶部的配置区：

| 环境变量 | 说明 | 默认值 |
|---|---|---|
| `API_KEY` | 大模型 API Key（必填） | 无 |
| `API_URL` | 模型接口地址 | AMD Radeon API |
| `MODEL_NAME` | 模型名称 | DeepSeek-V4-Flash |
| `SECRET_KEY` | Flask Session 签名密钥 | 内置默认值 |

Windows 设置示例（PowerShell）：

```powershell
$env:API_KEY = "你的APIKey"
python app.py
```

访问密码在 `app.py` 顶部 `ACCESS_PASSWORD` 处修改。
