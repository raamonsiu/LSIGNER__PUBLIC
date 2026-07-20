'use client';

import Button, { type ButtonProps } from '@mui/material/Button';

/**
 * Primary outlined button.
 * Border and text use `primary.main` (navy in light, cream in dark).
 * Hover adds the theme's `action.hover` tint behind the text.
 *
 * All standard MUI ButtonProps are forwarded. `variant` and `color` are fixed.
 */
export function OutlineButton({
  children,
  ...props
}: Omit<ButtonProps, 'variant' | 'color'>) {
  return (
    <Button variant="outlined" color="primary" {...props}>
      {children}
    </Button>
  );
}
