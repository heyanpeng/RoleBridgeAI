import { BACKEND_BASE_URL, SYSTEM_PROMPTS } from "../constants/global";
import type { Dir } from "../types/types";

// 后端 SSE 响应单元数据结构
type StreamPayload = { delta?: string };

// 翻译流式请求的参数类型
type FetchTranslationStreamOptions = {
  dir: Dir; // 方向（"pm2dev" | "dev2pm"）
  text: string; // 待翻译文本
  signal: AbortSignal; // 用于取消请求的信号
  onDelta: (delta: string) => void; // 每次有新内容时的回调，delta 为新增内容
};

// 执行流式翻译请求，处理 SSE 数据，逐步回调增量内容
export const fetchTranslationStream = async ({
  dir,
  text,
  signal,
  onDelta,
}: FetchTranslationStreamOptions) => {
  // 发起后端 SSE 翻译流请求
  const res = await fetch(`${BACKEND_BASE_URL}/api/chat/completions/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: "local-model",
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[dir] }, // 系统提示词
        { role: "user", content: text }, // 用户输入
      ],
    }),
  });

  // 处理响应状态或 body 异常
  if (!res.ok || !res.body) {
    const errorText = await res.text().catch(() => "");
    throw new Error(errorText || "请求失败");
  }

  // 获取可读流 reader
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let eventBuffer = ""; // 累积未处理的数据块（按 \n\n 分割）
  let fullText = ""; // 完整的已翻译文本

  // 循环读取流内容，处理每个增量
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // 按照流方式解码追加到 buffer
    eventBuffer += decoder.decode(value, { stream: true });

    // 查找下一个数据块，以 \n\n 作为流式 SSE 的 block 边界
    let sepIndex = eventBuffer.indexOf("\n\n");
    while (sepIndex !== -1) {
      const block = eventBuffer.slice(0, sepIndex); // 一个完整的事件块
      eventBuffer = eventBuffer.slice(sepIndex + 2); // 删除已处理
      const dataLines = block
        .split("\n")
        .filter((line) => line.startsWith("data:")) // 只保留 data 行
        .map((line) => line.slice(5).trimStart()); // 去除 "data:" 前缀

      if (dataLines.length === 0) {
        sepIndex = eventBuffer.indexOf("\n\n"); // 继续查找下一个块
        continue;
      }

      const payload = dataLines.join("\n"); // 合并多行（某些情况多 data 段）
      if (payload === "[DONE]") {
        // 标识流结束，返回所有文本
        return fullText;
      }

      try {
        // 尝试解析 json 增量数据
        const parsed = JSON.parse(payload) as StreamPayload;
        const delta = parsed.delta;
        // 如果本次有有效的 delta，累积并回调
        if (typeof delta === "string" && delta.length > 0) {
          fullText += delta;
          onDelta(delta);
        }
      } catch {
        // json 解析异常，可能为已截断或错误片段，跳到下一个
        sepIndex = eventBuffer.indexOf("\n\n");
        continue;
      }

      sepIndex = eventBuffer.indexOf("\n\n"); // 查找下一个完整数据块
    }
  }

  // 返回最终累积的完整译文
  return fullText;
};
