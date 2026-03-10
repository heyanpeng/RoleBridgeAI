import fastify from "fastify";

// 聊天消息接口
type ChatMessage = {
  role: "system" | "user" | "assistant"; // 消息身份
  content: string; // 消息内容
};

// 聊天补全请求接口
type ChatCompletionRequest = {
  model?: string; // 模型名称
  messages?: ChatMessage[]; // 聊天消息列表
  max_tokens?: number; // 生成最大token数
  temperature?: number; // 采样温度
  stream?: boolean; // 是否流式返回
};

// 流式返回的chunk结构
type StreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string; // 补全文本内容
    };
  }>;
};

// 服务器端口，来自环境变量或默认3001
const port = Number(process.env.PORT) || 3001;

// 创建fastify应用，启用日志
const app = fastify({ logger: true });

// LLM后端服务基础URL（去除尾部/）
const llmBaseUrl = (
  process.env.LLM_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// 默认模型名
const llmModel = process.env.LLM_MODEL || "local-model";

// LLM API密钥
const llmApiKey = process.env.LLM_API_KEY;

// 全局请求钩子：设置CORS响应头并处理预检请求
app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (request.method === "OPTIONS") {
    // 预检请求直接返回204
    return reply.code(204).send();
  }
});

// 健康检查接口
app.get("/health", async () => {
  return { ok: true };
});

// 阻止GET方式调用chat completions，提示应使用POST
app.get("/api/chat/completions", async (request, reply) => {
  return reply.code(405).send({
    error: "method_not_allowed",
    message: "use POST /api/chat/completions",
  });
});

// 聊天补全普通模式（非流式）接口
app.post<{ Body: ChatCompletionRequest }>(
  "/api/chat/completions",
  async (request, reply) => {
    const messages = request.body?.messages;
    // 校验请求内容
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages is required" });
    }

    // 构造上游请求体
    const upstreamBody = {
      model: request.body.model || llmModel,
      messages,
      max_tokens: request.body.max_tokens ?? 1200,
      temperature: request.body.temperature ?? 0.3,
      stream: false,
    };

    // 设置请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (llmApiKey) {
      headers.Authorization = `Bearer ${llmApiKey}`;
    }

    try {
      // 代理请求到llm服务
      const upstreamRes = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
      });

      // 上游响应异常处理
      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        return reply.code(502).send({
          error: "upstream_error",
          status: upstreamRes.status,
          details: errText,
        });
      }

      // 透传上游响应数据
      const data = await upstreamRes.json();
      return reply.send(data);
    } catch (error) {
      // 网络异常捕获
      const message = error instanceof Error ? error.message : "unknown error";
      return reply
        .code(502)
        .send({ error: "upstream_unreachable", details: message });
    }
  },
);

// 聊天补全流式输出接口（SSE）
app.post<{ Body: ChatCompletionRequest }>(
  "/api/chat/completions/stream",
  async (request, reply) => {
    const messages = request.body?.messages;
    // 校验请求内容
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages is required" });
    }

    // 构造上游请求体（流式）
    const upstreamBody = {
      model: request.body.model || llmModel,
      messages,
      max_tokens: request.body.max_tokens ?? 1200,
      temperature: request.body.temperature ?? 0.3,
      stream: true,
    };

    // 设置请求头
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };
    if (llmApiKey) {
      headers.Authorization = `Bearer ${llmApiKey}`;
    }

    // 查询用户中断，做流连接终止
    const abortController = new AbortController();
    request.raw.on("close", () => {
      if (request.raw.aborted) {
        abortController.abort();
      }
    });

    try {
      // 请求llm服务流式补全接口
      const upstreamRes = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
        signal: abortController.signal,
      });

      // 上游响应检查
      if (!upstreamRes.ok || !upstreamRes.body) {
        const errText = await upstreamRes.text().catch(() => "");
        return reply.code(502).send({
          error: "upstream_error",
          status: upstreamRes.status,
          details: errText,
        });
      }

      // 设置SSE响应头
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });

      // 读取上游响应流数据
      const reader = upstreamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // 解析SSE块
        let sepIndex = buffer.indexOf("\n\n");
        while (sepIndex !== -1) {
          // 获取一个块
          const block = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);
          // 提取所有data字段内容
          const dataLines = block
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart());
          if (dataLines.length === 0) {
            sepIndex = buffer.indexOf("\n\n");
            continue;
          }

          const payload = dataLines.join("\n");
          if (payload === "[DONE]") {
            // 流结束标识，关闭连接
            reply.raw.write("data: [DONE]\n\n");
            reply.raw.end();
            return;
          }

          try {
            // 取delta内容，转发给前端
            const parsed = JSON.parse(payload) as StreamChunk;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              reply.raw.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          } catch {}
          sepIndex = buffer.indexOf("\n\n");
        }
      }

      // 正常结束时通知客户端流结束
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
      return;
    } catch (error) {
      // 网络异常捕获
      const message = error instanceof Error ? error.message : "unknown error";
      if (!reply.sent) {
        return reply
          .code(502)
          .send({ error: "upstream_unreachable", details: message });
      }
      return;
    }
  },
);

// 启动服务监听
app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`backend listening on ${address}`);
});
