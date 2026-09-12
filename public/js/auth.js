let authToken = localStorage.getItem('pocket_auth_token') || '';
let onAuthSuccessCallback = null;
let onLockCallback = null;

const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const pinInput = document.getElementById('pin-input');
const authError = document.getElementById('auth-error');
const lockBtn = document.getElementById('lock-btn');

export function getAuthToken() {
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('pocket_auth_token', token);
  } else {
    localStorage.removeItem('pocket_auth_token');
  }
}

export function showLockscreen() {
  if (authModal) {
    authModal.style.display = 'flex';
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }
  if (lockBtn) lockBtn.style.display = 'none';
}

export function hideLockscreen() {
  if (authModal) authModal.style.display = 'none';
  if (lockBtn) lockBtn.style.display = 'inline-flex';
}

/**
 * Authenticated Fetch Wrapper
 */
export async function authFetch(url, options = {}) {
  options.headers = options.headers || {};
  if (authToken) {
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', `Bearer ${authToken}`);
    } else {
      options.headers['Authorization'] = `Bearer ${authToken}`;
    }
  }

  const res = await fetch(url, options);
  if (res.status === 401) {
    showLockscreen();
    throw new Error('Authentication required');
  }
  return res;
}

/**
 * Check Server Auth Status on Boot
 */
export async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    if (data.authRequired) {
      if (!authToken) {
        showLockscreen();
        return false;
      } else {
        hideLockscreen();
        return true;
      }
    } else {
      hideLockscreen();
      return true;
    }
  } catch (err) {
    console.error('Failed to check auth status:', err);
    return true;
  }
}

export function initAuth({ onAuthSuccess, onLock }) {
  onAuthSuccessCallback = onAuthSuccess;
  onLockCallback = onLock;

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pin = pinInput.value.trim();
      if (!pin) return;

      if (authError) authError.style.display = 'none';

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });

        const data = await res.json();
        if (data.success && data.token) {
          setAuthToken(data.token);
          hideLockscreen();
          if (typeof onAuthSuccessCallback === 'function') {
            onAuthSuccessCallback();
          }
        } else {
          if (authError) {
            authError.textContent = data.error || 'Incorrect PIN. Try again.';
            authError.style.display = 'block';
          }
          pinInput.value = '';
          pinInput.focus();
        }
      } catch (err) {
        if (authError) {
          authError.textContent = 'Connection error. Please try again.';
          authError.style.display = 'block';
        }
      }
    });
  }

  if (lockBtn) {
    lockBtn.addEventListener('click', () => {
      setAuthToken('');
      showLockscreen();
      if (typeof onLockCallback === 'function') {
        onLockCallback();
      }
    });
  }
}
