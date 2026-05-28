import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class LanguageManager {
  private locales = new Map<string, Record<string, string>>();

  constructor() {
    const localesDir = join(__dirname, '..', 'locales');
    for (const file of readdirSync(localesDir).filter(f => f.endsWith('.json'))) {
      const lang = file.replace('.json', '');
      const data = JSON.parse(readFileSync(join(localesDir, file), 'utf-8'));
      this.locales.set(lang, data);
    }
  }

  get(locale: string, key: string, ...args: string[]): string {
    const dict = this.locales.get(locale) ?? this.locales.get('en') ?? {};
    let text = dict[key] ?? this.locales.get('en')?.[key] ?? key;
    for (let i = 0; i < args.length; i++) {
      text = text.replaceAll(`{${i}}`, args[i]);
    }
    return text;
  }
}
