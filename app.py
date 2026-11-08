# -*- coding: utf-8 -*-
"""
AI 聊天机器人后端
- 提供静态页面
- /api/chat 转发大模型请求（支持流式输出）
"""
from flask import Flask, request, jsonify, Response, send_from_directory, session
import requests
import json
import socket
import os

app = Flask(__name__, static_folder="static", static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "change-me-9f8e7d6c5b4a3210")  # 用于签名会话 Cookie

# ================== 配置 ==================
# 敏感信息通过环境变量配置；也可直接写在下方等号里（不建议提交到公开仓库）
API_URL = os.environ.get("API_URL", "https://developer.amd.com.cn/radeon/api/v1/chat/completions")
API_KEY = os.environ.get("API_KEY", "在此填入你的APIKey")
MODEL_NAME = os.environ.get("MODEL_NAME", "DeepSeek-V4-Flash")
ACCESS_PASSWORD = "0307"  # 访问密码


@app.before_request
def check_auth():
    """所有 /api/* 接口需要登录（登录接口本身除外）"""
    if not request.path.startswith("/api/"):
        return None
    if request.path == "/api/login" or request.path == "/api/health":
        return None
    if session.get("auth"):
        return None
    return jsonify({"error": "未登录或密码错误"}), 401


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    if data.get("password") == ACCESS_PASSWORD:
        session["auth"] = True
        session.permanent = True
        return jsonify({"ok": True})
    return jsonify({"error": "密码错误"}), 401

# 系统提示词（可自行修改机器人的性格）
SYSTEM_PROMPT = "你是AI助手小龚，一个友好、专业的AI助手，回答要准确、简洁、有条理。请使用与用户提问相同的语言回答。当用户询问你的名字时，请回答你是小龚。"


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages", [])
    stream = data.get("stream", True)

    if not messages:
        return jsonify({"error": "messages 不能为空"}), 400

    # 组装消息：系统提示词 + 历史对话
    payload_messages = [{"role": "system", "content": SYSTEM_PROMPT}] + messages

    payload = {
        "model": MODEL_NAME,
        "messages": payload_messages,
        "stream": stream,
        "temperature": 0.7,
        "max_tokens": 4096,
    }
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    if not stream:
        # 非流式：一次性返回
        try:
            resp = requests.post(API_URL, json=payload, headers=headers, timeout=120)
            resp.raise_for_status()
            result = resp.json()
            content = result["choices"][0]["message"]["content"]
            return jsonify({"content": content})
        except requests.exceptions.RequestException as e:
            return jsonify({"error": f"请求大模型接口失败: {e}"}), 502
        except (KeyError, IndexError, ValueError):
            return jsonify({"error": "大模型返回格式异常", "raw": resp.text[:500]}), 502

    # 流式：逐段转发给前端
    def generate():
        try:
            resp = requests.post(
                API_URL, json=payload, headers=headers,
                stream=True, timeout=(10, 300),
            )
            resp.raise_for_status()
            # 上游未标 charset，requests 会按 ISO-8859-1 解码导致中文乱码，
            # 因此按原始字节读取，手动用 UTF-8 解码
            for raw_line in resp.iter_lines():
                line = raw_line.decode("utf-8", errors="replace") if raw_line else ""
                if not line or not line.startswith("data:"):
                    continue
                chunk = line[len("data:"):].strip()
                if chunk == "[DONE]":
                    yield "data: [DONE]\n\n"
                    break
                try:
                    obj = json.loads(chunk)
                    delta = obj["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        out = json.dumps({"content": content}, ensure_ascii=False)
                        yield f"data: {out}\n\n"
                except (ValueError, KeyError, IndexError):
                    # 跳过无法解析的块
                    continue
        except requests.exceptions.RequestException as e:
            err = json.dumps({"error": f"请求大模型接口失败: {e}"}, ensure_ascii=False)
            yield f"data: {err}\n\n"

    return Response(generate(), mimetype="text/event-stream",
                    headers={"Cache-Control": "no-cache",
                             "X-Accel-Buffering": "no"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_NAME})


def get_lan_ip():
    """获取局域网 IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


if __name__ == "__main__":
    ip = get_lan_ip()
    print("=" * 50)
    print(f"本机访问:   http://127.0.0.1:5000")
    print(f"局域网访问: http://{ip}:5000  (同一 WiFi 下的设备)")
    print(f"访问密码:   {ACCESS_PASSWORD}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False, threaded=True)
