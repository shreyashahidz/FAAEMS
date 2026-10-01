/**
 * FAAEMS — Interactive Controller
 * Features:
 * - Theme-reactive sticky header (Dark -> Light Misted Sky Glass -> Dark Deep Hanada)
 * - 3D Card tilt effect on hero platform visual
 * - Concentric multi-ring radial gauge sweep animation & 94.2% score count-up
 * - Department switcher (AI&ML, AI&DS, IT, COMP, E&TC, MME, Civil)
 * - HOD profile cards directory
 * - Instant Faculty Search filter across 15 sample faculty profiles
 * - Comprehensive Faculty Dossier Modal with Criterion 6.1 & 6.2 evaluation tables
 * - Grounded FAAEMS AI Accreditation Assistant
 */

document.addEventListener('DOMContentLoaded', async () => {
  initThemeReactiveHeader();
  initHeroTilt();
  initHeroDots();
  initCalendarAndTodoList();
  initLeaderboard();
  syncLeaderboardHeight();
  initFacultySearchAndCarousel();
  initFacultyDossierModal();
  initChatAssistant();
  initModals();
  initAccountMenu();
  initNewsletter();
  // Load real departments/faculty/criteria before the achievement form
  // renders its dropdowns, so it never has to re-populate itself mid-use.
  await buildRealSubmissionConfig();
  initAchievementSubmissionForm();
});

/* ==========================================================================
   1. Dynamic Theme-Reactive Header (Deep Hanada -> Misted Sky Glass -> Dark)
   ========================================================================== */
function initThemeReactiveHeader() {
  const header = document.getElementById('siteHeader');
  const deptSection = document.getElementById('departments');
  const hodSection = document.getElementById('hod-section');
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section, footer');

  function checkHeaderTheme() {
    const scrollY = window.scrollY;

    if (scrollY > 60) {
      header.classList.add('scrolled-header');
      header.classList.add('theme-light-header');
    } else {
      header.classList.remove('scrolled-header');
      header.classList.remove('theme-light-header');
    }

    // Scrollspy
    let currentId = '';
    const scrollPos = window.scrollY + 160;

    sections.forEach(sec => {
      const top = sec.offsetTop;
      const height = sec.offsetHeight;
      if (scrollPos >= top && scrollPos < top + height) {
        currentId = sec.getAttribute('id');
      }
    });

    if (currentId) {
      navLinks.forEach(link => {
        link.classList.remove('active');
        const href = link.getAttribute('href').replace('#', '');
        if (href === currentId || (currentId === 'departments' && href === 'departments') || (currentId === 'faculties-section' && href === 'faculties')) {
          link.classList.add('active');
        }
      });
    }
  }

  window.addEventListener('scroll', checkHeaderTheme, { passive: true });
  checkHeaderTheme();

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobileToggle');
  const mainNav = document.getElementById('mainNav');

  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', () => {
      if (mainNav.style.display === 'flex') {
        mainNav.style.display = 'none';
      } else {
        mainNav.style.display = 'flex';
        mainNav.style.flexDirection = 'column';
        mainNav.style.position = 'absolute';
        mainNav.style.top = '80px';
        mainNav.style.left = '0';
        mainNav.style.width = '100%';
        mainNav.style.background = header.classList.contains('theme-light-header') ? 'rgba(223, 251, 255, 0.98)' : 'rgba(36, 32, 61, 0.98)';
        mainNav.style.padding = '1.5rem 2rem';
        mainNav.style.borderBottom = '1px solid rgba(123, 132, 238, 0.3)';
      }
    });
  }
}

/* ==========================================================================
   2. Hero 3D Card Interactive Tilt
   ========================================================================== */
function initHeroTilt() {
  const container = document.getElementById('heroVisualWrapper');
  const card = document.getElementById('hero3dCard');

  if (!container || !card) return;

  container.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 14;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  });

  container.addEventListener('mouseleave', () => {
    card.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
  });
}

/* ==========================================================================
   3. Hero 5 Carousel Indicator Dots
   ========================================================================== */
function initHeroDots() {
  const dots = document.querySelectorAll('.hero-dot');
  const title = document.getElementById('heroTitle');
  if (!title || !subtitle || dots.length === 0) return;

  const slidesData = [
    {
      title: 'Academic Journey<br><span class="campus-headline-highlight">Begins at TCET</span>',
      desc: 'Centralized Institutional Evidence Vault, NBA Tier-I SAR Criterion 6 compliance, and verified faculty achievement tracking.'
    },
    {
      title: 'NBA Tier-I SAR<br><span class="campus-headline-highlight">Criterion 6 Suite</span>',
      desc: 'Full institutional rubric tracking across professional development, SWAYAM MOOCs, publications, patents, and sponsored research.'
    },
    {
      title: 'Verified Evidence<br><span class="campus-headline-highlight">Cryptographic Vault</span>',
      desc: 'Dual-role HOD verification, immutable certificate storage, and cryptographic duplicate prevention.'
    },
    {
      title: '12 Disciplines<br><span class="campus-headline-highlight">Engineering Leadership</span>',
      desc: 'Distinguished Ph.D department heads, active research supervisors, and faculty achievement portfolios.'
    }
  ];

  let currentSlide = 0;
  let autoTimer = null;

  function setSlide(idx) {
    currentSlide = idx;
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });

    if (title && subtitle) {
      title.style.opacity = '0';
      subtitle.style.opacity = '0';
      title.style.transform = 'translateY(6px)';
      subtitle.style.transform = 'translateY(6px)';
      title.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      subtitle.style.transition = 'opacity 0.25s ease, transform 0.25s ease';

      setTimeout(() => {
        title.innerHTML = slidesData[idx].title;
        subtitle.textContent = slidesData[idx].desc;
        title.style.opacity = '1';
        subtitle.style.opacity = '1';
        title.style.transform = 'translateY(0)';
        subtitle.style.transform = 'translateY(0)';
      }, 250);
    }
  }

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      clearInterval(autoTimer);
      setSlide(idx);
      startAutoSlide();
    });
  });

  function startAutoSlide() {
    autoTimer = setInterval(() => {
      const next = (currentSlide + 1) % slidesData.length;
      setSlide(next);
    }, 7000);
  }

  startAutoSlide();
}

// Phone number: digits only, capped at 10 (Indian mobile convention, no
// country code stored). Shared by the Register and Update Details forms.
function restrictToTenDigits(input) {
  if (!input) return;
  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 10);
  });
}

// Shared by every department <select> populated from the real API
// (register, add faculty, update details) — AIML pinned first since it's
// the department with the fullest real roster right now, the rest
// alphabetical.
function sortDepartmentsAimlFirst(depts) {
  return [...depts].sort((a, b) => {
    if (a.code === 'AIML') return -1;
    if (b.code === 'AIML') return 1;
    return a.name.localeCompare(b.name);
  });
}

/* ==========================================================================
   4. Academic Calendar & To-Do List (see initCalendarAndTodoList below)
   ========================================================================== */
let activeDepartmentState = {
  key: 'aiml',
  name: 'B.Tech – Artificial Intelligence & Machine Learning',
  shortName: 'B.Tech – AI & ML',
  status: 'Verified',
  rating: 'A++ Grade',
  compliance: 'Exemplary Compliance',
  desc: 'Comprehensive departmental evaluation across NBA/NAAC parameters including professional society leadership, advanced pedagogy training, refereed publications, and external research grants.'
};

// Turns a thrown api.js error into one short, human-readable line for a
// form's error banner — never the raw DRF field-error object. Two things
// the naive `Object.values(err.data).flat().join(' ')` this replaced got
// wrong: it included correlation_id (an internal UUID meaningless to a
// user) verbatim in the message, and a duplicate-registration attempt
// trips BOTH the email and full_name uniqueness checks at once, so it
// joined two near-identical "already exists" sentences into one wall of
// text instead of saying it once.
function friendlyErrorMessage(err, fallback) {
  if (err && err.data && typeof err.data === 'object') {
    const messages = Object.entries(err.data)
      .filter(([key]) => key !== 'correlation_id')
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
      .filter((m) => typeof m === 'string' && m.trim());
    if (messages.some((m) => /already exists/i.test(m))) {
      return 'An account with this name or email already exists. Please log in instead.';
    }
    if (messages.length) return messages.join(' ');
  }
  return (err && err.message) || fallback;
}

// Generic inline form-error toggle — a plain <p class="form-error-text">
// next to whichever field/form it belongs to. Promoted to top level (was
// previously local to initRealAuth()) so any init function can reuse it
// instead of redefining the same two lines.
function showError(el, message) {
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}
function hideError(el) {
  if (!el) return;
  el.style.display = 'none';
}

// Mirrors the backend's currently_active_faculty_q() / FacultyProfile.
// is_currently_active exactly (status must be 'active', and a scheduled
// exit_date only counts once it's actually in the past) — used purely to
// decide what the dossier UI offers (e.g. the HOD's delete-record
// override below); the real rule is still enforced server-side regardless
// of what this returns.
function isProfileCurrentlyActive(profile) {
  if (!profile || profile.status !== 'active') return false;
  if (profile.exit_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exit = new Date(profile.exit_date);
    if (exit < today) return false;
  }
  return true;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Live, purely client-side password strength feedback (no network call —
// unlike a real breach check, this can run on every keystroke without
// lag or rate-limiting) — informational only, same spirit as Gmail's
// signup strength meter: it never blocks submission, it just tells the
// person what it thinks before they hit submit.
const PASSWORD_STRENGTH_LEVELS = [
  { label: 'Very Weak', color: '#dc2626' },
  { label: 'Weak', color: '#dc2626' },
  { label: 'Fair', color: '#f59e0b' },
  { label: 'Good', color: '#2563eb' },
  { label: 'Strong', color: '#059669' },
];

function computePasswordStrength(password) {
  if (!password) return null;
  const length = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  // The obvious, guessable patterns worth calling out specifically —
  // "institution name + current year", sequences, repeated characters,
  // classic filler words — regardless of how they score on length/variety
  // alone (Tcet@2026 has all four character classes but is still exactly
  // the kind of password a breach list already has).
  const COMMON_PATTERNS = [
    /^(password|admin|welcome|qwerty|letmein|iloveyou|changeme)/i,
    /(tcet|thakur|faems|faculty)[@#_-]?\d{2,4}$/i,
    /^\d{6,}$/,
    /(.)\1{3,}/,
    /^(123456|12345678|abcdef|qwertyuiop|09876)/i,
  ];
  const looksCommon = COMMON_PATTERNS.some((re) => re.test(password));

  let score = 0;
  if (length >= 6) score += 1;
  if (length >= 10) score += 1;
  if (length >= 14) score += 1;
  score += Math.max(0, varietyCount - 1);
  if (looksCommon) score = Math.min(score, 1);
  score = Math.max(0, Math.min(PASSWORD_STRENGTH_LEVELS.length - 1, score));

  return { score, percent: Math.round(((score + 1) / PASSWORD_STRENGTH_LEVELS.length) * 100), ...PASSWORD_STRENGTH_LEVELS[score] };
}

// Google-signup-style "Suggest a strong password" — generated client-side,
// guaranteed to land in the top strength band (16 chars, all four
// character classes, no dictionary/sequence patterns) since it's built
// from a fixed shape rather than sampled and checked.
function generateStrongPassword() {
  const LOWER = 'abcdefghjkmnpqrstuvwxyz';
  const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const DIGITS = '23456789';
  const SYMBOLS = '!@#$%^&*-_=+';
  const ALL = LOWER + UPPER + DIGITS + SYMBOLS;
  const randChar = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [randChar(LOWER), randChar(UPPER), randChar(DIGITS), randChar(SYMBOLS)];
  while (chars.length < 16) chars.push(randChar(ALL));
  // Fisher-Yates shuffle so the fixed-class characters aren't always in
  // the same leading positions.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

// Local (per-browser) task reminders, surfaced through the SAME
// notification bell as real backend notifications instead of a separate
// on-page toast — see fireTaskReminder / renderNotifications. Kept as its
// own localStorage list (not folded into academicTasks) since "read" here
// is a notification-list concept, independent of the task's own
// completed/pending state in the to-do list.
const LOCAL_NOTIFICATIONS_KEY = 'FAAEMS_LOCAL_NOTIFICATIONS';

function getLocalNotifications() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_NOTIFICATIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveLocalNotifications(list) {
  try {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list));
  } catch {
    // best-effort — storage full/blocked, notification just won't persist
  }
}

function addLocalNotification(title, message) {
  const list = getLocalNotifications();
  list.unshift({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    createdAt: new Date().toISOString(),
    isRead: false,
  });
  saveLocalNotifications(list);
  document.dispatchEvent(new CustomEvent('faems:localNotificationAdded'));
}

function getUnreadLocalNotificationCount() {
  return getLocalNotifications().filter((n) => !n.isRead).length;
}

function markLocalNotificationRead(id) {
  const list = getLocalNotifications();
  const entry = list.find((n) => n.id === id);
  if (entry) {
    entry.isRead = true;
    saveLocalNotifications(list);
  }
}

function markAllLocalNotificationsRead() {
  saveLocalNotifications(getLocalNotifications().map((n) => ({ ...n, isRead: true })));
}

function attachPasswordStrengthMeter(inputId, meterId, suggestBtnId) {
  const input = document.getElementById(inputId);
  const meter = document.getElementById(meterId);
  if (!input || !meter) return;
  const fill = meter.querySelector('.password-strength-bar-fill');
  const label = meter.querySelector('.password-strength-label');
  const render = () => {
    const strength = computePasswordStrength(input.value);
    if (!strength) {
      meter.style.display = 'none';
      return;
    }
    meter.style.display = 'flex';
    fill.style.width = `${strength.percent}%`;
    fill.style.background = strength.color;
    label.textContent = strength.label;
    label.style.color = strength.color;
  };
  input.addEventListener('input', render);

  const suggestBtn = suggestBtnId ? document.getElementById(suggestBtnId) : null;
  if (suggestBtn) {
    suggestBtn.addEventListener('click', () => {
      input.value = generateStrongPassword();
      input.type = 'text';
      const toggleBtn = input.parentElement && input.parentElement.querySelector('[aria-label="Show password"], [aria-label="Hide password"]');
      if (toggleBtn) toggleBtn.setAttribute('aria-label', 'Hide password');
      render();
      input.focus();
    });
  }
}

function showToastNotification(message, type = 'info') {
  let container = document.getElementById('faaemsToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'faaemsToastContainer';
    container.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const bg = type === 'success' ? '#059669' : (type === 'error' ? '#dc2626' : '#0241cd');
  toast.style.cssText = `background: ${bg}; color: #ffffff; padding: 10px 18px; border-radius: 12px; font-size: 0.82rem; font-weight: 600; box-shadow: 0 10px 25px rgba(0,0,0,0.18); display: flex; align-items: center; gap: 8px; pointer-events: auto; animation: toastIn 0.3s ease; transition: opacity 0.3s ease;`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// Styled replacements for window.confirm()/alert() — those render as a
// bare "localhost:5173 says…" browser chrome dialog, which looks broken
// once this is deployed on a real domain. Both resolve/return through the
// same #appConfirmModal markup in index.html; showAppAlert is just
// showAppConfirm with the Cancel button hidden and only one way out.
function showAppConfirm(message, options = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('appConfirmModal');
    if (!modal) { resolve(window.confirm(message)); return; }
    const tag = document.getElementById('appConfirmTag');
    const title = document.getElementById('appConfirmTitle');
    const msgEl = document.getElementById('appConfirmMessage');
    const okBtn = document.getElementById('appConfirmOkBtn');
    const cancelBtn = document.getElementById('appConfirmCancelBtn');
    const closeBtn = document.getElementById('appConfirmCloseBtn');

    if (tag) tag.textContent = options.tag || 'Faculty Contribution';
    if (title) title.textContent = options.title || (options.hideCancel ? 'Notice' : 'Please Confirm');
    if (msgEl) msgEl.textContent = message;
    okBtn.textContent = options.okText || 'OK';
    okBtn.style.background = options.danger ? '#dc2626' : '';
    okBtn.style.color = options.danger ? '#ffffff' : '';
    cancelBtn.style.display = options.hideCancel ? 'none' : '';

    function settle(result) {
      modal.classList.remove('open');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    }
    function onOk() { settle(true); }
    function onCancel() { settle(false); }
    function onBackdrop(e) { if (e.target === modal) settle(false); }
    function onKeydown(e) { if (e.key === 'Escape') settle(false); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);
    modal.classList.add('open');
  });
}

function showAppAlert(message, options = {}) {
  return showAppConfirm(message, { ...options, hideCancel: true });
}

// Plain native <input type="date">, constrained with min/max so the
// browser's own calendar picker won't offer out-of-range dates in the
// first place — the exact day-level cutoff (e.g. "at least 18 years old")
// is still enforced server-side regardless, this is just the UI hint.
function initDateInputBounds(inputId, { minYear, maxYear, maxToday = false } = {}) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (minYear) input.min = `${minYear}-01-01`;
  if (maxToday) {
    input.max = new Date().toISOString().split('T')[0];
  } else if (maxYear) {
    input.max = `${maxYear}-12-31`;
  }
}

// Personal task list — local to this browser only (localStorage), separate
// from the real backend-driven notification bell (achievement submissions,
// corrections, etc.). Nothing here is shared with anyone else or synced.
function initCalendarAndTodoList() {
  const monthLabel = document.getElementById('calCurrentMonthYear');
  const prevMonthBtn = document.getElementById('calPrevMonthBtn');
  const nextMonthBtn = document.getElementById('calNextMonthBtn');
  const todayBtn = document.getElementById('calTodayBtn');
  const daysGrid = document.getElementById('calDaysGrid');
  const quickAddBtn = document.getElementById('calQuickAddBtn');
  const addOnDateBtn = document.getElementById('calAddOnDateBtn');
  const selectedDateLabel = document.getElementById('calSelectedDateLabel');
  const selectedTaskCount = document.getElementById('calSelectedTaskCount');
  const todoItemsList = document.getElementById('todoItemsList');
  const todoTotalBadge = document.getElementById('todoTotalBadge');
  const todoFilterTabs = document.querySelectorAll('.todo-filter-tab');
  if (!daysGrid) return;

  // Task Scheduling Modal Elements
  const taskModal = document.getElementById('calendarTaskModal');
  const closeTaskModalBtn = document.getElementById('closeCalTaskModalBtn');
  const cancelTaskModalBtn = document.getElementById('cancelCalTaskBtn');
  const taskForm = document.getElementById('calTaskForm');
  const taskTitleInput = document.getElementById('taskInputTitle');
  const taskDateInput = document.getElementById('taskInputDate');
  const taskTimeInput = document.getElementById('taskInputTime');
  const taskIntervalSelect = document.getElementById('taskInputInterval');
  const taskCategoryInput = document.getElementById('taskInputCategory');
  const taskNotesInput = document.getElementById('taskInputNotes');
  const catPills = document.querySelectorAll('#taskCategoryPills .cat-pill');

  // Circular (Android/Material-style) clock time picker — a plain
  // <input type="time"> and an hour/minute <select> pair both got
  // rejected in favor of an actual clickable clock face, so this builds
  // one out of SVG: 12 numbers positioned around a circle (hour mode
  // shows 1-12, minute mode shows 0/5/10.../55 at the same 12 spots), a
  // hand that rotates to point at whichever is selected, and an AM/PM
  // toggle. The 24-hour "HH:MM" value app.js actually reads/writes lives
  // in the hidden #taskInputTime input, only written on "OK".
  const taskTimeDisplayBtn = document.getElementById('taskTimeDisplayBtn');
  const taskTimeDisplayText = document.getElementById('taskTimeDisplayText');
  const clockPickerBackdrop = document.getElementById('clockPickerBackdrop');
  const clockHourTab = document.getElementById('clockHourTab');
  const clockMinuteTab = document.getElementById('clockMinuteTab');
  const clockAmPmBtns = document.querySelectorAll('.clock-ampm-btn');
  const clockHand = document.getElementById('clockHand');
  const clockNumbersGroup = document.getElementById('clockNumbersGroup');
  const clockPickerCancelBtn = document.getElementById('clockPickerCancelBtn');
  const clockPickerDoneBtn = document.getElementById('clockPickerDoneBtn');

  const CLOCK_CENTER = 110;
  const CLOCK_RADIUS = 82;
  // Clock face state, only committed to #taskInputTime on "OK" — Cancel
  // (or the backdrop) discards it and leaves the previously saved time
  // alone, same as Android's picker.
  const clockState = { hour12: 10, minute: 0, isPM: false, mode: 'hour' };

  function formatDisplayTime() {
    return `${clockState.hour12}:${String(clockState.minute).padStart(2, '0')} ${clockState.isPM ? 'PM' : 'AM'}`;
  }

  function polarPoint(index) {
    // index 0 sits at 12 o'clock (straight up), each step is 30° clockwise.
    const angleDeg = index * 30 - 90;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: CLOCK_CENTER + CLOCK_RADIUS * Math.cos(angleRad),
      y: CLOCK_CENTER + CLOCK_RADIUS * Math.sin(angleRad),
    };
  }

  function renderClockFace() {
    if (!clockNumbersGroup) return;
    const isHourMode = clockState.mode === 'hour';
    // Hour face: 12,1,2,...,11 clockwise from the top. Minute face: the
    // same 12 spots, but labelled every 5 minutes (0,5,10,...,55).
    const values = isHourMode
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
      : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const selected = isHourMode ? clockState.hour12 : clockState.minute;
    const selectedIndex = values.indexOf(selected);

    clockNumbersGroup.innerHTML = values.map((val, i) => {
      const { x, y } = polarPoint(i);
      const isSelected = i === selectedIndex;
      return `
        <circle class="clock-face-number-hit${isSelected ? ' selected' : ''}" cx="${x}" cy="${y}" r="16" data-value="${val}"></circle>
        <text class="clock-face-number-text${isSelected ? ' selected' : ''}" x="${x}" y="${y}">${isHourMode ? val : String(val).padStart(2, '0')}</text>
      `;
    }).join('');

    if (clockHand) {
      const angleDeg = (selectedIndex >= 0 ? selectedIndex : 0) * 30;
      clockHand.setAttribute('transform', `rotate(${angleDeg})`);
    }

    clockNumbersGroup.querySelectorAll('.clock-face-number-hit').forEach((hit) => {
      hit.addEventListener('click', () => {
        const val = parseInt(hit.getAttribute('data-value'), 10);
        if (isHourMode) {
          clockState.hour12 = val;
          clockHourTab.textContent = String(val);
          // Matches Android's picker: picking the hour auto-advances to
          // minute selection instead of requiring an extra tap.
          clockState.mode = 'minute';
          clockHourTab.classList.remove('active');
          clockMinuteTab.classList.add('active');
        } else {
          clockState.minute = val;
          clockMinuteTab.textContent = String(val).padStart(2, '0');
        }
        renderClockFace();
      });
    });
  }

  function openClockPicker() {
    if (!clockPickerBackdrop) return;
    const [h24, m] = (taskTimeInput.value || '10:00').split(':').map((n) => parseInt(n, 10));
    const isPM = h24 >= 12;
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    clockState.hour12 = h12;
    clockState.minute = m || 0;
    clockState.isPM = isPM;
    clockState.mode = 'hour';
    if (clockHourTab) { clockHourTab.textContent = String(h12); clockHourTab.classList.add('active'); }
    if (clockMinuteTab) { clockMinuteTab.textContent = String(m || 0).padStart(2, '0'); clockMinuteTab.classList.remove('active'); }
    clockAmPmBtns.forEach((btn) => btn.classList.toggle('active', btn.getAttribute('data-ampm') === (isPM ? 'PM' : 'AM')));
    renderClockFace();
    clockPickerBackdrop.classList.add('open');
  }

  function closeClockPicker() {
    if (clockPickerBackdrop) clockPickerBackdrop.classList.remove('open');
  }

  if (taskTimeDisplayBtn) taskTimeDisplayBtn.addEventListener('click', openClockPicker);
  if (clockPickerCancelBtn) clockPickerCancelBtn.addEventListener('click', closeClockPicker);
  if (clockPickerBackdrop) {
    clockPickerBackdrop.addEventListener('click', (e) => {
      if (e.target === clockPickerBackdrop) closeClockPicker();
    });
  }

  if (clockHourTab) {
    clockHourTab.addEventListener('click', () => {
      clockState.mode = 'hour';
      clockHourTab.classList.add('active');
      clockMinuteTab.classList.remove('active');
      renderClockFace();
    });
  }
  if (clockMinuteTab) {
    clockMinuteTab.addEventListener('click', () => {
      clockState.mode = 'minute';
      clockMinuteTab.classList.add('active');
      clockHourTab.classList.remove('active');
      renderClockFace();
    });
  }
  clockAmPmBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      clockAmPmBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      clockState.isPM = btn.getAttribute('data-ampm') === 'PM';
    });
  });

  if (clockPickerDoneBtn) {
    clockPickerDoneBtn.addEventListener('click', () => {
      let h24 = clockState.hour12 % 12;
      if (clockState.isPM) h24 += 12;
      const value24hr = `${String(h24).padStart(2, '0')}:${String(clockState.minute).padStart(2, '0')}`;
      if (taskTimeInput) taskTimeInput.value = value24hr;
      if (taskTimeDisplayText) taskTimeDisplayText.textContent = formatDisplayTime();
      closeClockPicker();
    });
  }

  // "HH:MM" (24-hour) -> writes the hidden input and the display button's
  // text, e.g. openTaskModal's "10:30" default. Does not open the picker.
  function setTimePicker12h(value24hr) {
    const [h24, m] = (value24hr || '10:00').split(':').map((n) => parseInt(n, 10));
    const isPM = h24 >= 12;
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    if (taskTimeInput) taskTimeInput.value = value24hr;
    if (taskTimeDisplayText) taskTimeDisplayText.textContent = `${h12}:${String(m || 0).padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
  }

  const now = new Date();
  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = toDateStr(now);

  // Calendar State — defaults to the real current month/day, not a fixed date.
  let calendarYear = now.getFullYear();
  let calendarMonth = now.getMonth();
  let selectedDateStr = todayStr;
  let currentTodoFilter = 'all';

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function addDays(d, n) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }

  // Default seed tasks (shown once, before the visitor adds their own) —
  // dated relative to today so they never look stale.
  let academicTasks = [
    {
      id: 'TASK-1001',
      title: 'Submit Criterion 6.1.2 FDP Attendance Evidence',
      date: toDateStr(addDays(now, 1)),
      time: '11:00',
      interval: '30m_before',
      intervalLabel: '🔔 30m before',
      category: 'NBA SAR Criterion 6',
      notes: 'Ensure all verified certificates are scanned in 300 DPI PDF.',
      completed: false,
      createdAt: now.toISOString()
    },
    {
      id: 'TASK-1002',
      title: 'HOD Department Review & Verification of Research Papers',
      date: toDateStr(addDays(now, 3)),
      time: '14:30',
      interval: '1h_before',
      intervalLabel: '🔔 1h before',
      category: 'HOD Review',
      notes: 'Review Scopus indexed faculty publications with Department DRC committee.',
      completed: false,
      createdAt: now.toISOString()
    },
    {
      id: 'TASK-1003',
      title: 'Upload Ph.D. Faculty Guide Recognition Certificates',
      date: todayStr,
      time: '16:00',
      interval: 'at_time',
      intervalLabel: '🔔 At event time',
      category: 'Faculty Dossier',
      notes: 'University recognized guide letters and candidate registration orders.',
      completed: true,
      createdAt: now.toISOString()
    }
  ];

  const savedTasks = localStorage.getItem('FAAEMS_CALENDAR_TASKS');
  if (savedTasks) {
    try {
      academicTasks = JSON.parse(savedTasks);
    } catch (e) { /* fall back to seed tasks above */ }
  } else {
    localStorage.setItem('FAAEMS_CALENDAR_TASKS', JSON.stringify(academicTasks));
  }

  function saveTasks() {
    localStorage.setItem('FAAEMS_CALENDAR_TASKS', JSON.stringify(academicTasks));
    renderCalendarGrid();
    renderTodoList();
    updateSelectedDateSummary();
  }

  function getTasksForDate(dateStr) {
    return academicTasks.filter(t => t.date === dateStr);
  }

  function formatReadableDate(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function updateSelectedDateSummary() {
    if (selectedDateLabel) {
      selectedDateLabel.textContent = `Selected: ${formatReadableDate(selectedDateStr)}`;
    }
    if (selectedTaskCount) {
      const count = getTasksForDate(selectedDateStr).length;
      selectedTaskCount.textContent = count === 1 ? '1 task scheduled on this date' : `${count} tasks scheduled on this date`;
    }
  }

  function renderCalendarGrid() {
    if (!daysGrid || !monthLabel) return;

    monthLabel.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

    const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const prevDaysInMonth = new Date(calendarYear, calendarMonth, 0).getDate();

    daysGrid.innerHTML = '';

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevDaysInMonth - i;
      const prevMonth = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const prevYear = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-num">${dayNum}</span>`;
      cell.addEventListener('click', () => {
        calendarMonth = prevMonth;
        calendarYear = prevYear;
        selectDate(dateStr, true);
      });
      daysGrid.appendChild(cell);
    }

    // 2. Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayTasks = getTasksForDate(dateStr);

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell';
      if (dateStr === todayStr) cell.classList.add('cal-today');
      if (dateStr === selectedDateStr) cell.classList.add('cal-selected');

      let dotsHtml = '';
      if (dayTasks.length > 0) {
        dotsHtml = '<div class="cal-task-dots-wrap">';
        dayTasks.slice(0, 3).forEach(task => {
          let dotClass = '';
          if (task.category.includes('HOD')) dotClass = 'cat-hod';
          else if (task.category.includes('Research')) dotClass = 'cat-research';
          dotsHtml += `<span class="cal-task-dot ${dotClass}" title="${escapeHtml(task.title)}"></span>`;
        });
        dotsHtml += '</div>';
      }

      cell.innerHTML = `
        <span class="cal-day-num">${day}</span>
        ${dotsHtml}
      `;

      cell.addEventListener('click', () => {
        selectDate(dateStr, true);
      });

      daysGrid.appendChild(cell);
    }

    // 3. Next month leading days
    const totalRendered = firstDayIndex + daysInMonth;
    const remainingCells = (totalRendered % 7 === 0) ? 0 : 7 - (totalRendered % 7);
    for (let day = 1; day <= remainingCells; day++) {
      const nextMonth = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const nextYear = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      const cell = document.createElement('div');
      cell.className = 'cal-day-cell other-month';
      cell.innerHTML = `<span class="cal-day-num">${day}</span>`;
      cell.addEventListener('click', () => {
        calendarMonth = nextMonth;
        calendarYear = nextYear;
        selectDate(dateStr, true);
      });
      daysGrid.appendChild(cell);
    }
  }

  function selectDate(dateStr, openModalOnClick = false) {
    selectedDateStr = dateStr;
    renderCalendarGrid();
    updateSelectedDateSummary();

    if (openModalOnClick) {
      openTaskModal(dateStr);
    }
  }

  function renderTodoList() {
    if (!todoItemsList) return;

    let filtered = [...academicTasks];
    if (currentTodoFilter === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (currentTodoFilter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    }

    if (todoTotalBadge) {
      const pendingCount = academicTasks.filter(t => !t.completed).length;
      todoTotalBadge.textContent = `${pendingCount} Pending`;
    }

    if (filtered.length === 0) {
      todoItemsList.innerHTML = `
        <div class="todo-empty-state">
          <svg class="todo-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <p class="todo-empty-text">No ${currentTodoFilter} tasks. Click any date above to add a note!</p>
        </div>
      `;
      return;
    }

    todoItemsList.innerHTML = filtered.map(task => `
      <div class="todo-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <div class="todo-checkbox" title="${task.completed ? 'Mark pending' : 'Mark completed & strike out'}"></div>
        <div class="todo-item-content">
          <div class="todo-title">${escapeHtml(task.title)}</div>
          <div class="todo-meta-row">
            <span class="todo-badge todo-badge-time">📅 ${task.date} at ${task.time}</span>
            <span class="todo-badge todo-badge-interval">${escapeHtml(task.intervalLabel || '🔔 Alert on time')}</span>
            <span class="todo-badge todo-badge-cat">🏷️ ${escapeHtml(task.category)}</span>
          </div>
        </div>
        <button type="button" class="todo-delete-btn" data-delete-id="${task.id}" title="Delete task">✕</button>
      </div>
    `).join('');

    // Clicking anywhere on item or checkbox strikes it out / toggles completion
    todoItemsList.querySelectorAll('.todo-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.todo-delete-btn')) return;
        const id = item.getAttribute('data-id');
        toggleTaskCompletion(id);
      });
    });

    // Delete task buttons
    todoItemsList.querySelectorAll('.todo-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-delete-id');
        deleteTask(id);
      });
    });
  }

  function toggleTaskCompletion(id) {
    const task = academicTasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      showToastNotification(task.completed ? 'Task completed and struck out' : 'Task marked pending', 'success');
    }
  }

  function deleteTask(id) {
    academicTasks = academicTasks.filter(t => t.id !== id);
    saveTasks();
    showToastNotification('Task deleted', 'info');
  }

  function openTaskModal(prefillDate = '') {
    if (!taskModal) return;
    if (taskDateInput) taskDateInput.value = prefillDate || selectedDateStr;
    if (taskTitleInput) taskTitleInput.value = '';
    setTimePicker12h('10:30');
    if (taskNotesInput) taskNotesInput.value = '';
    // .modal-backdrop is display:flex/opacity:0/pointer-events:none by
    // default and only becomes visible+clickable via the .open class (see
    // styles.css) — every other modal in the app toggles .open for exactly
    // this reason. Setting style.display here directly used to leave
    // opacity/pointer-events untouched, so the modal was technically
    // "open" but invisible and unclickable — clicking "Add Task" looked
    // like it silently did nothing.
    taskModal.classList.add('open');
    if (taskTitleInput) setTimeout(() => taskTitleInput.focus(), 100);
  }

  function closeTaskModal() {
    if (taskModal) taskModal.classList.remove('open');
  }

  // Month navigation
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      if (calendarMonth === 0) {
        calendarMonth = 11;
        calendarYear--;
      } else {
        calendarMonth--;
      }
      renderCalendarGrid();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      if (calendarMonth === 11) {
        calendarMonth = 0;
        calendarYear++;
      } else {
        calendarMonth++;
      }
      renderCalendarGrid();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      calendarYear = now.getFullYear();
      calendarMonth = now.getMonth();
      selectDate(todayStr, false);
    });
  }

  if (quickAddBtn) quickAddBtn.addEventListener('click', () => openTaskModal(selectedDateStr));
  if (addOnDateBtn) addOnDateBtn.addEventListener('click', () => openTaskModal(selectedDateStr));
  if (closeTaskModalBtn) closeTaskModalBtn.addEventListener('click', closeTaskModal);
  if (cancelTaskModalBtn) cancelTaskModalBtn.addEventListener('click', closeTaskModal);

  if (taskModal) {
    taskModal.addEventListener('click', (e) => {
      if (e.target === taskModal) closeTaskModal();
    });
  }

  catPills.forEach(pill => {
    pill.addEventListener('click', () => {
      catPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (taskCategoryInput) taskCategoryInput.value = pill.getAttribute('data-cat');
    });
  });

  todoFilterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      todoFilterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTodoFilter = tab.getAttribute('data-todo-filter');
      renderTodoList();
    });
  });

  if (taskForm) {
    taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = taskTitleInput.value.trim();
      const dateVal = taskDateInput.value;
      const timeVal = taskTimeInput.value || '10:00';
      const intervalVal = taskIntervalSelect.value;
      const intervalText = taskIntervalSelect.options[taskIntervalSelect.selectedIndex].text;
      const categoryVal = taskCategoryInput.value || 'NBA SAR Criterion 6';
      const notesVal = taskNotesInput.value.trim();

      if (!title || !dateVal) return;

      const newTask = {
        id: 'TASK-' + Date.now(),
        title: title,
        date: dateVal,
        time: timeVal,
        interval: intervalVal,
        intervalLabel: intervalText.split('(')[0].trim(),
        category: categoryVal,
        notes: notesVal,
        completed: false,
        createdAt: new Date().toISOString()
      };

      academicTasks.unshift(newTask);
      saveTasks();
      closeTaskModal();
      showToastNotification('Task saved & reminder set!', 'success');
    });
  }

  renderCalendarGrid();
  updateSelectedDateSummary();
  renderTodoList();

  // Local reminders — the task form offers rich "🔔 30 minutes before" /
  // "🔁 Every 15 minutes" alert options, which is a real promise to the
  // person filling it in even though the form's own fine-print says this
  // list "does not send a real notification to anyone else" (true — it's
  // not routed through the backend notification bell, which is per-user
  // server data this purely-local list was never part of). Never actually
  // firing anything at the chosen time made that promise false; this
  // makes it true via a toast (always) plus a real OS notification when
  // the browser permission allows it.
  const RECURRING_MINUTES = { recurring_15m: 15, recurring_30m: 30, recurring_1h: 60, recurring_daily: 1440 };
  const LEAD_MINUTES = { at_time: 0, '15m_before': 15, '30m_before': 30, '1h_before': 60, '2h_before': 120, '1d_before': 1440 };

  function parseTaskDateTime(task) {
    const [y, mo, d] = task.date.split('-').map(Number);
    const [hh, mm] = (task.time || '00:00').split(':').map(Number);
    return new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
  }

  function fireTaskReminder(task) {
    const title = task.title;
    // Whatever the person actually typed as notes when scheduling this is
    // more useful in the notification than a generic restatement of the
    // date/time they can already see on the task itself.
    const message = task.notes && task.notes.trim()
      ? task.notes.trim()
      : `${task.category || 'Task'} — ${formatReadableDate(task.date)} at ${task.time}`;
    addLocalNotification(title, message);
    try {
      if (window.Notification && Notification.permission === 'granted') {
        new Notification(title, { body: message });
      } else if (window.Notification && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {
      // Notification API unsupported or blocked by the browser — the
      // bell-icon notification above already covers it, this is a bonus.
    }
  }

  function checkDueTaskReminders() {
    const now = new Date();
    let changed = false;
    academicTasks.forEach(task => {
      if (task.completed) return;
      const eventTime = parseTaskDateTime(task);
      const recurMinutes = RECURRING_MINUTES[task.interval];
      if (recurMinutes) {
        if (now < eventTime) return;
        const lastFired = task.lastReminded ? new Date(task.lastReminded) : null;
        if (!lastFired || (now - lastFired) >= recurMinutes * 60000) {
          fireTaskReminder(task);
          task.lastReminded = now.toISOString();
          changed = true;
        }
      } else {
        const leadMinutes = LEAD_MINUTES[task.interval] ?? 0;
        const alertTime = new Date(eventTime.getTime() - leadMinutes * 60000);
        if (now >= alertTime && !task.reminded) {
          fireTaskReminder(task);
          task.reminded = true;
          changed = true;
        }
      }
    });
    if (changed) localStorage.setItem('FAAEMS_CALENDAR_TASKS', JSON.stringify(academicTasks));
  }

  if (window.Notification && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  checkDueTaskReminders();
  setInterval(checkDueTaskReminders, 30000);
}

/* ==========================================================================
   5. Academic Department Switcher
   ========================================================================== */
/* ==========================================================================
   6. HOD Cards Directory (11 College Department HODs & Live Gauge Sync & Search)
   ========================================================================== */
// Real, dynamic ranking by verified-achievement count — no placeholder
// data. Fetched fresh on every page load (see buildRealSubmissionConfig's
// caller in the bootstrap); ranking naturally shifts day to day as more
// submissions get verified.
// Pins the leaderboard column's height to match the calendar column's
// actual rendered height, so neither ever shows a blank gap under a
// shorter card while the other keeps going — CSS Grid stretch alone
// doesn't reliably do this across an auto-height row (see the CSS comment
// on .lb-scroll-wrapper), so it's measured directly instead.
function syncLeaderboardHeight() {
  const leaderboardWrapper = document.getElementById('leaderboardWrapper');
  const calendarContainer = document.getElementById('calendarTodoContainer');
  if (!leaderboardWrapper || !calendarContainer) return;
  // Below the tablet/mobile breakpoint (.capabilities-row-layout collapses
  // to a single column at max-width: 1024px — see styles.css) the two
  // columns stack vertically instead of sitting side by side — forcing a
  // fixed height there would just clip content, so only pin it above that
  // width, matching the same breakpoint the CSS uses.
  if (window.innerWidth <= 1024) {
    leaderboardWrapper.style.height = '';
    return;
  }
  const targetHeight = calendarContainer.getBoundingClientRect().height;
  if (targetHeight > 0) {
    leaderboardWrapper.style.height = `${targetHeight}px`;
  }
}

let _leaderboardHeightResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_leaderboardHeightResizeTimer);
  _leaderboardHeightResizeTimer = setTimeout(syncLeaderboardHeight, 150);
});

