import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type Dir = "pm2dev" | "dev2pm";
type MessageRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: MessageRole;
  content: string;
  dir: Dir;
};

type HistoryItem = {
  id: string;
  dir: Dir;
  text: string;
};

const DIR_CONFIG = {
  pm2dev: {
    from: "产品经理",
    to: "开发工程师",
    fromEmoji: "🎯",
    targetLabel: "⚙️ 翻译给开发工程师",
    targetClass: "to-dev",
    placeholder: "输入产品需求描述，例如：我们需要一个智能推荐功能...",
    inputHintRole: "🎯 产品视角",
    inputHintRoleClass: "pm",
    inputHintTail: "→ 翻译给开发",
    topHint: "翻译成技术语言",
  },
  dev2pm: {
    from: "开发工程师",
    to: "产品经理",
    fromEmoji: "⚙️",
    targetLabel: "🎯 翻译给产品经理",
    targetClass: "to-pm",
    placeholder:
      "输入技术方案描述，例如：我们优化了数据库查询，QPS提升了30%...",
    inputHintRole: "⚙️ 开发视角",
    inputHintRoleClass: "dev",
    inputHintTail: "→ 翻译给产品",
    topHint: "翻译成业务语言",
  },
} as const;

const EXAMPLES = {
  pm2dev: [
    "我们需要一个智能推荐功能，提升用户停留时长",
    "需要做一个消息通知系统，让用户不错过重要动态",
    "希望优化搜索体验，让用户能更快找到想要的内容",
  ],
  dev2pm: [
    "我们优化了数据库查询，QPS提升了30%，P99延迟从200ms降到50ms",
    "完成了微服务拆分重构，将单体应用拆分为6个独立服务",
    "引入了Redis缓存层，缓存命中率达到95%",
  ],
};

const MODAL_CONTENT = {
  about: {
    title: "关于职能翻译助手",
    body: [
      "职能翻译助手帮助产品经理与开发工程师消除沟通鸿沟。",
      "支持“产品 → 开发”和“开发 → 产品”双向翻译，自动补全关键上下文。",
    ],
  },
  guide: {
    title: "使用说明",
    body: [
      "1. 选择你的角色，系统会自动设定翻译方向。",
      "2. 输入原始描述，使用你最自然的语言即可。",
      "3. 获取结构化翻译结果，并继续追问细化。",
    ],
  },
} as const;

