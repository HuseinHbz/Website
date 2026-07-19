import type { CSSProperties } from 'react'

/** Tailwind class for visually hidden but accessible content */
export const srOnly =
  'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0 clip-[rect(0,0,0,0)]'

/** Inline style object for visually hidden elements */
export const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
}

/** Consistent focus ring classes for interactive elements */
export const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** Combine focus ring with any custom classes */
export function withFocusRing(...classes: string[]) {
  return [focusRing, ...classes].join(' ')
}
