/**
 * Gerador determinístico de embeddings semânticos clínicos de 384 dimensões (pgvector HNSW).
 */

const CLINICAL_CLUSTERS: Array<{ dims: number[]; terms: string[] }> = [
  {
    dims: [0, 1, 2, 3, 4, 5, 6, 7],
    terms: ['glicose', 'glicemia', 'hba1c', 'glicada', 'diabetes', 'metformina', 'insulina', 'acucar', 'metabolismo', 'jejum'],
  },
  {
    dims: [8, 9, 10, 11, 12, 13, 14, 15],
    terms: ['colesterol', 'ldl', 'hdl', 'triglicerideos', 'triglicerides', 'lipidios', 'dislipidemia', 'aterogenica', 'estatins', 'rosuvastatina', 'atorvastatina'],
  },
  {
    dims: [16, 17, 18, 19, 20, 21, 22, 23],
    terms: ['ferritina', 'ferro', 'hemoglobina', 'hematocrito', 'eritrocitos', 'anemia', 'fadiga', 'cansaco', 'fraqueza', 'hematologia', 'pancitopenia', 'plaquetas', 'leucocitos'],
  },
  {
    dims: [24, 25, 26, 27, 28, 29, 30, 31],
    terms: ['tsh', 't4', 'tireoide', 'hipotireoidismo', 'levotiroxina', 'hormonio', 'metabolico'],
  },
  {
    dims: [32, 33, 34, 35, 36, 37, 38, 39],
    terms: ['coracao', 'cardiaco', 'bpm', 'frequencia', 'taquicardia', 'arritmia', 'batimentos', 'pulso', 'hrv', 'variabilidade', 'wearable', 'relogio', 'apple watch'],
  },
  {
    dims: [40, 41, 42, 43, 44, 45, 46, 47],
    terms: ['sono', 'dormir', 'noturno', 'noturna', 'profundo', 'rem', 'insonia', 'repouso', 'recuperacao', 'prontidao'],
  },
  {
    dims: [48, 49, 50, 51, 52, 53, 54, 55],
    terms: ['spo2', 'oxigenio', 'saturacao', 'respiratorio', 'dispneia', 'falta de ar', 'h1n1', 'influenza', 'febre', 'tosse', 'pulmao', 'oseltamivir'],
  },
  {
    dims: [56, 57, 58, 59, 60, 61, 62, 63],
    terms: ['figado', 'hepatico', 'tgo', 'tgp', 'ast', 'alt', 'ggt', 'bilirrubina', 'albumina', 'esplenomegalia', 'leishmaniose', 'anfotericina'],
  },
  {
    dims: [64, 65, 66, 67, 68, 69, 70, 71],
    terms: ['rim', 'renal', 'creatinina', 'ureia', 'tfg', 'filtracao', 'acido urico', 'nefrologia'],
  },
  {
    dims: [72, 73, 74, 75, 76, 77, 78, 79],
    terms: ['inflamacao', 'pcr', 'proteina c reativa', 'vhs', 'infeccao', 'alerta', 'anomalia', 'critico', 'atencao'],
  },
  {
    dims: [80, 81, 82, 83, 84, 85, 86, 87],
    terms: ['vitamina', 'vitamina d', 'b12', 'nutricional', 'suplemento', 'colecalciferol', 'sodio', 'potassio', 'calcio', 'magnesio'],
  },
  {
    dims: [88, 89, 90, 91, 92, 93, 94, 95],
    terms: ['exame', 'laudo', 'laboratorio', 'fleury', 'dasa', 'zoppi', 'sabin', 'resultado', 'historico', 'resumo', 'geral'],
  },
];

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computeEmbedding384(text: string): number[] {
  const vec = new Array<number>(384).fill(0);
  const norm = normalizeText(text || 'contexto clinico geral');

  for (const cluster of CLINICAL_CLUSTERS) {
    let score = 0;
    for (const term of cluster.terms) {
      if (norm.includes(term)) {
        score += 1.5;
      }
    }
    if (score > 0) {
      for (let i = 0; i < cluster.dims.length; i++) {
        vec[cluster.dims[i]] += score * (1 - i * 0.04);
      }
    }
  }

  const tokens = norm.split(' ').filter(Boolean);
  for (const token of tokens) {
    let h = 2166136261;
    for (let i = 0; i < token.length; i++) {
      h ^= token.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const idx1 = 96 + (Math.abs(h) % 288);
    const idx2 = 96 + (Math.abs(h >> 8) % 288);
    vec[idx1] += 0.6;
    vec[idx2] += 0.35;
  }

  for (let i = 0; i < 16; i++) {
    vec[i] += 0.08;
  }

  let mag = 0;
  for (let i = 0; i < 384; i++) {
    mag += vec[i] * vec[i];
  }
  mag = Math.sqrt(mag) || 1;
  for (let i = 0; i < 384; i++) {
    vec[i] = Number((vec[i] / mag).toFixed(6));
  }
  return vec;
}

export function formatVectorPg(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