function initLeaderboard() {
  const rowsContainer = document.getElementById('leaderboardRowsContainer');
  const loadingState = document.getElementById('leaderboardLoadingState');
  const filterBar = document.getElementById('leaderboardFilterBar');
  const searchInput = document.getElementById('leaderboardSearchInput');
  const clearBtn = document.getElementById('leaderboardClearSearchBtn');
  const noResultsBox = document.getElementById('leaderboardNoResults');
  const searchTermSpan = document.getElementById('leaderboardSearchTerm');
  const resetBtn = document.getElementById('leaderboardResetSearchBtn');
  if (!rowsContainer || !window.FaemsAPI) return;

  let entries = [];
  let currentFilter = 'all';

  function rankBadgeClass(rank) {
    if (rank === 1) return ' lb-rank-1';
    if (rank === 2) return ' lb-rank-2';
    if (rank === 3) return ' lb-rank-3';
    return '';
  }

  function renderRows() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (clearBtn) clearBtn.style.display = query ? 'flex' : 'none';

    const filtered = entries.filter((entry, idx) => {
      entry._rank = idx + 1;
      const matchesDept = currentFilter === 'all' || entry.department_code === currentFilter;
      const matchesSearch = !query ||
        entry.full_name.toLowerCase().includes(query) ||
        entry.department_name.toLowerCase().includes(query) ||
        entry.designation.toLowerCase().includes(query);
      return matchesDept && matchesSearch;
    });

    if (filtered.length === 0) {
      rowsContainer.style.display = 'none';
      if (noResultsBox) {
        noResultsBox.style.display = 'block';
        if (searchTermSpan) searchTermSpan.textContent = query || 'selected department';
      }
      return;
    }
    rowsContainer.style.display = 'flex';
    if (noResultsBox) noResultsBox.style.display = 'none';

    rowsContainer.innerHTML = filtered.map(entry => {
      const pct = entry.submitted_count > 0 ? Math.round((entry.verified_count / entry.submitted_count) * 100) : 0;
      return `
        <div class="lb-row">
          <div class="lb-row-top">
            <div class="lb-rank-badge${rankBadgeClass(entry._rank)}">#${entry._rank}</div>
            <div class="lb-row-info">
              <div class="lb-row-name">${escapeHtml(entry.full_name)}</div>
              <div class="lb-row-sub">${escapeHtml(entry.designation)} · ${escapeHtml(entry.department_name)}</div>
            </div>
            <div class="lb-row-metric"><span class="lb-metric-num">${entry.verified_count}</span> verified</div>
          </div>
          <div class="lb-row-bottom">
            <div class="lb-progress-track"><div class="lb-progress-fill" style="width:${pct}%;"></div></div>
            <span class="lb-progress-frac">${entry.verified_count}/${entry.submitted_count} (${pct}%)</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function buildDepartmentFilters() {
    if (!filterBar) return;
    const seen = new Map();
    entries.forEach(e => { if (!seen.has(e.department_code)) seen.set(e.department_code, e.department_name); });
    const pills = ['<button type="button" class="hod-filter-btn active" data-lb-filter="all">All Departments</button>'];
    seen.forEach((name, code) => {
      pills.push(`<button type="button" class="hod-filter-btn" data-lb-filter="${code}">${escapeHtml(name)}</button>`);
    });
    filterBar.innerHTML = pills.join('');
    filterBar.querySelectorAll('.hod-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filterBar.querySelectorAll('.hod-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-lb-filter') || 'all';
        renderRows();
      });
    });
  }

  if (searchInput) searchInput.addEventListener('input', renderRows);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) { searchInput.value = ''; searchInput.focus(); }
      renderRows();
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      currentFilter = 'all';
      if (filterBar) {
        filterBar.querySelectorAll('.hod-filter-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-lb-filter') === 'all'));
      }
      renderRows();
    });
  }

  function loadLeaderboard() {
    window.FaemsAPI.getLeaderboard().then(res => {
      entries = res.results || res;
      if (loadingState) loadingState.remove();
      buildDepartmentFilters();
      renderRows();
      syncLeaderboardHeight();
    }).catch(() => {
      if (loadingState) loadingState.textContent = "Couldn't load the leaderboard — please refresh.";
    });
  }

  loadLeaderboard();
  // The initial attempt above runs before login-gate unlock resolves for a
  // brand-new visitor (no saved session yet), so it 401s silently behind
  // the still-hidden page — refresh once real auth actually completes.
  document.addEventListener('faems:authenticated', loadLeaderboard);
  // Submitting/verifying/deleting an achievement from the dossier changes
  // the verified/submitted counts this ranking is built from.
  document.addEventListener('faems:achievementsChanged', loadLeaderboard);
  document.addEventListener('faems:facultyStatusChanged', loadLeaderboard);
  // A faculty member editing their own name/designation/department in
  // "Update Details" should reflect here immediately too, not just after a
  // reload or a fresh login elsewhere.
  document.addEventListener('faems:facultyProfileUpdated', loadLeaderboard);
  // Every event above only fires in the SAME tab that made the change —
  // someone verifying/deleting a submission in one tab has no way to tell
  // a different tab (e.g. an HOD open elsewhere) anything happened. This
  // is the same gap the stale-tab banner covers for deployed code changes,
  // just for live data instead — a plain poll is simpler than wiring up
  // real-time push for what's still a small user base.
  setInterval(loadLeaderboard, 30000);
}

/* ==========================================================================
   7. Instant Faculty Search & Carousel Controller — real AI & ML roster,
   fetched live so a new self-registration or a profile edit shows up here
   without ever touching this file again.
   ========================================================================== */
function designationLabel(raw) {
  const labels = {
    lecturer: 'Lecturer',
    assistant_professor: 'Assistant Professor',
    associate_professor: 'Associate Professor',
    professor: 'Professor',
    hod: 'HOD',
    deputy_hod: 'Deputy HOD',
  };
  return labels[raw] || (raw || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Institutional email — every "local part + domain picker" field across
// the app (login, register, forgot-password, Add Faculty) only ever holds
// the local part in its own text input; the domain comes from a picker
// beside it (the institution issues real accounts on more than one
// domain, matching the backend's ALLOWED_EMAIL_DOMAINS). Top-level (not
// nested in any one init*() function) since every one of those forms
// lives in its own separate function and needs this same pair.
function emailDomainSuffix(domainSelectEl) {
  return '@' + (domainSelectEl ? domainSelectEl.value : 'tcetmumbai.in');
}
// Browser autofill (or a saved credential from before the domain picker
// existed) can drop a *full* email — local part and domain together —
// into a field that's only ever supposed to hold the local part. The
// "strip @ as you type" listeners on each form don't catch that, since
// autofill doesn't reliably fire a normal input event — so this is used
// again right before composing the submitted email, as a last line of
// defense against silently submitting "name@domain@domain".
function localPartOnly(value) {
  return (value || '').split('@')[0].trim();
}

// "YYYY-MM-DD" for *today* in the browser's own local timezone — matches
// what a native <input type="date"> reads/writes, so a straight string
// comparison against it (e.g. "is this date today or in the future?")
// works without parsing either side back into a Date object. Top-level
// for the same reason as emailDomainSuffix/localPartOnly above: more than
// one init*() function needs it (the calendar/to-do list, and the Delete
// Account modal), each in its own separate scope.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function facultyInitials(name) {
  const stripped = name.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '');
  return stripped.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'FC';
}

function buildFacultyCardHTML(fp, index) {
  const name = escapeHtml(fp.full_name);
  const designation = escapeHtml(designationLabel(fp.designation));
  const summary = escapeHtml(fp.bio && fp.bio.trim() ? fp.bio.trim() : `${designationLabel(fp.designation)}, Department of ${fp.department_name || 'Artificial Intelligence & Machine Learning'}.`);
  return `
    <div class="carousel-card${index === 0 ? ' active-card' : ''}" data-index="${index}" data-faculty-id="${fp.id}" data-department-code="${escapeHtml(fp.department_code || '')}">
      <div class="card-glow-border"></div>
      <div class="card-inner">
        <div class="card-icon-badge">
          <span class="faculty-avatar-initials">${facultyInitials(fp.full_name)}</span>
        </div>
        <h3 class="card-title">${name}</h3>
        <span class="card-designation">${designation}</span>
        <div class="card-meta-chips">
          <span class="meta-chip">Emp ID: ${escapeHtml(fp.employee_id || '—')}</span>
          <span class="meta-chip chip-verified">Verified ✓</span>
        </div>
        <p class="card-summary">${summary}</p>
        <button class="card-read-more" data-faculty-id="${fp.id}">
          <span>View Dossier &amp; Evidence</span>
          <span class="read-more-arrow">→</span>
        </button>
      </div>
    </div>
  `;
}

// HOD-only "Non-active" roster card — deliberately reuses the same class
// names/data attributes as buildFacultyCardHTML's active card
// (.carousel-card, .card-title, .card-designation, .card-summary,
// .meta-chip, .card-read-more[data-faculty-id]) so the existing
// document-level delegated click handler and getFacultyData()'s DOM
// scrape (both in initFacultyDossierModal) work on it completely
// unchanged — opening a non-active faculty's dossier is the same click
// handler as an active one, just reading a differently-styled card.
function buildNonActiveFacultyCardHTML(fp, departmentCode) {
  const name = escapeHtml(fp.full_name);
  const designation = escapeHtml(designationLabel(fp.designation));
  const period = `${fp.join_date || 'Unknown'} – ${fp.exit_date || 'Unknown'}`;
  return `
    <div class="carousel-card non-active-faculty-card" data-faculty-id="${fp.id}" data-department-code="${escapeHtml(departmentCode || '')}">
      <h3 class="card-title naf-name">${name}</h3>
      <span class="card-designation" style="display:none;">${designation}</span>
      <div class="naf-meta">${designation}<br>Emp ID: ${escapeHtml(fp.employee_id || '—')}<br>Active: ${escapeHtml(period)}</div>
      <span class="naf-badge">Non-active</span>
      <p class="card-summary" style="display:none;"></p>
      <button class="card-read-more" data-faculty-id="${fp.id}" style="margin-top:0.75rem;">
        <span>View Dossier &amp; Evidence</span>
        <span class="read-more-arrow">→</span>
      </button>
      <button class="naf-delete-data-btn" data-purge-faculty-id="${fp.id}" data-purge-faculty-name="${name}" type="button">Delete Data</button>
    </div>
  `;
}

function initFacultySearchAndCarousel() {
  const searchInput = document.getElementById('facultySearchInput');
  const clearBtn = document.getElementById('clearSearchBtn');
  const counter = document.getElementById('searchResultsCounter');
  const track = document.getElementById('carouselTrack');
  const prevBtn = document.getElementById('carouselPrev');
  const nextBtn = document.getElementById('carouselNext');
  const dotsWrap = document.getElementById('carouselDots');
  const api = window.FaemsAPI;
  if (!track || !api) return;

  let cards = [];
  let dots = [];
  let currentIndex = 0;

  function filterFaculties() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    let visibleCount = 0;

    cards.forEach(card => {
      const matches = card.textContent.toLowerCase().includes(query);
      card.style.display = matches ? 'block' : 'none';
      if (matches) visibleCount++;
    });

    if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

    if (counter) {
      counter.textContent = query
        ? `Showing ${visibleCount} of ${cards.length} faculties matching "${query}"`
        : `Displaying all ${cards.length} verified faculty profiles`;
    }

    currentIndex = 0;
    updateCarousel();
  }

  if (searchInput) searchInput.addEventListener('input', filterFaculties);
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      filterFaculties();
      searchInput.focus();
    });
  }

  function getVisibleCards() {
    // Measured from the actual rendered card/viewport size rather than
    // hardcoded width breakpoints — a mismatch between an assumed card
    // count and the real CSS card width was letting maxIndex overshoot
    // how many "next" clicks it actually takes to reach the last card(s),
    // leaving them reachable only via search, never via the arrows/dots.
    const viewport = track.parentElement;
    const viewportWidth = viewport ? viewport.offsetWidth : window.innerWidth;
    const firstCard = cards[0];
    if (!firstCard) return 1;
    const cardWidth = firstCard.offsetWidth || 260;
    const gap = 28;
    const fit = Math.floor((viewportWidth + gap) / (cardWidth + gap));
    return Math.max(1, fit);
  }

  function updateCarousel() {
    if (!cards.length) return;
    const visibleCards = getVisibleCards();
    const visibleCardElements = cards.filter(c => c.style.display !== 'none');
    const totalVisible = visibleCardElements.length;
    const maxIndex = Math.max(0, totalVisible - visibleCards);

    if (currentIndex > maxIndex) currentIndex = maxIndex;

    const cardWidth = cards[0].offsetWidth || 260;
    const gap = 28;
    const moveAmount = currentIndex * (cardWidth + gap);

    track.style.transform = `translateX(-${moveAmount}px)`;

    dots.forEach((dot, idx) => dot.classList.toggle('active', idx === currentIndex));
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const visibleCards = getVisibleCards();
      const maxIndex = Math.max(0, cards.filter(c => c.style.display !== 'none').length - visibleCards);
      currentIndex = currentIndex < maxIndex ? currentIndex + 1 : 0;
      updateCarousel();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const visibleCards = getVisibleCards();
      const maxIndex = Math.max(0, cards.filter(c => c.style.display !== 'none').length - visibleCards);
      currentIndex = currentIndex > 0 ? currentIndex - 1 : maxIndex;
      updateCarousel();
    });
  }

  function wireDots() {
    dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.c-dot')) : [];
    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        currentIndex = idx;
        updateCarousel();
      });
    });
  }

  window.addEventListener('resize', updateCarousel);

  function loadFacultyDirectory() {
    api.getFacultyDirectory().then(res => {
      const entries = res.results || res;
      track.innerHTML = entries.length
        ? entries.map((fp, i) => buildFacultyCardHTML(fp, i)).join('')
        : '<p class="carousel-loading-text">No faculty have registered yet.</p>';

      if (dotsWrap) {
        const pageCount = Math.max(1, Math.ceil(entries.length / getVisibleCards()));
        dotsWrap.innerHTML = Array.from({ length: pageCount }, (_, i) =>
          `<button class="c-dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="Page ${i + 1}"></button>`
        ).join('');
      }

      cards = Array.from(track.querySelectorAll('.carousel-card'));
      wireDots();
      if (counter) counter.textContent = `Displaying all ${cards.length} verified faculty profiles`;
      const heroCountEl = document.getElementById('heroFacultyCountStat');
      if (heroCountEl) heroCountEl.textContent = String(entries.length);
      currentIndex = 0;
      updateCarousel();
      document.dispatchEvent(new CustomEvent('faems:facultyDirectoryLoaded'));
    }).catch(() => {
      track.innerHTML = '<p class="carousel-loading-text">Couldn\'t load the faculty directory — please refresh.</p>';
    });
  }

  loadFacultyDirectory();
  // Same reasoning as the leaderboard: a brand-new visitor's first attempt
  // runs before the login gate unlocks, so it 401s behind the still-hidden
  // page — refresh once real auth actually completes.
  document.addEventListener('faems:authenticated', loadFacultyDirectory);
  // Marking someone as exited (from their own dossier) both endpoints
  // already filter to active faculty only, so the directory needs a
  // refetch too, not just the leaderboard.
  document.addEventListener('faems:facultyStatusChanged', loadFacultyDirectory);
  // Re-render the directory cards (name, designation, department badge)
  // right after any self-edit via "Update Details" — getFacultyData() in
  // the dossier below scrapes these cards' own DOM, so this refetch is
  // also what keeps a freshly reopened dossier from showing stale text.
  document.addEventListener('faems:facultyProfileUpdated', loadFacultyDirectory);

  // HOD-only Active/Non-active roster toggle. Plain faculty and IQAC/
  // Super Admin never see this at all — Non-active is specifically the
  // HOD's own-department "who's left" view (name/employee ID/time period
  // + every achievement they ever submitted, never deleted), not a
  // general admin archive.
  const rosterToggleWrap = document.getElementById('rosterToggleWrap');
  const rosterToggleActiveBtn = document.getElementById('rosterToggleActiveBtn');
  const rosterToggleNonActiveBtn = document.getElementById('rosterToggleNonActiveBtn');
  const nonActiveGrid = document.getElementById('nonActiveFacultyGrid');
  const carouselComponent = document.getElementById('carouselComponent');
  const facultySearchWrapper = document.querySelector('.faculty-search-wrapper');
  const generateNbaReportBtn = document.getElementById('generateNbaReportBtn');
  const nbaReportModal = document.getElementById('nbaReportModal');
  const closeNbaReportModal = document.getElementById('closeNbaReportModal');
  const nbaReportForm = document.getElementById('nbaReportForm');
  const nbaReportMonthSelect = document.getElementById('nbaReportMonth');
  const nbaReportYearSelect = document.getElementById('nbaReportYear');
  const nbaReportError = document.getElementById('nbaReportError');
  const nbaReportSubmitBtn = document.getElementById('nbaReportSubmitBtn');
  const nbaReportResult = document.getElementById('nbaReportResult');
  const nbaReportResultLabel = document.getElementById('nbaReportResultLabel');
  const nbaReportViewBtn = document.getElementById('nbaReportViewBtn');
  const nbaReportDownloadBtn = document.getElementById('nbaReportDownloadBtn');
  const nbaReportBackBtn = document.getElementById('nbaReportBackBtn');
  const nbaReportPreviewWrap = document.getElementById('nbaReportPreviewWrap');
  const nbaReportPreviewFrame = document.getElementById('nbaReportPreviewFrame');
  const nbaReportPreviewBackBtn = document.getElementById('nbaReportPreviewBackBtn');
  // Holds the most recently generated report's blob URL + filename so View
  // and Download (and a later click of either) can both reuse it instead
  // of re-fetching — revoked whenever a new report replaces it or the
  // modal is reset, so a tab's worth of these don't leak.
  let nbaReportBlobState = null;

  function resetNbaReportModal() {
    if (nbaReportBlobState) {
      URL.revokeObjectURL(nbaReportBlobState.url);
      nbaReportBlobState = null;
    }
    if (nbaReportForm) nbaReportForm.style.display = '';
    if (nbaReportResult) nbaReportResult.style.display = 'none';
    if (nbaReportPreviewWrap) nbaReportPreviewWrap.style.display = 'none';
    if (nbaReportPreviewFrame) nbaReportPreviewFrame.src = 'about:blank';
  }

  function updateRosterToggleVisibility() {
    const user = window.FAEMS_CURRENT_USER;
    if (rosterToggleWrap) rosterToggleWrap.style.display = user && user.role === 'hod' ? '' : 'none';
    if (generateNbaReportBtn) generateNbaReportBtn.style.display = user && user.role === 'hod' ? '' : 'none';
  }
  updateRosterToggleVisibility();
  document.addEventListener('faems:authenticated', updateRosterToggleVisibility);

  if (generateNbaReportBtn) {
    generateNbaReportBtn.addEventListener('click', async () => {
      if (nbaReportError) hideError(nbaReportError);
      resetNbaReportModal();
      const today = new Date();
      if (nbaReportMonthSelect) nbaReportMonthSelect.value = String(today.getMonth() + 1);
      if (nbaReportYearSelect) {
        nbaReportYearSelect.innerHTML = '<option value="" selected disabled>Loading…</option>';
      }
      if (nbaReportModal) nbaReportModal.classList.add('open');
      try {
        const res = await api.getNbaReportYears();
        const years = res.years || [];
        if (nbaReportYearSelect) {
          nbaReportYearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
          nbaReportYearSelect.value = String(today.getFullYear());
        }
      } catch {
        if (nbaReportYearSelect) {
          nbaReportYearSelect.innerHTML = `<option value="${today.getFullYear()}">${today.getFullYear()}</option>`;
        }
      }
    });
  }
  if (closeNbaReportModal) {
    closeNbaReportModal.addEventListener('click', () => {
      nbaReportModal.classList.remove('open');
      resetNbaReportModal();
    });
  }
  if (nbaReportModal) {
    nbaReportModal.addEventListener('click', (e) => {
      if (e.target === nbaReportModal) {
        nbaReportModal.classList.remove('open');
        resetNbaReportModal();
      }
    });
  }
  if (nbaReportForm) {
    nbaReportForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (nbaReportError) hideError(nbaReportError);
      nbaReportSubmitBtn.disabled = true;
      try {
        const { blob, filename } = await api.downloadNbaReport(
          Number(nbaReportMonthSelect.value), Number(nbaReportYearSelect.value)
        );
        if (nbaReportBlobState) URL.revokeObjectURL(nbaReportBlobState.url);
        nbaReportBlobState = { url: URL.createObjectURL(blob), filename };
        if (nbaReportResultLabel) {
          const monthText = nbaReportMonthSelect.options[nbaReportMonthSelect.selectedIndex].text;
          nbaReportResultLabel.textContent = `${monthText} ${nbaReportYearSelect.value}`;
        }
        nbaReportForm.style.display = 'none';
        if (nbaReportResult) nbaReportResult.style.display = '';
      } catch (err) {
        if (nbaReportError) showError(nbaReportError, friendlyErrorMessage(err, 'Could not generate the report. Please try again.'));
      } finally {
        nbaReportSubmitBtn.disabled = false;
      }
    });
  }
  if (nbaReportViewBtn) {
    nbaReportViewBtn.addEventListener('click', () => {
      if (!nbaReportBlobState) return;
      if (nbaReportPreviewFrame) nbaReportPreviewFrame.src = nbaReportBlobState.url;
      if (nbaReportResult) nbaReportResult.style.display = 'none';
      if (nbaReportPreviewWrap) nbaReportPreviewWrap.style.display = '';
    });
  }
  if (nbaReportPreviewBackBtn) {
    nbaReportPreviewBackBtn.addEventListener('click', () => {
      if (nbaReportPreviewWrap) nbaReportPreviewWrap.style.display = 'none';
      if (nbaReportPreviewFrame) nbaReportPreviewFrame.src = 'about:blank';
      if (nbaReportResult) nbaReportResult.style.display = '';
    });
  }
  if (nbaReportDownloadBtn) {
    nbaReportDownloadBtn.addEventListener('click', () => {
      if (!nbaReportBlobState) return;
      const link = document.createElement('a');
      link.href = nbaReportBlobState.url;
      link.download = nbaReportBlobState.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  }
  if (nbaReportBackBtn) {
    nbaReportBackBtn.addEventListener('click', () => resetNbaReportModal());
  }

  function loadNonActiveRoster() {
    if (!nonActiveGrid) return;
    nonActiveGrid.innerHTML = '<p class="carousel-loading-text">Loading…</p>';
    const departmentCode = (window.FAEMS_CURRENT_USER && window.FAEMS_CURRENT_USER.department && window.FAEMS_CURRENT_USER.department.code) || '';
    api.listFaculty({ view: 'non_active', page_size: 200 }).then(res => {
      const entries = res.results || res;
      nonActiveGrid.innerHTML = entries.length
        ? entries.map(fp => buildNonActiveFacultyCardHTML(fp, departmentCode)).join('')
        : '<p class="carousel-loading-text">No non-active faculty on record.</p>';
    }).catch(() => {
      nonActiveGrid.innerHTML = '<p class="carousel-loading-text">Couldn\'t load the non-active roster — please try again.</p>';
    });
  }

  // Delegated (grid content is rebuilt on every loadNonActiveRoster()
  // call) — the "Delete Data" button on a Non-active card permanently
  // removes that account AND every achievement/evidence record, even
  // with real history (unlike every other delete path in this app). No
  // undo, so this needs its own explicit, named confirmation rather than
  // the generic showAppConfirm wording used elsewhere.
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-purge-faculty-id]');
    if (!btn) return;
    const facId = btn.getAttribute('data-purge-faculty-id');
    const facName = btn.getAttribute('data-purge-faculty-name') || 'this faculty member';
    const confirmed = await showAppConfirm(
      `Permanently delete ALL data for ${facName}? This removes their account and every achievement/evidence record they ever submitted — unlike a normal deletion, none of it is kept for institutional record. This cannot be undone.`,
      { danger: true, okText: 'Delete Everything', title: 'Permanently Delete Data' }
    );
    if (!confirmed) return;
    btn.disabled = true;
    try {
      await api.purgeFaculty(facId);
      loadNonActiveRoster();
    } catch (err) {
      await showAppAlert(friendlyErrorMessage(err, 'Could not delete this record. Please try again.'));
      btn.disabled = false;
    }
  });

  function setRosterView(view) {
    const showNonActive = view === 'non_active';
    if (rosterToggleActiveBtn) rosterToggleActiveBtn.classList.toggle('active', !showNonActive);
    if (rosterToggleNonActiveBtn) rosterToggleNonActiveBtn.classList.toggle('active', showNonActive);
    if (carouselComponent) carouselComponent.style.display = showNonActive ? 'none' : '';
    if (facultySearchWrapper) facultySearchWrapper.style.display = showNonActive ? 'none' : '';
    if (nonActiveGrid) nonActiveGrid.style.display = showNonActive ? '' : 'none';
    if (showNonActive) loadNonActiveRoster();
  }

  if (rosterToggleActiveBtn) rosterToggleActiveBtn.addEventListener('click', () => setRosterView('active'));
  if (rosterToggleNonActiveBtn) rosterToggleNonActiveBtn.addEventListener('click', () => setRosterView('non_active'));
}

