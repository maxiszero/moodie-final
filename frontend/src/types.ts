export type Theme = 'light' | 'dark'
export type Lang = 'ru' | 'en'

export type UserMood = {
  emotion: string
  emoji: string
  color: string
  color2: string
  color3: string
}

export type AuthPayload = {
  _id: string
  username: string
  currentEmotion?: string
  currentEmoji?: string
  currentColor?: string
  currentColor2?: string
  currentColor3?: string
  preferredLanguage?: Lang
  preferredTheme?: Theme
  role?: 'user' | 'admin'
  telegramLinked?: boolean
  token: string
}

export type MePayload = Omit<AuthPayload, 'token'> & { token?: never }

export type PostAuthor = {
  _id: string
  username: string
  currentEmotion?: string
  currentEmoji?: string
  currentColor?: string
  currentColor2?: string
  currentColor3?: string
  banned?: boolean
}

export type PostReaction = {
  type: 'feel_this' | 'stay_strong' | 'hits_hard'
  userId: string
}

export type DailyQuestionToday = {
  dayKey: string
  moodBucket: string
  lang: string
  question: string
  hasAnswered: boolean
  myAnswer: string | null
  canAnswer: boolean
}

export type DailyAnonymousAnswer = {
  text: string
  createdAt: string
}

export type Post = {
  _id: string
  userId: PostAuthor | string
  text: string
  createdAt: string
  emotion?: string
  emoji?: string
  intensity?: number
  color?: string
  color2?: string
  color3?: string
  reasoning?: string
  tip?: string
  likes?: number
  likedBy?: string[]
  relatable?: number
  relatableBy?: string[]
  reactions?: PostReaction[]
  isFollowingAuthor?: boolean
  commentsCount?: number
}

export type PostComment = {
  _id: string
  postId?: string
  userId: PostAuthor | string
  text: string
  createdAt: string
}

export type PublicUser = {
  _id: string
  username: string
  weeklyAiSummary?: string
  currentEmotion?: string
  currentEmoji?: string
  currentColor?: string
  currentColor2?: string
  currentColor3?: string
  createdAt?: string
  registrationIp?: string
  lastIp?: string
}

/** Row from GET /admin/users */
export type AdminUserRow = PublicUser & {
  role?: 'user' | 'admin'
  banned?: boolean
}

export type ProfilePayload = {
  user: PublicUser
  posts: Post[]
  followersCount: number
  followingCount: number
  totalLikesReceived: number
  isFollowing: boolean
}

export type MoodHeatmapDay = {
  _id: string
  dominantColor: string
  emotions: Array<{ emotion: string; emoji: string; color: string }>
  count: number
}

