export type SubjectStatus = "En curso" | "Finalizada";
export type Subject = {
  id: string; name: string; code: string; period: string; status: SubjectStatus;
  sources: number; precedents: number; update: string;
  updateTone: "violet" | "emerald" | "blue" | "neutral"; progress: number;
};

export const subjects: Subject[] = [
  { id: "personas-juridicas", name: "Personas Jurídicas", code: "CPB-312", period: "2.º semestre 2026", status: "En curso", sources: 12, precedents: 3, update: "Actividad 3 en revisión", updateTone: "violet", progress: 68 },
  { id: "estadistica", name: "Estadística", code: "CPB-208", period: "2.º semestre 2026", status: "En curso", sources: 8, precedents: 2, update: "Sin trabajos pendientes", updateTone: "neutral", progress: 42 },
  { id: "contabilidad-iii", name: "Contabilidad III", code: "CPB-305", period: "2.º semestre 2026", status: "En curso", sources: 17, precedents: 5, update: "Actividad 2 lista para descargar", updateTone: "emerald", progress: 81 },
  { id: "derecho-laboral", name: "Derecho Laboral", code: "CPB-214", period: "1.º semestre 2026", status: "Finalizada", sources: 21, precedents: 4, update: "Última actividad: 10/10 estimado", updateTone: "blue", progress: 100 },
  { id: "impuestos-i", name: "Impuestos I", code: "CPB-301", period: "2.º semestre 2026", status: "En curso", sources: 24, precedents: 2, update: "Consigna pendiente de completar", updateTone: "neutral", progress: 35 },
  { id: "matematica-financiera", name: "Matemática Financiera", code: "CPB-203", period: "1.º semestre 2026", status: "Finalizada", sources: 10, precedents: 3, update: "Materia archivada", updateTone: "neutral", progress: 100 },
];
