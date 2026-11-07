/* ============ 状态 ============ */
const state = {
  chats: [],          // [{id, title, messages:[{role, content}]}]
  currentId: null,
  streaming: false,   // 是否正在生成
};

const $ = (id) => document.getElementById(id);
const els = {
  chatList: $("chatList"), messages: $("messages"), welcome: $("welcome"),
  input: $("input"), sendBtn: $("sendBtn"), chatTitle: $("chatTitle"),
  chatWindow: $("chatWindow"), sidebar: $("sidebar"),
};

/* ============ 持久化 ============ */
function load() {
  try {
    const raw = localStorage.getItem("ai_chats");
    if (raw) state.chats = JSON.parse(raw);
  } catch (e) { state.chats = []; }
  if (!state.chats.length) {
    createChat(false);
  } else {
    state.currentId = state.chats[0].id;
  }
}
function save() {
  localStorage.setItem("ai_chats", JSON.stringify(state.chats));
}

/* ============ 会话管理 ============ */
function createChat(render = true) {
  const chat = { id: Date.now() + "" + Math.floor(Math.random() * 1000), title: "新对话", messages: [] };
  state.chats.unshift(chat);
  state.currentId = chat.id;
  save();
  if (render) { renderAll(); els.input.focus(); }
  return chat;
}
function currentChat() {
  return state.chats.find(c => c.id === state.currentId);
}
function deleteChat(e, id) {
  e.stopPropagation();
  state.chats = state.chats.filter(c => c.id !== id);
  if (state.chats.length === 0) createChat(false);
  if (state.currentId === id) state.currentId = state.chats[0].id;
  save();
  renderAll();
}
function switchChat(id) {
  if (state.streaming) return;
  state.currentId = id;
  renderAll();
  // 手机上选中会话后自动收起侧边栏
  if (window.matchMedia("(max-width: 768px)").matches) {
    els.sidebar.classList.add("collapsed");
    syncOverlay();
  }
}

/* ============ 渲染 ============ */
function renderAll() {
  renderChatList();
  renderMessages();
}
function renderChatList() {
  els.chatList.innerHTML = "";
  for (const c of state.chats) {
    const div = document.createElement("div");
    div.className = "chat-item" + (c.id === state.currentId ? " active" : "");
    const title = document.createElement("span");
    title.textContent = c.title;
    div.appendChild(title);
    const del = document.createElement("button");
    del.className = "del-btn"; del.textContent = "✕"; del.title = "删除会话";
    del.onclick = (e) => deleteChat(e, c.id);
    div.appendChild(del);
    div.onclick = () => switchChat(c.id);
    els.chatList.appendChild(div);
  }
}

function renderMessages() {
  const chat = currentChat();
  els.messages.innerHTML = "";
  els.chatTitle.textContent = chat ? chat.title : "新对话";
  const empty = !chat || chat.messages.length === 0;
  els.welcome.style.display = empty ? "block" : "none";
  if (!chat) return;
  for (const m of chat.messages) {
    appendMessageEl(m.role, m.content, false);
  }
  scrollBottom();
}

/* 轻量 Markdown 渲染（代码块/行内代码/加粗/列表/标题） */
function renderMarkdown(text) {
  let html = escapeHtml(text);
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code}</code><button class="copy-code-btn" onclick="copyCode(this)">复制</button></pre>`;
  });
  html = html.replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
  html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");
  // 简单列表
  html = html.replace(/^[-*] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
  // 段落
  html = html.split(/\n{2,}/).map(p =>
    /^<(h\d|pre|ul|ol)/.test(p.trim()) ? p : (p.trim() ? `<p>${p.trim()}</p>` : "")
  ).join("");
  html = html.replace(/\n(?!<)/g, "<br>");
  return html;
}
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function copyCode(btn) {
  const code = btn.parentElement.querySelector("code").textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = "已复制";
    setTimeout(() => (btn.textContent = "复制"), 1500);
  });
}

/* 追加一条消息 DOM */
function appendMessageEl(role, content, animate = true) {
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "你" : "AI";
  const wrap = document.createElement("div");
  wrap.className = "bubble-wrap";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "user" ? escapeHtml(content) : renderMarkdown(content);
  wrap.appendChild(bubble);
  msg.appendChild(avatar);
  msg.appendChild(wrap);
  els.messages.appendChild(msg);
  return { msg, bubble };
}

function scrollBottom() {
  els.chatWindow.scrollTop = els.chatWindow.scrollHeight;
}

/* ============ 发送与流式接收 ============ */
async function sendMessage(text) {
  if (state.streaming) return;
  const chat = currentChat();
  if (!text.trim()) return;

  // 用户消息
  chat.messages.push({ role: "user", content: text });
  if (chat.title === "新对话") {
    chat.title = text.slice(0, 18) || "新对话";
    renderChatList();
    els.chatTitle.textContent = chat.title;
  }
  appendMessageEl("user", text);
  save();
  scrollBottom();

  // 创建 AI 消息占位
  els.welcome.style.display = "none";
  const { bubble } = appendMessageEl("assistant", "");
  bubble.innerHTML = '<span class="thinking"><span></span><span></span><span></span></span>';
  scrollBottom();

  state.streaming = true;
  els.sendBtn.disabled = true;

  // 只携带最近 20 条，避免超出上下文
  const history = chat.messages.slice(-20).map(m => ({ role: m.role, content: m.content }));

  // 浏览器端 axios 无法流式读取响应体，这里用 fetch + ReadableStream 实现
  // 打字机效果的流式输出（axios 用于其他普通请求）
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, stream: true }),
    });
    if (!resp.ok || !resp.body) {
      let detail = "";
      try { detail = (await resp.json()).error || ""; } catch (e) {}
      throw new Error(detail || `HTTP ${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let full = "", buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.error) throw new Error(obj.error);
          if (obj.content) {
            full += obj.content;
            bubble.innerHTML = renderMarkdown(full) + '<span class="typing-cursor"></span>';
            scrollBottom();
          }
        } catch (e) {
          if (e.message && !e.message.startsWith("Unexpected")) throw e;
        }
      }
    }
    bubble.innerHTML = renderMarkdown(full || "（模型未返回内容）");
    chat.messages.push({ role: "assistant", content: full });
    save();
  } catch (e) {
    bubble.innerHTML = `<span style="color:#ff6b6b">⚠️ 请求失败：${escapeHtml(e.message || "未知错误")}</span>`;
  } finally {
    state.streaming = false;
    els.sendBtn.disabled = false;
    els.input.focus();
    scrollBottom();
  }
}

