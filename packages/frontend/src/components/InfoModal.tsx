import { MODAL_CONTENT } from "../constants/global";
import type { ModalType } from "../types/types";

// InfoModal 组件属性类型定义
type InfoModalProps = {
  modalType: ModalType | null; // 当前弹窗类型，null 表示不显示
  onClose: () => void; // 关闭弹窗时的回调
};

// 信息弹窗组件，根据传入的 modalType 显示对应内容
export function InfoModal({ modalType, onClose }: InfoModalProps) {
  // 若未指定 modalType，不渲染弹窗
  if (!modalType) return null;

  return (
    // 遮罩层，点击遮罩关闭弹窗
    <div className="modal-overlay open" onClick={onClose}>
      {/* 弹窗主体，阻止事件冒泡避免关闭弹窗 */}
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          {/* 弹窗标题 */}
          <div className="modal-title">{MODAL_CONTENT[modalType].title}</div>
          {/* 关闭按钮 */}
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {/* 渲染弹窗正文，每行一个 <p> */}
          {MODAL_CONTENT[modalType].body.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
