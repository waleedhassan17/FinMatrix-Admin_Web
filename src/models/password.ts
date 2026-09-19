// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Password rule
// ═══════════════════════════════════════════════════════
// The server keeps length and character-class as two separate checks
// (MinLength(8) plus a class regex), so these mirror that split rather than
// folding both into one pattern.
//
// That is not a style preference. The mobile console shipped the combined
// form, `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8}$/`, where `.{8}` under a `$`
// anchor matches EXACTLY eight characters — so every longer password was
// refused, under a message promising "8+".

export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_CLASSES = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export const PASSWORD_RULE =
  'At least 8 characters, with an uppercase letter, a lowercase letter and a number.';

export const isValidPassword = (password: string): boolean =>
  password.length >= PASSWORD_MIN_LENGTH && PASSWORD_CLASSES.test(password);
