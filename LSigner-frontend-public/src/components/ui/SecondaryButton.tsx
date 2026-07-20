'use client';

import Button, { type ButtonProps } from '@mui/material/Button';

/**
 * Secondary filled (contained) button : amber/gold accent, used for primary
 * CTAs (e.g. "Subir documento", "Nuevo documento").
 * Text colour is always `navyDeep` for contrast against the amber background.
 * Hover darkens the amber; this is handled in MuiButton styleOverrides inside
 * muiTheme.ts.
 *
 * All standard MUI ButtonProps are forwarded. `variant` and `color` are fixed.
 */
export function SecondaryButton({
  children,
  ...props
}: Omit<ButtonProps, 'variant' | 'color'>) {
  return (
    <Button variant="contained" color="secondary" {...props}>
      {children}
    </Button>
  );
}
