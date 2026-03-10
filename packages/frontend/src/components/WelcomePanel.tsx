import { EXAMPLES } from "../constants/global";
import type { Dir } from "../types/types";

// WelcomePanel 组件属性类型定义
type WelcomePanelProps = {
  currentDir: Dir; // 当前选中的翻译方向
  onSwitchDir: (dir: Dir) => void; // 切换翻译方向回调
  onApplyExample: (dir: Dir, text: string) => void; // 应用示例输入回调
};

// 欢迎页面板组件，实现方向切换、示例快速填充等功能
export function WelcomePanel({
  currentDir,
  onSwitchDir,
  onApplyExample,
}: WelcomePanelProps) {
  return (
    <div className="welcome">
      {/* 顶部欢迎头部，包含图标和 Slogan */}
      <div className="welcome-header">
        <div className="welcome-icon">⇄</div>
        <div>
          <h1>职能沟通翻译助手</h1>
          <p>消除产品经理与开发工程师之间的语言鸿沟</p>
        </div>
      </div>
      {/* 方向选择卡片 */}
      <div className="dir-selector-welcome">
        {/* 产品经理（PM2Dev）卡片 */}
        <div
          className={`dir-card pm-card ${currentDir === "pm2dev" ? "selected" : ""}`}
          onClick={() => onSwitchDir("pm2dev")}
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
        {/* 中间箭头，根据方向变化是否旋转 */}
        <div
          className={`dir-arrow ${currentDir === "dev2pm" ? "reversed" : ""}`}
        >
          →
        </div>
        {/* 开发工程师（Dev2PM）卡片 */}
        <div
          className={`dir-card dev-card ${currentDir === "dev2pm" ? "selected" : ""}`}
          onClick={() => onSwitchDir("dev2pm")}
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
      {/* 示例建议区域 */}
      <div className="suggestion-chips">
        {/* 产品经理到开发的示例 */}
        <div className="chip-label">🎯 产品 → 开发 示例</div>
        <div className="chips-row">
          {EXAMPLES.pm2dev.map((example) => (
            <button
              className="chip pm-chip"
              key={example}
              onClick={() => onApplyExample("pm2dev", example)}
            >
              {example}
            </button>
          ))}
        </div>
        {/* 开发到产品经理的示例 */}
        <div className="chip-label">⚙️ 开发 → 产品 示例</div>
        <div className="chips-row">
          {EXAMPLES.dev2pm.map((example) => (
            <button
              className="chip dev-chip"
              key={example}
              onClick={() => onApplyExample("dev2pm", example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
