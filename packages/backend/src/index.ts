import fastify from "fastify";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatCompletionRequest = {
  model?: string;
  messages?: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
};

const port = Number(process.env.PORT) || 3001;
const app = fastify({ logger: true });
const llmBaseUrl = (
  process.env.LLM_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");
const llmModel = process.env.LLM_MODEL || "local-model";
const llmApiKey = process.env.LLM_API_KEY;

app.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (request.method === "OPTIONS") {
    return reply.code(204).send();
  }
});

app.get("/health", async () => {
  return { ok: true };
});

app.get("/api/chat/completions", async (request, reply) => {
  return reply.code(405).send({
    error: "method_not_allowed",
    message: "use POST /api/chat/completions",
  });
});

app.post<{ Body: ChatCompletionRequest }>(
  "/api/chat/completions",
  async (request, reply) => {
    const messages = request.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ error: "messages is required" });
    }

    const upstreamBody = {
      model: request.body.model || llmModel,
      messages,
      max_tokens: request.body.max_tokens ?? 1200,
      temperature: request.body.temperature ?? 0.3,
      stream: false,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (llmApiKey) {
      headers.Authorization = `Bearer ${llmApiKey}`;
    }

    try {
      const upstreamRes = await fetch(`${llmBaseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(upstreamBody),
      });

      if (!upstreamRes.ok) {
        const errText = await upstreamRes.text();
        return reply.code(502).send({
          error: "upstream_error",
          status: upstreamRes.status,
          details: errText,
        });
      }

      const data = await upstreamRes.json();
      return reply.send(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return reply
        .code(502)
        .send({ error: "upstream_unreachable", details: message });
    }
  },
);

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`backend listening on ${address}`);
});