/* ============ 事件绑定 ============ */
els.sendBtn.onclick = () => {
  const text = els.input.value;
  els.input.value = "";
  autoResize();
  sendMessage(text);
};
els.input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    const text = els.input.value;
    els.input.value = "";
    autoResize();
    sendMessage(text);
  }
});
els.input.addEventListener("input", autoResize);
function autoResize() {
  els.input.style.height = "auto";
  els.input.style.height = Math.min(els.input.scrollHeight, 160) + "px";
}

$("newChatBtn").onclick = () => {
  if (state.streaming) return;
  createChat();
  if (window.matchMedia("(max-width: 768px)").matches) {
    els.sidebar.classList.add("collapsed");
    syncOverlay();
  }
};
$("clearBtn").onclick = () => {
  const chat = currentChat();
  if (!chat || state.streaming) return;
  chat.messages = [];
  chat.title = "新对话";
  save();
  renderAll();
};
$("toggleSidebarBtn").onclick = () => {
  els.sidebar.classList.toggle("collapsed");
  syncOverlay();
};
$("sidebarOverlay").onclick = () => {
  els.sidebar.classList.add("collapsed");
  syncOverlay();
};
function syncOverlay() {
  const open = !els.sidebar.classList.contains("collapsed");
  document.getElementById("sidebarOverlay").classList.toggle("show", open);
}
// 手机上默认收起侧边栏，避免挡住聊天区
if (window.matchMedia("(max-width: 768px)").matches) {
  els.sidebar.classList.add("collapsed");
}
window.addEventListener("resize", () => {
  if (window.matchMedia("(max-width: 768px)").matches) {
    els.sidebar.classList.add("collapsed");
    syncOverlay();
  }
});

// 建议卡片
document.querySelectorAll(".suggest-card").forEach(card => {
  card.onclick = () => {
    els.input.value = card.dataset.q;
    autoResize();
    els.input.focus();
  };
});

/* ============ 访问密码门禁 ============ */
(function gate() {
  const gateEl = document.getElementById("gate");
  const pwdInput = document.getElementById("pwd");
  const enterBtn = document.getElementById("enterBtn");
  const errEl = document.getElementById("gateError");

  function unlock() {
    gateEl.remove();
    document.body.classList.remove("locked");
    els.input.focus();
  }

  function tryEnter() {
    const pwd = pwdInput.value.trim();
    if (!pwd) { errEl.textContent = "请输入密码"; return; }
    enterBtn.disabled = true;
    errEl.textContent = "";
    axios.post("/api/login", { password: pwd })
      .then(() => { unlock(); })
      .catch(() => {
        errEl.textContent = "密码错误，请重试";
        pwdInput.value = "";
        pwdInput.focus();
      })
      .finally(() => { enterBtn.disabled = false; });
  }

  enterBtn.onclick = tryEnter;
  pwdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryEnter();
  });
})();

/* ============ 启动 ============ */
load();
renderAll();
els.input.focus();

/* 用 axios 检查后端健康状态 */
axios.get("/api/health")
  .then(res => {
    if (res.data && res.data.model) {
      document.getElementById("modelName").textContent = res.data.model;
    }
  })
  .catch(() => {
    const badge = document.querySelector(".model-badge .dot");
    if (badge) { badge.style.background = "#ff6b6b"; badge.style.boxShadow = "0 0 8px #ff6b6b"; }
  });
