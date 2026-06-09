import type { CSSProperties } from 'react'

export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />
}

export function FeedPostSkeleton() {
  return (
    <div className="post-skeleton" aria-hidden="true">
      <div className="post-skeleton__head">
        <Skeleton className="post-skeleton__avatar" />
        <div className="post-skeleton__meta">
          <Skeleton className="post-skeleton__line post-skeleton__line--short" />
          <Skeleton className="post-skeleton__line post-skeleton__line--tiny" />
        </div>
      </div>
      <Skeleton className="post-skeleton__line" />
      <Skeleton className="post-skeleton__line" />
      <Skeleton className="post-skeleton__line post-skeleton__line--medium" />
      <div className="post-skeleton__actions">
        <Skeleton className="post-skeleton__chip" />
        <Skeleton className="post-skeleton__chip" />
        <Skeleton className="post-skeleton__chip" />
        <Skeleton className="post-skeleton__chip" />
      </div>
    </div>
  )
}

export function FeedPostSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="feed-skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <FeedPostSkeleton key={i} />
      ))}
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="profile-skeleton" aria-busy="true" aria-hidden="true">
      <Skeleton className="profile-skeleton__banner" />
      <div className="profile-skeleton__body">
        <Skeleton className="profile-skeleton__avatar" />
        <Skeleton className="profile-skeleton__line profile-skeleton__line--title" />
        <Skeleton className="profile-skeleton__line" />
        <Skeleton className="profile-skeleton__line profile-skeleton__line--short" />
      </div>
    </div>
  )
}
