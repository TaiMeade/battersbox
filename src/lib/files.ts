import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saving and opening files. Phones go through the share sheet and document
 * picker; the web build uses files.web.ts instead.
 */
export async function shareTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

/** The text of a file the user picks, or null if they cancel. */
export async function pickTextFile(mimeType: string): Promise<string | null> {
  const picked = await DocumentPicker.getDocumentAsync({ type: mimeType, copyToCacheDirectory: true });
  if (picked.canceled || picked.assets.length === 0) return null;
  return new File(picked.assets[0].uri).text();
}
