'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { getContactsApi } from '@/lib/api/endpoints/contacts';
import { searchUsersApi } from '@/lib/api/endpoints/users';

// === Types ====================================================================

export interface RecipientEntry {
  email: string;
  name: string;
  contactId?: string;
  userId?: string;
  type: 'contact' | 'user' | 'manual';
}

interface SearchOption {
  label: string;
  email: string;
  sublabel: string;
  source: 'contact' | 'user' | 'manual';
  entry: RecipientEntry;
}

export interface ContactSearchAutocompleteProps {
  /** Current selected recipient value (controlled). */
  value?: RecipientEntry | null;
  /** Called when a recipient is selected or cleared. */
  onChange: (recipient: RecipientEntry | null) => void;
  /** Called on every input change (for external state sync). */
  onInputChange?: (input: string) => void;
  placeholder?: string;
  noOptionsText?: string;
  loadingText?: string;
  clearText?: string;
  closeText?: string;
  openText?: string;
  contactLabel?: string;
  userLabel?: string;
}

// === Helpers ==================================================================

function buildOption(
  entry: RecipientEntry,
  contactLabel: string,
  userLabel: string,
): SearchOption {
  const sublabel = entry.type === 'contact' ? contactLabel : userLabel;
  return {
    label: entry.name || entry.email,
    email: entry.email,
    sublabel,
    source: entry.type,
    entry,
  };
}

/** Deduplicate by email — contact entry wins over user entry. */
function deduplicateByEmail(options: SearchOption[]): SearchOption[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.email)) return false;
    seen.add(option.email);
    return true;
  });
}

function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

// === Component ================================================================

export function ContactSearchAutocomplete({
  value,
  onChange,
  onInputChange,
  placeholder = 'Search contacts or users…',
  noOptionsText = 'No contacts or users found',
  loadingText = 'Searching…',
  clearText = 'Clear',
  closeText = 'Close',
  openText = 'Open',
  contactLabel = 'Contact',
  userLabel = 'User',
}: ContactSearchAutocompleteProps) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derive the Autocomplete value from the controlled RecipientEntry
  const selectedOption: SearchOption | null = useMemo(() => {
    if (!value || !value.email) return null;
    return buildOption(value, contactLabel, userLabel);
  }, [value, contactLabel, userLabel]);

  // === Search on input change ===============================================

  const doSearch = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setOptions([]);
        return;
      }

      setLoading(true);
      try {
        const [contactsResult, usersResult] = await Promise.allSettled([
          getContactsApi(query),
          searchUsersApi(query),
        ]);

        const results: SearchOption[] = [];

        if (contactsResult.status === 'fulfilled') {
          for (const contact of contactsResult.value) {
            results.push(
              buildOption(
                {
                  email: contact.contact_email,
                  name: contact.contact_name ?? '',
                  contactId: contact.id,
                  userId: contact.contact_user_id ?? undefined,
                  type: 'contact',
                },
                contactLabel,
                userLabel,
              ),
            );
          }
        }

        if (usersResult.status === 'fulfilled') {
          for (const user of usersResult.value) {
            results.push(
              buildOption(
                {
                  email: user.email,
                  name: [user.name, user.last_name].filter(Boolean).join(' '),
                  userId: user.id,
                  type: 'user',
                },
                contactLabel,
                userLabel,
              ),
            );
          }
        }

        setOptions(deduplicateByEmail(results));
      } finally {
        setLoading(false);
      }
    },
    [contactLabel, userLabel],
  );

  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newValue: string, reason: string) => {
      setInputValue(newValue);
      onInputChange?.(newValue);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (reason === 'input' && newValue.length >= 2) {
        debounceRef.current = setTimeout(() => {
          void doSearch(newValue);
        }, 200);
      } else if (reason === 'input' && newValue.length < 2) {
        setOptions([]);
      }
    },
    [doSearch, onInputChange],
  );

  // === Selection handler ====================================================

  const handleChange = useCallback(
    (_event: React.SyntheticEvent, newValue: SearchOption | string | null) => {
      if (!newValue) {
        onChange(null);
        setInputValue('');
        return;
      }

      if (typeof newValue === 'string') {
        // Free text entry — treat as manual email
        onChange({
          email: newValue.trim(),
          name: '',
          type: 'manual',
        });
        setInputValue('');
        return;
      }

      onChange(newValue.entry);
      setInputValue('');
    },
    [onChange],
  );

  // === Close handler — reset search state so dropdown can reopen fresh ======

  const handleClose = useCallback(() => {
    setOptions([]);
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && inputValue) {
        // If it's a valid email typed freely (not selecting an option)
        const matchingOption = options.find(
          (opt) => opt.email === inputValue || opt.label === inputValue,
        );
        if (!matchingOption && isValidEmail(inputValue)) {
          event.preventDefault();
          onChange({
            email: inputValue.trim(),
            name: '',
            type: 'manual',
          });
          setOptions([]);
          setInputValue('');
        }
      }
    },
    [inputValue, options, onChange],
  );

  // === Render ===============================================================

  return (
    <Autocomplete
      freeSolo
      value={selectedOption}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      onChange={handleChange}
      onClose={handleClose}
      disableCloseOnSelect={false}
      disablePortal
      slotProps={{
        popper: { disablePortal: true },
      }}
      options={options}
      loading={loading}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.label
      }
      filterOptions={(x) => x} // No client-side filtering — API does it
      isOptionEqualToValue={(option, val) =>
        typeof option === 'string' || typeof val === 'string'
          ? option === val
          : (option as SearchOption).email === (val as SearchOption).email
      }
      noOptionsText={noOptionsText}
      loadingText={loadingText}
      clearText={clearText}
      closeText={closeText}
      openText={openText}
      renderOption={(props, option) => {
        const { key, ...rest } = props;
        const uniqueKey = `${option.source ?? 'option'}-${option.email}-${String(key)}`;
        return (
          <Box
            component="li"
            key={uniqueKey}
            {...rest}
            sx={{ display: 'flex', flexDirection: 'column', py: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {option.label || option.email}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {option.email}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: 'primary.main', fontWeight: 600 }}
              >
                {option.sublabel}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          onKeyDown={handleKeyDown}
          slotProps={{
            ...params.slotProps,
            input: {
              ...params.slotProps.input,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress
                      role="progressbar"
                      size={20}
                      sx={{ mr: 0.5 }}
                    />
                  ) : null}
                  {params.slotProps.input.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}
