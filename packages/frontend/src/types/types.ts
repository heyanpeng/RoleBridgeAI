// 会话可选的方向类型：产品经理 → 开发 ("pm2dev") 或 开发 → 产品经理 ("dev2pm")
export type Dir = "pm2dev" | "dev2pm";

// 消息发送者角色类型：用户或助手
export type MessageRole = "user" | "assistant";

// 单条聊天消息类型定义
export type ChatMessage = {
  id: string; // 消息唯一标识
  role: MessageRole; // 角色：user 或 assistant
  content: string; // 消息内容
  dir: Dir; // 当前方向
};

// 历史会话项目类型定义
export type HistoryItem = {
  id: string; // 项目标识
  dir: Dir; // 会话方向
  text: string; // 显示文本
};

// 模态框类型：关于 or 使用说明
export type ModalType = "about" | "guide";

// 单个方向配置项类型定义
export type DirConfigItem = {
  from: string; // 源角色名称
  to: string; // 目标角色名称
  fromEmoji: string; // 源角色 emoji
  targetLabel: string; // 目标标签
  targetClass: string; // 目标标签样式类
  placeholder: string; // 输入框占位提示
  inputHintRole: string; // 输入角色提示文本
  inputHintRoleClass: "pm" | "dev"; // 输入角色提示样式类
  inputHintTail: string; // 输入尾部提示文本
  topHint: string; // 输入框上方提示
};

// 方向配置集合类型，键为方向名，值为配置项
export type DirConfigMap = Record<Dir, DirConfigItem>;
