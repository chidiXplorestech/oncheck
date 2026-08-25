import { supabase } from './supabase';

const ACCOUNT_KEY = 'oncheck-account-v2';
const HYDRATED_KEY = 'ontrack-account-hydrated-v1';
const E2E_BYPASS = import.meta.env.VITE_E2E_BYPASS_AUTH === '1';

type LocalAccount = {
  name?: string;
  role?: string;
  email?: string;
  maxDailyPriorities?: number;
  lowEnergyMinutes?: number;
  weekStart?: 'monday' | 'sunday';
};

type CloudSettings = Record<string, unknown> & { role?: string };

let activeUserId = '';
let activeEmail = '';
let activeName = '';
let activeRole = 'Personal OS';
let cloudSettings: CloudSettings = {};
let saving = false;

function readLocal(): LocalAccount {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? '{}') as LocalAccount;
  } catch {
    return {};
  }
}

function writeLocal(account: LocalAccount) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
}

function signature() {
  return `${activeUserId}:${activeName}:${activeEmail}:${activeRole}`;
}

function patchSettingsDialog() {
  if (!activeUserId) return;
  const dialog = document.querySelector<HTMLDialogElement>('.system-dialog');
  if (!dialog) return;

  const accountSection = dialog.querySelector<HTMLElement>('[data-system-section="account"]');
  if (!accountSection) return;

  const heading = accountSection.querySelector('h3');
  const intro = accountSection.querySelector('h3 + p');
  if (heading && heading.textContent !== 'ONTRACK account') heading.textContent = 'ONTRACK account';
  if (intro && intro.textContent !== 'Your identity is secured by Supabase and follows this account across devices.') {
    intro.textContent = 'Your identity is secured by Supabase and follows this account across devices.';
  }

  const name = accountSection.querySelector<HTMLInputElement>('input[name="name"]');
  const role = accountSection.querySelector<HTMLInputElement>('input[name="role"]');
  const email = accountSection.querySelector<HTMLInputElement>('input[name="email"]');
  if (name && document.activeElement !== name) name.value = activeName;
  if (role && document.activeElement !== role) role.value = activeRole;
  if (email) {
    email.value = activeEmail;
    email.readOnly = true;
    email.placeholder = '';
    email.setAttribute('aria-readonly', 'true');
    email.title = 'Your login email is managed by Supabase Auth.';
    const label = email.closest('label');
    if (label?.firstChild?.nodeType === Node.TEXT_NODE) label.firstChild.nodeValue = 'Email';
  }
}

async function hydrate() {
  if (E2E_BYPASS) return;
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData.session;
  if (!session) return;

  activeUserId = session.user.id;
  activeEmail = session.user.email ?? '';

  const [profileResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', activeUserId).maybeSingle(),
    supabase.from('user_settings').select('settings').eq('user_id', activeUserId).maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (settingsResult.error) throw settingsResult.error;

  const local = readLocal();
  cloudSettings = (settingsResult.data?.settings ?? {}) as CloudSettings;
  activeName = String(profileResult.data?.display_name ?? session.user.user_metadata?.display_name ?? '').trim() || 'Account';
  activeRole = String(cloudSettings.role ?? local.role ?? 'Personal OS').trim() || 'Personal OS';

  const next: LocalAccount = {
    ...local,
    name: activeName,
    role: activeRole,
    email: activeEmail,
  };
  const current = JSON.stringify(local);
  const desired = JSON.stringify(next);
  writeLocal(next);

  const marker = signature();
  if (current !== desired && sessionStorage.getItem(HYDRATED_KEY) !== marker) {
    sessionStorage.setItem(HYDRATED_KEY, marker);
    location.reload();
    return;
  }

  document.documentElement.dataset.accountSource = 'supabase';
  patchSettingsDialog();
}

async function saveCloudAccount(form: HTMLFormElement) {
  if (!activeUserId || saving) return;
  saving = true;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const original = button?.textContent ?? 'Save Account';
  if (button) {
    button.disabled = true;
    button.textContent = 'Saving…';
  }

  try {
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim() || 'Account';
    const role = String(data.get('role') ?? '').trim() || 'Personal OS';

    const [profileResult, authResult, settingsResult] = await Promise.all([
      supabase.from('profiles').update({ display_name: name }).eq('id', activeUserId),
      supabase.auth.updateUser({ data: { display_name: name } }),
      supabase.from('user_settings').upsert({
        user_id: activeUserId,
        settings: { ...cloudSettings, role },
      }, { onConflict: 'user_id' }),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (authResult.error) throw authResult.error;
    if (settingsResult.error) throw settingsResult.error;

    activeName = name;
    activeRole = role;
    cloudSettings = { ...cloudSettings, role };
    writeLocal({ ...readLocal(), name, role, email: activeEmail });
    sessionStorage.setItem(HYDRATED_KEY, signature());
    location.reload();
  } catch (error) {
    console.error('ONTRACK account save failed', error);
    if (button) {
      button.disabled = false;
      button.textContent = 'Try Again';
    }
    alert(error instanceof Error ? error.message : 'Could not save your ONTRACK account.');
  } finally {
    saving = false;
    if (button?.isConnected && !button.disabled) button.textContent = original;
  }
}

document.addEventListener('submit', event => {
  const form = event.target as HTMLFormElement | null;
  if (E2E_BYPASS || form?.id !== 'system-account-form' || !activeUserId) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  void saveCloudAccount(form);
}, true);

const observer = new MutationObserver(() => patchSettingsDialog());
observer.observe(document.documentElement, { childList: true, subtree: true });

if (!E2E_BYPASS) {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      activeUserId = '';
      return;
    }
    void hydrate().catch(error => console.error('ONTRACK account hydration failed', error));
  });
  void hydrate().catch(error => console.error('ONTRACK account hydration failed', error));
}
