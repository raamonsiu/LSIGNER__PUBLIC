import type { Locale } from '@/app/locale';

export type { Locale } from '@/app/locale';

export const LOCALE_COOKIE = 'locale';

export function formatGreeting(locale: Locale, hour: number): string {
  const greetings: Record<Locale, [string, string, string]> = {
    en: ['Good morning', 'Good afternoon', 'Good evening'],
    es: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
    ca: ['Bon dia', 'Bona tarda', 'Bona nit'],
  };

  const greeting = greetings[locale] ?? greetings.en;
  if (hour < 12) return greeting[0];
  if (hour < 20) return greeting[1];
  return greeting[2];
}

export function formatRelativeDate(
  locale: Locale,
  date: Date,
  now: Date,
): string {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const labels: Record<
    Locale,
    {
      minutesAgo: string;
      hoursAgo: string;
      yesterday: string;
      daysAgo: string;
      weeksAgo: string;
    }
  > = {
    en: {
      minutesAgo: '{minutes} min ago',
      hoursAgo: '{hours}h ago',
      yesterday: 'yesterday',
      daysAgo: '{days} days ago',
      weeksAgo: '{weeks} wk ago',
    },
    es: {
      minutesAgo: 'hace {minutes} min',
      hoursAgo: 'hace {hours}h',
      yesterday: 'ayer',
      daysAgo: 'hace {days} días',
      weeksAgo: 'hace {weeks} sem',
    },
    ca: {
      minutesAgo: 'fa {minutes} min',
      hoursAgo: 'fa {hours}h',
      yesterday: 'ahir',
      daysAgo: 'fa {days} dies',
      weeksAgo: 'fa {weeks} set',
    },
  };

  const label = labels[locale] ?? labels.en;

  if (diffMinutes < 60)
    return label.minutesAgo.replace('{minutes}', String(diffMinutes));
  if (diffHours < 24)
    return label.hoursAgo.replace('{hours}', String(diffHours));
  if (diffDays === 1) return label.yesterday;
  if (diffDays < 7) return label.daysAgo.replace('{days}', String(diffDays));
  if (diffDays < 30)
    return label.weeksAgo.replace('{weeks}', String(Math.floor(diffDays / 7)));
  return date.toLocaleDateString(
    locale === 'en' ? 'en-US' : locale === 'ca' ? 'ca-ES' : 'es-ES',
    {
      day: 'numeric',
      month: 'short',
    },
  );
}
