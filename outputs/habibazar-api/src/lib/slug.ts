// Persian/Arabic to Latin transliteration map
const FA_TO_EN: Record<string, string> = {
  'ا': 'a', 'آ': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's',
  'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'z',
  'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
  'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'و': 'v', 'ه': 'h', 'ی': 'y', 'ئ': 'y', 'ء': '', 'ة': 'h',
  'ى': 'a', 'ؤ': 'u', 'إ': 'e', 'أ': 'a',
  // Arabic equivalents
  'ك': 'k', 'ي': 'y',
};

export function slugify(text: string): string {
  // Transliterate Persian/Arabic characters
  let result = '';
  for (const char of text) {
    if (FA_TO_EN[char] !== undefined) {
      result += FA_TO_EN[char];
    } else {
      result += char;
    }
  }

  return result
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove characters that aren't alphanumeric or hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Collapse multiple hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '');
}
