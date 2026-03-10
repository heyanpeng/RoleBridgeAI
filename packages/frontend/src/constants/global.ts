import type { DirConfigMap, ModalType } from "../types/types";

// 不同翻译方向的界面配置
export const DIR_CONFIG: DirConfigMap = {
  pm2dev: {
    from: "产品经理", // 发起方角色
    to: "开发工程师", // 目标方角色
    fromEmoji: "🎯", // 发起方图标
    targetLabel: "⚙️ 翻译给开发工程师", // AI译文标签
    targetClass: "to-dev", // 目标角色的样式class
    placeholder: "输入产品需求描述，例如：我们需要一个智能推荐功能...", // 输入框占位提示
    inputHintRole: "🎯 产品视角", // 输入区上方角色标签
    inputHintRoleClass: "pm", // 输入区上方角色class
    inputHintTail: "→ 翻译给开发", // 输入区上方翻译目标提示
    topHint: "翻译成技术语言", // 方向切换时顶部提示
  },
  dev2pm: {
    from: "开发工程师", // 发起方角色
    to: "产品经理", // 目标方角色
    fromEmoji: "⚙️", // 发起方图标
    targetLabel: "🎯 翻译给产品经理", // AI译文标签
    targetClass: "to-pm", // 目标角色的样式class
    placeholder:
      "输入技术方案描述，例如：我们优化了数据库查询，QPS提升了30%...", // 输入框占位提示
    inputHintRole: "⚙️ 开发视角", // 输入区上方角色标签
    inputHintRoleClass: "dev", // 输入区上方角色class
    inputHintTail: "→ 翻译给产品", // 输入区上方翻译目标提示
    topHint: "翻译成业务语言", // 方向切换时顶部提示
  },
};

// 常用输入示例，便于用户快速体验
export const EXAMPLES = {
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
} as const;

// 顶部弹窗内容合集（关于/说明）
export const MODAL_CONTENT: Record<
  ModalType,
  { title: string; body: string[] }
> = {
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
};

// 系统提示词，控制 AI 生成风格与角度
export const SYSTEM_PROMPTS = {
  pm2dev:
    "你是产品经理与开发工程师之间的沟通翻译助手。把产品需求翻译成开发可执行版本，覆盖技术方案、数据设计、性能规模、接口依赖、工时评估、技术风险。输出中文 Markdown。",
  dev2pm:
    "你是开发工程师与产品经理之间的沟通翻译助手。把技术描述翻译成产品可决策版本，覆盖用户体验影响、业务价值、增长空间、成本收益、风险降低、后续机会。输出中文 Markdown。",
} as const;

// 后端接口基础 URL，优先取环境变量，默认本地
export const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001";
