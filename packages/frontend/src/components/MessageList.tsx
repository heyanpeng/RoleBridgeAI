import { DIR_CONFIG } from "../constants/global";
import type { ChatMessage } from "../types/types";
import { formatAI } from "../utils/contentFormatters";

// MessageList 组件的属性类型定义
type MessageListProps = {
  messages: ChatMessage[]; // 当前消息列表
  isStreaming: boolean; // 是否有消息正在流式生成（决定是否显示光标动画）
  onCopy: (content: string) => void; // 复制按钮回调函数
};

// 消息展示列表组件，根据消息类型(user/assistant)渲染不同气泡
export function MessageList({
  messages,
  isStreaming,
  onCopy,
}: MessageListProps) {
  return (
    <div className="msg-wrap">
      {/* 遍历每条消息，区分 user/assistant 渲染不同结构 */}
      {messages.map((message) =>
        message.role === "user" ? (
          // 用户消息气泡
          <div className="message user" key={message.id}>
            <div className="user-bubble-wrap">
              {/* 左侧角色标签（产品经理/开发） */}
              <div
                className={`user-role-tag ${message.dir === "pm2dev" ? "pm" : "dev"}`}
              >
                {DIR_CONFIG[message.dir].fromEmoji}{" "}
                {DIR_CONFIG[message.dir].from}
              </div>
              {/* 用户输入内容 */}
              <div className="user-bubble">{message.content}</div>
            </div>
          </div>
        ) : (
          // 助手（AI 翻译）消息气泡
          <div className="message assistant" key={message.id}>
            {/* AI 头像标识 */}
            <div className="ai-avatar">译</div>
            <div className="ai-content">
              {/* 译文目标标签 */}
              <div
                className={`ai-target-tag ${DIR_CONFIG[message.dir].targetClass}`}
              >
                {DIR_CONFIG[message.dir].targetLabel}
              </div>
              {/* AI 译文内容 */}
              <div className="ai-bubble">
                <div
                  className="ai-bubble-text"
                  // 通过 dangerouslySetInnerHTML 支持富文本/高亮排版
                  dangerouslySetInnerHTML={{
                    __html:
                      // 格式化 AI 内容（可带 html 格式）
                      formatAI(message.content) +
                      // 如果是最后一条且在流式中，补光标动效
                      (isStreaming &&
                      messages[messages.length - 1]?.id === message.id
                        ? '<span class="cursor"></span>'
                        : ""),
                  }}
                />
              </div>
              {/* 操作按钮栏 */}
              <div className="msg-actions">
                <button
                  className="act-btn"
                  onClick={() => void onCopy(message.content)}
                >
                  复制
                </button>
              </div>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
