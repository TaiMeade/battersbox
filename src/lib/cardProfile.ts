import { File, Paths } from 'expo-file-system';

import { getSetting, setSetting } from '@/db/repo';

/**
 * Card personalization lives in the settings key-value table — no schema
 * migration, and it rides along in the JSON backup for free. (The photo
 * file itself stays on this phone; after a restore on a new device the
 * card falls back to the monogram placeholder.)
 */
export const CARD_KEYS = {
  photo: 'card.photoUri',
  team: 'card.team',
  position: 'card.position',
  number: 'card.number',
} as const;

export type CardDetailKey = 'team' | 'position' | 'number';

export async function setCardDetail(key: CardDetailKey, value: string): Promise<void> {
  await setSetting(CARD_KEYS[key], value.trim());
}

/** Copies the picked image into app storage so it outlives the picker's cache. */
export async function saveCardPhoto(sourceUri: string): Promise<void> {
  const previous = await getSetting(CARD_KEYS.photo);
  // Versioned filename: a fresh URI so Image never serves a stale cache entry.
  const dest = new File(Paths.document, `card-photo-${Date.now()}.jpg`);
  new File(sourceUri).copy(dest);
  await setSetting(CARD_KEYS.photo, dest.uri);
  if (previous) deleteQuietly(previous);
}

export async function removeCardPhoto(): Promise<void> {
  const previous = await getSetting(CARD_KEYS.photo);
  await setSetting(CARD_KEYS.photo, '');
  if (previous) deleteQuietly(previous);
}

function deleteQuietly(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // the old photo is already gone — nothing to clean up
  }
}
