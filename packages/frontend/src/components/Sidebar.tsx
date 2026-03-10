import type { HistoryItem, ModalType } from "../types/types";

// Sidebar 组件属性类型定义
type SidebarProps = {
  sessionHistory: HistoryItem[]; // 历史会话列表
  onNewSession: () => void; // 新建会话回调
  onOpenModal: (modal: ModalType) => void; // 打开关于/说明弹窗
};

// 侧边栏组件，实现 logo、新建会话、历史记录和底部菜单
export function Sidebar({
  sessionHistory,
  onNewSession,
  onOpenModal,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* 顶部 logo 区域 */}
      <div className="sidebar-logo">
        <div className="logo-badge">译</div>
        职能翻译助手
      </div>
      {/* 新建会话按钮 */}
      <button className="new-btn" onClick={onNewSession}>
        <span>＋</span>
        新建会话
      </button>
      {/* 历史记录标签 */}
      <div className="sidebar-label">历史记录</div>
      <div>
        {/* 历史会话列表，每个显示方向点+文本 */}
        {sessionHistory.map((item) => (
          <div className="history-item" key={item.id}>
            {/* 会话方向圆点 */}
            <div
              className={`history-dot ${item.dir === "pm2dev" ? "pm" : "dev"}`}
            />
            {/* 会话文本内容 */}
            <div className="history-text">{item.text}</div>
          </div>
        ))}
      </div>
      {/* 占位拉伸，撑开底部 */}
      <div className="sidebar-spacer" />
      {/* 底部操作栏 */}
      <div className="sidebar-footer">
        {/* 关于助手弹窗入口 */}
        <div className="footer-item" onClick={() => onOpenModal("about")}>
          关于助手
        </div>
        {/* 使用说明弹窗入口 */}
        <div className="footer-item" onClick={() => onOpenModal("guide")}>
          使用说明
        </div>
      </div>
    </aside>
  );
}
