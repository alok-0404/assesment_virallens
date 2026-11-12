import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import FormField from '../components/auth/FormField.jsx';
import ErrorBanner from '../components/common/ErrorBanner.jsx';
import { Spinner } from '../components/common/Spinner.jsx';
import { redirectTarget } from '../components/common/PublicOnlyRoute.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { validateSignup } from '../utils/validation.js';
import { getErrorMessage, getFieldErrors } from '../utils/errors.js';

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' };

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState(EMPTY);
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
    const validationErrors = validateSignup(values);
    setErrors(validationErrors);
    setFormError('');
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    try {
      await signup({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      navigate(redirectTarget(location), { replace: true });
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      if (err?.response?.data?.error?.code === 'EMAIL_IN_USE') {
        fieldErrors.email = err.response.data.error.message;
      }
      setErrors(fieldErrors);
      setFormError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Get instant answers from our AI support assistant."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" state={location.state} className="font-medium text-brand-600 hover:text-brand-700">
            Sign in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={handleSubmit} className="space-y-4" aria-label="Signup form">
        <ErrorBanner message={formError} />
        <FormField
          id="name"
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={update('name')}
          error={errors.name}
          placeholder="Ada Lovelace"
        />
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
          autoComplete="new-password"
          value={values.password}
          onChange={update('password')}
          error={errors.password}
          hint="At least 8 characters, including a letter and a number."
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={update('confirmPassword')}
          error={errors.confirmPassword}
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? <Spinner className="h-4 w-4" label="Creating account…" /> : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
