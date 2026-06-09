import { useEffect, useState } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { t } from '../i18n/i18n'

export type FeedSort = 'latest' | 'trending' | 'daily' | 'following' | 'for_you'

const TABS: { id: FeedSort; labelKey: 'tab_feed' | 'tab_top' | 'tab_following' | 'tab_for_you' | 'tab_daily'; domId: string }[] = [
  { id: 'latest', labelKey: 'tab_feed', domId: 'tabLatest' },
  { id: 'trending', labelKey: 'tab_top', domId: 'tabTop' },
  { id: 'following', labelKey: 'tab_following', domId: 'tabFollowing' },
  { id: 'for_you', labelKey: 'tab_for_you', domId: 'tabForYou' },
  { id: 'daily', labelKey: 'tab_daily', domId: 'tabDaily' },
]

type Props = {
  sort: FeedSort
  onSort: (next: FeedSort) => void
}

export function FeedTabs({ sort, onSort }: Props) {
  const reduceMotion = useReducedMotion()
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const useSlidingPill = !reduceMotion && !narrow

  const tabs = (
    <div className={`feed-tabs feed-tabs--scroll ${useSlidingPill ? 'feed-tabs--animated' : ''}`} role="tablist" aria-label={t('feed_tabs_label')}>
      {TABS.map((tab) => {
        const active = sort === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            className={`feed-tab ${active ? 'active' : ''}`}
            data-sort={tab.id}
            role="tab"
            aria-selected={active}
            id={tab.domId}
            onClick={() => onSort(tab.id)}
          >
            {active && useSlidingPill ? (
              <motion.span
                layoutId="feedTabPill"
                className="feed-tab__pill"
                transition={{ type: 'spring', stiffness: 400, damping: 34 }}
              />
            ) : null}
            <span className="feed-tab__label">{t(tab.labelKey)}</span>
          </button>
        )
      })}
    </div>
  )

  return useSlidingPill ? <LayoutGroup id="feed-tabs">{tabs}</LayoutGroup> : tabs
}
