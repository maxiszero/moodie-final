/** Simplified MBTI: each question nudges one of E/I, S/N, T/F, J/P */

export type MbtiAxis = 'EI' | 'SN' | 'TF' | 'JP'

export type MbtiQuestion = {
  id: string
  promptKey: string
  axis: MbtiAxis
  /** true = first pole (E,S,T,J), false = second (I,N,F,P) */
  towardFirst: boolean
}

export const MBTI_QUESTIONS: MbtiQuestion[] = [
  { id: 'm1', promptKey: 'test_mbti_q1', axis: 'EI', towardFirst: true },
  { id: 'm2', promptKey: 'test_mbti_q2', axis: 'EI', towardFirst: false },
  { id: 'm3', promptKey: 'test_mbti_q3', axis: 'EI', towardFirst: true },
  { id: 'm4', promptKey: 'test_mbti_q4', axis: 'EI', towardFirst: false },
  { id: 'm5', promptKey: 'test_mbti_q5', axis: 'SN', towardFirst: true },
  { id: 'm6', promptKey: 'test_mbti_q6', axis: 'SN', towardFirst: false },
  { id: 'm7', promptKey: 'test_mbti_q7', axis: 'SN', towardFirst: true },
  { id: 'm8', promptKey: 'test_mbti_q8', axis: 'SN', towardFirst: false },
  { id: 'm9', promptKey: 'test_mbti_q9', axis: 'TF', towardFirst: true },
  { id: 'm10', promptKey: 'test_mbti_q10', axis: 'TF', towardFirst: false },
  { id: 'm11', promptKey: 'test_mbti_q11', axis: 'TF', towardFirst: true },
  { id: 'm12', promptKey: 'test_mbti_q12', axis: 'TF', towardFirst: false },
  { id: 'm13', promptKey: 'test_mbti_q13', axis: 'JP', towardFirst: true },
  { id: 'm14', promptKey: 'test_mbti_q14', axis: 'JP', towardFirst: false },
  { id: 'm15', promptKey: 'test_mbti_q15', axis: 'JP', towardFirst: true },
  { id: 'm16', promptKey: 'test_mbti_q16', axis: 'JP', towardFirst: false },
]