/* ==========================================================================
   8. Faculty Detailed Accreditation Dossier Modal (Playbook Appendix A)
   ========================================================================== */
/* ==========================================================================
   8. Faculty Detailed Accreditation Dossier Modal (Playbook Appendix A & PDF)
   ========================================================================== */
function initFacultyDossierModal() {
  const modal = document.getElementById('facultyDossierModal');
  const closeBtn = document.getElementById('closeFacultyModal');
  const headerContainer = document.getElementById('dossierHeader');
  const bodyContainer = document.getElementById('dossierBody');

  // Faculty dossier detail is generated on demand from each card's real,
  // published profile info (see getFacultyData below) instead of being
  // hand-authored here. These are real named people; specific achievement
  // claims (patent numbers, membership IDs, grant names) shouldn't be
  // invented and attached to a real person's name without real records.
  const facultyDossiers = {};

  // Builds a dossier from the faculty card's own real, published profile
  // info — real qualification/experience text and real employee ID, both
  // already shown on the card — rather than inventing achievement records
  // that haven't actually been submitted and verified yet.
  function getFacultyData(id) {
    if (facultyDossiers[id]) return facultyDossiers[id];

    const cardEl = document.querySelector(`.carousel-card[data-faculty-id="${id}"]`);
    const name = cardEl ? cardEl.querySelector('.card-title').textContent.trim() : `Faculty Member #${id}`;
    const role = cardEl ? cardEl.querySelector('.card-designation').textContent.trim() : 'Assistant Professor';
    const qualificationSummary = cardEl ? cardEl.querySelector('.card-summary').textContent.trim() : '';
    const empIdChip = cardEl ? cardEl.querySelector('.meta-chip') : null;
    const empId = empIdChip ? empIdChip.textContent.replace('Emp ID: ', '').trim() : `AIML-EMP-${id}`;
    const initials = name.replace(/^(Dr|Mr|Mrs|Ms)\.?\s+/i, '').split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('');
    const departmentCode = cardEl ? cardEl.getAttribute('data-department-code') : '';

    facultyDossiers[id] = {
      name: name,
      initials: initials || 'FC',
      role: role,
      dept: 'Artificial Intelligence & Machine Learning',
      deptKey: 'AI & ML',
      departmentCode: departmentCode,
      empId: empId,
      joinDate: 'On record with HR',
      status: 'Active (Faculty Role)',
      email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@tcetmumbai.in`,
      summary: qualificationSummary || `${role}, Department of Artificial Intelligence & Machine Learning.`,
    };
    return facultyDossiers[id];
  }

  // A self-edit via "Update Details" invalidates this cached dossier (it
  // was built from the directory card's DOM, which faems:facultyProfileUpdated
  // also refreshes elsewhere) — drop it so the next open re-scrapes fresh
  // data, and re-render immediately if that faculty's dossier is open right now.
  document.addEventListener('faems:facultyProfileUpdated', (e) => {
    const id = e.detail && e.detail.facultyProfileId;
    if (id == null) return;
    delete facultyDossiers[id];
    if (modal.classList.contains('open') && modal.getAttribute('data-active-fac-id') === String(id)) {
      renderDossier(id);
    }
  });

  // facId -> that faculty's real achievements (each with nested evidence
  // documents), fetched from the same Achievement records the submission
  // wizard and HOD review queue already use. Cleared after any action that
  // changes it (submit/delete/verify/add evidence) or on a fresh dossier
  // open, so a stale in-memory copy never hides a just-submitted record.
  const achievementsCache = {};
  let dossierRenderToken = 0;

  function achievementStatusLabel(status) {
    const labels = {
      draft: 'Draft',
      submitted: 'Submitted — Pending Review',
      hod_review: 'Pending HOD Review',
      corrections_required: 'Corrections Required',
      resubmitted: 'Resubmitted',
      verified: 'Verified ✓',
      iqac_locked: 'IQAC Locked ✓',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  }

  async function fetchFacultyAchievements(facId) {
    if (achievementsCache[facId]) return achievementsCache[facId];
    try {
      const res = await window.FaemsAPI.listAchievements(facId);
      const list = res.results || res;
      achievementsCache[facId] = list;
      return list;
    } catch {
      return [];
    }
  }

  // Evidence files are streamed through an authenticated backend proxy
  // (never a raw MinIO URL — see EvidenceDocumentViewSet.download), so
  // opening one needs the bearer token attached the way a plain <a href>
  // navigation never would. The tab is opened synchronously, before the
  // first await, and redirected once the blob is ready — opening it only
  // after the fetch/blob work (i.e. after an await) is what popup blockers
  // treat as no longer a direct user gesture, and silently block it.
  async function openEvidenceFile(url, filename, download) {
    const newTab = download ? null : window.open('', '_blank');
    try {
      const tokens = window.FaemsAPI.getTokens();
      const res = await fetch(url, { headers: { Authorization: `Bearer ${tokens.access}` } });
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename || 'evidence';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else if (newTab) {
        // Navigating the tab straight to the blob: URL (newTab.location.href
        // = blobUrl) works, but the tab then has no <title> of its own, so
        // the browser falls back to showing the raw blob UUID in the tab —
        // looks exactly like something went wrong even though the preview
        // itself is fine. Wrapping it in a real HTML document with a
        // <title> fixes that; <embed> is what actually gets the browser's
        // native PDF viewer to render inline (a bare <img>/<iframe> src
        // wouldn't for a PDF blob).
        const safeTitle = escapeHtml(filename || 'Evidence');
        let bodyHtml;
        if (blob.type === 'application/pdf') {
          bodyHtml = `<embed src="${blobUrl}" type="application/pdf">`;
        } else if (blob.type === 'text/csv') {
          bodyHtml = `<pre>${escapeHtml(await blob.text())}</pre>`;
        } else {
          bodyHtml = `<img src="${blobUrl}" alt="${safeTitle}">`;
        }
        newTab.document.write(
          `<!DOCTYPE html><html><head><title>${safeTitle}</title>` +
          `<style>html,body{margin:0;height:100%;background:#525659;}` +
          `embed{width:100%;height:100%;border:none;}` +
          `img{display:block;max-width:100%;max-height:100%;margin:auto;}` +
          `pre{background:#fff;color:#1a1a1a;margin:0;padding:1.25rem;min-height:100%;` +
          `box-sizing:border-box;font-family:ui-monospace,Consolas,monospace;font-size:13px;` +
          `white-space:pre-wrap;word-break:break-word;}</style>` +
          `</head><body>${bodyHtml}</body></html>`
        );
        newTab.document.close();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
    } catch {
      if (newTab) newTab.close();
      await showAppAlert("Couldn't open this file — please try again.");
    }
  }

  // Everything now lives on the one Profile & Metrics view: the (editable,
  // own-profile) description, a plain-language submitted-so-far summary,
  // and one row per achievement with a ⋮ menu for add-attachment / delete /
  // download — replacing the earlier separate Criterion 6.1 / 6.2 /
  // Evidence Vault tabs.
  function renderAchievementsSection(achievements, isOwnProfile, isReviewer, isFacultyNonActive) {
    const total = achievements.length;
    const summaryLine = total
      ? `<strong>${total}</strong> achievement${total === 1 ? '' : 's'} submitted so far.`
      : '';

    // Every distinct year range this faculty has actually submitted under —
    // including one just created via "+ Add Year" in the wizard — so a new
    // year shows up here (own dossier and the HOD's review of them) with no
    // extra wiring: it's driven entirely by what's really in the data.
    const years = Array.from(new Set(achievements.map(a => a.cycle_label).filter(Boolean)))
      .sort().reverse();
    const yearFilterHtml = years.length > 1 ? `
      <select class="form-input dossier-year-filter" data-action="filter-year" aria-label="Filter by year">
        <option value="">All Years</option>
        ${years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('')}
      </select>` : '';

    // criterion_path only ever carries descriptions (never codes — see
    // AchievementSerializer.get_criterion_path), so the "6.1"/"6.2" prefix
    // faculty actually recognize comes from matching that description
    // against the same live criteria config the submission wizard already
    // loaded (window.FAAEMS_SUBMISSION_CONFIG), not the API response.
    const topCriteria = (window.FAAEMS_SUBMISSION_CONFIG && window.FAAEMS_SUBMISSION_CONFIG.criteria) || [];
    const codeByTitle = {};
    topCriteria.forEach(c => { codeByTitle[c.title] = c.id; });

    function criterionHeading(title) {
      const code = codeByTitle[title];
      return code ? `${code} — ${title}` : title;
    }

    // Every distinct top-level criterion actually present, so the filter
    // (mirrors the year filter below) only ever offers real choices.
    const criteriaPresent = Array.from(new Set(achievements.map(a => (a.criterion_path && a.criterion_path[0]) || 'Unclassified')));
    const criterionFilterHtml = criteriaPresent.length > 1 ? `
      <select class="form-input dossier-criterion-filter" data-action="filter-criterion" aria-label="Filter by criterion">
        <option value="">All Criteria</option>
        ${criteriaPresent.map(title => `<option value="${escapeHtml(title)}">${escapeHtml(criterionHeading(title))}</option>`).join('')}
      </select>` : '';

    function renderRow(a) {
      const docs = a.documents || [];
      const isLocked = a.status === 'iqac_locked';
      const canAddEvidence = isOwnProfile && !isLocked;
      // A faculty member can add/remove their own attachment(s), or delete
      // the whole submission, at any point — including after HOD has
      // verified it — right up until IQAC locks it in as the institutional
      // record. A reviewer (this faculty's own HOD, or IQAC/Super Admin)
      // gets that same power, but only once this faculty member has gone
      // non-active and can no longer log in to clean up their own dossier
      // — matches can_manage_non_active_faculty_record server-side.
      const canManageAsNonActive = isReviewer && isFacultyNonActive;
      const canDeleteAttachment = (isOwnProfile || canManageAsNonActive) && !isLocked;
      const canDeleteAchievement = (isOwnProfile || canManageAsNonActive) && !isLocked;
      const canVerify = isReviewer && ['submitted', 'resubmitted'].includes(a.status);

      const menuItems = [];
      if (canAddEvidence) menuItems.push(`<label class="dossier-menu-item" style="cursor:pointer;">Add Attachment<input type="file" data-action="add-evidence" data-achievement-id="${a.id}" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv" style="display:none;"></label>`);
      if (canDeleteAchievement) menuItems.push(`<button type="button" class="dossier-menu-item dossier-menu-item-danger" data-action="delete-achievement" data-achievement-id="${a.id}">Delete Submission</button>`);

      // Each attachment gets its own download/delete — not just the
      // latest one — so with two or more files on the same submission,
      // any single one of them can be removed without touching the rest.
      const attachmentsHtml = docs.length ? `
        <div class="dossier-attachment-list">
          ${docs.map((doc, idx) => {
            const displayName = doc.filename || `Attachment ${idx + 1}`;
            return `
            <div class="dossier-attachment-chip">
              <span class="dossier-attachment-name" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</span>
              <div class="dossier-attachment-actions">
                <button type="button" class="dossier-attachment-icon-btn dossier-attachment-icon-btn-view" data-action="view-evidence" data-url="${escapeHtml(doc.download_url)}" data-filename="${escapeHtml(displayName)}" data-content-type="${escapeHtml(doc.content_type || '')}" data-preview-url="${escapeHtml(doc.preview_url || '')}" data-preview-status="${escapeHtml(doc.preview_status || '')}" title="View" aria-label="View ${escapeHtml(displayName)}">&#128065;</button>
                <button type="button" class="dossier-attachment-icon-btn" data-action="download-evidence" data-url="${escapeHtml(doc.download_url)}" data-filename="${escapeHtml(displayName)}" title="Download" aria-label="Download ${escapeHtml(displayName)}">⬇</button>
                ${canDeleteAttachment ? `<button type="button" class="dossier-attachment-icon-btn dossier-attachment-icon-btn-danger" data-action="delete-evidence" data-evidence-id="${doc.id}" title="Delete" aria-label="Delete ${escapeHtml(displayName)}">✕</button>` : ''}
              </div>
            </div>
          `;
          }).join('')}
        </div>
      ` : '';

      return `
        <div class="dossier-achievement-row" data-cycle-label="${escapeHtml(a.cycle_label || '')}" data-criterion-title="${escapeHtml((a.criterion_path && a.criterion_path[0]) || 'Unclassified')}">
          <div class="dossier-achievement-info">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
              <strong>${escapeHtml(a.title)}</strong>
              <div class="dossier-row-actions">
                ${canVerify ? `<button type="button" class="btn btn-primary dossier-action-btn" data-action="verify-achievement" data-achievement-id="${a.id}">Verify</button>` : ''}
                ${menuItems.length ? `
                <div class="dossier-menu-wrap">
                  <button type="button" class="dossier-menu-trigger" data-action="toggle-menu" aria-label="More actions">⋮</button>
                  <div class="dossier-menu-dropdown">${menuItems.join('')}</div>
                </div>` : ''}
              </div>
            </div>
            <div class="dossier-achievement-meta">
              ${a.cycle_label ? `<span class="meta-chip-year">${escapeHtml(a.cycle_label)}</span> &bull; ` : ''}
              <span class="status-badge-verified">${achievementStatusLabel(a.status)}</span>
              ${!docs.length && !['draft', 'verified', 'iqac_locked'].includes(a.status)
                ? ` &bull; <span class="status-badge-no-evidence">No evidence attached</span>`
                : ''}
            </div>
            ${attachmentsHtml}
          </div>
        </div>
      `;
    }

    // Group by top-level criterion (6.1 / 6.2 / …) — the earlier flat list
    // with a one-line "X under Y" summary was harder to scan than seeing
    // each criterion's own submissions listed under it directly.
    const groups = new Map();
    achievements.forEach(a => {
      const title = (a.criterion_path && a.criterion_path[0]) || 'Unclassified';
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title).push(a);
    });

    const groupsHtml = Array.from(groups.entries()).map(([title, items]) => `
        <div class="dossier-criterion-group" data-criterion-title="${escapeHtml(title)}">
          <h5 class="dossier-criterion-heading">${escapeHtml(criterionHeading(title))}</h5>
          <div class="dossier-achievements-list">${items.map(renderRow).join('')}</div>
        </div>
      `).join('') || '<p style="text-align:center;color:var(--text-muted);padding:1rem 0;">No achievements submitted yet.</p>';

    return `
      <div class="dossier-section-block">
        <div class="dossier-section-header-row">
          <h4 class="dossier-section-title" style="margin-bottom:0;">Profile Metrics</h4>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${criterionFilterHtml}${yearFilterHtml}</div>
        </div>
        ${summaryLine ? `<p style="font-size:0.88rem;color:var(--text-secondary);margin-bottom:0.75rem;">${summaryLine}</p>` : ''}
        ${groupsHtml}
      </div>
    `;
  }

  async function renderDossier(facId) {
    const data = getFacultyData(facId);

    // Own-profile: full read/write access (add attachments, delete a draft,
    // download). Reviewer (the faculty's own HOD, or IQAC/Super Admin):
    // read + verify on someone else's record — same RBAC the review
    // workflow already enforces server-side; this just decides what the
    // dossier UI offers.
    const currentUser = window.FAEMS_CURRENT_USER;
    // Compare real faculty_profile_id, not display names — a name-string
    // match is one stale re-render or formatting difference away from
    // silently hiding a faculty member's own Add/Update/Delete/Download
    // controls on their own dossier.
    const isOwnProfile = !!(currentUser && currentUser.faculty_profile_id != null && String(currentUser.faculty_profile_id) === String(facId));
    const REVIEWER_ROLES = new Set(['iqac_admin', 'super_admin']);
    const isReviewer = !isOwnProfile && !!currentUser && (
      REVIEWER_ROLES.has(currentUser.role) ||
      (currentUser.role === 'hod' && currentUser.department && data.departmentCode && currentUser.department.code === data.departmentCode)
    );
    const canSeeAchievements = isOwnProfile || isReviewer;

    // Real status from the server, not the DOM-scraped getFacultyData()
    // (whose `status` field is a hardcoded placeholder) — only matters for
    // a reviewer, so skip the extra request on a faculty member's own
    // dossier. Drives the HOD's "clean up a departed faculty member's
    // dossier" override below; falls back to "not non-active" on error,
    // same fail-closed direction the backend's own check takes.
    let isFacultyNonActive = false;
    if (isReviewer) {
      try {
        const profile = await window.FaemsAPI.getFacultyProfile(facId);
        isFacultyNonActive = !isProfileCurrentlyActive(profile);
      } catch { /* best-effort — stays false */ }
    }

    // Header Profile. The Active badge is clickable only for a reviewer
    // (this faculty's own HOD, or IQAC/Super Admin) — self-service exit is
    // the separate "Delete Account" menu item, not this.
    headerContainer.innerHTML = `
      <div class="dossier-header-profile">
        <div class="dossier-avatar-large">${data.initials}</div>
        <div style="flex: 1;">
          <h3 class="dossier-name">${escapeHtml(data.name)}</h3>
          <span class="dossier-role-title">${escapeHtml(data.role)} &bull; ${escapeHtml(data.dept)}</span>
          <div class="dossier-badges-row">
            <span class="meta-chip">${escapeHtml(data.empId)}</span>
            ${isReviewer
              ? `<button type="button" class="meta-chip chip-verified" style="cursor:pointer;border:none;" data-action="open-deactivate" data-faculty-id="${facId}">${escapeHtml(data.status)} &#9662;</button>`
              : `<span class="meta-chip chip-verified">${escapeHtml(data.status)}</span>`}
            <span class="meta-chip">Joined: ${escapeHtml(data.joinDate)}</span>
            ${isReviewer ? '<span class="meta-chip">Reviewing as ' + (currentUser.role === 'hod' ? 'HOD' : 'IQAC') + '</span>' : ''}
          </div>
          ${isReviewer ? `
          <div class="dossier-deactivate-panel" style="display:none;margin-top:0.75rem;background:var(--bg-surface-alt);border:1px solid var(--border-light);border-radius:10px;padding:0.85rem;">
            <p style="font-size:0.82rem;color:var(--text-primary);font-weight:600;margin-bottom:0.5rem;">Mark ${escapeHtml(data.name)} as no longer with the department?</p>
            <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.6rem;">They'll be removed from the leaderboard and faculty directory, and their login will be disabled.</p>
            <label style="font-size:0.78rem;color:var(--text-secondary);display:block;margin-bottom:0.3rem;">Last working date</label>
            <input type="date" class="form-input dossier-exit-date-input" style="margin-bottom:0.6rem;max-width:220px;">
            <div style="display:flex;gap:0.5rem;">
              <button type="button" class="btn btn-primary dossier-action-btn" style="background:#dc2626;color:#ffffff;" data-action="confirm-deactivate" data-faculty-id="${facId}">Confirm Exit</button>
              <button type="button" class="btn btn-ghost dossier-action-btn" data-action="cancel-deactivate">Cancel</button>
            </div>
          </div>` : ''}
        </div>
      </div>
    `;

    bodyContainer.innerHTML = `
      <div class="dossier-section-block">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <h4 class="dossier-section-title" style="margin-bottom:0;">Description</h4>
          ${isOwnProfile ? `<button type="button" class="btn btn-ghost dossier-action-btn" data-action="edit-bio">Edit</button>` : ''}
        </div>
        <p class="dossier-bio-display" style="font-size:0.9rem;line-height:1.6;color:var(--text-secondary);margin-top:0.6rem;">${escapeHtml(data.summary)}</p>
        ${isOwnProfile ? `
        <div class="dossier-bio-edit-wrap" style="display:none;margin-top:0.6rem;">
          <textarea class="form-input dossier-bio-textarea" rows="3" style="width:100%;resize:vertical;font-family:inherit;">${escapeHtml(data.summary)}</textarea>
          <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
            <button type="button" class="btn btn-primary dossier-action-btn" data-action="save-bio">Save</button>
            <button type="button" class="btn btn-ghost dossier-action-btn" data-action="cancel-bio-edit">Cancel</button>
          </div>
        </div>` : ''}
      </div>
      ${canSeeAchievements
        ? `<div class="dossier-section-block" id="dossierMetricsBlock"><p style="text-align:center;color:var(--text-muted);padding:1rem 0;">Loading…</p></div>`
        : `<div class="dossier-section-block"><p style="font-size:0.82rem;color:var(--text-muted);">Achievement details are only visible on this faculty member's own profile.</p></div>`}
    `;

    if (canSeeAchievements) {
      const token = ++dossierRenderToken;
      const achievements = await fetchFacultyAchievements(facId);
      if (token !== dossierRenderToken) return;
      const block = document.getElementById('dossierMetricsBlock');
      if (block) block.outerHTML = renderAchievementsSection(achievements, isOwnProfile, isReviewer, isFacultyNonActive);
    }
  }

  // Card click triggers — delegated on the document since faculty cards
  // (and their "View Dossier" buttons) are now built asynchronously from
  // the real roster after this listener is attached, not present at
  // page load like the old static cards were.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-read-more');
    if (!btn) return;
    const facId = btn.getAttribute('data-faculty-id') || '1';
    modal.setAttribute('data-active-fac-id', facId);
    // Always refetch on open — an achievement submitted via the wizard
    // (or anywhere else outside this modal's own action buttons) since the
    // last time this dossier was open wouldn't otherwise be reflected here.
    delete achievementsCache[facId];
    renderDossier(facId);
    modal.classList.add('open');
  });

  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));

  // Close any open ⋮ menu when clicking outside it.
  document.addEventListener('click', (e) => {
    if (e.target.closest('.dossier-menu-wrap')) return;
    modal.querySelectorAll('.dossier-menu-dropdown.open').forEach(d => d.classList.remove('open'));
  });

  // Dossier action buttons (menu toggle / add-attachment / delete / verify
  // / download / edit description) — delegated on the modal since the
  // achievements list is rebuilt on every render.
  modal.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const facId = modal.getAttribute('data-active-fac-id');

    if (action === 'toggle-menu') {
      const dropdown = btn.closest('.dossier-menu-wrap').querySelector('.dossier-menu-dropdown');
      const wasOpen = dropdown.classList.contains('open');
      modal.querySelectorAll('.dossier-menu-dropdown.open').forEach(d => d.classList.remove('open'));
      if (!wasOpen) dropdown.classList.add('open');
      return;
    }

    if (action === 'view-evidence' || action === 'download-evidence') {
      const contentType = btn.getAttribute('data-content-type') || '';
      const isBrowserViewable = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv'].includes(contentType);
      if (action === 'view-evidence' && !isBrowserViewable) {
        // No browser has a built-in renderer for Word/PowerPoint/Excel —
        // that's what previewUrl is for: a PDF LibreOffice converted this
        // to in the background on upload (see
        // _run_preview_conversion_in_background), shown the exact same
        // way a native PDF is. previewStatus lets this tell "still
        // converting, try again shortly" apart from "no preview possible
        // for this file at all" instead of treating both the same.
        const previewUrl = btn.getAttribute('data-preview-url');
        const previewStatus = btn.getAttribute('data-preview-status');
        if (previewUrl) {
          // The preview endpoint's response is served with
          // Content-Type: application/pdf, so the fetched blob's own
          // .type already reads as a PDF to openEvidenceFile — no need
          // to tell it that separately.
          openEvidenceFile(previewUrl, btn.getAttribute('data-filename').replace(/\.[^.]+$/, '.pdf'), false);
          return;
        }
        if (previewStatus === 'pending') {
          showAppAlert('A preview is still being generated for this file — try again in a few seconds.');
          return;
        }
        showAppAlert("This file type can't be previewed in the browser — downloading it instead.");
        openEvidenceFile(btn.getAttribute('data-url'), btn.getAttribute('data-filename'), true);
        return;
      }
      openEvidenceFile(btn.getAttribute('data-url'), btn.getAttribute('data-filename'), action === 'download-evidence');
      return;
    }

    if (action === 'open-deactivate' || action === 'cancel-deactivate') {
      const panel = headerContainer.querySelector('.dossier-deactivate-panel');
      if (panel) panel.style.display = action === 'open-deactivate' ? '' : 'none';
      return;
    }

    if (action === 'confirm-deactivate') {
      const panel = btn.closest('.dossier-deactivate-panel');
      const dateInput = panel.querySelector('.dossier-exit-date-input');
      const exitDate = dateInput.value;
      if (!exitDate) {
        await showAppAlert('Please enter their last working date.');
        return;
      }
      const targetFacId = btn.getAttribute('data-faculty-id');
      btn.disabled = true;
      try {
        await window.FaemsAPI.deactivateFaculty(targetFacId, exitDate);
        document.dispatchEvent(new CustomEvent('faems:facultyStatusChanged'));
        showToastNotification('Marked as exited — removed from the leaderboard and directory.', 'success');
        modal.classList.remove('open');
      } catch (err) {
        await showAppAlert((err && err.message) || 'Could not update their status. Please try again.');
        btn.disabled = false;
      }
      return;
    }

    if (action === 'edit-bio' || action === 'cancel-bio-edit') {
      const section = btn.closest('.dossier-section-block');
      const editWrap = section.querySelector('.dossier-bio-edit-wrap');
      const display = section.querySelector('.dossier-bio-display');
      const showingEdit = action === 'edit-bio';
      if (editWrap) editWrap.style.display = showingEdit ? '' : 'none';
      if (display) display.style.display = showingEdit ? 'none' : '';
      return;
    }

    if (action === 'save-bio') {
      const section = btn.closest('.dossier-section-block');
      const textarea = section.querySelector('.dossier-bio-textarea');
      const currentUser = window.FAEMS_CURRENT_USER;
      if (!textarea || !currentUser || !currentUser.faculty_profile_id) return;
      const newBio = textarea.value.trim();
      btn.disabled = true;
      try {
        await window.FaemsAPI.updateMyProfile(currentUser.faculty_profile_id, { bio: newBio });
        // getFacultyData scrapes the directory card's own DOM (see its
        // definition above) rather than re-fetching the profile, so the
        // card itself needs updating too, not just the cached dossier data.
        const cardSummaryEl = document.querySelector(`.carousel-card[data-faculty-id="${facId}"] .card-summary`);
        if (cardSummaryEl) cardSummaryEl.textContent = newBio;
        delete facultyDossiers[facId];
        await renderDossier(facId);
        showToastNotification('Description updated.', 'success');
      } catch (err) {
        await showAppAlert((err && err.message) || 'Could not save your description. Please try again.');
        btn.disabled = false;
      }
      return;
    }

    const confirmations = {
      'delete-evidence': 'Delete this attachment? This cannot be undone.',
      'delete-achievement': 'Delete this entire submission, including any attached evidence? This cannot be undone.',
    };
    if (confirmations[action]) {
      const ok = await showAppConfirm(confirmations[action], { danger: true, okText: 'Delete' });
      if (!ok) return;
    }

    const calls = {
      'delete-evidence': () => window.FaemsAPI.deleteEvidence(btn.getAttribute('data-evidence-id')),
      'delete-achievement': () => window.FaemsAPI.deleteAchievement(btn.getAttribute('data-achievement-id')),
      'verify-achievement': () => window.FaemsAPI.approveAchievement(btn.getAttribute('data-achievement-id')),
    };
    const call = calls[action];
    if (!call) return;

    btn.disabled = true;
    try {
      await call();
      delete achievementsCache[facId];
      await renderDossier(facId);
      // The leaderboard's counts (and the faculty directory) are only ever
      // refetched on their own page load — without this, verifying/
      // submitting/deleting here wouldn't show up there until a full
      // reload.
      document.dispatchEvent(new CustomEvent('faems:achievementsChanged'));
      if (action === 'verify-achievement') showToastNotification('Achievement verified — the faculty member has been notified.', 'success');
      if (action === 'delete-evidence') showToastNotification('Attachment deleted.', 'success');
      if (action === 'delete-achievement') showToastNotification('Submission deleted.', 'success');
    } catch (err) {
      await showAppAlert((err && err.message) || 'That action could not be completed. Please try again.');
      btn.disabled = false;
    }
  });

  // Year filter above the achievements list — purely a client-side show/
  // hide over rows already fetched, so it works the instant a new year's
  // achievement exists, with no extra request. Year and criterion filters
  // combine (both have to match), and a criterion group whose every row
  // got filtered out is hidden too, rather than leaving its heading
  // floating above an empty list.
  function applyDossierFilters() {
    const yearSelect = modal.querySelector('[data-action="filter-year"]');
    const criterionSelect = modal.querySelector('[data-action="filter-criterion"]');
    const chosenYear = yearSelect ? yearSelect.value : '';
    const chosenCriterion = criterionSelect ? criterionSelect.value : '';
    modal.querySelectorAll('.dossier-criterion-group').forEach(group => {
      const groupMatches = !chosenCriterion || group.getAttribute('data-criterion-title') === chosenCriterion;
      let anyVisible = false;
      group.querySelectorAll('.dossier-achievement-row').forEach(row => {
        const rowVisible = groupMatches && (!chosenYear || row.getAttribute('data-cycle-label') === chosenYear);
        row.style.display = rowVisible ? '' : 'none';
        if (rowVisible) anyVisible = true;
      });
      group.style.display = anyVisible ? '' : 'none';
    });
  }
  modal.addEventListener('change', (e) => {
    if (!e.target.closest('[data-action="filter-year"], [data-action="filter-criterion"]')) return;
    applyDossierFilters();
  });

  // Adding an attachment is a file input, not a click.
  modal.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-action="add-evidence"]');
    if (!input || !input.files || !input.files[0]) return;
    const achievementId = input.getAttribute('data-achievement-id');
    const facId = modal.getAttribute('data-active-fac-id');
    try {
      await window.FaemsAPI.uploadEvidence(achievementId, input.files[0]);
      delete achievementsCache[facId];
      await renderDossier(facId);
      document.dispatchEvent(new CustomEvent('faems:achievementsChanged'));
      showToastNotification('Attachment added.', 'success');
    } catch (err) {
      await showAppAlert((err && err.message) || 'Could not upload this file. Please try again.');
    }
  });
}

/* ==========================================================================
   9. Real-Time Grounded AI Accreditation Assistant
   ========================================================================== */
function initChatAssistant() {
  const floatingBtn = document.getElementById('floatingChatBtn');
  const drawer = document.getElementById('chatDrawer');
  const closeBtn = document.getElementById('closeChatDrawerBtn');
  const clearBtn = document.getElementById('clearChatBtn');
  const inputForm = document.getElementById('chatInputForm');
  const input = document.getElementById('chatInput');
  const sendBtn = inputForm ? inputForm.querySelector('.chat-send-btn') : null;
  const messagesContainer = document.getElementById('chatMessages');
  const quickPromptsBox = document.getElementById('chatQuickPrompts');

  if (!floatingBtn || !drawer) return;

  let isStreaming = false;
  let streamTimer = null;

  floatingBtn.addEventListener('click', () => {
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open') && input) input.focus();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => drawer.classList.remove('open'));
  }

  // Clear chat conversation
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (streamTimer) clearTimeout(streamTimer);
      isStreaming = false;
      if (input) {
        input.disabled = false;
        input.value = '';
      }
      if (sendBtn) sendBtn.disabled = false;

      messagesContainer.innerHTML = `
        <div class="chat-msg bot-msg">
          <div class="msg-bubble">
            Conversation reset. Greetings! I am the <strong>Faculty Contribution Accreditation AI</strong>. Ask me what Criterion 6.1 or 6.2 covers, what a specific sub-point means, or how to submit an achievement.
            <div class="ai-actions-wrap">
              <button type="button" class="ai-action-chip" data-query="How do I submit an achievement?">📋 How to Submit</button>
              <button type="button" class="ai-action-chip" data-query="What is Criterion 6.1?">📚 Criterion 6.1</button>
              <button type="button" class="ai-action-chip" data-query="What is Criterion 6.2?">🔬 Criterion 6.2</button>
            </div>
          </div>
          <span class="msg-time">Just now</span>
        </div>
      `;

      updateQuickChips([
        { label: '6.1 Professional Dev', query: 'What is Criterion 6.1?' },
        { label: '6.2 Research & Grants', query: 'What is Criterion 6.2?' },
        { label: 'How to Submit', query: 'How do I submit an achievement?' }
      ]);
    });
  }

  // Listen to Quick Prompts
  if (quickPromptsBox) {
    quickPromptsBox.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (!chip || isStreaming) return;
      const query = chip.getAttribute('data-query');
      if (query) handleUserQuery(query);
    });
  }

  // Listen to interactive action chips inside chat messages
  if (messagesContainer) {
    messagesContainer.addEventListener('click', (e) => {
      const actionChip = e.target.closest('.ai-action-chip');
      if (!actionChip) return;

      const scrollTarget = actionChip.getAttribute('data-scroll');
      const query = actionChip.getAttribute('data-query');
      const dossierKey = actionChip.getAttribute('data-dossier');

      if (scrollTarget) {
        drawer.classList.remove('open');
        setTimeout(() => {
          const el = document.querySelector(scrollTarget);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else if (dossierKey) {
        drawer.classList.remove('open');
        setTimeout(() => {
          if (typeof openFacultyDossierModal === 'function') {
            openFacultyDossierModal(dossierKey);
          }
        }, 150);
      } else if (query && !isStreaming) {
        handleUserQuery(query);
      }
    });
  }

  // Form submission
  if (inputForm) {
    inputForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (isStreaming) return;
      const query = input.value.trim();
      if (!query) return;
      input.value = '';
      handleUserQuery(query);
    });
  }

  function handleUserQuery(text) {
    appendUserMessage(text);
    const aiResponse = generateAccreditationAIResponse(text);
    streamRealTimeAIResponse(aiResponse);
  }

  function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg user-msg';
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;
    const time = document.createElement('span');
    time.className = 'msg-time';
    time.textContent = 'Just now';
    msgDiv.appendChild(bubble);
    msgDiv.appendChild(time);
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function updateQuickChips(chips) {
    if (!quickPromptsBox) return;
    quickPromptsBox.innerHTML = '';
    chips.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quick-chip';
      btn.setAttribute('data-query', c.query);
      btn.textContent = c.label;
      quickPromptsBox.appendChild(btn);
    });
  }

  // Real-Time Token Streaming with Live Cursor
  function streamRealTimeAIResponse(responseObj) {
    isStreaming = true;
    if (input) input.disabled = true;
    if (sendBtn) sendBtn.disabled = true;

    // 1. Thinking / Reasoning Indicator Bubble
    const typingMsg = document.createElement('div');
    typingMsg.className = 'chat-msg bot-msg typing-msg';
    typingMsg.innerHTML = `
      <div class="msg-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-status-text">${responseObj.thinkingStatus || 'Analyzing Faculty Contribution Accreditation DB...'}</span>
      </div>
    `;
    messagesContainer.appendChild(typingMsg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    const thinkingDelay = Math.floor(Math.random() * 250) + 400; // 400 - 650ms realistic cognitive pause

    setTimeout(() => {
      if (typingMsg.parentNode) typingMsg.parentNode.removeChild(typingMsg);

      // 2. Real Bot Message Div
      const botMsgDiv = document.createElement('div');
      botMsgDiv.className = 'chat-msg bot-msg';
      const bubble = document.createElement('div');
      bubble.className = 'msg-bubble';
      botMsgDiv.appendChild(bubble);

      const time = document.createElement('span');
      time.className = 'msg-time';
      time.textContent = 'Just now';
      botMsgDiv.appendChild(time);

      messagesContainer.appendChild(botMsgDiv);

      // Split into HTML tags vs words to ensure tags don't break during typing
      const tokens = responseObj.html.match(/(<[^>]+>|[^<>\s]+|\s+)/g) || [responseObj.html];
      let currentOutput = '';
      let tokenIdx = 0;

      function streamNextToken() {
        if (tokenIdx >= tokens.length) {
          // Finished Streaming!
          bubble.innerHTML = responseObj.html;

          // Append Interactive Action Chips
          if (responseObj.actions && responseObj.actions.length > 0) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ai-actions-wrap';
            responseObj.actions.forEach(act => {
              const b = document.createElement('button');
              b.type = 'button';
              b.className = 'ai-action-chip';
              b.innerHTML = act.label;
              if (act.scroll) b.setAttribute('data-scroll', act.scroll);
              if (act.query) b.setAttribute('data-query', act.query);
              if (act.dossier) b.setAttribute('data-dossier', act.dossier);
              actionsDiv.appendChild(b);
            });
            bubble.appendChild(actionsDiv);
          }

          // Update Quick Prompts
          if (responseObj.followUps && responseObj.followUps.length > 0) {
            updateQuickChips(responseObj.followUps);
          }

          isStreaming = false;
          if (input) {
            input.disabled = false;
            input.focus();
          }
          if (sendBtn) sendBtn.disabled = false;
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
          return;
        }

        const token = tokens[tokenIdx++];
        currentOutput += token;

        // Auto-complete unclosed tags in the same frame
        while (tokenIdx < tokens.length && tokens[tokenIdx].startsWith('<') && !tokens[tokenIdx].startsWith('</')) {
          currentOutput += tokens[tokenIdx++];
        }

        bubble.innerHTML = currentOutput + ' <span class="ai-cursor">▌</span>';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        const delay = token.startsWith('<') ? 0 : Math.floor(Math.random() * 12) + 10;
        streamTimer = setTimeout(streamNextToken, delay);
      }

      streamNextToken();
    }, thinkingDelay);
  }

  // Grounded strictly in this system's own real NBA Criterion 6 tree (see
  // CRITERION_6_KB below, which mirrors the backend's seeded SubCriterion
  // data exactly) — no fabricated department names, HODs or criteria the
  // system doesn't actually have.
  const CRITERION_6_KB = {
    '6.1': {
      title: 'Professional Development Activities',
      children: [
        { code: '6.1.1', title: 'Memberships in Professional Societies at National/International Levels' },
        { code: '6.1.2', title: "Faculty as Resource Persons or Participants in STTPs/FDPs" },
        { code: '6.1.3', title: 'Faculty Contribution in Development of SWAYAM MOOCs and other E-Content' },
        { code: '6.1.4', title: 'Faculty Certification of MOOCs through SWAYAM, etc.' },
        { code: '6.1.5', title: 'FDP/STTP Organized by Department' },
        { code: '6.1.6', title: 'Faculty Support in Student Innovative Projects' },
        { code: '6.1.7', title: 'Faculty Internship/Training/Collaboration with Industry' },
      ],
    },
    '6.2': {
      title: 'Research and Development Activities',
      children: [
        { code: '6.2.1', title: 'Academic Research (number and quality of publications)' },
        { code: '6.2.2', title: 'Ph.D. Student Details (enrolled and graduated during the assessment period)' },
        { code: '6.2.3', title: 'Development Activities (patents granted/published, working prototypes)' },
        { code: '6.2.4', title: 'Sponsored Research Project' },
        { code: '6.2.5', title: 'Consultancy Work' },
        { code: '6.2.6', title: "Institution Seed Money or Internal Research Grant to its Faculty for Research Work" },
      ],
    },
  };

  function findSubPointByCode(code) {
    for (const top of Object.values(CRITERION_6_KB)) {
      const hit = top.children.find(c => c.code === code);
      if (hit) return hit;
    }
    return null;
  }

  function subPointListHtml(topCode) {
    return CRITERION_6_KB[topCode].children
      .map(c => `<li><strong>${c.code}</strong>: ${c.title}</li>`)
      .join('');
  }

  const HOW_TO_SUBMIT_ACTIONS = [{ label: '📋 Open Submission Form', scroll: '#criteria-details' }];
  const CRITERION_FOLLOWUPS = [
    { label: 'Explain Criterion 6.1', query: 'What is Criterion 6.1?' },
    { label: 'Explain Criterion 6.2', query: 'What is Criterion 6.2?' },
    { label: 'How do I submit?', query: 'How do I submit an achievement?' },
  ];

  // Extensive Grounded AI Knowledge Base
  function generateAccreditationAIResponse(query) {
    const q = query.trim().toLowerCase();

    // 1. Greetings / Identity / Capabilities
    if (q.match(/^(hi|hello|hey|greetings|namaste|good morning|good afternoon|good evening)\b/) || q.includes('who are you') || q.includes('what can you do') || q.includes('help')) {
      return {
        thinkingStatus: 'Initializing Faculty Contribution Assistant Engine...',
        html: `Hello! I am the <strong>Faculty Contribution Accreditation AI</strong>.<br><br>
               Here is what I can help with:
               <ul>
                 <li><span class="ai-badge ai-badge-blue">SAR Tier-1</span> <strong>NBA Criterion 6 Guidance</strong>: what Criterion 6.1 and 6.2 cover, and what each sub-point means.</li>
                 <li><span class="ai-badge">Workflow</span> <strong>How to submit</strong> an achievement with supporting evidence.</li>
                 <li><span class="ai-badge">Integrity</span> <strong>Evidence Vault</strong>: how SHA-256 verification and HOD review work.</li>
               </ul>`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 2. A specific sub-point by code (e.g. "6.1.2", "explain 6.2.3")
    const codeMatch = q.match(/6\.[12]\.[1-7]/);
    if (codeMatch) {
      const sp = findSubPointByCode(codeMatch[0]);
      if (sp) {
        const topCode = sp.code.slice(0, 3);
        return {
          thinkingStatus: `Looking up Criterion ${sp.code}...`,
          html: `<strong>Criterion ${sp.code}: ${sp.title}</strong><br><br>
                 This is one of the sub-points under <strong>${topCode} — ${CRITERION_6_KB[topCode].title}</strong>. Faculty submit real achievements against this sub-point through the submission form, attaching supporting documents (PDF, Word, PowerPoint, JPG or PNG) as evidence; your HOD then reviews and verifies it.`,
          actions: HOW_TO_SUBMIT_ACTIONS,
          followUps: CRITERION_FOLLOWUPS,
        };
      }
    }

    // 3. Criterion 6.1 overview
    if (q.includes('6.1') || (q.includes('professional development') && !q.includes('6.2'))) {
      return {
        thinkingStatus: 'Compiling Criterion 6.1 overview...',
        html: `<strong>NBA Criterion 6.1: Professional Development Activities</strong><br><br>
               Covers faculty's continuous skill development, training and academic contribution outside direct research:
               <ul>${subPointListHtml('6.1')}</ul>`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 4. Criterion 6.2 overview
    if (q.includes('6.2') || q.includes('research and development')) {
      return {
        thinkingStatus: 'Compiling Criterion 6.2 overview...',
        html: `<strong>NBA Criterion 6.2: Research and Development Activities</strong><br><br>
               Covers departmental research output, doctoral guidance, IPR and funded/consultancy work:
               <ul>${subPointListHtml('6.2')}</ul>`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 5. Asking about criteria this system doesn't have (6.3, 6.4, 6.5...) —
    // answered honestly rather than inventing content for them.
    if (q.match(/6\.[3-9]/) || q.includes('other criteria') || q.includes('other criterion')) {
      return {
        thinkingStatus: 'Checking the Criterion 6 tree...',
        html: `Right now this system's NBA Criterion 6 tree only covers <strong>6.1 (Professional Development Activities)</strong> and <strong>6.2 (Research and Development Activities)</strong> — there's no 6.3 or beyond configured yet. Ask me about either one, or about a specific sub-point like 6.1.2 or 6.2.4.`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 6. How to Submit Achievement / Evidence Workflow
    if (q.includes('submit') || q.includes('how to submit') || q.includes('evidence form') || q.includes('dropdown') || q.includes('proof')) {
      return {
        thinkingStatus: 'Retrieving submission steps...',
        html: `<strong>How to submit an achievement</strong><br><br>
               <ol>
                 <li>Open the submission form (your <strong>Faculty Name</strong> is filled in automatically from your login).</li>
                 <li>Pick the <strong>Top-Level Criterion</strong> — 6.1 or 6.2.</li>
                 <li>Pick the specific <strong>Sub-Point</strong> that matches your achievement, narrowing further if it has sub-tiers.</li>
                 <li>Pick the <strong>Assessment Year</strong>.</li>
                 <li>Attach your supporting document(s) — PDF, Word, PowerPoint, JPG or PNG, up to 40MB each.</li>
                 <li>Click <strong>Submit for Review</strong>. It's saved as a draft first, so you can also come back later, add more evidence, or submit it from your own dossier.</li>
               </ol>
               Once submitted, your HOD reviews it from your dossier and verifies it — you'll get a notification the moment that happens.`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 7. Evidence Vault & Cryptographic Hashing
    if (q.includes('vault') || q.includes('sha') || q.includes('hash') || q.includes('security') || q.includes('tamper') || q.includes('duplicate')) {
      return {
        thinkingStatus: 'Explaining the Evidence Vault...',
        html: `<strong>Evidence Vault</strong><br><br>
               <ul>
                 <li><strong>SHA-256 hashing</strong>: every uploaded document gets a unique fingerprint, so the same file can't quietly be re-used for two different claims.</li>
                 <li><strong>Verification status</strong>: each document is <em>pending</em> until your HOD verifies the achievement it belongs to.</li>
                 <li><strong>Where to see it</strong>: open your own faculty dossier, under the <strong>Evidence Vault</strong> tab — you can view, download, or (while the achievement is still a draft) delete anything you've attached.</li>
               </ul>`,
        actions: HOW_TO_SUBMIT_ACTIONS,
        followUps: CRITERION_FOLLOWUPS,
      };
    }

    // 8. Conversational fallback
    return {
      thinkingStatus: 'Thinking...',
      html: `Regarding &ldquo;<strong>${query.replace(/</g, '&lt;')}</strong>&rdquo;:
             <br><br>
             I can help with what Criterion 6.1 or 6.2 (and their sub-points) mean, and how to submit an achievement with evidence. What would you like to know?`,
      actions: HOW_TO_SUBMIT_ACTIONS,
      followUps: CRITERION_FOLLOWUPS,
    };
  }
}

