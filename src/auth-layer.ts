import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import './auth.css';
import { supabase, supabaseEnabled } from './supabase';

type AuthMode = 'login' | 'signup' | 'forgot' | 'recovery' | 'check-email';

const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';
const PRODUCTION_APP_URL = 'https://ontrack-everyday.netlify.app/';
let mode: AuthMode = 'login';
let authRoot: HTMLElement | null = null;
let currentSession: Session | null = null;
let message = '';
let busy = false;

function esc(value: string) {
  return value.replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] ?? ch));
}

function authRedirectUrl() {
  if (import.meta.env.PROD) return PRODUCTION_APP_URL;
  return `${window.location.origin}${import.meta.env.BASE_URL}`;
}

function setAppLocked(locked: boolean) {
  document.documentElement.dataset.authRequired = locked ? 'true' : 'false';
}

function patchAccount() {
  if (!currentSession) return;
  const profile = document.querySelector<HTMLElement>('.profile');
  if (!profile || profile.dataset.authPatched === currentSession.user.id) return;
  const displayName = String(currentSession.user.user_metadata?.display_name ?? '').trim() || 'ONTRACK';
  const email = currentSession.user.email ?? '';
  profile.dataset.authPatched = currentSession.user.id;
  profile.innerHTML = `
    <div class="avatar"></div>
    <div class="oncheck-auth-account">
      <div class="oncheck-auth-account-copy"><strong>${esc(displayName)}</strong><span>${esc(email)}</span></div>
      <button type="button" class="oncheck-auth-logout" data-auth-logout>LOG OUT</button>
    </div>`;
}

function removeGate() {
  authRoot?.remove();
  authRoot = null;
  setAppLocked(false);
  requestAnimationFrame(patchAccount);
}

function shell(content: string) {
  return `
    <div class="auth-stage">
      <div class="auth-atmosphere" aria-hidden="true"></div>
      <main class="auth-card" aria-live="polite">
        <div class="auth-brand">ONTRACK</div>
        ${content}
      </main>
    </div>`;
}

function render() {
  if (E2E_BYPASS || !supabaseEnabled || currentSession) {
    removeGate();
    return;
  }

  if (!authRoot) {
    authRoot = document.createElement('div');
    authRoot.className = 'auth-root';
    document.body.append(authRoot);
  }

  setAppLocked(true);
  const feedback = message ? `<p class="auth-feedback">${esc(message)}</p>` : '';
  const disabled = busy ? 'disabled' : '';

  if (mode === 'signup') {
    authRoot.innerHTML = shell(`
      <div class="auth-heading"><span>CREATE ACCOUNT</span><h1>Start with one account.</h1><p>Your ONTRACK data will belong to this account and follow you across devices.</p></div>
      <form class="auth-form" data-auth-form="signup">
        <label>Name<input name="name" autocomplete="name" required /></label>
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        ${feedback}
        <button class="auth-primary" ${disabled}>${busy ? 'CREATING…' : 'CREATE ACCOUNT'}</button>
      </form>
      <button class="auth-link" data-auth-mode="login">Already have an account? Log in</button>
    `);
    return;
  }

  if (mode === 'forgot') {
    authRoot.innerHTML = shell(`
      <div class="auth-heading"><span>ACCOUNT RECOVERY</span><h1>Reset your password.</h1><p>Enter your account email. Supabase will send a secure recovery email to verify it is you.</p></div>
      <form class="auth-form" data-auth-form="forgot">
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        ${feedback}
        <button class="auth-primary" ${disabled}>${busy ? 'SENDING…' : 'SEND RECOVERY EMAIL'}</button>
      </form>
      <button class="auth-link" data-auth-mode="login">Back to login</button>
    `);
    return;
  }

  if (mode === 'recovery') {
    authRoot.innerHTML = shell(`
      <div class="auth-heading"><span>NEW PASSWORD</span><h1>Secure the account.</h1><p>Create a new password for your ONTRACK account.</p></div>
      <form class="auth-form" data-auth-form="recovery">
        <label>New password<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        ${feedback}
        <button class="auth-primary" ${disabled}>${busy ? 'UPDATING…' : 'UPDATE PASSWORD'}</button>
      </form>
    `);
    return;
  }

  if (mode === 'check-email') {
    authRoot.innerHTML = shell(`
      <div class="auth-heading auth-centered"><span>VERIFY EMAIL</span><h1>Check your inbox.</h1><p>${feedback || 'We sent a secure verification email. Open it to activate your ONTRACK account.'}</p></div>
      <button class="auth-primary" data-auth-mode="login">BACK TO LOGIN</button>
    `);
    return;
  }

  authRoot.innerHTML = shell(`
    <div class="auth-heading"><span>PERSONAL OS</span><h1>Your life. In execution.</h1><p>Sign in to continue to your ONTRACK workspace.</p></div>
    <form class="auth-form" data-auth-form="login">
      <label>Email<input name="email" type="email" autocomplete="email" required /></label>
      <label>Password<input name="password" type="password" autocomplete="current-password" required /></label>
      ${feedback}
      <button class="auth-primary" ${disabled}>${busy ? 'SIGNING IN…' : 'LOG IN'}</button>
    </form>
    <div class="auth-actions">
      <button class="auth-link" data-auth-mode="forgot">Forgot password?</button>
      <button class="auth-link" data-auth-mode="signup">Create account</button>
    </div>
  `);
}

