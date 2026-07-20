'use client';

import Button, { type ButtonProps } from '@mui/material/Button';

/**
 * Primary filled (contained) button.
 * Hover behaviour : light: navy -> darker navy; dark: cream -> navy with cream text :
 * is handled globally in MuiButton styleOverrides inside muiTheme.ts.
 *
 * All standard MUI ButtonProps are forwarded (onClick, disabled, fullWidth,
 * size, startIcon, endIcon, href, component, …). `variant` and `color` are
 * fixed and cannot be overridden.
 */
export function FilledButton({
  children,
  ...props
}: Omit<ButtonProps, 'variant' | 'color'>) {
  return (
    <Button variant="contained" color="primary" {...props}>
      {children}
    </Button>
  );
}
