/** Weight maps for scoring canonical mood tags (aligned with app emotions). */
export type EmotionWeights = Partial<Record<string, number>>

export type EmotionQuestion = {
  id: string
  promptKey: string
  options: Array<{ labelKey: string; weights: EmotionWeights }>
}

export const EMOTION_TEST_QUESTIONS: EmotionQuestion[] = [
  {
    id: 'e1',
    promptKey: 'test_em_q1',
    options: [
      { labelKey: 'test_em_q1_a', weights: { happy: 3, excited: 2 } },
      { labelKey: 'test_em_q1_b', weights: { calmness: 3, apathy: 1 } },
      { labelKey: 'test_em_q1_c', weights: { anxiety: 3, tired: 1 } },
      { labelKey: 'test_em_q1_d', weights: { sad: 2, melancholy: 2 } },
    ],
  },
  {
    id: 'e2',
    promptKey: 'test_em_q2',
    options: [
      { labelKey: 'test_em_q2_a', weights: { drive: 3, excited: 1 } },
      { labelKey: 'test_em_q2_b', weights: { calmness: 3 } },
      { labelKey: 'test_em_q2_c', weights: { scared: 2, anxiety: 2 } },
      { labelKey: 'test_em_q2_d', weights: { tired: 3, apathy: 1 } },
    ],
  },
  {
    id: 'e3',
    promptKey: 'test_em_q3',
    options: [
      { labelKey: 'test_em_q3_a', weights: { loved: 3, happy: 1 } },
      { labelKey: 'test_em_q3_b', weights: { neutral: 3 } },
      { labelKey: 'test_em_q3_c', weights: { angry: 3 } },
      { labelKey: 'test_em_q3_d', weights: { inspiration: 3 } },
    ],
  },
  {
    id: 'e4',
    promptKey: 'test_em_q4',
    options: [
      { labelKey: 'test_em_q4_a', weights: { happy: 2, excited: 2 } },
      { labelKey: 'test_em_q4_b', weights: { melancholy: 2, sad: 2 } },
      { labelKey: 'test_em_q4_c', weights: { anxiety: 3 } },
      { labelKey: 'test_em_q4_d', weights: { calmness: 3 } },
    ],
  },
  {
    id: 'e5',
    promptKey: 'test_em_q5',
    options: [
      { labelKey: 'test_em_q5_a', weights: { tired: 3 } },
      { labelKey: 'test_em_q5_b', weights: { drive: 3, happy: 1 } },
      { labelKey: 'test_em_q5_c', weights: { apathy: 3 } },
      { labelKey: 'test_em_q5_d', weights: { anxiety: 2, scared: 1 } },
    ],
  },
  {
    id: 'e6',
    promptKey: 'test_em_q6',
    options: [
      { labelKey: 'test_em_q6_a', weights: { inspiration: 3 } },
      { labelKey: 'test_em_q6_b', weights: { calmness: 2, neutral: 1 } },
      { labelKey: 'test_em_q6_c', weights: { angry: 2, sad: 1 } },
      { labelKey: 'test_em_q6_d', weights: { loved: 3 } },
    ],
  },
  {
    id: 'e7',
    promptKey: 'test_em_q7',
    options: [
      { labelKey: 'test_em_q7_a', weights: { scared: 3, anxiety: 1 } },
      { labelKey: 'test_em_q7_b', weights: { happy: 2, loved: 1 } },
      { labelKey: 'test_em_q7_c', weights: { sad: 3 } },
      { labelKey: 'test_em_q7_d', weights: { neutral: 3 } },
    ],
  },
  {
    id: 'e8',
    promptKey: 'test_em_q8',
    options: [
      { labelKey: 'test_em_q8_a', weights: { calmness: 3, happy: 1 } },
      { labelKey: 'test_em_q8_b', weights: { excited: 3, drive: 1 } },
      { labelKey: 'test_em_q8_c', weights: { tired: 2, melancholy: 2 } },
      { labelKey: 'test_em_q8_d', weights: { apathy: 2, neutral: 1 } },
    ],
  },
]
