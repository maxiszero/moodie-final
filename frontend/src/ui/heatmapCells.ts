import type { MoodHeatmapDay } from '../types'

export type HeatmapCell = {
  key: string
  color: string
  label: string
  title: string
  dayData: MoodHeatmapDay | null
}

export function buildWeekHeatmapCells(heatmap: MoodHeatmapDay[], lang: 'ru' | 'en'): HeatmapCell[] {
  const map: Record<string, MoodHeatmapDay> = {}
  heatmap.forEach((d) => {
    map[d._id] = d
  })
  const dayNames =
    lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const now = new Date()
  const daysToShow = 6
  const cells: HeatmapCell[] = []
  for (let i = daysToShow; i >= 0; i--) {
    const d = new Date()
    d.setDate(now.getDate() - i)
    const key = d.toISOString().split('T')[0]
    const dayData = map[key] || null
    const color = dayData ? dayData.dominantColor : 'var(--border-color)'
    cells.push({
      key,
      color,
      label: dayNames[d.getDay()],
      title: key + (dayData ? ` (${dayData.count})` : ''),
      dayData,
    })
  }
  return cells
}
