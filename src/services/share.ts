export async function shareText(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const browserNavigator = navigator as Navigator & {
      share?: (data: { text: string }) => Promise<void>;
      clipboard?: { writeText: (value: string) => Promise<void> };
    };
    if (browserNavigator.share) {
      await browserNavigator.share({ text });
      return true;
    }

    if (browserNavigator.clipboard?.writeText) {
      await browserNavigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}
