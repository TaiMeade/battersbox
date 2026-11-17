/**
 * Web versions of files.ts. Saving offers the share sheet where the browser
 * can share files (an iPhone home-screen app can: "Save to Files"),
 * otherwise downloads.
 */
export async function shareBlob(filename: string, blob: Blob): Promise<void> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') return; // they closed the sheet
      // anything else: fall back to a download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function shareTextFile(filename: string, content: string, mimeType: string): Promise<void> {
  await shareBlob(filename, new Blob([content], { type: mimeType }));
}

export function pickTextFile(mimeType: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${mimeType},.json`;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    };
    // No change event fires on cancel in every browser; this one does.
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
