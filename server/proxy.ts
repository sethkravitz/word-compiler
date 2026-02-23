import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express from "express";
import { createApiRouter } from "./api/routes.js";
import { getDatabase } from "./db/connection.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database and mount REST API
const db = getDatabase();
app.use("/api/data", createApiRouter(db));

const client = new Anthropic();

// Cache models list — it doesn't change during a session
let modelsCache: Array<{ id: string; displayName: string; contextWindow: number; maxOutput: number }> | null = null;

app.get("/api/models", async (_req, res) => {
  try {
    if (modelsCache) {
      res.json({ models: modelsCache });
      return;
    }

    const response = await client.models.list({ limit: 100 });
    const models = response.data
      .filter((m: { type: string }) => m.type === "model")
      .map((m: any) => ({
        id: m.id,
        displayName: m.display_name ?? m.id,
        contextWindow: m.context_window ?? 200000,
        maxOutput: m.max_output ?? 64000,
      }))
      .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

    modelsCache = models;
    res.json({ models });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(status).json({ error: message });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const { systemMessage, userMessage, temperature, topP, maxTokens, model, outputSchema } = req.body;

    // Anthropic API forbids sending both temperature and top_p together.
    // Prefer temperature; only use top_p when temperature is absent.
    const samplingParams: { temperature?: number; top_p?: number } =
      temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

    const response = await client.messages.create({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens || 2000,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
      ...(outputSchema && {
        output_config: { format: { type: "json_schema" as const, schema: outputSchema } },
      }),
    });

    const textBlock = response.content.find((b: { type: string }) => b.type === "text");
    if (!textBlock) {
      res.status(502).json({ error: "LLM response contained no text content" });
      return;
    }
    res.json({
      text: (textBlock as { text: string }).text,
      usage: response.usage,
      stopReason: response.stop_reason,
    });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500;
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(status).json({ error: message });
  }
});

// Streaming endpoint — SSE
app.post("/api/generate/stream", async (req, res) => {
  const { systemMessage, userMessage, temperature, topP, maxTokens, model, outputSchema } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const samplingParams: { temperature?: number; top_p?: number } =
    temperature != null ? { temperature } : topP != null ? { top_p: topP } : { temperature: 0.8 };

  function safeWrite(data: string) {
    if (!res.writableEnded && !res.destroyed) res.write(data);
  }
  function safeEnd() {
    if (!res.writableEnded && !res.destroyed) res.end();
  }

  try {
    const stream = client.messages.stream({
      model: model || "claude-sonnet-4-6",
      max_tokens: maxTokens || 2000,
      ...samplingParams,
      system: systemMessage,
      messages: [{ role: "user", content: userMessage }],
      ...(outputSchema && {
        output_config: { format: { type: "json_schema" as const, schema: outputSchema } },
      }),
    });

    // Abort the upstream Anthropic stream when the client disconnects
    // to prevent wasting API tokens on responses nobody is reading
    req.on("close", () => {
      stream.abort();
    });

    stream.on("text", (text: string) => {
      safeWrite(`data: ${JSON.stringify({ type: "delta", text })}\n\n`);
    });

    stream.on("error", (err: Error) => {
      safeWrite(`data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`);
      safeEnd();
    });

    const finalMessage = await stream.finalMessage();
    safeWrite(
      `data: ${JSON.stringify({
        type: "done",
        usage: finalMessage.usage,
        stopReason: finalMessage.stop_reason,
      })}\n\n`,
    );
    safeEnd();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    safeWrite(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`);
    safeEnd();
  }
});

export { app };

const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Proxy listening on http://localhost:${PORT}`);
  });
}
