'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SideNav } from '@/components/layout/SideNav';
import { TopBar } from '@/components/layout/TopBar';
import { AppFooter } from '@/components/layout/AppFooter';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ProfileDrawer } from '@/components/profile/ProfileDrawer';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { SettingsProvider } from '@/app/(app)/settings/SettingsContext';
import { SendDocumentWizardProvider } from '@/components/providers/SendDocumentWizardProvider';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const handleProfileClose = useCallback(() => setProfileOpen(false), []);
  const handleModalClose = useCallback(() => setProfileModalOpen(false), []);

  const handleEditInfo = useCallback(() => {
    setProfileModalOpen(false);
    setTimeout(() => {
      router.push('/settings#user');
    }, 300);
  }, [router]);

  return (
    <AuthGuard>
      <SettingsProvider>
        <SendDocumentWizardProvider>
          <SideNav />
          <div
            style={{
              marginLeft: '256px',
              display: 'flex',
              flexDirection: 'column',
              minHeight: '100vh',
            }}
          >
            <TopBar onProfileClick={() => setProfileModalOpen(true)} />
            <main style={{ flex: 1 }}>{children}</main>
          </div>
          <AppFooter />
        </SendDocumentWizardProvider>
        <ProfileDrawer open={profileOpen} onClose={handleProfileClose} />
        <ProfileModal
          open={profileModalOpen}
          onClose={handleModalClose}
          onEditInfo={handleEditInfo}
        />
      </SettingsProvider>
    </AuthGuard>
  );
}