/* ==========================================================================
   10. Modals Management (Login, Portal & Submission Success)
   ========================================================================== */
// HOD accounts are actually issued on thakureducation.org, not the main
// tcetmumbai.in faculty domain — auto-switching the domain picker to match
// whenever Designation is set to HOD means nobody has to remember to flip
// it themselves. It's still a real <select>, so it can be overridden by
// hand for the rare exception. Shared by both the Register form and the
// Add Faculty modal (different top-level init functions, same behavior).
function autoSelectDomainForDesignation(designationSelect, domainSelect) {
  if (!designationSelect || !domainSelect) return;
  designationSelect.addEventListener('change', () => {
    domainSelect.value = designationSelect.value === 'hod' ? 'thakureducation.org' : 'tcetmumbai.in';
  });
}

function initModals() {
  const loginModal = document.getElementById('loginModal');
  const portalModal = document.getElementById('portalModal');
  const submissionSuccessModal = document.getElementById('submissionSuccessModal');

  const loginBtn = document.getElementById('loginBtn');
  const headerGetStartedBtn = document.getElementById('headerGetStartedBtn');
  const heroGetStartedBtn = document.getElementById('heroGetStartedBtn');
  const heroLearnMoreBtn = document.getElementById('heroLearnMoreBtn');

  const closeLogin = document.getElementById('closeLoginModal');
  const closePortal = document.getElementById('closePortalModal');

  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (window.FaemsAPI && window.FaemsAPI.isAuthenticated()) {
        const dropdown = document.getElementById('accountDropdown');
        if (dropdown) dropdown.classList.toggle('open');
      } else {
        loginModal.classList.add('open');
      }
    });
  }
  if (headerGetStartedBtn) {
    headerGetStartedBtn.addEventListener('click', () => {
      const formSection = document.getElementById('criteria-details');
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth' });
        const step1 = document.getElementById('step1DeptSelect');
        if (step1) setTimeout(() => step1.focus(), 600);
      } else {
        portalModal.classList.add('open');
      }
    });
  }
  if (heroGetStartedBtn) {
    heroGetStartedBtn.addEventListener('click', () => {
      document.getElementById('faculties-section').scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (heroLearnMoreBtn) {
    heroLearnMoreBtn.addEventListener('click', () => {
      const hodSec = document.getElementById('hod-section');
      if (hodSec) hodSec.scrollIntoView({ behavior: 'smooth' });
    });
  }

  // While the login gate is locked, the login modal can't be dismissed —
  // no page content is visible until a session is confirmed (see the
  // faems-gate-locked class on <html>, set/cleared in index.html's <head>
  // and here once login/MFA succeeds).
  function isGateLocked() {
    return document.documentElement.classList.contains('faems-gate-locked');
  }

  if (closeLogin) {
    closeLogin.addEventListener('click', () => {
      if (isGateLocked()) return;
      loginModal.classList.remove('open');
    });
  }
  if (closePortal) closePortal.addEventListener('click', () => portalModal.classList.remove('open'));

  [loginModal, portalModal, submissionSuccessModal].forEach(m => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target !== m) return;
      if (m === loginModal && isGateLocked()) return;
      m.classList.remove('open');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (loginModal && !isGateLocked()) loginModal.classList.remove('open');
      if (portalModal) portalModal.classList.remove('open');
      if (submissionSuccessModal) submissionSuccessModal.classList.remove('open');
      const dossierModal = document.getElementById('facultyDossierModal');
      if (dossierModal) dossierModal.classList.remove('open');
      const chat = document.getElementById('chatDrawer');
      if (chat) chat.classList.remove('open');
    }
  });

  // The gate defaults locked (see index.html's <head>) unless a saved
  // token unlocked it already; either way, force the login modal open on
  // load whenever the gate is still locked, so it's the first thing shown.
  if (isGateLocked() && loginModal) loginModal.classList.add('open');

  initRealAuth(loginModal);
}

