'use client';
// ? Insame page, I have coding fkng forms

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Link from 'next/link';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '@/lib/auth/AuthContext';
import { handleFormError } from '@/lib/api/error-handler';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { FilledButton, OutlineButton } from '@/components/ui';
import type { RegisterDto } from '@/lib/auth/types';

interface FormState {
  name: string;
  last_name: string;
  email: string;
  country: string;
  phone_number: string;
  national_id: string;
  passport: string;
  password: string;
  passwordConfirm: string;
}

type FormErrors = Partial<Record<keyof FormState, string>>;

const INITIAL_FORM: FormState = {
  name: '',
  last_name: '',
  email: '',
  country: '',
  phone_number: '',
  national_id: '',
  passport: '',
  password: '',
  passwordConfirm: '',
};

export default function RegisterPage() {
  const translations = useTranslations('register');
  const commonTranslations = useTranslations('common');
  const errorsTranslations = useTranslations('errors');
  const router = useRouter();
  const { register } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  function handleChange(field: keyof FormState) {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function validate(): boolean {
    const errors: FormErrors = {};

    if (!form.name.trim()) errors.name = translations('form.name_required');
    if (!form.last_name.trim())
      errors.last_name = translations('form.last_name_required');
    if (!form.email.trim()) {
      errors.email = translations('form.email_required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { // TODO: Give it to regex commons not inline
      errors.email = translations('form.email_invalid');
    }
    if (!form.country.trim())
      errors.country = translations('form.country_required');
    if (!form.phone_number.trim()) {
      errors.phone_number = translations('form.phone_required');
    } else if (!/^\+[1-9]\d{6,14}$/.test(form.phone_number)) {
      errors.phone_number = translations('form.phone_invalid');
    }
    if (!form.password) {
      errors.password = translations('form.password_required');
    } else if (form.password.length < 8) {
      errors.password = translations('form.password_too_short');
    }
    if (form.password !== form.passwordConfirm) {
      errors.passwordConfirm = translations('form.passwords_mismatch');
    }

    setErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const dto: RegisterDto = {
      name: form.name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim().toLowerCase(),
      country: form.country.trim(),
      phone_number: form.phone_number.trim(),
      password: form.password,
      ...(form.national_id.trim() && { national_id: form.national_id.trim() }),
      ...(form.passport.trim() && { passport: form.passport.trim() }),
    };

    try {
      await register(dto);
      showSnackbar(translations('success_message'), 'success');
      router.push('/login');
    } catch (err) {
      handleFormError(err, 'register', showSnackbar, {
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
    showSnackbar(commonTranslations('google_placeholder.register'), 'info');
  }

  function renderNameFields() {
    return (
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            label={translations('form.name_label')}
            autoComplete="given-name"
            value={form.name}
            onChange={handleChange('name')}
            error={Boolean(errors.name)}
            helperText={errors.name}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlinedIcon sx={styles.inputIcon} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            label={translations('form.last_name_label')}
            autoComplete="family-name"
            value={form.last_name}
            onChange={handleChange('last_name')}
            error={Boolean(errors.last_name)}
            helperText={errors.last_name}
            fullWidth
          />
        </Grid>
      </Grid>
    );
  }

  function renderEmailField() {
    return (
      <TextField
        label={translations('form.email_label')}
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={handleChange('email')}
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

  function renderCountryField() {
    return (
      <TextField
        label={translations('form.country_label')}
        autoComplete="country-name"
        value={form.country}
        onChange={handleChange('country')}
        error={Boolean(errors.country)}
        helperText={errors.country}
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <PublicOutlinedIcon sx={styles.inputIcon} />
              </InputAdornment>
            ),
          },
        }}
      />
    );
  }

  function renderPhoneField() {
    return (
      <TextField
        label={translations('form.phone_label')}
        type="tel"
        autoComplete="tel"
        value={form.phone_number}
        onChange={handleChange('phone_number')}
        error={Boolean(errors.phone_number)}
        helperText={
          errors.phone_number ?? translations('form.phone_placeholder')
        }
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <PhoneOutlinedIcon sx={styles.inputIcon} />
              </InputAdornment>
            ),
          },
        }}
      />
    );
  }

  function renderIdFields() {
    return (
      <Grid container spacing={2}>
        <Grid size={6}>
          <TextField
            label={translations('form.national_id_label')}
            value={form.national_id}
            onChange={handleChange('national_id')}
            fullWidth
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeOutlinedIcon sx={styles.inputIcon} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Grid>
        <Grid size={6}>
          <TextField
            label={translations('form.passport_label')}
            value={form.passport}
            onChange={handleChange('passport')}
            fullWidth
          />
        </Grid>
      </Grid>
    );
  }

  function renderPasswordField() {
    return (
      <TextField
        label={translations('form.password_label')}
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={form.password}
        onChange={handleChange('password')}
        error={Boolean(errors.password)}
        helperText={errors.password ?? translations('form.password_min_length')}
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

  function renderConfirmPasswordField() {
    return (
      <TextField
        label={translations('form.confirm_password_label')}
        type={showPasswordConfirm ? 'text' : 'password'}
        autoComplete="new-password"
        value={form.passwordConfirm}
        onChange={handleChange('passwordConfirm')}
        error={Boolean(errors.passwordConfirm)}
        helperText={errors.passwordConfirm}
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
                  onClick={() => setShowPasswordConfirm((v) => !v)}
                  edge="end"
                  size="small"
                  aria-label={
                    showPasswordConfirm
                      ? translations('form.hide_password')
                      : translations('form.show_password')
                  }
                >
                  {showPasswordConfirm ? (
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

  function renderSubmitButton() {
    return (
      <FilledButton
        type="submit"
        fullWidth
        disabled={submitting}
        sx={styles.submitButton}
      >
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

  function renderLoginLink() {
    return (
      <Typography variant="body2" sx={styles.bottomText}>
        {translations('login_link')}{' '}
        <Link href="/login" style={styles.bottomLink}>
          {translations('login_link_action')}
        </Link>
      </Typography>
    );
  }

  function renderLegal() {
    return (
      <Typography variant="caption" sx={styles.legal}>
        {translations('legal')}{' '}
        <Link href="/legal/terms-and-conditions" style={styles.legalLink}>
          {translations('legal_terms')}
        </Link>{' '}
        {translations('legal_connector')}{' '}
        <Link href="/legal/privacy-policy" style={styles.legalLink}>
          {translations('legal_privacy')}
        </Link>
        .
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
            {renderNameFields()}
            {renderEmailField()}
            {renderCountryField()}
            {renderPhoneField()}
            {renderIdFields()}
            {renderPasswordField()}
            {renderConfirmPasswordField()}
            {renderSubmitButton()}
          </Box>

          {renderDivider()}
          {renderGoogleButton()}
          {renderLoginLink()}
          {renderLegal()}
        </CardContent>
      </Card>
    </Box>
  );
}

const styles = {
  root: { width: '100%', maxWidth: 540 },
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
  divider: { my: 2.5 },
  dividerText: { color: 'var(--text-secondary)' },
  bottomText: { textAlign: 'center', mt: 3, color: 'var(--text-secondary)' },
  bottomLink: {
    color: 'var(--brand-primary)',
    fontWeight: 600,
    textDecoration: 'none',
  },
  submitButton: { mt: 0.5 },
  legal: {
    display: 'block',
    textAlign: 'center',
    mt: 2,
    color: 'var(--text-disabled)',
  },
  legalLink: { color: 'var(--brand-primary)', cursor: 'pointer' },
} as const;
