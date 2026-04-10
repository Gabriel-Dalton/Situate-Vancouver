import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LensSelector from './LensSelector'

describe('LensSelector', () => {
  it('renders three lens options as a radiogroup', () => {
    render(<LensSelector active="cycle" onSelect={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: /mobility lens/i })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('marks the active lens and calls onSelect when another lens is chosen', async () => {
    const user = userEvent.setup()
    const onSelect = jest.fn()
    render(<LensSelector active="cycle" onSelect={onSelect} />)

    const walk = screen.getByRole('radio', { name: /walking/i })
    expect(screen.getByRole('radio', { name: /cycling/i })).toHaveAttribute('aria-checked', 'true')
    expect(walk).toHaveAttribute('aria-checked', 'false')

    await user.click(walk)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('pedestrian')
  })
})