// Reveals the site (removes the login-gate lock) — called once login/MFA
// succeeds, and once a restored session is confirmed still valid.
function unlockLoginGate() {
  document.documentElement.classList.remove('faems-gate-locked');
}

/* ==========================================================================
   Real authentication against the Django/Postgres backend — replaces the
   old always-succeeds demo login. Two forms live in the same modal
   (#loginForm, #mfaForm); MFA only appears for roles that require it
   (HOD / IQAC Admin / Super Admin), exactly like the account actually
   requires server-side, not whatever the quick-fill dropdown says.
   ========================================================================== */
function initRealAuth(loginModal) {
  const loginForm = document.getElementById('loginForm');
  const mfaForm = document.getElementById('mfaForm');
  if (!loginForm || !mfaForm || !window.FaemsAPI) return;

  const emailInput = document.getElementById('loginEmail');
  const passwordInput = document.getElementById('loginPassword');
  const loginError = document.getElementById('loginError');
  const loginSubmitBtn = document.getElementById('loginSubmitBtn');
  const authTabRow = document.getElementById('authTabRow');
  const authModalTitle = document.getElementById('authModalTitle');

  const mfaCodeInput = document.getElementById('mfaCode');
  const mfaError = document.getElementById('mfaError');
  const mfaSubmitBtn = document.getElementById('mfaSubmitBtn');
  const mfaQrWrap = document.getElementById('mfaQrWrap');
  const mfaQrImage = document.getElementById('mfaQrImage');
  const mfaSecretText = document.getElementById('mfaSecretText');

  const togglePasswordBtn = document.getElementById('togglePasswordVisibility');
  const eyeIcon = document.getElementById('togglePasswordIconEye');
  const eyeOffIcon = document.getElementById('togglePasswordIconEyeOff');
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      togglePasswordBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      if (eyeIcon) eyeIcon.style.display = showing ? '' : 'none';
      if (eyeOffIcon) eyeOffIcon.style.display = showing ? 'none' : '';
    });
  }

  // Visible captcha: a short random code from the backend, rendered here
  // with per-character rotation/offset and a couple of wavy lines so it
  // reads like a distorted captcha image rather than plain text.
  const captchaImageWrap = document.getElementById('loginCaptchaImageWrap');
  const captchaInput = document.getElementById('loginCaptchaInput');
  const refreshCaptchaBtn = document.getElementById('refreshCaptchaBtn');
  let currentCaptcha = null;

  function renderCaptchaSVG(code) {
    const width = 180, height = 46;
    const charWidth = width / (code.length + 1);
    let glyphs = '';
    for (let i = 0; i < code.length; i++) {
      const x = charWidth * (i + 1);
      const y = height / 2 + (Math.random() * 10 - 5);
      const rotate = Math.random() * 32 - 16;
      const hue = 200 + Math.random() * 60;
      glyphs += `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" text-anchor="middle" dominant-baseline="middle" font-size="21" font-weight="800" font-family="Georgia, serif" fill="hsl(${hue},55%,38%)">${code[i]}</text>`;
    }
    let noiseLines = '';
    for (let i = 0; i < 3; i++) {
      const y1 = Math.random() * height, y2 = Math.random() * height;
      noiseLines += `<path d="M0,${y1} C${width / 3},${y1 - 15} ${(width * 2) / 3},${y2 + 15} ${width},${y2}" stroke="hsl(${200 + Math.random() * 60},40%,70%)" stroke-width="1.5" fill="none" opacity="0.6"/>`;
    }
    let noiseDots = '';
    for (let i = 0; i < 18; i++) {
      noiseDots += `<circle cx="${Math.random() * width}" cy="${Math.random() * height}" r="1" fill="hsl(${200 + Math.random() * 60},40%,55%)" opacity="0.5"/>`;
    }
    return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Captcha code">${noiseLines}${noiseDots}${glyphs}</svg>`;
  }

  async function loadCaptcha() {
    try {
      currentCaptcha = await window.FaemsAPI.getCaptcha();
      if (captchaImageWrap) captchaImageWrap.innerHTML = renderCaptchaSVG(currentCaptcha.question);
    } catch {
      if (captchaImageWrap) captchaImageWrap.innerHTML = '<span style="color:#ff6b6b;font-size:0.78rem;">Couldn\'t load code — try refresh</span>';
    }
    if (captchaInput) captchaInput.value = '';
  }

  if (refreshCaptchaBtn) refreshCaptchaBtn.addEventListener('click', loadCaptcha);
  loadCaptcha();

  // The captcha token expires after 5 minutes — get a fresh one each time
  // the modal is reopened, however it was opened (header button, the
  // achievement form's "please sign in" prompt, etc.), not just at page load.
  if (loginModal) {
    let wasOpen = loginModal.classList.contains('open');
    new MutationObserver(() => {
      const isOpen = loginModal.classList.contains('open');
      if (isOpen && !wasOpen) loadCaptcha();
      wasOpen = isOpen;
    }).observe(loginModal, { attributes: true, attributeFilter: ['class'] });
  }

  const loginDomainSelect = document.getElementById('loginDomain');

  // Strip any "@" a visitor tries to type — the domain picker beside the
  // field is the only way to choose the domain, so the text field itself
  // still isn't where it comes from.
  if (emailInput) {
    emailInput.addEventListener('input', () => {
      if (emailInput.value.includes('@')) {
        emailInput.value = emailInput.value.split('@')[0];
      }
    });
  }

  // ---- Forgot Password (2-step: verify email + date of birth on file,
  // then set a new password — no email/OTP dependency) ----
  const forgotRequestForm = document.getElementById('forgotRequestForm');
  const forgotResetForm = document.getElementById('forgotResetForm');
  const forgotEmailInput = document.getElementById('forgotEmail');
  const forgotDobInput = document.getElementById('forgotDob');
  const forgotRequestError = document.getElementById('forgotRequestError');
  const forgotRequestSubmitBtn = document.getElementById('forgotRequestSubmitBtn');
  const forgotResetError = document.getElementById('forgotResetError');
  const forgotResetSubmitBtn = document.getElementById('forgotResetSubmitBtn');
  const forgotBackToLoginBtn = document.getElementById('forgotBackToLoginBtn');
  let pendingResetToken = null;

  initDateInputBounds('forgotDob', { minYear: 1965, maxYear: new Date().getFullYear() - 18 });

  if (forgotEmailInput) {
    forgotEmailInput.addEventListener('input', () => {
      if (forgotEmailInput.value.includes('@')) {
        forgotEmailInput.value = forgotEmailInput.value.split('@')[0];
      }
    });
  }

  const forgotLink = document.getElementById('forgotPasswordLink');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (authTabRow) authTabRow.style.display = 'none';
      loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'none';
      mfaForm.style.display = 'none';
      if (forgotResetForm) forgotResetForm.style.display = 'none';
      if (forgotRequestForm) {
        forgotRequestForm.style.display = '';
        if (forgotEmailInput) forgotEmailInput.value = emailInput.value;
      }
      if (authModalTitle) authModalTitle.textContent = 'Reset Your Password';
      hideError(forgotRequestError);
    });
  }

  if (forgotBackToLoginBtn) {
    forgotBackToLoginBtn.addEventListener('click', () => {
      if (authTabRow) authTabRow.style.display = '';
      if (forgotRequestForm) forgotRequestForm.style.display = 'none';
      if (forgotResetForm) forgotResetForm.style.display = 'none';
      switchAuthTab('login');
    });
  }

  if (forgotRequestForm) {
    forgotRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(forgotRequestError);
      // Same hidden-input-behind-three-selects situation as regDob — the
      // native required check no longer fires on its own.
      if (!forgotDobInput.value) {
        showError(forgotRequestError, 'Please select your complete date of birth.');
        return;
      }
      forgotRequestSubmitBtn.disabled = true;
      try {
        const result = await window.FaemsAPI.requestPasswordReset(
          localPartOnly(forgotEmailInput.value) + emailDomainSuffix(document.getElementById('forgotDomain')),
          forgotDobInput.value
        );
        pendingResetToken = result.reset_token;
        forgotRequestForm.style.display = 'none';
        if (forgotResetForm) forgotResetForm.style.display = '';
        if (authModalTitle) authModalTitle.textContent = 'Set a New Password';
        hideError(forgotResetError);
        const newPasswordInput = document.getElementById('forgotNewPassword');
        if (newPasswordInput) { newPasswordInput.value = ''; newPasswordInput.focus(); }
      } catch (err) {
        showError(forgotRequestError, (err && err.message) || "That email and date of birth don't match our records.");
      } finally {
        forgotRequestSubmitBtn.disabled = false;
      }
    });
  }

  if (forgotResetForm) {
    forgotResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(forgotResetError);
      forgotResetSubmitBtn.disabled = true;
      try {
        const newPassword = document.getElementById('forgotNewPassword').value;
        await window.FaemsAPI.confirmPasswordReset(pendingResetToken, newPassword);
        forgotResetForm.style.display = 'none';
        if (authTabRow) authTabRow.style.display = '';
        emailInput.value = forgotEmailInput.value.trim();
        passwordInput.value = '';
        switchAuthTab('login');
        await showAppAlert('Password updated! Please sign in with your new password.');
      } catch (err) {
        showError(forgotResetError, (err && err.message) || 'Could not update your password. Please try again.');
      } finally {
        forgotResetSubmitBtn.disabled = false;
      }
    });
  }

  let pendingMfaToken = null;

  function enterPortal(user) {
    window.FAEMS_CURRENT_USER = user;
    unlockLoginGate();
    try {
      document.dispatchEvent(new CustomEvent('faems:authenticated', { detail: user }));
    } catch {
      // older browsers — non-fatal, app.js also re-checks on modal close
    }
    loginForm.innerHTML = `
      <div style="text-align:center;padding:1.5rem 0;">
        <div style="width:54px;height:54px;border-radius:50%;background:var(--tcet-blue-light);color:var(--tcet-blue);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;font-size:1.75rem;">✓</div>
        <h4 style="font-family:var(--font-heading);font-size:1.35rem;color:var(--text-primary);margin-bottom:0.5rem;">Signed in as ${(user.role || '').toUpperCase()}</h4>
        <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.6;">Welcome <strong>${user.full_name}</strong>. Entering Faculty Contribution Accreditation Portal…</p>
      </div>
    `;
    setTimeout(() => loginModal.classList.remove('open'), 1200);
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(loginError);
    if (!currentCaptcha) {
      showError(loginError, 'Security code is still loading — please wait a moment and try again.');
      return;
    }
    loginSubmitBtn.disabled = true;
    try {
      const result = await window.FaemsAPI.login(
        localPartOnly(emailInput.value) + emailDomainSuffix(loginDomainSelect),
        passwordInput.value,
        currentCaptcha.token,
        captchaInput ? captchaInput.value.trim() : ''
      );
      if (result.mfa_setup_required || result.mfa_required) {
        pendingMfaToken = result.mfa_token;
        loginForm.style.display = 'none';
        mfaForm.style.display = '';
        mfaCodeInput.value = '';
        hideError(mfaError);
        if (result.mfa_setup_required) {
          const setup = await window.FaemsAPI.mfaSetup(pendingMfaToken);
          mfaQrWrap.style.display = 'block';
          mfaQrImage.src = setup.qr_code;
          mfaSecretText.textContent = `Manual entry key: ${setup.secret}`;
        } else {
          mfaQrWrap.style.display = 'none';
        }
        mfaCodeInput.focus();
        return;
      }
      await window.FaemsAPI.completeLogin(result);
      enterPortal(result.user);
    } catch (err) {
      showError(loginError, (err && err.message) || 'Login failed. Please check your details and try again.');
      loadCaptcha();
    } finally {
      loginSubmitBtn.disabled = false;
    }
  });

  mfaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(mfaError);
    mfaSubmitBtn.disabled = true;
    try {
      const result = await window.FaemsAPI.mfaVerify(pendingMfaToken, mfaCodeInput.value.trim());
      enterPortal(result.user);
    } catch (err) {
      showError(mfaError, (err && err.message) || 'Incorrect code. Please try again.');
    } finally {
      mfaSubmitBtn.disabled = false;
    }
  });

  // ---- Register tab ----
  const authTabLogin = document.getElementById('authTabLogin');
  const authTabRegister = document.getElementById('authTabRegister');
  const registerForm = document.getElementById('registerForm');
  const regEmailInput = document.getElementById('regEmail');
  const regPasswordInput = document.getElementById('regPassword');
  const regDobInput = document.getElementById('regDob');
  const registerError = document.getElementById('registerError');
  const registerSubmitBtn = document.getElementById('registerSubmitBtn');
  attachPasswordStrengthMeter('regPassword', 'regPasswordStrength', 'regPasswordSuggestBtn');
  attachPasswordStrengthMeter('forgotNewPassword', 'forgotNewPasswordStrength', 'forgotNewPasswordSuggestBtn');

  // A person must be 18+ to register — the year list itself only offers
  // qualifying years, same guarantee the old date input's max= gave, as
  // well as validated again on submit.
  initDateInputBounds('regDob', { minYear: 1965, maxYear: new Date().getFullYear() - 18 });
  initDateInputBounds('regJoinDate', { minYear: 2022, maxToday: true });

  autoSelectDomainForDesignation(document.getElementById('regDesignation'), document.getElementById('regDomain'));

  if (regEmailInput) {
    regEmailInput.addEventListener('input', () => {
      if (regEmailInput.value.includes('@')) {
        regEmailInput.value = regEmailInput.value.split('@')[0];
      }
    });
  }

  const regToggleBtn = document.getElementById('regTogglePasswordVisibility');
  if (regToggleBtn && regPasswordInput) {
    regToggleBtn.addEventListener('click', () => {
      regPasswordInput.type = regPasswordInput.type === 'text' ? 'password' : 'text';
    });
  }

  restrictToTenDigits(document.getElementById('regPhone'));

  function switchAuthTab(tab) {
    const showLogin = tab === 'login';
    if (authTabRow) authTabRow.style.display = '';
    if (authTabLogin) authTabLogin.classList.toggle('active', showLogin);
    if (authTabRegister) authTabRegister.classList.toggle('active', !showLogin);
    loginForm.style.display = showLogin ? '' : 'none';
    if (registerForm) registerForm.style.display = showLogin ? 'none' : '';
    mfaForm.style.display = 'none';
    if (forgotRequestForm) forgotRequestForm.style.display = 'none';
    if (forgotResetForm) forgotResetForm.style.display = 'none';
    if (authModalTitle) authModalTitle.textContent = showLogin ? 'Faculty Contribution Login' : 'Create Your Account';
  }

  if (authTabLogin) authTabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (authTabRegister) authTabRegister.addEventListener('click', () => switchAuthTab('register'));

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(registerError);
      // Date of Birth is required, but now lives on a hidden input (the
      // three visible day/month/year <select>s are what the person
      // actually fills in), so the browser's native required-field
      // validation never sees it — has to be checked by hand instead.
      if (!regDobInput.value) {
        showError(registerError, 'Please select your complete date of birth.');
        return;
      }
      registerSubmitBtn.disabled = true;
      try {
        const title = document.getElementById('regTitle').value;
        const typedName = document.getElementById('regFullName').value.trim();
        const regDomainSelect = document.getElementById('regDomain');
        const payload = {
          full_name: `${title} ${typedName}`.trim(),
          email: localPartOnly(regEmailInput.value) + emailDomainSuffix(regDomainSelect),
          password: regPasswordInput.value,
          designation: document.getElementById('regDesignation').value,
          gender: document.getElementById('regGender').value,
          employee_id: document.getElementById('regEmployeeId').value.trim(),
          contact_number: document.getElementById('regPhone').value.trim(),
          join_date: document.getElementById('regJoinDate').value || null,
          date_of_birth: regDobInput.value || null,
        };
        await window.FaemsAPI.registerFaculty(payload);
        registerForm.reset();
        switchAuthTab('login');
        showError(loginError, '');
        hideError(loginError);
        await showAppAlert(
          "Your request has been shared with the HOD. Your account will be created once it's approved — "
          + "you'll be able to log in after that."
        );
      } catch (err) {
        const detail = friendlyErrorMessage(err, 'Could not submit your registration. Please check the details and try again.');
        showError(registerError, detail);
      } finally {
        registerSubmitBtn.disabled = false;
      }
    });
  }
}

