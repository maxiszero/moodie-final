export type StressOption = { score: number; labelKey: string }

export type StressQuestion = {
  id: string
  textKey: string
  options: StressOption[]
}

export const STRESS_QUESTIONS: StressQuestion[] = [
  {
    id: 's1',
    textKey: 'test_stress_q1',
    options: [
      { score: 0, labelKey: 'test_stress_q1_0' },
      { score: 1, labelKey: 'test_stress_q1_1' },
      { score: 2, labelKey: 'test_stress_q1_2' },
      { score: 3, labelKey: 'test_stress_q1_3' },
    ],
  },
  {
    id: 's2',
    textKey: 'test_stress_q2',
    options: [
      { score: 0, labelKey: 'test_stress_q2_0' },
      { score: 1, labelKey: 'test_stress_q2_1' },
      { score: 2, labelKey: 'test_stress_q2_2' },
      { score: 3, labelKey: 'test_stress_q2_3' },
    ],
  },
  {
    id: 's3',
    textKey: 'test_stress_q3',
    options: [
      { score: 0, labelKey: 'test_stress_q3_0' },
      { score: 1, labelKey: 'test_stress_q3_1' },
      { score: 2, labelKey: 'test_stress_q3_2' },
      { score: 3, labelKey: 'test_stress_q3_3' },
    ],
  },
  {
    id: 's4',
    textKey: 'test_stress_q4',
    options: [
      { score: 0, labelKey: 'test_stress_q4_0' },
      { score: 1, labelKey: 'test_stress_q4_1' },
      { score: 2, labelKey: 'test_stress_q4_2' },
      { score: 3, labelKey: 'test_stress_q4_3' },
    ],
  },
  {
    id: 's5',
    textKey: 'test_stress_q5',
    options: [
      { score: 0, labelKey: 'test_stress_q5_0' },
      { score: 1, labelKey: 'test_stress_q5_1' },
      { score: 2, labelKey: 'test_stress_q5_2' },
      { score: 3, labelKey: 'test_stress_q5_3' },
    ],
  },
  {
    id: 's6',
    textKey: 'test_stress_q6',
    options: [
      { score: 0, labelKey: 'test_stress_q6_0' },
      { score: 1, labelKey: 'test_stress_q6_1' },
      { score: 2, labelKey: 'test_stress_q6_2' },
      { score: 3, labelKey: 'test_stress_q6_3' },
    ],
  },
  {
    id: 's7',
    textKey: 'test_stress_q7',
    options: [
      { score: 0, labelKey: 'test_stress_q7_0' },
      { score: 1, labelKey: 'test_stress_q7_1' },
      { score: 2, labelKey: 'test_stress_q7_2' },
      { score: 3, labelKey: 'test_stress_q7_3' },
    ],
  },
  {
    id: 's8',
    textKey: 'test_stress_q8',
    options: [
      { score: 0, labelKey: 'test_stress_q8_0' },
      { score: 1, labelKey: 'test_stress_q8_1' },
      { score: 2, labelKey: 'test_stress_q8_2' },
      { score: 3, labelKey: 'test_stress_q8_3' },
    ],
  },
]

export function stressBand(total: number): 'low' | 'moderate' | 'high' {
  if (total <= 6) return 'low'
  if (total <= 14) return 'moderate'
  return 'high'
}
