'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import { useAuth } from '@/lib/auth/AuthContext';
import { useSettingsContext, type SettingsSection } from './SettingsContext';
import { SettingsSidebar } from './components/SettingsSidebar';
import { SettingsSection as SettingsSectionBlock } from './components/SettingsSection';
import { SettingsProfileSection } from '@/components/profile/SettingsProfileSection';
import { PlatformSettingsSection } from './components/PlatformSettingsSection';
import { LegalSection } from './components/LegalSection';
import { DangerZoneSection } from './components/DangerZoneSection';

const SECTION_IDS: SettingsSection[] = [
  'user',
  'platform',
  'docs',
  'cookies',
  'danger-zone',
];

export default function SettingsPage() {
  const { user } = useAuth();
  const translations = useTranslations('settings');
  const { setActiveSection } = useSettingsContext();

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTION_IDS.forEach((id) => {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveSection(id);
              window.history.replaceState(null, '', `#${id}`);
            }
          }
        },
        { threshold: 0.35 },
      );

      const element = document.getElementById(id);
      if (element) observer.observe(element);
      observers.push(observer);
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
      setActiveSection(null);
    };
  }, [setActiveSection]);

  if (!user) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        px: 4,
        py: 2,
      }}
    >
      <SettingsSidebar />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <SettingsSectionBlock
          key="user"
          id="user"
          title={translations('sections.user')}
        >
          <SettingsProfileSection user={user} />
        </SettingsSectionBlock>
        {SECTION_IDS.filter((id) => id !== 'user' && id !== 'danger-zone').map(
          (id) => (
            <SettingsSectionBlock
              key={id}
              id={id}
              title={translations(`sections.${id}`)}
            >
              {id === 'platform' && <PlatformSettingsSection />}
              {id === 'docs' && <LegalSection group="docs" />}
              {id === 'cookies' && <LegalSection group="cookies" />}
            </SettingsSectionBlock>
          ),
        )}

        <DangerZoneSection />
      </Box>
    </Box>
  );
}