async function handleLogin(form: HTMLFormElement) {
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function handleSignup(form: HTMLFormElement) {
  const data = new FormData(form);
  const name = String(data.get('name') ?? '').trim();
  const email = String(data.get('email') ?? '').trim();
  const password = String(data.get('password') ?? '');
  const confirmPassword = String(data.get('confirmPassword') ?? '');
  if (password !== confirmPassword) throw new Error('Passwords do not match.');

  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectUrl(), data: { display_name: name } },
  });
  if (error) throw error;
  if (!result.session) {
    mode = 'check-email';
    message = `Verification sent to ${email}.`;
  }
}

async function handleForgot(form: HTMLFormElement) {
  const data = new FormData(form);
  const email = String(data.get('email') ?? '').trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() });
  if (error) throw error;
  mode = 'check-email';
  message = `Recovery instructions sent to ${email}.`;
}

async function handleRecovery(form: HTMLFormElement) {
  const data = new FormData(form);
  const password = String(data.get('password') ?? '');
  const confirmPassword = String(data.get('confirmPassword') ?? '');
  if (password !== confirmPassword) throw new Error('Passwords do not match.');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  mode = 'login';
  message = 'Password updated. You can now continue securely.';
}

async function submit(form: HTMLFormElement) {
  if (busy) return;
  busy = true;
  message = '';
  render();
  try {
    const action = form.dataset.authForm;
    if (action === 'login') await handleLogin(form);
    if (action === 'signup') await handleSignup(form);
    if (action === 'forgot') await handleForgot(form);
    if (action === 'recovery') await handleRecovery(form);
  } catch (error) {
    message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  } finally {
    busy = false;
    render();
  }
}

function handleAuthEvent(event: AuthChangeEvent, nextSession: Session | null) {
  currentSession = nextSession;
  if (event === 'PASSWORD_RECOVERY') {
    mode = 'recovery';
    currentSession = null;
  }
  render();
}

document.addEventListener('click', event => {
  const modeButton = (event.target as HTMLElement).closest<HTMLElement>('[data-auth-mode]');
  if (modeButton) {
    mode = (modeButton.dataset.authMode as AuthMode) ?? 'login';
    message = '';
    render();
    return;
  }
  const logout = (event.target as HTMLElement).closest<HTMLElement>('[data-auth-logout]');
  if (logout) void supabase.auth.signOut();
});

document.addEventListener('submit', event => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('[data-auth-form]');
  if (!form) return;
  event.preventDefault();
  void submit(form);
});

const accountObserver = new MutationObserver(() => {
  if (currentSession) requestAnimationFrame(patchAccount);
});
accountObserver.observe(document.documentElement, { childList: true, subtree: true });

if (E2E_BYPASS) {
  removeGate();
  document.documentElement.dataset.authBypass = 'e2e';
} else {
  setAppLocked(true);
  void supabase.auth.getSession().then(({ data }) => {
    currentSession = data.session;
    render();
  });
  supabase.auth.onAuthStateChange(handleAuthEvent);
}

export async function signOutOntrack() {
  await supabase.auth.signOut();
}
