#!/usr/bin/env node
// ChatGPT als Kontroll-Tool für Claude Code (MCP-Server, ohne Zusatzpakete).
// Claude kann damit Code oder Pläne von ChatGPT gegenprüfen lassen.
//
// Der OpenAI-API-Schlüssel steht NICHT hier und NICHT im Repo (öffentlich!).
// In der Cloud fügt ihn das „Network Secret“ der Claude-Code-Umgebung
// automatisch an Anfragen an api.openai.com an. Lokal ginge alternativ die
// Umgebungsvariable OPENAI_API_KEY.

import { createInterface } from "node:readline";

const MODEL = process.env.OPENAI_MODEL || "gpt-6.2-sol";
const API_KEY = process.env.OPENAI_API_KEY || "";

const SYSTEM = `Du bist ein kritischer Zweitprüfer. Eine andere KI (Claude) legt dir Code,
einen Plan oder eine Antwort vor. Prüfe auf Fehler, Bugs, Sicherheitslücken, falsche
Annahmen und übersehene Randfälle. Sei konkret und knapp, nenne die wichtigsten Punkte zuerst.
Wenn alles stimmt, sag das klar. Antworte auf Deutsch.`;

const TOOL = {
  name: "ask_chatgpt",
  description:
    "Holt eine unabhängige Zweitmeinung von ChatGPT ein, um Code, einen Plan oder eine Antwort " +
    "gegenzuprüfen. ChatGPT sieht weder das Gespräch noch das Repo – gib allen nötigen Kontext mit. " +
    "Niemals Geheimnisse (Schlüssel, E-Mail-Adressen, private Daten) mitschicken.",
  inputSchema: {
    type: "object",
    properties: {
      question: { type: "string", description: "Was ChatGPT prüfen oder beantworten soll" },
      context: { type: "string", description: "Zu prüfender Inhalt, z. B. Code-Ausschnitt oder Diff" },
    },
    required: ["question"],
  },
};

const URL_OPENAI = "https://api.openai.com/v1/chat/completions";

// Weg 1: Node-eigenes fetch.
async function postWithFetch(body) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const res = await fetch(URL_OPENAI, { method: "POST", headers, body });
  return { status: res.status, text: await res.text() };
}

// Weg 2 (Ausweich-Route): curl nutzt den Proxy der Cloud-Umgebung zuverlässig.
// Kopfzeilen kommen per stdin (curl -K -), damit kein Schlüssel in der Prozessliste steht.
async function postWithCurl(body) {
  const { execFile } = await import("node:child_process");
  const { writeFile, rm, mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "chatgpt-"));
  const bodyFile = join(dir, "body.json");
  await writeFile(bodyFile, body);
  const cfg = ['header = "Content-Type: application/json"'];
  if (API_KEY) cfg.push(`header = "Authorization: Bearer ${API_KEY}"`);
  try {
    const out = await new Promise((resolve, reject) => {
      const child = execFile(
        "curl",
        ["-sS", "-K", "-", "-X", "POST", "--data-binary", `@${bodyFile}`, "-w", "\n%{http_code}", URL_OPENAI],
        { maxBuffer: 20 * 1024 * 1024, timeout: 300000 },
        (err, stdout, stderr) => (err ? reject(new Error(stderr.trim() || err.message)) : resolve(stdout))
      );
      child.stdin.end(cfg.join("\n") + "\n");
    });
    const cut = out.lastIndexOf("\n");
    return { status: Number(out.slice(cut + 1)), text: out.slice(0, cut) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function askChatGPT({ question, context }) {
  const userMsg = context ? `${question}\n\n--- Inhalt ---\n${context}` : question;
  const body = JSON.stringify({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMsg },
    ],
  });
  let r;
  try {
    r = await postWithFetch(body);
  } catch (fetchErr) {
    try {
      r = await postWithCurl(body);
    } catch (curlErr) {
      throw new Error(
        `api.openai.com nicht erreichbar (fetch: ${fetchErr.cause?.code || fetchErr.message}; curl: ${curlErr.message}). ` +
        "→ Ist das Network Secret für api.openai.com in der Cloud-Umgebung eingetragen?"
      );
    }
  }
  const res = { ok: r.status >= 200 && r.status < 300, status: r.status };
  const text = r.text;
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!res.ok) {
    let hint = "";
    if (res.status === 401) hint = " → API-Schlüssel fehlt oder falsch (Network Secret prüfen).";
    if (res.status === 403) hint = " → Zugriff auf api.openai.com blockiert (Network Secret / Netzwerk prüfen).";
    if (res.status === 429) hint = " → Kein Guthaben mehr oder zu viele Anfragen.";
    throw new Error(`OpenAI-Fehler ${res.status}: ${data?.error?.message ?? text.slice(0, 300)}${hint}`);
  }
  return data?.choices?.[0]?.message?.content ?? "(leere Antwort)";
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // Benachrichtigung, keine Antwort nötig
  switch (method) {
    case "initialize":
      return send({
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "chatgpt-kontrolle", version: "1.0.0" },
        },
      });
    case "ping":
      return send({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return send({ jsonrpc: "2.0", id, result: { tools: [TOOL] } });
    case "tools/call": {
      if (params?.name !== TOOL.name) {
        return send({ jsonrpc: "2.0", id, error: { code: -32602, message: `Unbekanntes Tool: ${params?.name}` } });
      }
      const args = params.arguments || {};
      if (typeof args.question !== "string" || !args.question.trim()) {
        return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: "Feld „question“ fehlt." }] } });
      }
      try {
        const answer = await askChatGPT(args);
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `ChatGPT (${MODEL}) meint:\n\n${answer}` }] } });
      } catch (e) {
        return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: e.message }] } });
      }
    }
    default:
      return send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unbekannte Methode: ${method}` } });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Ungültiges JSON" } });
  }
  handle(msg).catch((e) => send({ jsonrpc: "2.0", id: msg.id ?? null, error: { code: -32603, message: e.message } }));
});
