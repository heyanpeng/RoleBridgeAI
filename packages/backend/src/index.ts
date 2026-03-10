import fastify from "fastify";
const port = Number(process.env.PORT) || 3000;
const app = fastify({ logger: true });

app.get("/health", async () => {
  return { ok: true };
});

app.listen({ port }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`backend listening on ${address}`);
});
