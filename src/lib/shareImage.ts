import type { RefObject } from 'react';
import type { View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

/** Snapshot a view into a named PNG and hand it to the native share sheet. */
export async function shareViewImage(
  ref: RefObject<View | null>,
  filename: string,
): Promise<void> {
  const shot = await captureRef(ref, { format: 'png', quality: 1 });
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  new File(shot).copy(file);
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: filename });
}
