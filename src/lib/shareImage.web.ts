import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { shareBlob } from './files.web';

/** Web version: snapshot the view in the page, then share or download the PNG. */
export async function shareViewImage(ref: RefObject<View | null>, filename: string): Promise<void> {
  const dataUrl = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
  const blob = await (await fetch(dataUrl)).blob();
  await shareBlob(filename, blob);
}
