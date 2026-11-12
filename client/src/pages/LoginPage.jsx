import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import FormField from '../components/auth/FormField.jsx';
import ErrorBanner from '../components/common/ErrorBanner.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { redirectTarget } from '../components/common/PublicOnlyRoute.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { validateLogin } from '../utils/validation.js';
import { getErrorMessage, getFieldErrors } from '../utils/errors.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    const validationErrors = validateLogin(values);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(redirectTarget(location), { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err));
      setErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to chat with Ava, your AI support assistant."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" state={location.state} className="font-medium text-brand-600 hover:text-brand-700">
            Create one
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-label="Login form">
        <ErrorBanner message={formError} />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={update('email')}
          error={errors.email}
          placeholder="you@example.com"
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Spinner className="h-4 w-4" label="Signing in…" /> : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
