import { DIR_CONFIG } from "../constants/global";
import type { Dir } from "../types/types";

// InputPanel 组件的属性类型定义
type InputPanelProps = {
  currentDir: Dir; // 当前对话方向
  input: string; // 输入框内容
  isStreaming: boolean; // 是否正在流式翻译
  onInputChange: (value: string) => void; // 输入框变化回调
  onSend: () => void; // 发送按钮回调
  onSwitchRole: (role: "pm" | "dev") => void; // 切换角色回调
};

// 底部输入区组件，实现角色切换、输入、发送等功能
export function InputPanel({
  currentDir,
  input,
  isStreaming,
  onInputChange,
  onSend,
  onSwitchRole,
}: InputPanelProps) {
  // 按照当前方向获取配置
  const cfg = DIR_CONFIG[currentDir];

  return (
    <div className="input-area">
      <div className="input-wrap">
        {/* 方向切换卡片条 */}
        <div className="dir-card-bar">
          {/* 产品经理卡片 */}
          <div
            className={`dir-role-card pm ${currentDir === "pm2dev" ? "selected-from" : "selected-to"}`}
            onClick={() => onSwitchRole("pm")}
          >
            <div className="card-role-name">🎯 产品经理</div>
            <div className="card-role-desc">我来描述需求</div>
          </div>
          {/* 箭头+切换提示 */}
          <div className="dir-arrow-connector">
            <div
              className={`dir-arrow-icon ${currentDir === "dev2pm" ? "reversed" : ""}`}
            >
              →
            </div>
            <span className="dir-swap-hint">{cfg.topHint}</span>
          </div>
          {/* 开发工程师卡片 */}
          <div
            className={`dir-role-card dev ${currentDir === "dev2pm" ? "selected-from" : "selected-to"}`}
            onClick={() => onSwitchRole("dev")}
          >
            <div className="card-role-name">⚙️ 开发工程师</div>
            <div className="card-role-desc">我来描述方案</div>
          </div>
        </div>
        {/* 输入区盒子 */}
        <div className="input-box">
          <div className="input-row">
            {/* 用户输入内容的文本区域 */}
            <textarea
              value={input}
              id="msgInput"
              rows={1}
              placeholder={cfg.placeholder}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                // 支持回车快捷发送（shift+回车换行）
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
            />
          </div>
          {/* 输入区下方提示与发送按钮 */}
          <div className="input-footer">
            <div className="input-hint">
              <span className={`hint-dir ${cfg.inputHintRoleClass}`}>
                {cfg.inputHintRole}
              </span>
              <span>{cfg.inputHintTail}</span>
            </div>
            {/* 发送/停止按钮 */}
            <button
              className="send-btn"
              onClick={onSend}
              // 没有输入内容且未流式时禁用按钮
              disabled={!isStreaming && input.trim().length === 0}
            >
              {isStreaming ? "停止" : "发送"}
            </button>
          </div>
        </div>
      </div>
      {/* 底部免责声明 */}
      <div className="disclaimer">
        翻译结果仅供参考，建议结合实际场景进一步沟通确认。
      </div>
    </div>
  );
}
