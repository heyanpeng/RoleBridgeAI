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
