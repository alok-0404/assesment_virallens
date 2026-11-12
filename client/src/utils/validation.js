const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name) {
  const value = name.trim();
  if (!value) return 'Name is required.';
  if (value.length < 2) return 'Name must be at least 2 characters.';
  if (value.length > 60) return 'Name must be at most 60 characters.';
  return '';
}

export function validateEmail(email) {
  const value = email.trim();
  if (!value) return 'Email is required.';
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return 'Please enter a valid email address.';
  return '';
}

export function validateNewPassword(password) {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one number.';
  return '';
}

function collect(entries) {
  return Object.fromEntries(entries.filter(([, message]) => message));
}

export function validateLogin({ email, password }) {
  return collect([
    ['email', validateEmail(email)],
    ['password', password ? '' : 'Password is required.'],
  ]);
}

export function validateSignup({ name, email, password, confirmPassword }) {
  return collect([
    ['name', validateName(name)],
    ['email', validateEmail(email)],
    ['password', validateNewPassword(password)],
    ['confirmPassword', password !== confirmPassword ? 'Passwords do not match.' : ''],
  ]);
}
