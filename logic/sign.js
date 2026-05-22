// =====================================================================
// Sign / Sign Up — منطق الواجهة
// =====================================================================

const container    = document.getElementById('container');
const registerBtn  = document.getElementById('registerBtn');
const loginBtn     = document.getElementById('loginBtn');

// التوغل بين الشاشتين
registerBtn.addEventListener('click', () => container.classList.add('active'));
loginBtn   .addEventListener('click', () => container.classList.remove('active'));

// أداة عرض الرسائل
function showMsg(elId, text, ok) {
    const el = document.getElementById(elId);
    el.textContent = text;
    el.className   = 'auth-message ' + (ok ? 'success' : 'error');
}

// =====================================================================
// Sign In
// =====================================================================
const signInForm = document.getElementById('signInForm');
signInForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd   = new FormData(signInForm);
    const body = new URLSearchParams(fd);

    const res  = await fetch('/login', { method: 'POST', body });
    const data = await res.json();

    if (data.success) {
        sessionStorage.setItem('userEmail', data.email);
        showMsg('signin-message', 'Logged in ✓', true);
        setTimeout(() => (window.location.href = '/property.html'), 400);
    } else {
        showMsg('signin-message', data.message || 'Login failed', false);
    }
});

// =====================================================================
// Sign Up
// =====================================================================
const signUpForm = document.getElementById('signUpForm');
signUpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd   = new FormData(signUpForm);
    const body = new URLSearchParams(fd);

    const res  = await fetch('/signup', { method: 'POST', body });
    const data = await res.json();

    if (data.success) {
        // المستخدم الجديد يُحوَّل لصفحة صاحب العقار (property.html) — وستكون فارغة
        sessionStorage.setItem('userEmail', data.email);
        showMsg('signup-message', 'Account created ✓', true);
        setTimeout(() => (window.location.href = '/property.html'), 400);
    } else {
        showMsg('signup-message', data.message || 'Sign up failed', false);
    }
});
