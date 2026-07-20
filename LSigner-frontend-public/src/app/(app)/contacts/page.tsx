'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from '@/components/providers/SnackbarProvider';
import {
  getContactsApi,
  createContactApi,
  deleteContactApi,
} from '@/lib/api/endpoints/contacts';
import { searchUsersApi } from '@/lib/api/endpoints/users';
import type {
  ContactResponse,
  UserSearchResult,
} from '@/lib/api/endpoints/types';

const DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;

export default function ContactsPage() {
  const t = useTranslations('contacts');
  const { showSnackbar } = useSnackbar();

  const [contacts, setContacts] = useState<ContactResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // == Dialog state ==========================================================

  const [dialogOpen, setDialogOpen] = useState(false);
  const [userSearchInput, setUserSearchInput] = useState('');
  const [userOptions, setUserOptions] = useState<UserSearchResult[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const userDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // == Data loading ==========================================================

  const loadContacts = useCallback(
    async (query?: string) => {
      setLoading(true);
      setError(null);
      try {
        const data = await getContactsApi(query || undefined);
        setContacts(data);
      } catch {
        setError(t('load_error'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadContacts();
  }, [loadContacts]);

  // == Search ================================================================

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(value);
        void loadContacts(value || undefined);
      }, DEBOUNCE_MS);
    },
    [loadContacts],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    void loadContacts();
  }, [loadContacts]);

  // == Delete ================================================================

  const handleDelete = useCallback(
    async (contactId: string) => {
      try {
        await deleteContactApi(contactId);
        setContacts((prev) => prev.filter((c) => c.id !== contactId));
        showSnackbar(t('delete_success'), 'success');
      } catch {
        showSnackbar(t('delete_fail'), 'error');
      }
    },
    [showSnackbar, t],
  );

  // == Add contact dialog ====================================================

  const openDialog = useCallback(() => {
    setDialogOpen(true);
    setUserSearchInput('');
    setUserOptions([]);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setUserSearchInput('');
    setUserOptions([]);
  }, []);

  const handleUserSearchChange = useCallback((value: string) => {
    setUserSearchInput(value);
    clearTimeout(userDebounceRef.current);

    if (value.length < SEARCH_MIN_CHARS) {
      setUserOptions([]);
      return;
    }

    userDebounceRef.current = setTimeout(async () => {
      setUserSearchLoading(true);
      try {
        const results = await searchUsersApi(value);
        setUserOptions(results);
      } catch {
        setUserOptions([]);
      } finally {
        setUserSearchLoading(false);
      }
    }, DEBOUNCE_MS);
  }, []);

  const handleSelectUser = useCallback(
    async (user: UserSearchResult | null) => {
      if (!user) return;

      setAddingContact(true);
      try {
        await createContactApi({
          contact_email: user.email,
          contact_name: `${user.name} ${user.last_name}`.trim(),
          contact_user_id: user.id,
        });
        closeDialog();
        showSnackbar(t('contact_added'), 'success');
        void loadContacts(debouncedQuery || undefined);
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 409) {
          showSnackbar(t('contact_exists'), 'error');
        } else {
          showSnackbar(t('contact_add_error'), 'error');
        }
      } finally {
        setAddingContact(false);
      }
    },
    [closeDialog, debouncedQuery, loadContacts, showSnackbar, t],
  );

  // == Memoized filtered contacts for empty-state logic ======================

  const showEmptyState = useMemo(
    () => contacts.length === 0 && !debouncedQuery,
    [contacts.length, debouncedQuery],
  );

  const showNoResults = useMemo(
    () => contacts.length === 0 && debouncedQuery.length > 0,
    [contacts.length, debouncedQuery],
  );

  // == Cleanup debounces on unmount ==========================================

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      clearTimeout(userDebounceRef.current);
    };
  }, []);

  // == Render ================================================================

  return (
    <Container maxWidth="lg" sx={{ py: 4, pb: '56px', px: { xs: 2, sm: 3 } }}>
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'text.primary' }}
        >
          {t('page_title')}
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={openDialog}
        >
          {t('add_contact')}
        </Button>
      </Box>

      {/* Search bar */}
      <TextField
        placeholder={t('search_placeholder')}
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        size="small"
        fullWidth
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
            endAdornment: searchQuery ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  aria-label={t('search_clear')}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {/* Content area */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress role="progressbar" />
        </Box>
      ) : error ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            {error}
          </Typography>
          <Button variant="outlined" onClick={() => void loadContacts()}>
            {t('retry')}
          </Button>
        </Box>
      ) : showEmptyState ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'text.secondary' }}>{t('empty')}</Typography>
        </Box>
      ) : showNoResults ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ color: 'text.secondary' }}>
            {t('no_results')}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {contacts.map((contact) => (
            <Box
              key={contact.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                px: 2,
                py: 1,
                borderRadius: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {contact.contact_name || contact.contact_email}
                </Typography>
                {contact.contact_name && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary' }}
                  >
                    {contact.contact_email}
                  </Typography>
                )}
              </Box>
              <IconButton
                size="small"
                onClick={() => void handleDelete(contact.id)}
                aria-label={t('delete_aria_label', {
                  email: contact.contact_email,
                })}
                sx={{ color: 'text.secondary' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Add Contact Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{t('add_contact_title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('add_contact_subtitle')}
          </Typography>
          <Autocomplete
            options={userOptions}
            loading={userSearchLoading}
            loadingText={t('searching')}
            noOptionsText={t('no_users_found')}
            inputValue={userSearchInput}
            onInputChange={(_event, value) => handleUserSearchChange(value)}
            onChange={(_event, value) => {
              void handleSelectUser(value);
            }}
            getOptionLabel={(user) =>
              `${user.name} ${user.last_name} (${user.email})`
            }
            isOptionEqualToValue={(option, value) => option.id === value.id}
            disabled={addingContact}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('search_users_label')}
                size="small"
                autoFocus
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog} disabled={addingContact}>
            {t('cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