const SYSTEM_PROMPTS = {
  pm2dev:
    "你是产品经理与开发工程师之间的沟通翻译助手。把产品需求翻译成开发可执行版本，覆盖技术方案、数据设计、性能规模、接口依赖、工时评估、技术风险。输出中文 Markdown。",
  dev2pm:
    "你是开发工程师与产品经理之间的沟通翻译助手。把技术描述翻译成产品可决策版本，覆盖用户体验影响、业务价值、增长空间、成本收益、风险降低、后续机会。输出中文 Markdown。",
} as const;

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001";

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const formatAI = (text: string) => {
  let html = escHtml(text);
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  const blocks = html.split(/\n\n+/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      if (t.startsWith("<h3>") || t.startsWith("<ul>")) return t;
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
};

const createFallback = (dir: Dir, text: string) => {
  if (dir === "pm2dev") {
    return `### 技术翻译\n- 目标：${text}\n- 推荐方案：拆分为前端交互、服务端能力、数据指标三层实现\n- 数据设计：定义核心实体、埋点字段、状态流转\n- 工时建议：需求澄清 0.5 天，开发 2-4 天，联调验收 1 天\n- 风险提示：边界场景未定义会影响交付稳定性`;
  }
  return `### 业务翻译\n- 用户价值：${text}\n- 直观收益：体验更快、更稳，减少等待和失败感知\n- 业务影响：提升转化与留存，降低客服投诉\n- 成本收益：同等资源支撑更大业务规模\n- 后续机会：可继续做精细化运营和自动化增长实验`;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function App() {
  const [currentDir, setCurrentDir] = useState<Dir>("pm2dev");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [topbarLabel, setTopbarLabel] = useState("职能沟通翻译");
  const [modalType, setModalType] = useState<keyof typeof MODAL_CONTENT | null>(
    null,
  );
  const stopRef = useRef(false);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const userScrollLockUntilRef = useRef(0);

  const cfg = useMemo(() => DIR_CONFIG[currentDir], [currentDir]);
  const showWelcome = messages.length === 0;

  const isNearBottom = (el: HTMLDivElement) =>
    el.scrollHeight - el.scrollTop - el.clientHeight < 80;

  const handleMsgScroll = () => {
    const el = msgContainerRef.current;
    if (!el) return;
    autoScrollRef.current = isNearBottom(el);
  };

  const markUserScrolling = () => {
    userScrollLockUntilRef.current = Date.now() + 260;
  };

  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messageCountChanged && isNearBottom(el)) {
      autoScrollRef.current = true;
    }
    if (Date.now() < userScrollLockUntilRef.current) return;
    if (!autoScrollRef.current) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: "auto",
    });
  }, [messages]);

  const switchRole = (role: "pm" | "dev") => {
    const dir = role === "pm" ? "pm2dev" : "dev2pm";
    if (dir !== currentDir) setCurrentDir(dir);
  };

  const addHistoryFromCurrentSession = () => {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const short =
      firstUser.content.length > 22
        ? `${firstUser.content.slice(0, 22)}…`
        : firstUser.content;
    const item: HistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      dir: firstUser.dir,
      text: short,
    };
    setSessionHistory((prev) => [item, ...prev]);
  };

  const handleNewSession = () => {
    if (messages.length > 0) addHistoryFromCurrentSession();
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    stopRef.current = false;
    setTopbarLabel("职能沟通翻译");
  };

  const fetchTranslation = async (dir: Dir, text: string) => {
    const res = await fetch(`${BACKEND_BASE_URL}/api/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "local-model",
        max_tokens: 1200,
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[dir] },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      if (errorText) {
        throw new Error(errorText);
      }
      return createFallback(dir, text);
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return createFallback(dir, text);
    }
    return content;
  };

  const streamText = async (id: string, fullText: string) => {
    let partial = "";
    for (const char of fullText) {
      if (stopRef.current) break;
      partial += char;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: partial } : m)),
      );
      await sleep(12);
    }
  };

  const sendMsg = async (override?: { dir: Dir; text: string }) => {
    const useDir = override?.dir ?? currentDir;
    const raw = override?.text ?? input;
    const text = raw.trim();
    if (!text || isStreaming) return;
    const short = text.length > 20 ? `${text.slice(0, 20)}…` : text;
    setTopbarLabel(short);
    setIsStreaming(true);
    stopRef.current = false;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random()}`,
      role: "user",
      content: text,
      dir: useDir,
    };
    const assistantId = `a-${Date.now()}-${Math.random()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      dir: useDir,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    try {
      const fullText = await fetchTranslation(useDir, text);
      await streamText(assistantId, fullText);
      if (stopRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `${m.content}\n\n∎ 已中断` }
              : m,
          ),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "请求失败";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `⚠️ 请求失败：${message}` }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
      stopRef.current = false;
    }
  };

  const handleSendClick = () => {
    if (isStreaming) {
      stopRef.current = true;
      return;
    }
    void sendMsg();
  };

  const applyExample = (dir: Dir, text: string) => {
    setCurrentDir(dir);
    void sendMsg({ dir, text });
  };

  const copyMsg = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      return;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-badge">译</div>
          职能翻译助手
        </div>
        <button className="new-btn" onClick={handleNewSession}>
          <span>＋</span>
          新建会话
        </button>
        <div className="sidebar-label">历史记录</div>
        <div>
          {sessionHistory.map((item) => (
            <div className="history-item" key={item.id}>
              <div
                className={`history-dot ${item.dir === "pm2dev" ? "pm" : "dev"}`}
              />
              <div className="history-text">{item.text}</div>
            </div>
          ))}
        </div>
        <div className="sidebar-spacer" />
        <div className="sidebar-footer">
          <div className="footer-item" onClick={() => setModalType("about")}>
            关于助手
          </div>
          <div className="footer-item" onClick={() => setModalType("guide")}>
            使用说明
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{topbarLabel}</div>
        </div>
        <div
          className="messages-container"
          ref={msgContainerRef}
          onScroll={handleMsgScroll}
          onWheel={markUserScrolling}
          onTouchMove={markUserScrolling}
        >
          {showWelcome ? (
            <div className="welcome">
              <div className="welcome-header">
                <div className="welcome-icon">⇄</div>
                <div>
                  <h1>职能沟通翻译助手</h1>
                  <p>消除产品经理与开发工程师之间的语言鸿沟</p>
                </div>
              </div>
              <div className="dir-selector-welcome">
                <div
                  className={`dir-card pm-card ${currentDir === "pm2dev" ? "selected" : ""}`}
                  onClick={() => setCurrentDir("pm2dev")}
                >
                  <div className="role-label">
                    {currentDir === "pm2dev" ? "我来描述需求" : "翻译目标"}
                  </div>
                  <div className="role-name">🎯 产品经理</div>
                  <div className="role-desc">
                    业务目标・用户价值
                    <br />
                    功能描述・商业逻辑
                  </div>
                </div>
                <div
                  className={`dir-arrow ${currentDir === "dev2pm" ? "reversed" : ""}`}
                >
                  →
                </div>
                <div
                  className={`dir-card dev-card ${currentDir === "dev2pm" ? "selected" : ""}`}
                  onClick={() => setCurrentDir("dev2pm")}
                >
                  <div className="role-label">
                    {currentDir === "dev2pm" ? "我来描述方案" : "翻译目标"}
                  </div>
                  <div className="role-name">⚙️ 开发工程师</div>
                  <div className="role-desc">
                    技术实现・工作量
                    <br />
                    具体细节・性能指标
                  </div>
                </div>
              </div>
              <div className="suggestion-chips">
                <div className="chip-label">🎯 产品 → 开发 示例</div>
                <div className="chips-row">
                  {EXAMPLES.pm2dev.map((example) => (
                    <button
                      className="chip pm-chip"
                      key={example}
                      onClick={() => applyExample("pm2dev", example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
                <div className="chip-label">⚙️ 开发 → 产品 示例</div>
                <div className="chips-row">
                  {EXAMPLES.dev2pm.map((example) => (
                    <button
                      className="chip dev-chip"
                      key={example}
                      onClick={() => applyExample("dev2pm", example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="msg-wrap">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div className="message user" key={message.id}>
                    <div className="user-bubble-wrap">
                      <div
                        className={`user-role-tag ${message.dir === "pm2dev" ? "pm" : "dev"}`}
                      >
                        {DIR_CONFIG[message.dir].fromEmoji}{" "}
                        {DIR_CONFIG[message.dir].from}
                      </div>
                      <div className="user-bubble">{message.content}</div>
                    </div>
                  </div>
                ) : (
                  <div className="message assistant" key={message.id}>
                    <div className="ai-avatar">译</div>
                    <div className="ai-content">
                      <div
                        className={`ai-target-tag ${DIR_CONFIG[message.dir].targetClass}`}
                      >
                        {DIR_CONFIG[message.dir].targetLabel}
                      </div>
                      <div className="ai-bubble">
                        <div
                          className="ai-bubble-text"
                          dangerouslySetInnerHTML={{
                            __html:
                              formatAI(message.content) +
                              (isStreaming &&
                              messages[messages.length - 1]?.id === message.id
                                ? '<span class="cursor"></span>'
                                : ""),
                          }}
                        />
                      </div>
                      <div className="msg-actions">
                        <button
                          className="act-btn"
                          onClick={() => void copyMsg(message.content)}
                        >
                          复制
                        </button>
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
        <div className="input-area">
          <div className="input-wrap">
            <div className="dir-card-bar">
              <div
                className={`dir-role-card pm ${currentDir === "pm2dev" ? "selected-from" : "selected-to"}`}
                onClick={() => switchRole("pm")}
              >
                <div className="card-role-name">🎯 产品经理</div>
                <div className="card-role-desc">我来描述需求</div>
              </div>
              <div className="dir-arrow-connector">
                <div
                  className={`dir-arrow-icon ${currentDir === "dev2pm" ? "reversed" : ""}`}
                >
                  →
                </div>
                <span className="dir-swap-hint">{cfg.topHint}</span>
              </div>
              <div
                className={`dir-role-card dev ${currentDir === "dev2pm" ? "selected-from" : "selected-to"}`}
                onClick={() => switchRole("dev")}
              >
                <div className="card-role-name">⚙️ 开发工程师</div>
                <div className="card-role-desc">我来描述方案</div>
              </div>
            </div>
            <div className="input-box">
              <div className="input-row">
                <textarea
                  value={input}
                  id="msgInput"
                  rows={1}
                  placeholder={cfg.placeholder}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendClick();
                    }
                  }}
                />
              </div>
              <div className="input-footer">
                <div className="input-hint">
                  <span className={`hint-dir ${cfg.inputHintRoleClass}`}>
                    {cfg.inputHintRole}
                  </span>
                  <span>{cfg.inputHintTail}</span>
                </div>
                <button
                  className="send-btn"
                  onClick={handleSendClick}
                  disabled={!isStreaming && input.trim().length === 0}
                >
                  {isStreaming ? "停止" : "发送"}
                </button>
              </div>
            </div>
          </div>
          <div className="disclaimer">
            翻译结果仅供参考，建议结合实际场景进一步沟通确认。
          </div>
        </div>
      </main>
      {modalType && (
        <div className="modal-overlay open" onClick={() => setModalType(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {MODAL_CONTENT[modalType].title}
              </div>
              <button
                className="modal-close"
                onClick={() => setModalType(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {MODAL_CONTENT[modalType].body.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
