/* ==========================================================================
   FAEMS API client, plain fetch, no build step. Loaded before app.js and
   exposes window.FaemsAPI. Talks to the same Django/DRF backend the React
   admin app uses (Postgres-backed, MinIO for files, JWT auth).
   ========================================================================== */
(function () {
  const BASE = window.FAEMS_API_BASE || "http://localhost:8010/api";
  const TOKEN_KEY = "faems.tokens";

  // sessionStorage, not localStorage: localStorage is shared across every
  // tab of this origin, so logging into a second account in one tab
  // silently swaps the session for every other open tab too (e.g. testing
  // as HOD in one tab and faculty in another, the second login clobbers
  // the first tab's auth without it reloading, which looks like a broken
  // permission check when it's really two tabs fighting over one shared
  // token). sessionStorage is per-tab, so each tab keeps its own login.
  // Trade-off: closing a tab ends that tab's session (reopening the same
  // URL in a fresh tab requires signing in again); a duplicated tab
  // inherits its session as normal.
  function getTokens() {
    try {
      return JSON.parse(sessionStorage.getItem(TOKEN_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setTokens(tokens) {
    if (tokens) sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
    else sessionStorage.removeItem(TOKEN_KEY);
  }

  // The backend rotates + blacklists the refresh token on every use
  // (SIMPLE_JWT ROTATE_REFRESH_TOKENS/BLACKLIST_AFTER_ROTATION), so two
  // things matter here: (1) the *new* rotated refresh token from the
  // response has to replace the old one in storage, or the very next
  // refresh reuses an already-blacklisted token and fails; (2) several
  // requests can 401 at once (e.g. the parallel Promise.all in
  // buildRealSubmissionConfig on page load) and each would otherwise fire
  // its own refresh, only the first can win against the one-time-use
  // refresh token, so concurrent callers share one in-flight promise
  // instead of racing.
  let refreshInFlight = null;

  async function refreshAccessToken() {
    if (refreshInFlight) return refreshInFlight;
    const tokens = getTokens();
    if (!tokens || !tokens.refresh) throw new Error("No refresh token");
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: tokens.refresh }),
        });
        if (!res.ok) throw new Error("Refresh failed");
        const data = await res.json();
        const updated = { ...tokens, access: data.access, refresh: data.refresh || tokens.refresh };
        setTokens(updated);
        return updated;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  // DRF validation errors normally come back as {"field_name": ["message",
  // ...], ...} rather than {"detail": "message"}, falling back to
  // JSON.stringify(data) for anything without a `detail` key meant a form
  // error like {"new_password": ["too common"]} showed up as the literal
  // raw JSON (braces, quotes, "correlation_id" and all) in the UI instead
  // of the actual sentence. This flattens whichever shape it gets into one
  // readable message.
  function extractErrorMessage(data) {
    if (!data) return null;
    if (typeof data === "string") return data;
    if (data.detail) return data.detail;
    const messages = Object.entries(data)
      .filter(([key]) => key !== "correlation_id")
      .flatMap(([, value]) => (Array.isArray(value) ? value : [value]));
    return messages.length ? messages.join(" ") : null;
  }

  // Core request helper: attaches the bearer token, retries once on 401 via
  // token refresh, and throws an Error carrying the parsed response body
  // (callers read `.data` / `.status` for friendly error messages).
  async function request(path, { method = "GET", body, isForm = false, _retried = false } = {}) {
    const tokens = getTokens();
    const headers = {};
    if (!isForm) headers["Content-Type"] = "application/json";
    if (tokens && tokens.access) headers["Authorization"] = `Bearer ${tokens.access}`;

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });

    if (res.status === 401 && !_retried && tokens && tokens.refresh && !path.startsWith("/auth/")) {
      try {
        await refreshAccessToken();
        return request(path, { method, body, isForm, _retried: true });
      } catch {
        setTokens(null);
      }
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!res.ok) {
      const err = new Error(extractErrorMessage(data) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Same server-generated captcha the React admin uses: a short random
  // code (in `question`) carried by a signed token, rendered distorted by
  // the login form and typed back in by the visitor.
  function getCaptcha() {
    return request("/auth/captcha/");
  }

  async function login(email, password, captchaToken, captchaAnswer) {
    return request("/auth/login/", {
      method: "POST",
      body: { email, password, captcha_token: captchaToken, captcha_answer: captchaAnswer },
    });
  }

  // Self-registration: validated server-side, and the account is created
  // immediately (no approval step), the person can log in right away.
  function registerFaculty(payload) {
    return request("/auth/register/", { method: "POST", body: payload });
  }


  // Binary PDF response, the shared request() helper always reads the
  // body as text/JSON, which would corrupt a PDF's bytes, so this fetches
  // and returns a Blob directly instead. Not retried on 401 (one-off
  // button click, not worth the refresh-token dance for this). month/year
  // omitted falls back to the current month server-side.
  async function downloadNbaReport(month, year) {
    const tokens = getTokens();
    const qs = month && year ? `?month=${month}&year=${year}` : "";
    const res = await fetch(`${BASE}/faculty/nba-report/${qs}`, {
      headers: tokens && tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
    });
    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const data = await res.json();
        detail = extractErrorMessage(data) || detail;
      } catch { /* non-JSON error body */ }
      const err = new Error(detail);
      err.status = res.status;
      throw err;
    }
    // Built here from the month/year rather than read from the response
    // header: the browser hides Content-Disposition from scripts on this
    // cross-origin call, which used to leave the generic fallback name.
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const filename = month && year
      ? `Faculty_Contribution_Report_${monthNames[Number(month) - 1]}_${year}.pdf`
      : "Faculty_Contribution_Report.pdf";
    const blob = await res.blob();
    return { blob, filename };
  }

  // The report modal's Year dropdown options, see
  // available_report_years' docstring for why this list auto-extends.
  function getNbaReportYears() {
    return request("/faculty/nba-report-years/");
  }

  // Forgot password, step 1: email + date of birth on file, matching DOB
  // is the identity check (no email/OTP involved).
  function requestPasswordReset(email, dateOfBirth) {
    return request("/auth/password-reset/request/", { method: "POST", body: { email, date_of_birth: dateOfBirth } });
  }

  // Forgot password, step 2: the reset_token from step 1 + a new password.
  function confirmPasswordReset(resetToken, newPassword) {
    return request("/auth/password-reset/confirm/", {
      method: "POST",
      body: { reset_token: resetToken, new_password: newPassword },
    });
  }

  async function mfaSetup(mfaToken) {
    return request("/auth/mfa/setup/", { method: "POST", body: { mfa_token: mfaToken } });
  }

  async function mfaVerify(mfaToken, code) {
    const data = await request("/auth/mfa/verify/", { method: "POST", body: { mfa_token: mfaToken, code } });
    setTokens({ access: data.access, refresh: data.refresh });
    return data;
  }

  async function completeLogin(loginResponse) {
    setTokens({ access: loginResponse.access, refresh: loginResponse.refresh });
    return loginResponse;
  }

  async function logout() {
    const tokens = getTokens();
    try {
      if (tokens && tokens.refresh) await request("/auth/logout/", { method: "POST", body: { refresh: tokens.refresh } });
    } catch {
      // best-effort
    }
    setTokens(null);
  }

  function isAuthenticated() {
    const t = getTokens();
    return !!(t && t.access);
  }

  function me() {
    return request("/auth/me/");
  }

  function listDepartments() {
    return request("/departments/");
  }

  function listFaculty(params) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/faculty/${qs}`);
  }

  function getFacultyProfile(id) {
    return request(`/faculty/${id}/`);
  }

  // HOD-only in practice: the backend rejects a department that isn't the
  // caller's own unless the caller is IQAC/super admin (see
  // can_manage_department_faculty on the server).
  function createFaculty(payload) {
    return request("/faculty/", { method: "POST", body: payload });
  }

  // "Update Details", a faculty member editing their own profile. The
  // backend allows this for the profile's own owner regardless of role;
  // email is never part of this payload (it can't be changed here).
  function updateMyProfile(facultyProfileId, payload) {
    return request(`/faculty/${facultyProfileId}/`, { method: "PATCH", body: payload });
  }

  // "Transfer your role to the next HOD", only the current HOD acting on
  // her own profile can call this. Her own demotion (new_designation) and
  // the successor's account creation happen together, atomically, on the
  // backend, see FacultyProfileViewSet.transfer_hod.
  function transferHOD(newDesignation, successor) {
    return request("/faculty/transfer-hod/", {
      method: "POST",
      body: { new_designation: newDesignation, successor_mode: "new", successor },
    });
  }

  // Same transfer, but the incoming HOD is an existing faculty member in
  // the department, no new account, just her designation/role promoted.
  function transferHODToExisting(newDesignation, successorFacultyId) {
    return request("/faculty/transfer-hod/", {
      method: "POST",
      body: {
        new_designation: newDesignation,
        successor_mode: "existing",
        successor_faculty_id: successorFacultyId,
      },
    });
  }

  // "Delete Account", a future last working date only schedules it
  // (everything stays normal until then, including login); today/a past
  // date applies right away. See FacultyProfileViewSet.delete_my_account
  // on the backend for the full behavior.
  function deleteMyAccount(lastWorkingDate, reason) {
    return request("/faculty/delete-my-account/", {
      method: "POST",
      body: { last_working_date: lastWorkingDate, reason },
    });
  }

  // HOD (own department) or IQAC/Super Admin marking someone who has
  // actually left, one step, from that faculty member's own dossier.
  // Disables their login and drops them from the leaderboard/directory
  // (both already filter to active faculty only).
  function deactivateFaculty(facultyProfileId, exitDate, reason) {
    return request(`/faculty/${facultyProfileId}/deactivate/`, {
      method: "POST",
      body: { exit_date: exitDate, reason },
    });
  }

  // HOD-only "Delete Data" on a Non-active faculty card, permanently
  // removes the account AND every achievement/evidence record, even with
  // real history. Only works on someone already non-active. See
  // FacultyProfileViewSet.purge on the backend.
  function purgeFaculty(facultyProfileId) {
    return request(`/faculty/${facultyProfileId}/purge/`, { method: "POST" });
  }

  // Institution-wide contribution ranking (verified-achievement counts).
  function getLeaderboard(year) {
    return request("/faculty/leaderboard/" + (year ? `?year=${encodeURIComponent(year)}` : ""));
  }

  // The public faculty directory (name, title, bio), every active
  // faculty member, visible to any signed-in user regardless of role.
  // Deliberately not the same as listFaculty(), which is RBAC-scoped
  // (self-only for plain faculty) for the roster-management use case.
  function getFacultyDirectory(params) {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request(`/faculty/directory/${qs}`);
  }

  function listCycles() {
    return request("/cycles/");
  }

  // The submission wizard's "+ Add Year" option, server computes and
  // creates exactly the next single academic year after whatever's
  // currently latest (e.g. 2026-2027 -> 2027-2028); open to any
  // authenticated faculty member, not just IQAC/admin.
  function addNextCycle() {
    return request("/cycles/add-next/", { method: "POST" });
  }

  // The "Delete Year" counterpart, only succeeds for a year the calling
  // faculty added themselves (server-enforced); cascades to soft-delete
  // that faculty's own achievements/attachments under it, never anyone
  // else's data or the year itself for other faculty.
  function removeCycle(cycleId) {
    return request(`/cycles/${cycleId}/remove-mine/`, { method: "POST" });
  }

  function topLevelCriteria() {
    return request("/sub-criteria/?top_level=true");
  }

  function childrenOf(parentId) {
    return request(`/sub-criteria/?parent=${parentId}&page_size=100`);
  }

  function createAchievement(payload) {
    return request("/achievements/", { method: "POST", body: payload });
  }

  // A faculty member's achievements (each with its nested evidence
  // documents), backs the dossier's Criterion 6.1/6.2 and Evidence Vault
  // tabs. The backend scopes the result by the caller's own role regardless
  // of the faculty id passed: a plain faculty member only ever gets their
  // own record back, an HOD gets any faculty in their own department (for
  // review), and IQAC/Super Admin get anyone's.
  function listAchievements(facultyId) {
    return request(`/achievements/?faculty=${facultyId}&page_size=200`);
  }

  function deleteAchievement(id) {
    return request(`/achievements/${id}/`, { method: "DELETE" });
  }

  function deleteEvidence(id) {
    return request(`/evidence-documents/${id}/`, { method: "DELETE" });
  }

  function uploadEvidence(achievementId, file) {
    const fd = new FormData();
    fd.append("achievement", achievementId);
    fd.append("file", file);
    return request("/evidence-documents/", { method: "POST", body: fd, isForm: true });
  }

  function submitForReview(achievementId) {
    return request(`/achievements/${achievementId}/submit/`, { method: "POST" });
  }

  // Faculty get notified when their submission needs corrections or is
  // verified; the reviewing HOD (or IQAC, if the submitter is the HOD)
  // gets notified when something new needs their review. The bell
  // dropdown only ever shows unread ones, once marked read, a
  // notification is done its job and shouldn't keep cluttering the list.
  function listNotifications() {
    return request("/notifications/?is_read=false");
  }

  function unreadNotificationCount() {
    return request("/notifications/unread_count/");
  }

  function markNotificationRead(id) {
    return request(`/notifications/${id}/mark_read/`, { method: "POST" });
  }

  function markAllNotificationsRead() {
    return request("/notifications/mark-all-read/", { method: "POST" });
  }

  window.FaemsAPI = {
    BASE,
    getTokens,
    setTokens,
    isAuthenticated,
    getCaptcha,
    login,
    mfaSetup,
    mfaVerify,
    completeLogin,
    logout,
    registerFaculty,
    downloadNbaReport,
    getNbaReportYears,
    requestPasswordReset,
    confirmPasswordReset,
    me,
    listDepartments,
    listFaculty,
    getFacultyProfile,
    createFaculty,
    updateMyProfile,
    transferHOD,
    transferHODToExisting,
    deleteMyAccount,
    deactivateFaculty,
    purgeFaculty,
    getLeaderboard,
    getFacultyDirectory,
    listCycles,
    addNextCycle,
    removeCycle,
    topLevelCriteria,
    childrenOf,
    createAchievement,
    listAchievements,
    deleteAchievement,
    deleteEvidence,
    uploadEvidence,
    submitForReview,
    listNotifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
  };
})();
