import { z } from "zod";

export const evidenceSchema = z.object({ id: z.string(), label: z.string(), content: z.string(), sourceUrl: z.string().url().optional() });
export const draftSchema = z.object({ title: z.string(), sections: z.array(z.object({ heading: z.string(), paragraphs: z.array(z.string()), evidenceIds: z.array(z.string()) })), bibliography: z.array(z.object({ evidenceId: z.string(), citation: z.string() })), unresolvedQuestions: z.array(z.string()) });
export const evaluationSchema = z.object({ estimatedScore: z.number().min(0).max(10), criticalErrors: z.array(z.string()), criteria: z.array(z.object({ rubricItemId: z.string(), fulfilled: z.boolean(), score: z.number().min(0).max(10), explanation: z.string(), requestedChanges: z.array(z.string()) })), overallFeedback: z.string(), ready: z.boolean() });

export type Evidence = z.infer<typeof evidenceSchema>;
export type Draft = z.infer<typeof draftSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;

export function parseJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La IA no devolvió un objeto JSON.");
  return JSON.parse(text.slice(start, end + 1)) as unknown;
}
