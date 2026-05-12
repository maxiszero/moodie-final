import { useCallback, useRef, useState } from 'react'
import { HeaderSearch, type HeaderSearchRef } from '../layout/HeaderSearch'
import {
  addSearchHistoryEntry,
  clearSearchHistory,
  getSearchHistory,
  removeSearchHistoryEntry,
} from '../config/searchHistory'
import { t } from '../i18n/i18n'

const clockIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export function SearchPage() {
  const searchRef = useRef<HeaderSearchRef>(null)
  const [history, setHistory] = useState(() => getSearchHistory())

  const onSearchExecuted = useCallback(
    (q: string) => {
      addSearchHistoryEntry(q)
      setHistory(getSearchHistory())
    },
    [],
  )

  const onPick = (q: string) => {
    searchRef.current?.focusAndApplyQuery(q)
  }

  const onRemove = (q: string) => {
    removeSearchHistoryEntry(q)
    setHistory(getSearchHistory())
  }

  const onClear = () => {
    clearSearchHistory()
    setHistory([])
  }

  return (
    <div id="searchView" className="main-content search-page">
      <h1 className="search-page__title">{t('nav_search')}</h1>
      <div className="search-page__field">
        <HeaderSearch ref={searchRef} onSearchExecuted={onSearchExecuted} />
      </div>

      <div className="search-page__history" aria-label={t('search_history_aria')}>
        <div className="search-page__history-head">
          <h2 className="search-page__history-title">
            {clockIcon}
            {t('search_history_title')}
          </h2>
          {history.length > 0 ? (
            <button type="button" className="search-page__history-clear" onClick={onClear}>
              {t('search_history_clear')}
            </button>
          ) : null}
        </div>
        {history.length === 0 ? (
          <p className="search-page__history-empty">{t('search_history_empty')}</p>
        ) : (
          <ul className="search-page__history-list">
            {history.map((q) => (
              <li key={q} className="search-page__history-item">
                <button type="button" className="search-page__history-query" onClick={() => onPick(q)} title={q}>
                  {q}
                </button>
                <button
                  type="button"
                  className="search-page__history-remove"
                  onClick={() => onRemove(q)}
                  aria-label={t('search_history_remove_aria').replace('{q}', q)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
