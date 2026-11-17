import { getSetting, setSetting } from '@/db/repo';

/**
 * Web version of cardProfile.ts. There's no app folder to copy a photo
 * into, so it's shrunk and kept in the settings table as an image URL,
 * which also means it syncs to the other devices.
 */
export const CARD_KEYS = {
  photo: 'card.photoUri',
  team: 'card.team',
  position: 'card.position',
  number: 'card.number',
} as const;

export type CardDetailKey = 'team' | 'position' | 'number';

const MAX_SIDE = 640;

export async function setCardDetail(key: CardDetailKey, value: string): Promise<void> {
  await setSetting(CARD_KEYS[key], value.trim());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be read'));
    img.src = src;
  });
}

export async function saveCardPhoto(sourceUri: string): Promise<void> {
  const img = await loadImage(sourceUri);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  await setSetting(CARD_KEYS.photo, canvas.toDataURL('image/jpeg', 0.85));
}

export async function removeCardPhoto(): Promise<void> {
  if (await getSetting(CARD_KEYS.photo)) await setSetting(CARD_KEYS.photo, '');
}
