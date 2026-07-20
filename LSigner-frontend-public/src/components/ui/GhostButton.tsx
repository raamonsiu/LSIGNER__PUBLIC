'use client';

import Button, { type ButtonProps } from '@mui/material/Button';

/**
 * Ghost (text) button : no background or border at rest.
 * Text uses `primary.main`. Hover adds the theme's `action.hover` tint.
 *
 * All standard MUI ButtonProps are forwarded. `variant` and `color` are fixed.
 */
export function GhostButton({
  children,
  ...props
}: Omit<ButtonProps, 'variant' | 'color'>) {
  return (
    <Button variant="text" color="primary" {...props}>
      {children}
    </Button>
  );
}
