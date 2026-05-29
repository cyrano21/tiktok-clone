export class MMKV {
  getString(key: string) { return localStorage.getItem(key) || undefined; }
  set(key: string, value: string) { localStorage.setItem(key, value); }
  delete(key: string) { localStorage.removeItem(key); }
  clearAll() { localStorage.clear(); }
}