/* ==========================================================================
   10b. Account Menu (signed-in state, logout), Notifications & Add Faculty
   ========================================================================== */
function initAccountMenu() {
  const api = window.FaemsAPI;
  if (!api) return;

  const loginBtn = document.getElementById('loginBtn');
  const accountDropdown = document.getElementById('accountDropdown');
  const accountDropdownName = document.getElementById('accountDropdownName');
  const accountDropdownRole = document.getElementById('accountDropdownRole');
  const addFacultyMenuBtn = document.getElementById('addFacultyMenuBtn');
  const logoutMenuBtn = document.getElementById('logoutMenuBtn');

  const notifBellBtn = document.getElementById('notifBellBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  const notifBadge = document.getElementById('notifBadge');
  const notifList = document.getElementById('notifList');
  const notifMarkAllReadBtn = document.getElementById('notifMarkAllReadBtn');

  const CAN_MANAGE_FACULTY_ROLES = new Set(['hod', 'iqac_admin', 'super_admin']);

  function timeAgo(isoString) {
    const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  function updateHeaderForUser(user) {
    if (!user) return;
    if (loginBtn) loginBtn.innerHTML = `<span>${user.full_name}</span>`;
    if (accountDropdownName) accountDropdownName.textContent = user.full_name;
    if (accountDropdownRole) accountDropdownRole.textContent = (user.role || '').replace('_', ' ');
    if (addFacultyMenuBtn) addFacultyMenuBtn.style.display = CAN_MANAGE_FACULTY_ROLES.has(user.role) ? '' : 'none';
    refreshUnreadCount();
  }

  async function refreshUnreadCount() {
    if (!notifBadge) return;
    let serverCount = 0;
    if (api.isAuthenticated()) {
      try {
        const res = await api.unreadNotificationCount();
        serverCount = res.count;
      } catch {
        // best-effort — stale/expired session, leave the server half as-is
      }
    }
    const total = serverCount + getUnreadLocalNotificationCount();
    notifBadge.textContent = total > 9 ? '9+' : String(total);
    notifBadge.style.display = total > 0 ? 'flex' : 'none';
  }
  // Same cross-tab gap as the leaderboard's poll: a notification created by
  // someone else's action (a different faculty submitting/deleting, an HOD
  // verifying) reaches this tab's badge within this interval, not the
  // instant it's created server-side — isAuthenticated() inside the
  // function already makes this a no-op before login. 15s (not 30s) so a
  // notification that just arrived doesn't sit stale-looking for as long.
  setInterval(refreshUnreadCount, 15000);
  // A local task reminder firing (see fireTaskReminder in
  // initCalendarAndTodoList) needs the badge to pick it up immediately —
  // that code has no access to this closure's refreshUnreadCount, hence
  // the event instead of a direct call.
  document.addEventListener('faems:localNotificationAdded', refreshUnreadCount);

  async function renderNotifications() {
    if (!notifList) return;
    notifList.innerHTML = '<p class="notif-empty-text">Loading…</p>';
    let serverRows = [];
    try {
      const res = await api.listNotifications();
      serverRows = res.results || res;
    } catch {
      // best-effort — local reminders below still render even if this fails
    }
    const localRows = getLocalNotifications()
      .filter((n) => !n.isRead)
      .map((n) => ({ id: n.id, title: n.title, message: n.message, created_at: n.createdAt, isLocal: true }));
    const rows = [...localRows, ...serverRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // Pending-faculty-approval notifications get a bigger, actionable card
    // of their own — a faculty member literally cannot log in until one of
    // these is acted on, so burying it as a plain text row isn't enough.
    const approvalRows = rows.filter(n => n.notification_type === 'faculty_registration_pending');
    const plainRows = rows.filter(n => n.notification_type !== 'faculty_registration_pending');
    if (!rows.length) {
      notifList.innerHTML = '<p class="notif-empty-text">No notifications yet.</p>';
      return;
    }
    const approvalCardsHtml = approvalRows.map(n => {
      const requestId = (n.related_evidence_id || '').replace('regreq-', '');
      return `
      <div class="notif-approval-card" data-approval-notif-id="${n.id}" data-approval-local="${n.isLocal ? '1' : ''}">
        <div class="notif-approval-card-title">${escapeHtml(n.title)}</div>
        <div class="notif-approval-card-meta">${escapeHtml(n.message)}</div>
        <div class="notif-approval-card-actions">
          <button type="button" class="notif-approval-approve-btn" data-approve-request-id="${requestId}">Approve</button>
          <button type="button" class="notif-approval-reject-btn" data-reject-request-id="${requestId}">Reject</button>
        </div>
      </div>`;
    }).join('');
    const plainRowsHtml = plainRows.map(n => `
      <button type="button" class="notif-item unread" data-notif-id="${n.id}" data-local="${n.isLocal ? '1' : ''}">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-message">${escapeHtml(n.message)}</div>
        <div class="notif-item-time">${timeAgo(n.created_at)}${n.related_evidence_id ? ' • ' + n.related_evidence_id : ''}</div>
      </button>
    `).join('');
    notifList.innerHTML = approvalCardsHtml + plainRowsHtml;
    // Marking read means "done with this" — the row leaves the list
    // right away instead of just losing its unread styling, so read
    // notifications never pile up here.
    notifList.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-notif-id');
        const isLocal = item.getAttribute('data-local') === '1';
        item.remove();
        if (isLocal) {
          markLocalNotificationRead(id);
        } else {
          try { await api.markNotificationRead(id); } catch { /* best-effort */ }
        }
        refreshUnreadCount();
        if (!notifList.querySelector('.notif-item') && !notifList.querySelector('.notif-approval-card')) {
          notifList.innerHTML = '<p class="notif-empty-text">No notifications yet.</p>';
        }
      });
    });
    notifList.querySelectorAll('[data-approve-request-id]').forEach(btn => {
      btn.addEventListener('click', () => handleFacultyApprovalAction(btn.getAttribute('data-approve-request-id'), 'approve', btn));
    });
    notifList.querySelectorAll('[data-reject-request-id]').forEach(btn => {
      btn.addEventListener('click', () => handleFacultyApprovalAction(btn.getAttribute('data-reject-request-id'), 'reject', btn));
    });
  }

  // Shared by the notification dropdown's approval card and the dedicated
  // Approve Faculty modal — one action, two entry points.
  async function handleFacultyApprovalAction(requestId, action, triggerBtn) {
    const card = triggerBtn.closest('.notif-approval-card') || triggerBtn.closest('.approve-faculty-row');
    if (card) card.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      if (action === 'approve') {
        await api.approveFacultyRegistration(requestId);
      } else {
        await api.rejectFacultyRegistration(requestId);
      }
      // The underlying Notification row is still unread server-side —
      // acting on the request here should also clear it from the bell,
      // not just from whichever surface (card vs modal) was clicked.
      const notifId = card && card.getAttribute('data-approval-notif-id');
      if (notifId) {
        try { await api.markNotificationRead(notifId); } catch { /* best-effort */ }
      }
      if (card) card.remove();
      refreshUnreadCount();
      refreshApprovalBadge();
      if (notifList && !notifList.querySelector('.notif-item') && !notifList.querySelector('.notif-approval-card')) {
        notifList.innerHTML = '<p class="notif-empty-text">No notifications yet.</p>';
      }
      const approveFacultyList = document.getElementById('approveFacultyList');
      if (approveFacultyList && !approveFacultyList.querySelector('.approve-faculty-row')) {
        approveFacultyList.innerHTML = '<p class="notif-empty-text">No pending registrations.</p>';
      }
    } catch (err) {
      await showAppAlert(friendlyErrorMessage(err, `Could not ${action} this registration. Please try again.`));
      if (card) card.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  }

  const approveFacultyMenuBtn = document.getElementById('approveFacultyMenuBtn');
  const approveFacultyBadge = document.getElementById('approveFacultyBadge');
  const approveFacultyModal = document.getElementById('approveFacultyModal');
  const approveFacultyList = document.getElementById('approveFacultyList');
  const closeApproveFacultyModal = document.getElementById('closeApproveFacultyModal');

  async function refreshApprovalBadge() {
    if (!approveFacultyMenuBtn || !CAN_MANAGE_FACULTY_ROLES.has((window.FAEMS_CURRENT_USER || {}).role)) {
      if (approveFacultyMenuBtn) approveFacultyMenuBtn.style.display = 'none';
      return;
    }
    approveFacultyMenuBtn.style.display = '';
    try {
      const res = await api.listPendingFacultyApprovals();
      const count = (res.results || res).length;
      if (approveFacultyBadge) {
        approveFacultyBadge.textContent = count > 9 ? '9+' : String(count);
        approveFacultyBadge.style.display = count > 0 ? '' : 'none';
      }
    } catch { /* best-effort */ }
  }
  document.addEventListener('faems:authenticated', refreshApprovalBadge);
  setInterval(refreshApprovalBadge, 30000);

  async function loadApproveFacultyList() {
    if (!approveFacultyList) return;
    approveFacultyList.innerHTML = '<p class="notif-empty-text">Loading…</p>';
    try {
      const res = await api.listPendingFacultyApprovals();
      const rows = res.results || res;
      if (!rows.length) {
        approveFacultyList.innerHTML = '<p class="notif-empty-text">No pending registrations.</p>';
        return;
      }
      approveFacultyList.innerHTML = rows.map(r => `
        <div class="approve-faculty-row">
          <div class="approve-faculty-row-info">
            <div class="approve-faculty-row-name">${escapeHtml(r.full_name)}</div>
            <div class="approve-faculty-row-meta">${escapeHtml(r.email)} · ${escapeHtml(designationLabel(r.designation))} · Emp ID: ${escapeHtml(r.employee_id || '—')}</div>
          </div>
          <div class="approve-faculty-row-actions">
            <button type="button" class="notif-approval-approve-btn" data-approve-request-id="${r.id}">Approve</button>
            <button type="button" class="notif-approval-reject-btn" data-reject-request-id="${r.id}">Reject</button>
          </div>
        </div>
      `).join('');
      approveFacultyList.querySelectorAll('[data-approve-request-id]').forEach(btn => {
        btn.addEventListener('click', () => handleFacultyApprovalAction(btn.getAttribute('data-approve-request-id'), 'approve', btn));
      });
      approveFacultyList.querySelectorAll('[data-reject-request-id]').forEach(btn => {
        btn.addEventListener('click', () => handleFacultyApprovalAction(btn.getAttribute('data-reject-request-id'), 'reject', btn));
      });
    } catch {
      approveFacultyList.innerHTML = '<p class="notif-empty-text">Could not load pending registrations.</p>';
    }
  }

  if (approveFacultyMenuBtn) {
    approveFacultyMenuBtn.addEventListener('click', () => {
      if (accountDropdown) accountDropdown.classList.remove('open');
      if (approveFacultyModal) approveFacultyModal.classList.add('open');
      loadApproveFacultyList();
    });
  }
  if (closeApproveFacultyModal) {
    closeApproveFacultyModal.addEventListener('click', () => approveFacultyModal.classList.remove('open'));
  }
  if (approveFacultyModal) {
    approveFacultyModal.addEventListener('click', (e) => {
      if (e.target === approveFacultyModal) approveFacultyModal.classList.remove('open');
    });
  }

  if (notifBellBtn) {
    notifBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!api.isAuthenticated()) {
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.classList.add('open');
        return;
      }
      if (accountDropdown) accountDropdown.classList.remove('open');
      const wasOpen = notifDropdown.classList.contains('open');
      notifDropdown.classList.toggle('open');
      if (!wasOpen) {
        renderNotifications();
        // renderNotifications() re-fetches the *list*, but the badge
        // *count* only otherwise refreshes on the 30s interval below —
        // without this, a notification that arrived in the last <30s
        // shows correctly inside the opened dropdown while the badge
        // number next to it still shows the stale, lower count until the
        // next tick, which looks like the bell "isn't updating".
        refreshUnreadCount();
      }
    });
  }

  if (notifMarkAllReadBtn) {
    notifMarkAllReadBtn.addEventListener('click', async () => {
      markAllLocalNotificationsRead();
      try {
        await api.markAllNotificationsRead();
      } catch { /* best-effort */ }
      renderNotifications();
      refreshUnreadCount();
      if (notifDropdown) notifDropdown.classList.remove('open');
    });
  }

  document.addEventListener('click', (e) => {
    if (notifDropdown && notifDropdown.classList.contains('open') && !e.target.closest('.notif-menu-wrap')) {
      notifDropdown.classList.remove('open');
    }
    if (accountDropdown && accountDropdown.classList.contains('open') && !e.target.closest('.account-menu-wrap')) {
      accountDropdown.classList.remove('open');
    }
  });

  if (logoutMenuBtn) {
    logoutMenuBtn.addEventListener('click', async () => {
      logoutMenuBtn.disabled = true;
      try { await api.logout(); } catch { /* best-effort */ }
      // A full reload is the simplest reliable way to reset every bit of
      // client-side state (the login form's own DOM gets replaced with a
      // "Signed in" message on success, dropdown/menu states, etc.).
      window.location.reload();
    });
  }

  // ---- Add Faculty (HOD adds to their own department; IQAC/Super Admin can
  // pick any department — both enforced again server-side either way) ----
  const addFacultyModal = document.getElementById('addFacultyModal');
  const addFacultyForm = document.getElementById('addFacultyForm');
  const addFacultyDeptSelect = document.getElementById('addFacultyDepartment');
  const addFacultyError = document.getElementById('addFacultyError');
  const addFacultySubmitBtn = document.getElementById('addFacultySubmitBtn');
  const closeAddFacultyModal = document.getElementById('closeAddFacultyModal');
  autoSelectDomainForDesignation(document.getElementById('addFacultyDesignation'), document.getElementById('addFacultyDomain'));

  if (addFacultyMenuBtn) {
    addFacultyMenuBtn.addEventListener('click', async () => {
      if (accountDropdown) accountDropdown.classList.remove('open');
      const user = window.FAEMS_CURRENT_USER;
      if (addFacultyDeptSelect) {
        addFacultyDeptSelect.innerHTML = '<option>Loading…</option>';
        try {
          const res = await api.listDepartments();
          const depts = sortDepartmentsAimlFirst(res.results || res);
          addFacultyDeptSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
          if (user && user.role === 'hod' && user.department) {
            addFacultyDeptSelect.value = String(user.department.id);
            addFacultyDeptSelect.disabled = true;
          } else {
            addFacultyDeptSelect.disabled = false;
          }
        } catch {
          addFacultyDeptSelect.innerHTML = '<option value="">Couldn\'t load departments</option>';
        }
      }
      if (addFacultyModal) addFacultyModal.classList.add('open');
    });
  }

  if (closeAddFacultyModal) {
    closeAddFacultyModal.addEventListener('click', () => addFacultyModal.classList.remove('open'));
  }
  if (addFacultyModal) {
    addFacultyModal.addEventListener('click', (e) => {
      if (e.target === addFacultyModal) addFacultyModal.classList.remove('open');
    });
  }

  if (addFacultyForm) {
    addFacultyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (addFacultyError) addFacultyError.style.display = 'none';
      addFacultySubmitBtn.disabled = true;
      try {
        const payload = {
          full_name: document.getElementById('addFacultyName').value.trim(),
          email: localPartOnly(document.getElementById('addFacultyEmail').value) + emailDomainSuffix(document.getElementById('addFacultyDomain')),
          designation: document.getElementById('addFacultyDesignation').value,
          department: Number(addFacultyDeptSelect.value),
          employee_id: document.getElementById('addFacultyEmployeeId').value.trim(),
          temporary_password: document.getElementById('addFacultyPassword').value,
        };
        await api.createFaculty(payload);
        addFacultyModal.classList.remove('open');
        addFacultyForm.reset();
        await showAppAlert(`${payload.full_name} has been added. Share the temporary password with them directly — it won't be shown again here.`);
        if (typeof buildRealSubmissionConfig === 'function') buildRealSubmissionConfig();
      } catch (err) {
        if (addFacultyError) {
          addFacultyError.textContent = friendlyErrorMessage(err, 'Could not add faculty. Please check the details and try again.');
          addFacultyError.style.display = 'block';
        }
      } finally {
        addFacultySubmitBtn.disabled = false;
      }
    });
  }

  // Strip "@" from the local-part field, same as the login form.
  const addFacultyEmailInput = document.getElementById('addFacultyEmail');
  if (addFacultyEmailInput) {
    addFacultyEmailInput.addEventListener('input', () => {
      if (addFacultyEmailInput.value.includes('@')) {
        addFacultyEmailInput.value = addFacultyEmailInput.value.split('@')[0];
      }
    });
  }

  // ---- Update Details (self-service — everything except email) ----
  const updateDetailsModal = document.getElementById('updateDetailsModal');
  const closeUpdateDetailsModal = document.getElementById('closeUpdateDetailsModal');
  const updateDetailsForm = document.getElementById('updateDetailsForm');
  const udDepartmentSelect = document.getElementById('udDepartment');
  const updateDetailsError = document.getElementById('updateDetailsError');
  const updateDetailsSubmitBtn = document.getElementById('updateDetailsSubmitBtn');
  const updateDetailsMenuBtn = document.getElementById('updateDetailsMenuBtn');
  restrictToTenDigits(document.getElementById('udPhone'));
  initDateInputBounds('udJoinDate', { minYear: 2022, maxToday: true });
  initDateInputBounds('udDob', { minYear: 1965, maxYear: new Date().getFullYear() - 18 });
  initDateInputBounds('hodTransferJoinDate', { minYear: 2022, maxToday: true });
  initDateInputBounds('hodTransferDob', { minYear: 1965, maxYear: new Date().getFullYear() - 18 });
  restrictToTenDigits(document.getElementById('hodTransferEmployeeId'));

  // Only ever relevant for the person who opened this modal actually
  // being the department's current HOD — everyone else's designation
  // select just behaves like a plain dropdown, no transfer box.
  const udDesignationSelect = document.getElementById('udDesignation');
  const hodTransferBox = document.getElementById('hodTransferBox');
  const hodTransferModeSelect = document.getElementById('hodTransferMode');
  const hodTransferExistingFields = document.getElementById('hodTransferExistingFields');
  const hodTransferExistingFacultySelect = document.getElementById('hodTransferExistingFaculty');
  const hodTransferNewFields = document.getElementById('hodTransferNewFields');
  let openedAsCurrentHOD = false;

  function syncHodTransferModeFields() {
    if (!hodTransferModeSelect) return;
    const isExisting = hodTransferModeSelect.value === 'existing';
    if (hodTransferExistingFields) hodTransferExistingFields.style.display = isExisting ? '' : 'none';
    if (hodTransferNewFields) hodTransferNewFields.style.display = isExisting ? 'none' : '';
  }
  if (hodTransferModeSelect) hodTransferModeSelect.addEventListener('change', syncHodTransferModeFields);

  // The rest of the department, minus the acting HOD herself — anyone
  // non-active isn't offered (she'd be promoting someone who can't log
  // in to use the access).
  async function loadHodTransferExistingFacultyOptions() {
    if (!hodTransferExistingFacultySelect) return;
    const user = window.FAEMS_CURRENT_USER;
    hodTransferExistingFacultySelect.innerHTML = '<option value="" selected disabled>Loading…</option>';
    try {
      // No params needed — list() already scopes an HOD caller to her own
      // department's currently-active faculty (FacultyProfileViewSet.get_queryset).
      const res = await api.listFaculty();
      const rows = (res.results || res).filter(fp => fp.id !== user.faculty_profile_id);
      if (!rows.length) {
        hodTransferExistingFacultySelect.innerHTML = '<option value="" selected disabled>No other faculty in this department</option>';
        return;
      }
      hodTransferExistingFacultySelect.innerHTML =
        '<option value="" selected disabled>Select…</option>' +
        rows.map(fp => `<option value="${fp.id}">${escapeHtml(fp.full_name)} — ${escapeHtml(designationLabel(fp.designation))} (Emp ID: ${escapeHtml(fp.employee_id || '—')})</option>`).join('');
    } catch {
      hodTransferExistingFacultySelect.innerHTML = '<option value="" selected disabled>Could not load faculty list</option>';
    }
  }

  function syncHodTransferBoxVisibility() {
    if (!hodTransferBox || !udDesignationSelect) return;
    const showTransferBox = openedAsCurrentHOD && udDesignationSelect.value !== 'hod';
    hodTransferBox.style.display = showTransferBox ? '' : 'none';
    if (showTransferBox) {
      if (hodTransferModeSelect) hodTransferModeSelect.value = 'existing';
      syncHodTransferModeFields();
      loadHodTransferExistingFacultyOptions();
    }
  }
  if (udDesignationSelect) udDesignationSelect.addEventListener('change', syncHodTransferBoxVisibility);

  if (updateDetailsMenuBtn) {
    updateDetailsMenuBtn.addEventListener('click', async () => {
      if (accountDropdown) accountDropdown.classList.remove('open');
      const user = window.FAEMS_CURRENT_USER;
      if (!user || !user.faculty_profile_id) {
        await showAppAlert("This account doesn't have an editable faculty profile.");
        return;
      }
      try {
        const [deptsRes, profile] = await Promise.all([
          api.listDepartments(),
          api.getFacultyProfile(user.faculty_profile_id),
        ]);
        const depts = sortDepartmentsAimlFirst(deptsRes.results || deptsRes);
        udDepartmentSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
        document.getElementById('udFullName').value = profile.full_name || '';
        document.getElementById('udEmailDisplay').value = profile.email || user.email;
        udDepartmentSelect.value = String(profile.department);
        document.getElementById('udDesignation').value = profile.designation || 'assistant_professor';
        document.getElementById('udPhone').value = profile.contact_number || '';
        document.getElementById('udJoinDate').value = profile.join_date || '';
        document.getElementById('udGender').value = profile.gender || '';
        document.getElementById('udDob').value = profile.date_of_birth || '';
        document.getElementById('udBio').value = profile.bio || '';
        openedAsCurrentHOD = user.role === 'hod' && profile.designation === 'hod';
        // Reset from any previous open — this is a real account being
        // created on submit, not a draft that should survive a reopen.
        ['hodTransferTitle', 'hodTransferFullName', 'hodTransferEmployeeId', 'hodTransferEmail', 'hodTransferPassword', 'hodTransferJoinDate', 'hodTransferDob'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
        syncHodTransferBoxVisibility();
        if (updateDetailsError) updateDetailsError.style.display = 'none';
        if (updateDetailsModal) updateDetailsModal.classList.add('open');
      } catch {
        await showAppAlert("Couldn't load your profile — please try again.");
      }
    });
  }

  if (closeUpdateDetailsModal) {
    closeUpdateDetailsModal.addEventListener('click', () => updateDetailsModal.classList.remove('open'));
  }
  if (updateDetailsModal) {
    updateDetailsModal.addEventListener('click', (e) => {
      if (e.target === updateDetailsModal) updateDetailsModal.classList.remove('open');
    });
  }

  if (updateDetailsForm) {
    updateDetailsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (updateDetailsError) updateDetailsError.style.display = 'none';
      const transferringHOD = openedAsCurrentHOD && udDesignationSelect.value !== 'hod';
      const transferringToExisting = transferringHOD && hodTransferModeSelect && hodTransferModeSelect.value === 'existing';
      if (transferringHOD) {
        if (transferringToExisting) {
          if (!hodTransferExistingFacultySelect || !hodTransferExistingFacultySelect.value) {
            if (updateDetailsError) {
              updateDetailsError.textContent = 'Select which faculty member is taking over as HOD.';
              updateDetailsError.style.display = 'block';
            }
            return;
          }
        } else {
          const title = document.getElementById('hodTransferTitle').value;
          if (!title) {
            if (updateDetailsError) {
              updateDetailsError.textContent = 'Choose the next HOD\'s title (Dr./Mr./Mrs./Ms.).';
              updateDetailsError.style.display = 'block';
            }
            return;
          }
        }
      }
      updateDetailsSubmitBtn.disabled = true;
      try {
        const user = window.FAEMS_CURRENT_USER;
        if (transferringToExisting) {
          await api.transferHODToExisting(udDesignationSelect.value, Number(hodTransferExistingFacultySelect.value));
          await api.updateMyProfile(user.faculty_profile_id, {
            full_name: document.getElementById('udFullName').value.trim(),
            department: Number(udDepartmentSelect.value),
            designation: udDesignationSelect.value,
            contact_number: document.getElementById('udPhone').value.trim(),
            join_date: document.getElementById('udJoinDate').value || null,
            gender: document.getElementById('udGender').value,
            date_of_birth: document.getElementById('udDob').value || null,
            bio: document.getElementById('udBio').value.trim(),
          });
        } else if (transferringHOD) {
          const successor = {
            title: document.getElementById('hodTransferTitle').value,
            full_name: document.getElementById('hodTransferFullName').value.trim(),
            employee_id: document.getElementById('hodTransferEmployeeId').value.trim(),
            designation: document.getElementById('hodTransferDesignation').value,
            email: localPartOnly(document.getElementById('hodTransferEmail').value) + emailDomainSuffix(document.getElementById('hodTransferDomain')),
            temporary_password: document.getElementById('hodTransferPassword').value,
            join_date: document.getElementById('hodTransferJoinDate').value || null,
            date_of_birth: document.getElementById('hodTransferDob').value || null,
          };
          await api.transferHOD(udDesignationSelect.value, successor);
          // The successor's account is created by transfer_hod itself —
          // this PATCH only covers the *other* profile fields (phone,
          // bio, ...) that aren't part of that atomic transfer.
          await api.updateMyProfile(user.faculty_profile_id, {
            full_name: document.getElementById('udFullName').value.trim(),
            department: Number(udDepartmentSelect.value),
            designation: udDesignationSelect.value,
            contact_number: document.getElementById('udPhone').value.trim(),
            join_date: document.getElementById('udJoinDate').value || null,
            gender: document.getElementById('udGender').value,
            date_of_birth: document.getElementById('udDob').value || null,
            bio: document.getElementById('udBio').value.trim(),
          });
        } else {
          const payload = {
            full_name: document.getElementById('udFullName').value.trim(),
            department: Number(udDepartmentSelect.value),
            designation: document.getElementById('udDesignation').value,
            contact_number: document.getElementById('udPhone').value.trim(),
            join_date: document.getElementById('udJoinDate').value || null,
            gender: document.getElementById('udGender').value,
            date_of_birth: document.getElementById('udDob').value || null,
            bio: document.getElementById('udBio').value.trim(),
          };
          await api.updateMyProfile(user.faculty_profile_id, payload);
        }
        // Re-fetch /auth/me/ rather than hand-merging the PATCH response:
        // it's the same MeSerializer shape enterPortal() set at login (User
        // row, nested department object), so this is the one place
        // guaranteed to match — a hand merge risks clobbering the nested
        // department object with the profile PATCH's raw department id.
        const freshUser = await api.me();
        window.FAEMS_CURRENT_USER = freshUser;
        updateHeaderForUser(window.FAEMS_CURRENT_USER);
        updateDetailsModal.classList.remove('open');
        if (typeof buildRealSubmissionConfig === 'function') buildRealSubmissionConfig();
        document.dispatchEvent(new CustomEvent('faems:facultyProfileUpdated', {
          detail: { facultyProfileId: user.faculty_profile_id },
        }));
      } catch (err) {
        if (updateDetailsError) {
          updateDetailsError.textContent = friendlyErrorMessage(err, 'Could not save your details. Please try again.');
          updateDetailsError.style.display = 'block';
        }
      } finally {
        updateDetailsSubmitBtn.disabled = false;
      }
    });
  }

  // ---- Delete Account (self-service) — a future last working date only
  // schedules the departure; today applies it immediately. See
  // FacultyProfileViewSet.delete_my_account for the full behavior.
  const deleteAccountMenuBtn = document.getElementById('deleteAccountMenuBtn');
  const deleteAccountModal = document.getElementById('deleteAccountModal');
  const deleteAccountLastDay = document.getElementById('deleteAccountLastDay');
  const deleteAccountError = document.getElementById('deleteAccountError');
  const confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');
  const cancelDeleteAccountBtn = document.getElementById('cancelDeleteAccountBtn');
  const closeDeleteAccountModalBtn = document.getElementById('closeDeleteAccountModalBtn');

  function closeDeleteAccountModal() {
    if (deleteAccountModal) deleteAccountModal.classList.remove('open');
  }

  if (deleteAccountMenuBtn && deleteAccountModal) {
    deleteAccountMenuBtn.addEventListener('click', () => {
      if (accountDropdown) accountDropdown.classList.remove('open');
      if (deleteAccountLastDay) deleteAccountLastDay.value = todayStr();
      hideError(deleteAccountError);
      deleteAccountModal.classList.add('open');
    });
  }
  if (cancelDeleteAccountBtn) cancelDeleteAccountBtn.addEventListener('click', closeDeleteAccountModal);
  if (closeDeleteAccountModalBtn) closeDeleteAccountModalBtn.addEventListener('click', closeDeleteAccountModal);
  if (deleteAccountModal) {
    deleteAccountModal.addEventListener('click', (e) => {
      if (e.target === deleteAccountModal) closeDeleteAccountModal();
    });
  }
  if (confirmDeleteAccountBtn) {
    confirmDeleteAccountBtn.addEventListener('click', async () => {
      hideError(deleteAccountError);
      if (!deleteAccountLastDay || !deleteAccountLastDay.value) {
        showError(deleteAccountError, 'Please choose your last working date.');
        return;
      }
      const lastDay = deleteAccountLastDay.value;
      const isFuture = lastDay > todayStr();
      const confirmed = await showAppConfirm(
        isFuture
          ? `Schedule your account for deletion after ${lastDay}? You'll keep working normally until then — this cannot be undone by you.`
          : 'Delete your account now? You will be signed out immediately and will no longer be able to log in. ' +
            'Your existing achievement submissions stay on institutional record for accreditation purposes — this cannot be undone by you.',
        { danger: true, okText: 'Confirm' }
      );
      if (!confirmed) return;
      confirmDeleteAccountBtn.disabled = true;
      try {
        await api.deleteMyAccount(lastDay, 'Self-service account deletion');
      } catch (err) {
        showError(deleteAccountError, friendlyErrorMessage(err, 'Could not delete your account. Please try again.'));
        confirmDeleteAccountBtn.disabled = false;
        return;
      }
      closeDeleteAccountModal();
      if (isFuture) {
        await showAppAlert(`Your account is scheduled to be deactivated after ${lastDay}. You can keep using it normally until then.`);
      } else {
        api.setTokens(null);
        window.location.reload();
      }
      confirmDeleteAccountBtn.disabled = false;
    });
  }

  document.addEventListener('faems:authenticated', (e) => updateHeaderForUser(e.detail));

  // A page reload with a still-valid session (tokens in sessionStorage but
  // window.FAEMS_CURRENT_USER not yet set this load) should restore the
  // signed-in header state rather than showing "Faculty Login" while
  // actually still authenticated.
  if (api.isAuthenticated()) {
    api.me().then(user => {
      window.FAEMS_CURRENT_USER = user;
      updateHeaderForUser(user);
      unlockLoginGate();
      // enterPortal() (fresh in-page login) dispatches this; a page
      // reload with a still-valid session restores the same
      // window.FAEMS_CURRENT_USER through this separate path and needs
      // to fire it too — every role-conditional bit of UI that only
      // reacts to this event (the HOD-only Active/Non-active roster
      // toggle, among others) would otherwise stay stuck in its
      // logged-out state until something else happened to touch it.
      document.dispatchEvent(new CustomEvent('faems:authenticated', { detail: user }));
    }).catch(() => {
      // Saved token is stale/invalid (expired, revoked, wrong signing key
      // after a redeploy, etc.) — the optimistic early-unlock in
      // index.html's <head> was wrong, so undo it: drop the dead token and
      // re-lock behind the login modal instead of leaving a blank page.
      api.setTokens(null);
      document.documentElement.classList.add('faems-gate-locked');
      const loginModal = document.getElementById('loginModal');
      if (loginModal) loginModal.classList.add('open');
    });
  }
}

