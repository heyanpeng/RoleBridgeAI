import { useEffect, useRef, useState } from "react";
import "./App.css";
import { fetchTranslationStream } from "./api/api";
import { createFallback } from "./utils/contentFormatters";
import type { ChatMessage, Dir, HistoryItem, ModalType } from "./types/types";
import { Sidebar } from "./components/Sidebar";
import { WelcomePanel } from "./components/WelcomePanel";
import { MessageList } from "./components/MessageList";
import { InputPanel } from "./components/InputPanel";
import { InfoModal } from "./components/InfoModal";

function App() {
  const [currentDir, setCurrentDir] = useState<Dir>("pm2dev");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionHistory, setSessionHistory] = useState<HistoryItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [topbarLabel, setTopbarLabel] = useState("职能沟通翻译");
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const userScrollLockUntilRef = useRef(0);

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
      let fullText = "";
      const controller = new AbortController();
      abortRef.current = controller;
      fullText = await fetchTranslationStream({
        dir: useDir,
        text,
        signal: controller.signal,
        onDelta: (delta) => {
          fullText += delta;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: fullText } : m,
            ),
          );
        },
      });
      if (!fullText.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: createFallback(useDir, text) }
              : m,
          ),
        );
      } else if (stopRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `${m.content}\n\n∎ 已中断` }
              : m,
          ),
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (stopRef.current) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `${m.content}\n\n∎ 已中断` }
                : m,
            ),
          );
        }
        return;
      }
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
      abortRef.current = null;
    }
  };

  const handleSendClick = () => {
    if (isStreaming) {
      stopRef.current = true;
      abortRef.current?.abort();
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
      <Sidebar
        sessionHistory={sessionHistory}
        onNewSession={handleNewSession}
        onOpenModal={setModalType}
      />
      <main className="main">
        <div className="topbar">
          <div className="topbar-title">{topbarLabel}</div>
          <a
            className="github-link"
            href="https://github.com/heyanpeng/RoleBridgeAI"
            target="_blank"
            rel="noreferrer"
            aria-label="打开 GitHub 仓库"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12 1.5A10.5 10.5 0 0 0 1.5 12c0 4.67 3.03 8.63 7.23 10.03.53.1.72-.23.72-.51v-2.01c-2.94.64-3.56-1.25-3.56-1.25-.48-1.21-1.17-1.54-1.17-1.54-.95-.65.07-.64.07-.64 1.06.08 1.61 1.08 1.61 1.08.93 1.6 2.44 1.14 3.04.87.09-.68.36-1.15.65-1.41-2.34-.27-4.8-1.17-4.8-5.2 0-1.15.4-2.08 1.08-2.82-.1-.27-.47-1.36.1-2.83 0 0 .89-.29 2.92 1.08a10.2 10.2 0 0 1 5.3 0c2.03-1.37 2.92-1.08 2.92-1.08.57 1.47.2 2.56.1 2.83.68.74 1.08 1.67 1.08 2.82 0 4.04-2.47 4.92-4.83 5.18.38.33.72.97.72 1.96v2.9c0 .28.2.62.73.51A10.5 10.5 0 0 0 22.5 12 10.5 10.5 0 0 0 12 1.5Z"
              />
            </svg>
          </a>
        </div>
        <div
          className="messages-container"
          ref={msgContainerRef}
          onScroll={handleMsgScroll}
          onWheel={markUserScrolling}
          onTouchMove={markUserScrolling}
        >
          {showWelcome ? (
            <WelcomePanel
              currentDir={currentDir}
              onSwitchDir={setCurrentDir}
              onApplyExample={applyExample}
            />
          ) : (
            <MessageList
              messages={messages}
              isStreaming={isStreaming}
              onCopy={copyMsg}
            />
          )}
        </div>
        <InputPanel
          currentDir={currentDir}
          input={input}
          isStreaming={isStreaming}
          onInputChange={setInput}
          onSend={handleSendClick}
          onSwitchRole={switchRole}
        />
      </main>
      <InfoModal modalType={modalType} onClose={() => setModalType(null)} />
    </div>
  );
}

export default App;
