import { describe, it, expect } from 'vitest';
import { formatGreeting, formatRelativeDate } from './index';
import type { Locale } from '@/app/locale';

describe('formatGreeting', () => {
  it('returns morning greeting for hour < 12 in English', () => {
    expect(formatGreeting('en', 8)).toBe('Good morning');
  });

  it('returns afternoon greeting for 12 <= hour < 20 in English', () => {
    expect(formatGreeting('en', 14)).toBe('Good afternoon');
  });

  it('returns evening greeting for hour >= 20 in English', () => {
    expect(formatGreeting('en', 22)).toBe('Good evening');
  });

  it('returns Spanish greetings', () => {
    expect(formatGreeting('es', 8)).toBe('Buenos días');
    expect(formatGreeting('es', 14)).toBe('Buenas tardes');
    expect(formatGreeting('es', 22)).toBe('Buenas noches');
  });

  it('returns Catalan greetings', () => {
    expect(formatGreeting('ca', 8)).toBe('Bon dia');
    expect(formatGreeting('ca', 14)).toBe('Bona tarda');
    expect(formatGreeting('ca', 22)).toBe('Bona nit');
  });

  it('falls back to English for unknown locale', () => {
    expect(formatGreeting('fr' as Locale, 8)).toBe('Good morning');
    expect(formatGreeting('fr' as Locale, 14)).toBe('Good afternoon');
    expect(formatGreeting('fr' as Locale, 22)).toBe('Good evening');
  });

  it('handles boundary hour 12 as afternoon', () => {
    expect(formatGreeting('en', 12)).toBe('Good afternoon');
  });

  it('handles boundary hour 20 as evening', () => {
    expect(formatGreeting('en', 20)).toBe('Good evening');
  });

  it('handles hour 0 as morning', () => {
    expect(formatGreeting('en', 0)).toBe('Good morning');
  });

  it('handles hour 23 as evening', () => {
    expect(formatGreeting('en', 23)).toBe('Good evening');
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-06-20T12:00:00Z');

  it('returns "X min ago" for less than 60 minutes in English', () => {
    const date = new Date('2026-06-20T11:55:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('5 min ago');
  });

  it('returns "Xh ago" for less than 24 hours in English', () => {
    const date = new Date('2026-06-20T08:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('4h ago');
  });

  it('returns "yesterday" for 1 day ago in English', () => {
    const date = new Date('2026-06-19T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('yesterday');
  });

  it('returns "X days ago" for 2-6 days in English', () => {
    const date = new Date('2026-06-15T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('5 days ago');
  });

  it('returns "X wk ago" for 7-29 days in English', () => {
    const date = new Date('2026-06-06T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('2 wk ago');
  });

  it('returns formatted date for 30+ days in English', () => {
    const date = new Date('2026-05-01T12:00:00Z');
    const result = formatRelativeDate('en', date, now);
    expect(result).toMatch(/May 1/);
  });

  it('returns Spanish relative dates', () => {
    const minAgo = new Date('2026-06-20T11:55:00Z');
    expect(formatRelativeDate('es', minAgo, now)).toBe('hace 5 min');

    const hoursAgo = new Date('2026-06-20T08:00:00Z');
    expect(formatRelativeDate('es', hoursAgo, now)).toBe('hace 4h');

    const yesterday = new Date('2026-06-19T12:00:00Z');
    expect(formatRelativeDate('es', yesterday, now)).toBe('ayer');

    const daysAgo = new Date('2026-06-15T12:00:00Z');
    expect(formatRelativeDate('es', daysAgo, now)).toBe('hace 5 días');

    const weeksAgo = new Date('2026-06-06T12:00:00Z');
    expect(formatRelativeDate('es', weeksAgo, now)).toBe('hace 2 sem');
  });

  it('returns Catalan relative dates', () => {
    const minAgo = new Date('2026-06-20T11:55:00Z');
    expect(formatRelativeDate('ca', minAgo, now)).toBe('fa 5 min');

    const hoursAgo = new Date('2026-06-20T08:00:00Z');
    expect(formatRelativeDate('ca', hoursAgo, now)).toBe('fa 4h');

    const yesterday = new Date('2026-06-19T12:00:00Z');
    expect(formatRelativeDate('ca', yesterday, now)).toBe('ahir');

    const daysAgo = new Date('2026-06-15T12:00:00Z');
    expect(formatRelativeDate('ca', daysAgo, now)).toBe('fa 5 dies');

    const weeksAgo = new Date('2026-06-06T12:00:00Z');
    expect(formatRelativeDate('ca', weeksAgo, now)).toBe('fa 2 set');
  });

  it('falls back to English for unknown locale', () => {
    const date = new Date('2026-06-20T11:55:00Z');
    expect(formatRelativeDate('fr' as Locale, date, now)).toBe('5 min ago');
  });

  it('handles 0 minutes ago', () => {
    const date = new Date('2026-06-20T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('0 min ago');
  });

  it('handles exactly 1 hour ago', () => {
    const date = new Date('2026-06-20T11:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('1h ago');
  });

  it('handles exactly 6 days ago (still in days range)', () => {
    const date = new Date('2026-06-14T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('6 days ago');
  });

  it('handles exactly 7 days ago (weeks range)', () => {
    const date = new Date('2026-06-13T12:00:00Z');
    expect(formatRelativeDate('en', date, now)).toBe('1 wk ago');
  });
});
