import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { draftSchema, parseJsonObject, type Draft, type Evidence } from "./contracts";

export async function createStudentDraft(input: { prompt: string; assignment: string; rubric: string; evidence: Evidence[]; previousDraft?: Draft; corrections?: string[] }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey || !model) throw new Error("Claude no está configurado.");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model, max_tokens: 12000, system: `${input.prompt}\nRespondé únicamente con JSON válido según la estructura solicitada. No inventes datos y usá solo los IDs de evidencia recibidos.`,
    messages: [{ role: "user", content: JSON.stringify({ task: "Redactar o revisar el trabajo práctico", assignment: input.assignment, rubric: input.rubric, evidence: input.evidence, previousDraft: input.previousDraft, corrections: input.corrections, output: { title: "string", sections: [{ heading: "string", paragraphs: ["string"], evidenceIds: ["string"] }], bibliography: [{ evidenceId: "string", citation: "string" }], unresolvedQuestions: ["string"] } }) }],
  });
  const text = response.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
  return draftSchema.parse(parseJsonObject(text));
}