/* ==========================================================================
   11. Footer Newsletter / Search Submission
   ========================================================================== */
function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  const input = document.getElementById('newsletterInput');
  const status = document.getElementById('newsletterStatus');

  if (!form || !input || !status) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = input.value.trim();
    if (!val) return;

    status.style.color = '#6FD8F2';
    status.textContent = `✓ Query for "${val}" recorded. Locating verified accreditation files...`;
    input.value = '';

    setTimeout(() => {
      status.textContent = '';
    }, 4000);
  });
}

/* ==========================================================================
   12. Achievement Submission Form Controller (Horizontal 6-Step Workflow)
   Seed data schema for configurable administrative evaluation rules.
   No raw code IDs or marks/scores are ever visible in the faculty UI.
   ========================================================================== */
// Original hand-authored demo data — kept as an offline fallback so the
// page still shows a populated form if the backend is unreachable. It is
// overwritten with real data from Postgres by buildRealSubmissionConfig()
// below, which runs once at page load before the form initializes.
window.FAAEMS_SUBMISSION_CONFIG_DEMO_FALLBACK = {
  departments: [
    {
      id: 'comp',
      name: 'B.E. Computer Engineering',
      faculty: [
        'Dr. Sunita Deshmukh (Professor & HOD)',
        'Dr. Rajesh M. Bodade (Professor)',
        'Prof. Varsha H. Jadhav (Associate Professor)',
        'Prof. Sachin B. Gade (Assistant Professor)'
      ]
    },
    {
      id: 'it',
      name: 'B.E. Information Technology',
      faculty: [
        'Dr. Pravin R. Joshi (Professor & HOD)',
        'Prof. Anjali D. Patil (Associate Professor)',
        'Prof. Mahesh N. Shinde (Assistant Professor)',
        'Prof. Sneha Kadam (Associate Professor)'
      ]
    },
    {
      id: 'etc',
      name: 'B.E. Electronics & Tele-Communication',
      faculty: [
        'Dr. Meenakshi S. Patil (Professor & HOD)',
        'Dr. Sanjay L. Nalbalwar (Professor)',
        'Prof. Nilesh S. Jagtap (Associate Professor)',
        'Prof. Devendra Singh (Associate Professor)'
      ]
    },
    {
      id: 'ecs',
      name: 'B.E - Electronics and Computer Science',
      faculty: [
        'Dr. Shailendra K. Pawar (Professor & HOD)',
        'Prof. Vandana M. Sawant (Associate Professor)',
        'Prof. Kunal R. More (Assistant Professor)'
      ]
    },
    {
      id: 'mech',
      name: 'B.E - Mechanical Engineering',
      faculty: [
        'Dr. Rajeshwar S. More (Professor & HOD)',
        'Prof. Kiran S. Sanap (Associate Professor)',
        'Prof. Vinod N. Surange (Assistant Professor)'
      ]
    },
    {
      id: 'civil',
      name: 'B.E. Civil Engineering',
      faculty: [
        'Dr. Anand S. Joshi (Professor & HOD)',
        'Prof. Pradeep K. More (Associate Professor)',
        'Prof. Pooja Bhatt (Assistant Professor)'
      ]
    },
    {
      id: 'csecs',
      name: 'B.E. Computer Science and Engineering (Cyber Security)',
      faculty: [
        'Dr. Vikramaditya Rathore (Professor & HOD)',
        'Prof. Alok S. Dixit (Associate Professor)',
        'Prof. Tanvi Rao (Associate Professor)'
      ]
    },
    {
      id: 'mme',
      name: 'B.E. Mechanical and Mechatronics Engineering (Additive Manufacturing)',
      faculty: [
        'Dr. Anand K. Bhosale (Professor & HOD)',
        'Dr. Sunil S. Dingare (Professor)',
        'Prof. Vishal Jadhav (Assistant Professor)'
      ]
    },
    {
      id: 'aiml',
      name: 'B.Tech – Artificial Intelligence & Machine Learning',
      faculty: [
        'Dr. Shiwani Gupta (Professor & HOD)',
        'Mrs. Pranjali Sankhe (Assistant Professor)',
        'Dr. Vivek S. Patil (Associate Professor)',
        'Prof. Amit Kumar (Associate Professor)',
        'Dr. Nidhi Sharma (Assistant Professor)'
      ]
    },
    {
      id: 'aids',
      name: 'B.Tech – Artificial Intelligence & Data Science',
      faculty: [
        'Dr. Ramesh V. Kulkarni (Professor & HOD)',
        'Prof. Sandeep K. More (Associate Professor)',
        'Prof. Kirti D. Bhave (Assistant Professor)',
        'Dr. Ananya Sen (Associate Professor)'
      ]
    },
    {
      id: 'cseiot',
      name: 'B.Tech – Computer Science and Engineering (IoT)',
      faculty: [
        'Dr. Hemant K. Shinde (Professor & HOD)',
        'Prof. Shilpa M. Verma (Associate Professor)',
        'Prof. Deepak R. Joshi (Assistant Professor)'
      ]
    }
  ],

  criteria: [
    {
      id: '6.1',
      title: 'Professional Development Activities',
      subPoints: [
        {
          id: '6.1.1',
          title: 'Memberships in Professional Societies at National/International Levels',
          hasFurther: false
        },
        {
          id: '6.1.2',
          title: 'Faculty as Resource Persons or Participants in STTPs/FDPs',
          hasFurther: true,
          isTieredLevel: true,
          level1: [
            {
              id: '6.1.2.1',
              title: 'Faculty as Resource Persons in STTPs/FDPs',
              level2: [
                'More than 3 faculty members from the department served as resource persons',
                'More than 2 and less than 3 faculty members from the department served as resource persons'
              ]
            },
            {
              id: '6.1.2.2',
              title: "Faculty Members' Participation in STTPs/FDPs",
              level2: [
                'Participated in a 2 to 5 day Faculty Development Program',
                'Participated in a Faculty Development Program longer than 5 days'
              ]
            }
          ]
        },
        {
          id: '6.1.3',
          title: 'Faculty Contribution in Development of SWAYAM MOOCs and other E-Content',
          hasFurther: true,
          furtherOptions: [
            'Faculty member(s) involvement in developing SWAYAM MOOCs',
            'Involvement of faculty members in developing E-Content'
          ]
        },
        {
          id: '6.1.4',
          title: 'Faculty Certification of MOOCs through SWAYAM, etc.',
          hasFurther: false
        },
        {
          id: '6.1.5',
          title: 'FDP/STTP Organized by Department',
          hasFurther: false
        },
        {
          id: '6.1.6',
          title: 'Faculty Support in Student Innovative Projects',
          hasFurther: false
        },
        {
          id: '6.1.7',
          title: 'Faculty Internship/Training/Collaboration with Industry',
          hasFurther: false
        }
      ]
    },
    {
      id: '6.2',
      title: 'Research and Development Activities',
      subPoints: [
        {
          id: '6.2.1',
          title: 'Academic Research',
          hasFurther: true,
          furtherOptions: [
            'Number of Publications',
            'Quality of Publications'
          ]
        },
        {
          id: '6.2.2',
          title: 'Ph.D. Student Details',
          hasFurther: true,
          furtherOptions: [
            'Number of students enrolled for Ph.D. degree in the department during the assessment period',
            'Number of Ph.D. students graduated in the department during the assessment period'
          ]
        },
        {
          id: '6.2.3',
          title: 'Development Activities',
          hasFurther: true,
          furtherOptions: [
            'Patents granted during the assessment period',
            'Patents published during the assessment period',
            'Working models and prototypes developed during the assessment period'
          ]
        },
        {
          id: '6.2.4',
          title: 'Sponsored Research Project',
          hasFurther: false
        },
        {
          id: '6.2.5',
          title: 'Consultancy Work',
          hasFurther: false
        },
        {
          id: '6.2.6',
          title: 'Institution Seed Money or Internal Research Grant to its Faculty for Research Work',
          hasFurther: true,
          furtherOptions: [
            'Amount received',
            'Amount utilized'
          ]
        }
      ]
    }
  ],

  years: ['2025-2026', '2026-2027']
};

window.FAAEMS_SUBMISSION_CONFIG = window.FAAEMS_SUBMISSION_CONFIG_DEMO_FALLBACK;

// Resolves the display strings the form works with back to real database
// IDs at submit time, so the tested cascading-dropdown logic above (which
// reads titles/descriptions, never IDs) doesn't need to change.
window.FAEMS_LOOKUP = {
  facultyIdByName: {},
  subCriterionIdByText: {},
  cycleIdByLabel: {},
};

