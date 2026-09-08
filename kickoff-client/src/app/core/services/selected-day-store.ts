import { Injectable, signal } from '@angular/core';
import { startOfLocalDay } from '../timeline';

const STORAGE_KEY = 'kickoff.day.selected-date';

@Injectable({ providedIn: 'root' })
export class SelectedDayStore {
  readonly day = signal(readSelectedDay());

  select(day: Date): void {
    const selected = startOfLocalDay(day);
    this.day.set(selected);
    try {
      localStorage.setItem(STORAGE_KEY, formatLocalDate(selected));
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  goToToday(): void {
    this.day.set(startOfLocalDay(new Date()));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }
}

function readSelectedDay(): Date {
  try {
    const value = localStorage.getItem(STORAGE_KEY) ?? '';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const date = Number(match[3]);
      const parsed = startOfLocalDay(new Date(year, month - 1, date));
      if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === date) {
        return parsed;
      }
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
  return startOfLocalDay(new Date());
}

function formatLocalDate(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, '0');
  const date = String(day.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}
