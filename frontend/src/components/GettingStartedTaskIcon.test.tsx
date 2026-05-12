import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GettingStartedTaskIcon } from './GettingStartedTaskIcon'

describe('GettingStartedTaskIcon', () => {
  it('renders the pending ring state', () => {
    const { container } = render(<GettingStartedTaskIcon done={false} />)

    expect(container.querySelector('.gs-task-icon__ring')).toBeInTheDocument()
  })

  it('renders the done state as a hidden decorative icon', () => {
    const { container } = render(<GettingStartedTaskIcon done />)

    expect(container.querySelector('.gs-task-icon--done')).toBeInTheDocument()
  })
})