// Replaces the static demo config with real departments/faculty/cycles/
// criteria fetched from the Django API, in the exact shape
// populateFaculties/populateCriteria/updateSubPoints/updateFurtherOptions/
// updateFurtherContd already expect. Runs once, before the form is
// initialized, so it never has to re-render an already-populated form.
async function buildRealSubmissionConfig() {
  const api = window.FaemsAPI;
  if (!api) return false;

  try {
    const [deptsRes, cyclesRes, topLevelRes] = await Promise.all([
      api.listDepartments(),
      api.listCycles(),
      api.topLevelCriteria(),
    ]);
    const departmentRows = deptsRes.results || deptsRes;
    const cycleRows = cyclesRes.results || cyclesRes;
    const topNodes = topLevelRes.results || topLevelRes;

    // Faculty roster is personal data, so it's only fetched (and only
    // exists to fetch) once the visitor is logged in; the backend already
    // scopes the result to self / department / everyone by role.
    let facultyRows = [];
    if (api.isAuthenticated()) {
      const facRes = await api.listFaculty({ page_size: 200 });
      facultyRows = facRes.results || facRes;
    }

    const lookup = { facultyIdByName: {}, subCriterionIdByText: {}, cycleIdByLabel: {}, cycleCanRemoveByLabel: {} };
    cycleRows.forEach(c => {
      lookup.cycleIdByLabel[c.label] = c.id;
      lookup.cycleCanRemoveByLabel[c.label] = !!c.can_remove;
    });

    const departments = departmentRows.map(d => {
      const rows = facultyRows.filter(f => f.department === d.id);
      rows.forEach(f => { lookup.facultyIdByName[f.full_name] = f.id; });
      return { id: d.code, name: d.name, faculty: rows.map(f => f.full_name) };
    });

    // Walks one SubCriterion node's children to build the same
    // hasFurther / furtherOptions / isTieredLevel+level1 shape the static
    // demo config used, discovering tiering (grandchildren) as it goes.
    async function buildSubPoint(node) {
      lookup.subCriterionIdByText[node.description] = node.id;
      const childRes = await api.childrenOf(node.id);
      const children = childRes.results || childRes;
      if (children.length === 0) {
        return { id: node.code, title: node.description, hasFurther: false };
      }
      children.forEach(c => { lookup.subCriterionIdByText[c.description] = c.id; });
      const grandchildLists = await Promise.all(
        children.map(c => api.childrenOf(c.id).then(r => r.results || r))
      );
      const isTiered = grandchildLists.some(g => g.length > 0);

      if (isTiered) {
        return {
          id: node.code,
          title: node.description,
          hasFurther: true,
          isTieredLevel: true,
          level1: children.map((c, i) => {
            grandchildLists[i].forEach(g => { lookup.subCriterionIdByText[g.description] = g.id; });
            return { id: c.code, title: c.description, level2: grandchildLists[i].map(g => g.description) };
          }),
        };
      }
      return {
        id: node.code,
        title: node.description,
        hasFurther: true,
        furtherOptions: children.map(c => c.description),
      };
    }

    const criteria = [];
    for (const top of topNodes) {
      const subRes = await api.childrenOf(top.id);
      const subs = subRes.results || subRes;
      const subPoints = [];
      for (const sp of subs) {
        subPoints.push(await buildSubPoint(sp));
      }
      criteria.push({ id: top.code, title: top.description, subPoints });
    }

    window.FAEMS_LOOKUP = lookup;
    window.FAAEMS_SUBMISSION_CONFIG = {
      departments,
      criteria,
      years: cycleRows.map(c => c.label),
    };
    return true;
  } catch (err) {
    console.error('Live criteria/department data unavailable — showing offline demo data instead.', err);
    return false;
  }
}

function initAchievementSubmissionForm() {
  const formCard = document.getElementById('achievementSubmissionCard');
  if (!formCard) return;

  const facultySelect = document.getElementById('stepFacultySelect');
  const criterionSelect = document.getElementById('stepCriterionSelect');
  const subPointSelect = document.getElementById('stepSubPointSelect');
  const yearSelect = document.getElementById('stepYearSelect');
  const deleteYearBtn = document.getElementById('deleteYearBtn');
  const furtherSelect = document.getElementById('stepFurtherSelect');
  const furtherContdSelect = document.getElementById('stepFurtherContdSelect');
  const colFurtherContd = document.getElementById('colFurtherContd');

  const dropzone = document.getElementById('fileDropzone');
  const fileInput = document.getElementById('evidenceFileInput');
  const filesContainer = document.getElementById('attachedFilesContainer');
  const filesList = document.getElementById('attachedFilesList');
  const filesCount = document.getElementById('attachedFilesCount');
  const addMoreBtn = document.getElementById('addMoreFilesBtn');

  const submitBtn = document.getElementById('submitForReviewBtn');
  const resetBtn = document.getElementById('resetSubmissionBtn');

  const successModal = document.getElementById('submissionSuccessModal');
  const successRefId = document.getElementById('successRefId');
  const successTable = document.getElementById('successSummaryTable');
  const successDoneBtn = document.getElementById('successModalDoneBtn');
  const successCloseBtn = document.getElementById('closeSubmissionSuccessModal');

  // Form State initialized to Image 2 visual defaults
  const state = {
    facultyName: 'Guest Faculty',
    criterionId: '6.1',
    criterionTitle: 'Professional Development Activities',
    subPointId: '6.1.2',
    subPointTitle: 'Faculty as Resource Persons or Participants in STTPs/FDPs',
    year: '2026-2027',
    furtherLevel1: 'Faculty as Resource Persons in STTPs/FDPs',
    furtherLevel2: 'More than 3 faculty members from the department served as resource persons',
    files: []
  };

  // You can only ever submit an achievement under your own faculty profile
  // (the backend rejects anything else — see AchievementViewSet.perform_create),
  // so this field is just a locked display of who you're signed in as, not
  // a picker over every other department's roster.
  function populateFaculties() {
    if (!facultySelect) return;
    const name = (window.FAEMS_CURRENT_USER && window.FAEMS_CURRENT_USER.full_name) || 'Guest Faculty';
    facultySelect.innerHTML = `<option value="${escapeHtml(name)}" selected>${escapeHtml(name)}</option>`;
    facultySelect.disabled = true;
    state.facultyName = name;
  }

  // Populate Top-Level Criteria
  function populateCriteria() {
    if (!criterionSelect) return;
    criterionSelect.innerHTML = '';
    window.FAAEMS_SUBMISSION_CONFIG.criteria.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.title;
      if (c.id === '6.1') opt.selected = true;
      criterionSelect.appendChild(opt);
    });
  }

  // Populate the Year dropdown from the live cycle list (falls back to the
  // static demo years when offline), keeping 2026-2027 — the current
  // academic year — selected by default unless the caller already picked
  // something else. Always ends with the "+ Add Year..." sentinel option,
  // which the change handler below intercepts rather than treating as a
  // real year.
  function populateYears(preserveSelection) {
    if (!yearSelect) return;
    const previous = preserveSelection ? state.year : null;
    const years = (window.FAAEMS_SUBMISSION_CONFIG.years || []).slice();
    yearSelect.innerHTML = '';
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      // A year only you added shows that right in the list, so it's clear
      // at a glance which years can be removed (via the "Remove this
      // year" link below, once selected) without having to click through
      // each one — the institution's default years never get this suffix.
      const removable = window.FAEMS_LOOKUP && window.FAEMS_LOOKUP.cycleCanRemoveByLabel
        ? !!window.FAEMS_LOOKUP.cycleCanRemoveByLabel[y]
        : false;
      opt.textContent = removable ? `${y} (added by you — removable)` : y;
      yearSelect.appendChild(opt);
    });
    const addOpt = document.createElement('option');
    addOpt.value = '__add_year__';
    addOpt.textContent = '+ Add Year…';
    yearSelect.appendChild(addOpt);

    const fallback = years.includes('2026-2027') ? '2026-2027' : years[years.length - 1];
    const target = previous && years.includes(previous) ? previous : fallback;
    if (target) {
      yearSelect.value = target;
      state.year = target;
    }
    updateDeleteYearBtn();
  }

  // Only a year the signed-in faculty added themselves (server-reported
  // can_remove — see CycleViewSet.remove_mine) ever shows the "Remove this
  // year" link; the institution's default years never do.
  function updateDeleteYearBtn() {
    if (!deleteYearBtn) return;
    const canRemove = window.FAEMS_LOOKUP && window.FAEMS_LOOKUP.cycleCanRemoveByLabel
      ? !!window.FAEMS_LOOKUP.cycleCanRemoveByLabel[state.year]
      : false;
    deleteYearBtn.style.display = canRemove ? '' : 'none';
  }

  if (deleteYearBtn) {
    deleteYearBtn.addEventListener('click', async () => {
      const year = state.year;
      const cycleId = window.FAEMS_LOOKUP && window.FAEMS_LOOKUP.cycleIdByLabel[year];
      if (!cycleId) return;
      const confirmed = await showAppConfirm(
        `Remove ${year} from your Year list? This also permanently deletes any of your own achievement submissions and attachments filed under ${year}. This cannot be undone, and other faculty are not affected.`,
        { title: 'Remove Academic Year', okText: 'Remove Year', danger: true }
      );
      if (!confirmed) return;
      deleteYearBtn.disabled = true;
      try {
        const api = window.FaemsAPI;
        await api.removeCycle(cycleId);
        window.FAAEMS_SUBMISSION_CONFIG.years = (window.FAAEMS_SUBMISSION_CONFIG.years || []).filter(y => y !== year);
        delete window.FAEMS_LOOKUP.cycleCanRemoveByLabel[year];
        state.year = '';
        populateYears(false);
        showToastNotification(`Removed ${year} and your submissions under it.`, 'success');
      } catch (err) {
        showToastNotification(err.message || 'Could not remove this year. Please try again.', 'error');
      } finally {
        deleteYearBtn.disabled = false;
      }
    });
  }

  // Populate Sub-points based on selected Criterion
  function updateSubPoints() {
    if (!subPointSelect) return;
    const critId = criterionSelect ? criterionSelect.value : '6.1';
    const critObj = window.FAAEMS_SUBMISSION_CONFIG.criteria.find(c => c.id === critId);

    subPointSelect.innerHTML = '';
    if (critObj && critObj.subPoints) {
      critObj.subPoints.forEach((sp, idx) => {
        const opt = document.createElement('option');
        opt.value = sp.id;
        opt.textContent = sp.title;
        if (critId === '6.1' && sp.id === '6.1.2') {
          opt.selected = true;
        } else if (idx === 0 && critId !== '6.1') {
          opt.selected = true;
        }
        subPointSelect.appendChild(opt);
      });
    }

    state.criterionId = critId;
    state.criterionTitle = critObj ? critObj.title : '';
    state.subPointId = subPointSelect.value;
    const currentSp = critObj ? critObj.subPoints.find(s => s.id === state.subPointId) : null;
    state.subPointTitle = currentSp ? currentSp.title : '';

    updateFurtherOptions();
  }

  // Populate Further Sub-Point & Further Sub-Point (Contd.)
  function updateFurtherOptions() {
    const critId = criterionSelect ? criterionSelect.value : '6.1';
    const subId = subPointSelect ? subPointSelect.value : '6.1.2';
    const critObj = window.FAAEMS_SUBMISSION_CONFIG.criteria.find(c => c.id === critId);
    const spObj = critObj ? critObj.subPoints.find(sp => sp.id === subId) : null;

    if (!spObj || !spObj.hasFurther) {
      if (furtherSelect) {
        furtherSelect.innerHTML = '<option value="" disabled selected>Not Applicable (N/A)</option>';
        furtherSelect.disabled = true;
      }
      if (furtherContdSelect) {
        furtherContdSelect.innerHTML = '<option value="" disabled selected>Not Applicable (N/A)</option>';
        furtherContdSelect.disabled = true;
      }
      if (colFurtherContd) colFurtherContd.classList.remove('active-highlight');
      state.furtherLevel1 = 'Not applicable';
      state.furtherLevel2 = '';
      updateTrack(50);
      return;
    }

    if (spObj.isTieredLevel && spObj.level1) {
      if (furtherSelect) {
        furtherSelect.disabled = false;
        furtherSelect.innerHTML = '';
        spObj.level1.forEach((l1, idx) => {
          const opt = document.createElement('option');
          opt.value = l1.title;
          opt.textContent = l1.title;
          if (idx === 0) opt.selected = true;
          furtherSelect.appendChild(opt);
        });
      }
      updateFurtherContd();
    } else if (spObj.furtherOptions) {
      if (furtherSelect) {
        furtherSelect.disabled = false;
        furtherSelect.innerHTML = '';
        spObj.furtherOptions.forEach((fo, idx) => {
          const opt = document.createElement('option');
          opt.value = fo;
          opt.textContent = fo;
          if (idx === 0) opt.selected = true;
          furtherSelect.appendChild(opt);
        });
      }

      if (furtherContdSelect) {
        furtherContdSelect.innerHTML = '<option value="" disabled selected>Not Applicable (N/A)</option>';
        furtherContdSelect.disabled = true;
      }
      if (colFurtherContd) colFurtherContd.classList.remove('active-highlight');
      state.furtherLevel1 = furtherSelect ? furtherSelect.value : '';
      state.furtherLevel2 = '';
      updateTrack(75);
    }
  }

  function updateFurtherContd() {
    const critId = criterionSelect ? criterionSelect.value : '6.1';
    const subId = subPointSelect ? subPointSelect.value : '6.1.2';
    const critObj = window.FAAEMS_SUBMISSION_CONFIG.criteria.find(c => c.id === critId);
    const spObj = critObj ? critObj.subPoints.find(sp => sp.id === subId) : null;

    if (!spObj || !spObj.isTieredLevel || !spObj.level1) return;

    const selectedL1Title = furtherSelect ? furtherSelect.value : '';
    const l1Obj = spObj.level1.find(l => l.title === selectedL1Title) || spObj.level1[0];

    if (l1Obj && l1Obj.level2) {
      if (furtherContdSelect) {
        furtherContdSelect.disabled = false;
        furtherContdSelect.innerHTML = '';
        l1Obj.level2.forEach((l2, idx) => {
          const opt = document.createElement('option');
          opt.value = l2;
          opt.textContent = l2;
          if (idx === 0) opt.selected = true;
          furtherContdSelect.appendChild(opt);
        });
      }

      if (colFurtherContd) colFurtherContd.classList.add('active-highlight');
      state.furtherLevel1 = selectedL1Title;
      state.furtherLevel2 = furtherContdSelect ? furtherContdSelect.value : '';
      updateTrack(95);
    } else {
      if (furtherContdSelect) {
        furtherContdSelect.innerHTML = '<option value="" disabled selected>Not Applicable (N/A)</option>';
        furtherContdSelect.disabled = true;
      }
      if (colFurtherContd) colFurtherContd.classList.remove('active-highlight');
      state.furtherLevel1 = selectedL1Title;
      state.furtherLevel2 = '';
      updateTrack(75);
    }
  }

  function updateTrack(pct) {
    // Slider track removed as requested
  }

  // Event Listeners for Dropdowns
  if (facultySelect) {
    facultySelect.addEventListener('change', () => {
      state.facultyName = facultySelect.value;
    });
  }

  if (criterionSelect) {
    criterionSelect.addEventListener('change', () => {
      updateSubPoints();
    });
  }

  if (subPointSelect) {
    subPointSelect.addEventListener('change', () => {
      const critId = criterionSelect.value;
      const critObj = window.FAAEMS_SUBMISSION_CONFIG.criteria.find(c => c.id === critId);
      state.subPointId = subPointSelect.value;
      const currentSp = critObj ? critObj.subPoints.find(s => s.id === state.subPointId) : null;
      state.subPointTitle = currentSp ? currentSp.title : '';
      updateFurtherOptions();
    });
  }

  if (yearSelect) {
    yearSelect.addEventListener('change', async () => {
      if (yearSelect.value !== '__add_year__') {
        state.year = yearSelect.value;
        updateDeleteYearBtn();
        return;
      }
      // "+ Add Year..." picked: create the next academic year on the
      // backend (scoped to this faculty's own visible years — see
      // CycleViewSet.add_next), add it to the dropdown, but per spec do
      // NOT auto-select it — restore whatever year was previously chosen.
      const previousYear = state.year;
      yearSelect.disabled = true;
      try {
        const api = window.FaemsAPI;
        const cycle = await api.addNextCycle();
        window.FAEMS_LOOKUP = window.FAEMS_LOOKUP || { cycleIdByLabel: {}, cycleCanRemoveByLabel: {} };
        window.FAEMS_LOOKUP.cycleIdByLabel[cycle.label] = cycle.id;
        window.FAEMS_LOOKUP.cycleCanRemoveByLabel[cycle.label] = !!cycle.can_remove;
        if (!window.FAAEMS_SUBMISSION_CONFIG.years.includes(cycle.label)) {
          window.FAAEMS_SUBMISSION_CONFIG.years.push(cycle.label);
        }
        populateYears(true);
        showToastNotification(`Added ${cycle.label} to your Year dropdown. Other faculty won't see it unless they add it too.`, 'success');
      } catch (err) {
        yearSelect.value = previousYear;
        state.year = previousYear;
        showToastNotification(err.message || 'Could not add a new year. Please try again.', 'error');
      } finally {
        yearSelect.disabled = false;
      }
    });
  }

  if (furtherSelect) {
    furtherSelect.addEventListener('change', () => {
      updateFurtherContd();
    });
  }

  if (furtherContdSelect) {
    furtherContdSelect.addEventListener('change', () => {
      state.furtherLevel2 = furtherContdSelect.value;
    });
  }

  // Attachments Handling
  function renderAttachedFiles() {
    if (!filesList || !filesContainer || !filesCount) return;

    filesCount.textContent = state.files.length;

    if (state.files.length === 0) {
      filesContainer.style.display = 'none';
      filesList.innerHTML = '';
    } else {
      filesContainer.style.display = 'block';
      filesList.innerHTML = '';

      state.files.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'file-item-card';

        const sizeFormatted = file.size > 1024 * 1024 
          ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
          : Math.max(1, Math.round(file.size / 1024)) + ' KB';

        item.innerHTML = `
          <div class="file-info-group">
            <div class="file-icon-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div class="file-name-block">
              <div class="file-name-text" title="${file.name}">${file.name}</div>
              <span class="file-size-badge">${sizeFormatted}</span>
            </div>
          </div>
          <button type="button" class="file-remove-btn" data-index="${index}" title="Remove file">&times;</button>
        `;
        filesList.appendChild(item);
      });

      filesList.querySelectorAll('.file-remove-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          state.files.splice(idx, 1);
          renderAttachedFiles();
        });
      });
    }
  }

  function handleFilesAdded(newFiles) {
    if (!newFiles || newFiles.length === 0) return;
    Array.from(newFiles).forEach(f => {
      const exists = state.files.some(existing => existing.name === f.name && existing.size === f.size);
      if (!exists) {
        state.files.push(f);
      }
    });
    renderAttachedFiles();
  }

  if (dropzone) {
    dropzone.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer && e.dataTransfer.files) {
        handleFilesAdded(e.dataTransfer.files);
      }
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      handleFilesAdded(e.target.files);
      fileInput.value = '';
    });
  }

  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fileInput) fileInput.click();
    });
  }

  // Submit for Review — creates the Achievement, uploads each attached
  // file as evidence, then submits it, all against the real backend.
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const api = window.FaemsAPI;
      if (!api || !api.isAuthenticated()) {
        await showAppAlert('Please sign in before submitting an achievement for review.');
        const loginModal = document.getElementById('loginModal');
        if (loginModal) loginModal.classList.add('open');
        return;
      }
      if (!state.facultyName) {
        await showAppAlert('Please select a Faculty Name.');
        if (facultySelect) facultySelect.focus();
        return;
      }
      if (!state.criterionTitle) {
        await showAppAlert('Please select a Top-Level Criterion.');
        if (criterionSelect) criterionSelect.focus();
        return;
      }
      if (!state.subPointTitle) {
        await showAppAlert('Please select a Sub-Point.');
        if (subPointSelect) subPointSelect.focus();
        return;
      }
      if (!state.year) {
        await showAppAlert('Please select an Assessment Year.');
        if (yearSelect) yearSelect.focus();
        return;
      }
      if (state.files.length === 0) {
        await showAppAlert('Please attach at least one supporting document before submitting for review.');
        if (dropzone) dropzone.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      const lookup = window.FAEMS_LOOKUP || {};
      const facultyId = lookup.facultyIdByName ? lookup.facultyIdByName[state.facultyName] : undefined;
      const cycleId = lookup.cycleIdByLabel ? lookup.cycleIdByLabel[state.year] : undefined;
      const subCriterionText = state.furtherLevel2 || state.furtherLevel1 || state.subPointTitle;
      const subCriterionId = lookup.subCriterionIdByText ? lookup.subCriterionIdByText[subCriterionText] : undefined;

      if (!facultyId || !cycleId || !subCriterionId) {
        await showAppAlert('Live criteria/department data could not be loaded from the server, so this cannot be submitted right now. Please refresh the page and try again once the backend is reachable.');
        return;
      }

      const furtherDetail = state.furtherLevel2
        ? `${state.furtherLevel1} → ${state.furtherLevel2}`
        : (state.furtherLevel1 || 'Direct evaluation');

      const record = {
        refId: '',
        date: new Date().toLocaleString(),
        faculty: state.facultyName,
        criterion: state.criterionTitle,
        subPoint: state.subPointTitle,
        year: state.year,
        furtherDetails: furtherDetail,
        files: state.files.map(f => f.name),
        status: 'Submitted — Pending HOD Review',
      };

      const originalBtnText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';

      let achievement;
      let submittedAchievement;
      try {
        achievement = await api.createAchievement({
          faculty: facultyId,
          cycle: cycleId,
          sub_criterion: subCriterionId,
          title: state.subPointTitle,
          description: furtherDetail,
        });
        // Each file upload triggers server-side OCR, so with several
        // attachments this can take a real, noticeable amount of time —
        // showing which file is currently uploading (instead of a static
        // "Submitting…" the whole way through) is what tells the person
        // it's still working rather than frozen.
        for (let i = 0; i < state.files.length; i++) {
          if (state.files.length > 1) {
            submitBtn.textContent = `Uploading file ${i + 1} of ${state.files.length}…`;
          }
          await api.uploadEvidence(achievement.id, state.files[i]);
        }
        submitBtn.textContent = 'Submitting…';
        submittedAchievement = await api.submitForReview(achievement.id);
      } catch (err) {
        console.error('Submission failed:', err);
        await showAppAlert(`Submission failed: ${err.message || 'Please try again.'}`);
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
        return;
      }

      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
      record.refId = achievement.evidence_id;
      // HOD submitting their own achievement auto-verifies on submit (no
      // review step exists for it — see AchievementViewSet.submit) — the
      // success modal has to reflect whatever the server actually did,
      // not always claim it was queued for review.
      const isAutoVerified = submittedAchievement && submittedAchievement.status === 'verified';
      record.status = isAutoVerified ? 'Verified' : 'Not Verified';
      const successModalTitle = document.getElementById('successModalTitle');
      const successModalSubtitle = document.getElementById('successModalSubtitle');
      if (successModalTitle) successModalTitle.textContent = isAutoVerified ? 'Record Verified' : 'Record Submitted for Review';
      if (successModalSubtitle) {
        successModalSubtitle.textContent = 'Your achievement record has been cryptographically logged.';
      }

      // Clear the form the instant the submission actually succeeds, not
      // only when the success modal's "Done" button is clicked — leaving
      // the same attached files and selections sitting there (e.g. if
      // someone dismisses the modal with × instead) made it possible to
      // accidentally hit "Submit for Review" again and create a real
      // duplicate submission.
      resetForm();
      // The leaderboard and directory only ever refetch on their own page
      // load or from dossier actions — a fresh submission from this wizard
      // never told them anything changed, so the new record's counts sat
      // stale until a full reload.
      document.dispatchEvent(new CustomEvent('faems:achievementsChanged'));

      if (successRefId) successRefId.textContent = record.refId;
      if (successTable) {
        successTable.innerHTML = `
          <div class="submission-detail-row">
            <span class="detail-row-label">Faculty Name:</span>
            <span class="detail-row-value">${record.faculty}</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Top Criterion:</span>
            <span class="detail-row-value">${record.criterion}</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Sub-Point:</span>
            <span class="detail-row-value">${record.subPoint}</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Assessment Year:</span>
            <span class="detail-row-value">${record.year}</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Specific Detail:</span>
            <span class="detail-row-value">${record.furtherDetails}</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Attachments:</span>
            <span class="detail-row-value">${record.files.length} document(s) (${record.files.join(', ')})</span>
          </div>
          <div class="submission-detail-row">
            <span class="detail-row-label">Workflow Status:</span>
            <span class="detail-row-value" style="color:#059669;font-weight:700;">${record.status}</span>
          </div>
        `;
      }

      if (successModal) {
        successModal.classList.add('open');
      }
    });
  }

  // Start Over / Reset Function
  function resetForm() {
    populateFaculties();
    populateCriteria();
    updateSubPoints();
    populateYears(false);
    state.files = [];
    renderAttachedFiles();
    updateTrack(35);
  }

  if (resetBtn) resetBtn.addEventListener('click', resetForm);
  if (successDoneBtn) {
    successDoneBtn.addEventListener('click', () => {
      if (successModal) successModal.classList.remove('open');
      resetForm();
    });
  }
  if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
      if (successModal) successModal.classList.remove('open');
    });
  }

  // Initial Setup
  populateFaculties();
  populateCriteria();
  updateSubPoints();
  populateYears(false);
  updateTrack(35);

  // The faculty roster is only fetched once the visitor is authenticated
  // (it's personal data — see buildRealSubmissionConfig), so re-fetch and
  // re-render the faculty dropdown right after a successful login.
  document.addEventListener('faems:authenticated', async () => {
    const refreshed = await buildRealSubmissionConfig();
    if (refreshed) {
      populateFaculties();
      populateYears(true);
    }
  });

  // The Faculty Name field here is a locked display of the signed-in user
  // (see populateFaculties above) — if they just renamed themselves via
  // "Update Details", window.FAEMS_CURRENT_USER.full_name is already fresh
  // by the time this fires, so just re-render the field from it.
  document.addEventListener('faems:facultyProfileUpdated', () => populateFaculties());
}
