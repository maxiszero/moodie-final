/** Russian plural for streak days */
export function streakLabel(count: number, lang: string): string {
  if (lang === 'en') {
    return `${count} day${count === 1 ? '' : 's'}`
  }
  const n = Math.abs(count) % 100
  const n1 = n % 10
  let word = 'дней'
  if (n1 === 1 && n !== 11) word = 'день'
  else if (n1 >= 2 && n1 <= 4 && (n < 12 || n > 14)) word = 'дня'
  return `${count} ${word}`
}
