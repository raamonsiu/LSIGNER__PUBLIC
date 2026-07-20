'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Link from 'next/link';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import { handleFormError } from '@/lib/api/error-handler';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FilledButton, OutlineButton } from '@/components/ui';

export default function LoginPage() {
  const translations = useTranslations('login');
  const commonTranslations = useTranslations('common');
  const errorsTranslations = useTranslations('errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const hasShownExpired = useRef(false);
  useEffect(() => {
    if (searchParams?.get('reason') === 'expired' && !hasShownExpired.current) {
      hasShownExpired.current = true;
      showSnackbar(translations('expired_session'), 'warning');
    }
  }, [searchParams, showSnackbar, translations]);

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!email) errs.email = translations('form.email_required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = translations('form.email_invalid');
    if (!password) errs.password = translations('form.password_required');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      handleFormError(err, 'login', showSnackbar, {
        generic: errorsTranslations('generic'),
        credentials: errorsTranslations('credentials'),
        timeout: errorsTranslations('timeout'),
        server: errorsTranslations('server'),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoogle() {
    showSnackbar(commonTranslations('google_placeholder.login'), 'info');
  }

  function renderEmailField() {
    return (
      <TextField
        label={translations('form.email_label')}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={Boolean(errors.email)}
        helperText={errors.email}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <EmailOutlinedIcon sx={styles.inputIcon} />
              </InputAdornment>
            ),
          },
        }}
      />
    );
  }

  function renderPasswordField() {
    return (
      <TextField
        label={translations('form.password_label')}
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={Boolean(errors.password)}
        helperText={errors.password}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlinedIcon sx={styles.inputIcon} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPassword((v) => !v)}
                  edge="end"
                  size="small"
                  aria-label={
                    showPassword
                      ? translations('form.hide_password')
                      : translations('form.show_password')
                  }
                >
                  {showPassword ? (
                    <VisibilityOffOutlinedIcon sx={styles.visibilityIcon} />
                  ) : (
                    <VisibilityOutlinedIcon sx={styles.visibilityIcon} />
                  )}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    );
  }

  function renderForgotPassword() {
    return (
      <Box sx={styles.forgotRow}>
        <Typography component="span" variant="body2" sx={styles.forgotLink}>
          {translations('form.forgot_password')}
        </Typography>
      </Box>
    );
  }

  function renderSubmitButton() {
    return (
      <FilledButton type="submit" fullWidth disabled={submitting}>
        {submitting
          ? translations('form.submitting')
          : translations('form.submit')}
      </FilledButton>
    );
  }

  function renderDivider() {
    return (
      <Divider sx={styles.divider}>
        <Typography variant="body2" sx={styles.dividerText}>
          {translations('divider')}
        </Typography>
      </Divider>
    );
  }

  function renderGoogleButton() {
    return (
      <OutlineButton
        fullWidth
        startIcon={<GoogleIcon />}
        onClick={handleGoogle}
      >
        {translations('google')}
      </OutlineButton>
    );
  }

  function renderRegisterLink() {
    return (
      <Typography variant="body2" sx={styles.bottomText}>
        {translations('register_link')}{' '}
        <Link href="/register" style={styles.bottomLink}>
          {translations('register_link_action')}
        </Link>
      </Typography>
    );
  }

  return (
    <Box sx={styles.root}>
      <Box sx={styles.brand}>
        <BrandLogo centered />
      </Box>

      <Card elevation={0} sx={styles.card}>
        <CardContent sx={styles.cardContent}>
          <Typography variant="h5" component="h2" sx={styles.title}>
            {translations('page.title')}
          </Typography>
          <Typography variant="body2" sx={styles.subtitle}>
            {translations('page.subtitle')}
          </Typography>

          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={styles.form}
          >
            {renderEmailField()}
            {renderPasswordField()}
            {renderForgotPassword()}
            {renderSubmitButton()}
          </Box>

          {renderDivider()}
          {renderGoogleButton()}
          {renderRegisterLink()}
        </CardContent>
      </Card>
    </Box>
  );
}

const styles = {
  root: { width: '100%', maxWidth: 440 },
  brand: { textAlign: 'center', mb: 3 },
  brandTitle: {
    fontWeight: 700,
    color: 'var(--brand-primary)',
    letterSpacing: '-0.02em',
  },
  brandSubtitle: { color: 'var(--text-secondary)', mt: 0.5 },
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 2,
  },
  cardContent: { p: { xs: 3, sm: 4 } },
  title: { fontWeight: 600, mb: 0.5, color: 'var(--text-primary)' },
  subtitle: { color: 'var(--text-secondary)', mb: 3 },
  form: { display: 'flex', flexDirection: 'column', gap: 2 },
  inputIcon: { color: 'var(--text-secondary)', fontSize: 20 },
  visibilityIcon: { fontSize: 20 },
  forgotRow: { textAlign: 'right', mt: -1 },
  forgotLink: {
    color: 'var(--brand-primary)',
    cursor: 'pointer',
    '&:hover': { textDecoration: 'underline' },
  },
  divider: { my: 2.5 },
  dividerText: { color: 'var(--text-secondary)' },
  bottomText: { textAlign: 'center', mt: 3, color: 'var(--text-secondary)' },
  bottomLink: {
    color: 'var(--brand-primary)',
    fontWeight: 600,
    textDecoration: 'none',
  },
} as const;
