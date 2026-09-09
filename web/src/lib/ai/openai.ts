import "server-only";
import OpenAI from "openai";
import { evaluationSchema, parseJsonObject, type Draft, type Evidence } from "./contracts";

export async function evaluateProfessor(input: { prompt: string; assignment: string; rubric: string; draft: Draft; evidence: Evidence[] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) throw new Error("ChatGPT no está configurado.");
  const client = new OpenAI({ apiKey });
  const response = await client.responses.create({ model, instructions: `${input.prompt}\nActuá como catedrático. Respondé solo con JSON válido. No aceptes afirmaciones cuyo evidenceId no exista.`, input: JSON.stringify({ assignment: input.assignment, rubric: input.rubric, draft: input.draft, evidence: input.evidence, output: { estimatedScore: 0, criticalErrors: ["string"], criteria: [{ rubricItemId: "string", fulfilled: false, score: 0, explanation: "string", requestedChanges: ["string"] }], overallFeedback: "string", ready: false } }) });
  return evaluationSchema.parse(parseJsonObject(response.output_text));
}
