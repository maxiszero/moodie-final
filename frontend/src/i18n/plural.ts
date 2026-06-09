import { getLang } from './i18n'

/** Russian-style plural: 1 / 2–4 / 5+ */
export function ruPlural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const n1 = abs % 10
  if (n1 === 1 && abs !== 11) return one
  if (n1 >= 2 && n1 <= 4 && (abs < 12 || abs > 14)) return few
  return many
}

export function postsStatLabel(count: number): string {
  if (getLang() === 'en') return count === 1 ? 'Post' : 'Posts'
  return ruPlural(count, 'пост', 'поста', 'постов')
}

export function followersStatLabel(count: number): string {
  if (getLang() === 'en') return count === 1 ? 'Follower' : 'Followers'
  return ruPlural(count, 'подписчик', 'подписчика', 'подписчиков')
}

export function followingStatLabel(count: number): string {
  if (getLang() === 'en') return 'Following'
  return ruPlural(count, 'подписка', 'подписки', 'подписок')
}

export function likesStatLabel(count: number): string {
  if (getLang() === 'en') return count === 1 ? 'Like on posts' : 'Likes on posts'
  return `${ruPlural(count, 'лайк', 'лайка', 'лайков')} с постов`
}
