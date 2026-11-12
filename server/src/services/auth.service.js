import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { AppError, conflict } from '../utils/AppError.js';

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
const emailInUse = () => conflict('EMAIL_IN_USE', 'An account with this email already exists.');

let dummyHashPromise;
function getDummyHash(rounds) {
  dummyHashPromise ??= bcrypt.hash('timing-equalisation-placeholder', rounds);
  return dummyHashPromise;
}

export async function registerUser({ name, email, password }, env) {
  if (await User.exists({ email })) throw emailInUse();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
  try {
    return await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err?.code === 11000) throw emailInUse();
    throw err;
  }
}

export async function authenticateUser({ email, password }, env) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    // Spend comparable time on unknown emails to blunt user enumeration by timing.
    await bcrypt.compare(password, await getDummyHash(env.BCRYPT_SALT_ROUNDS));
    throw invalidCredentials();
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw invalidCredentials();
  return user;
}
