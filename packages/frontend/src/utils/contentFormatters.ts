import type { Dir } from "../types/types";

/**
 * 对HTML特殊字符进行转义，避免注入攻击和标签错乱
 * @param s 需要转义的字符串
 * @returns 转义后的字符串
 */
const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * 格式化AI返回的文本为富文本HTML，支持加粗、标题、列表、内联代码等
 * @param text 原始AI文本
 * @returns 格式化后的HTML字符串
 */
export const formatAI = (text: string) => {
  // 1. 首先进行HTML转义，防止注入
  let html = escHtml(text);
  // 2. 加粗语法：**text** 转为 <strong>
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // 3. 标题语法：### text 或 ## text 转为 <h3>
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  // 4. 列表项语法：- 或 • 开头行转为 <li>
  html = html.replace(/^[-•] (.+)$/gm, "<li>$1</li>");
  // 5. 连续<li>分组包裹到<ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  // 6. 行内代码：`code` 转为 <code>
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // 7. 用空行分块
  const blocks = html.split(/\n\n+/);
  return blocks
    .map((b) => {
      const t = b.trim();
      if (!t) return "";
      // 如果是标题或ul列表，直接输出
      if (t.startsWith("<h3>") || t.startsWith("<ul>")) return t;
      // 其余用<p>包裹，每行换成<br>
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
};

/**
 * 没有AI返回时的兜底预设内容
 * @param dir 当前方向
 * @param text 用户输入内容
 * @returns 兜底AI结构化回答
 */
export const createFallback = (dir: Dir, text: string) => {
  if (dir === "pm2dev") {
    // 产品需求转技术方案的兜底内容
    return `### 技术翻译\n- 目标：${text}\n- 推荐方案：拆分为前端交互、服务端能力、数据指标三层实现\n- 数据设计：定义核心实体、埋点字段、状态流转\n- 工时建议：需求澄清 0.5 天，开发 2-4 天，联调验收 1 天\n- 风险提示：边界场景未定义会影响交付稳定性`;
  }
  // 技术转业务价值的兜底内容
  return `### 业务翻译\n- 用户价值：${text}\n- 直观收益：体验更快、更稳，减少等待和失败感知\n- 业务影响：提升转化与留存，降低客服投诉\n- 成本收益：同等资源支撑更大业务规模\n- 后续机会：可继续做精细化运营和自动化增长实验`;
};
