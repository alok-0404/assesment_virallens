import { describe, it, expect } from 'vitest';
import { validateEmail, validateLogin, validateName, validateNewPassword, validateSignup } from './validation.js';

describe('validation', () => {
  it('validates emails', () => {
    expect(validateEmail('')).toBe('Email is required.');
    expect(validateEmail('nope')).toBe('Please enter a valid email address.');
    expect(validateEmail(' ada@example.com ')).toBe('');
  });

  it('validates new passwords like the server', () => {
    expect(validateNewPassword('')).toBe('Password is required.');
    expect(validateNewPassword('abc1')).toBe('Password must be at least 8 characters.');
    expect(validateNewPassword('abcdefgh')).toBe('Password must contain at least one number.');
    expect(validateNewPassword('12345678')).toBe('Password must contain at least one letter.');
    expect(validateNewPassword('abcdefg1')).toBe('');
  });

  it('validates names', () => {
    expect(validateName(' ')).toBe('Name is required.');
    expect(validateName('A')).toBe('Name must be at least 2 characters.');
    expect(validateName('Ada')).toBe('');
  });

  it('collects login and signup errors', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: 'Email is required.',
      password: 'Password is required.',
    });
    expect(
      validateSignup({ name: 'Ada', email: 'ada@example.com', password: 'Password1', confirmPassword: 'Password2' }),
    ).toEqual({ confirmPassword: 'Passwords do not match.' });
    expect(
      validateSignup({ name: 'Ada', email: 'ada@example.com', password: 'Password1', confirmPassword: 'Password1' }),
    ).toEqual({});
  });
});
