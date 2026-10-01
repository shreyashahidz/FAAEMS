import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import DepartmentCarousel from "../../components/DepartmentCarousel.jsx";
import Icon from "../../components/Icon.jsx";

const VERIFIED_STATUSES = new Set(["verified", "iqac_locked"]);
const NEEDS_ACTION = new Set(["draft", "corrections_required"]);
const AWAITING_REVIEW = new Set(["submitted", "resubmitted"]);

function timeAgo(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function OverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/departments/"),
      api.get("/faculty/", { params: { page_size: 100 } }),
      api.get("/achievements/", { params: { page_size: 200 } }),
    ])
      .then(([deptRes, facultyRes, achRes]) => {
        setDepartments(deptRes.data.results ?? deptRes.data);
        setFaculty(facultyRes.data.results ?? facultyRes.data);
        setAchievements(achRes.data.results ?? achRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const isReviewer = ["hod", "iqac_admin", "super_admin"].includes(user.role);
  const canSubmit = true;

  const stats = useMemo(() => {
    const total = achievements.length;
    const verified = achievements.filter((a) => VERIFIED_STATUSES.has(a.status)).length;
    const needsAction = achievements.filter((a) => NEEDS_ACTION.has(a.status));
    const awaitingReview = achievements.filter((a) => AWAITING_REVIEW.has(a.status));
    const corrections = achievements.filter((a) => a.status === "corrections_required");
    return {
      completeness: total ? Math.round((verified / total) * 100) : 0,
      total,
      verified,
      needsAction,
      awaitingReview,
      corrections,
    };
  }, [achievements]);

  const categoryBreakdown = useMemo(() => {
    const colors = ["bg-cyan-500 text-cyan-700", "bg-blue-600 text-blue-700", "bg-emerald-500 text-emerald-700", "bg-indigo-500 text-indigo-700"];
    // Group by the top-level criterion (e.g. "Professional Development
    // Activities" vs "Research and Development Activities") — the wizard
    // now drives everything off the criteria tree, not a separate flat
    // category picklist.
    const groups = new Map();
    achievements.forEach((a) => {
      const top = a.criterion_path?.[0];
      if (!top) return;
      if (!groups.has(top)) groups.set(top, []);
      groups.get(top).push(a);
    });
    return Array.from(groups.entries()).map(([name, items], i) => {
      const verified = items.filter((a) => VERIFIED_STATUSES.has(a.status)).length;
      const pct = items.length ? Math.round((verified / items.length) * 100) : 0;
      const [bar, text] = colors[i % colors.length].split(" ");
      return { name, pct, count: items.length, bar, text };
    });
  }, [achievements]);

  const mostRecent = (list) => [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  const cards = isReviewer
    ? [
        {
          icon: "pending_actions",
          tone: "blue",
          title: "Pending Verifications",
          count: stats.awaitingReview.length,
          countLabel: "Records",
          desc: "Submitted achievements awaiting your cryptographic sign-off.",
          recent: mostRecent(stats.awaitingReview),
          action: "Review batch →",
          onAction: () => navigate("/dashboard/review"),
        },
        {
          icon: "rule_folder",
          tone: "amber",
          title: "Corrections Required",
          count: stats.corrections.length,
          countLabel: "Submissions",
          desc: "Faculty have been asked to fix and resubmit these records.",
          recent: mostRecent(stats.corrections),
          action: "View gaps →",
          onAction: () => navigate("/dashboard/achievements"),
        },
        {
          icon: "verified",
          tone: "emerald",
          title: "Verified This Cycle",
          count: stats.verified,
          countLabel: "Records",
          desc: "Achievements verified and ready for IQAC lock-in.",
          recent: mostRecent(achievements.filter((a) => VERIFIED_STATUSES.has(a.status))),
          action: "Open faculty directory →",
          onAction: () => navigate("/dashboard/faculty"),
        },
      ]
    : [
        {
          icon: "pending_actions",
          tone: "blue",
          title: "Needs Your Action",
          count: stats.needsAction.length,
          countLabel: "Records",
          desc: "Drafts and corrections-required achievements of yours.",
          recent: mostRecent(stats.needsAction),
          action: "Continue →",
          onAction: () => navigate("/dashboard/achievements"),
        },
        {
          icon: "hourglass_top",
          tone: "amber",
          title: "Awaiting Review",
          count: stats.awaitingReview.length,
          countLabel: "Records",
          desc: "Submitted to your HOD/IQAC and pending verification.",
          recent: mostRecent(stats.awaitingReview),
          action: "View status →",
          onAction: () => navigate("/dashboard/achievements"),
        },
        {
          icon: "verified",
          tone: "emerald",
          title: "Verified",
          count: stats.verified,
          countLabel: "Records",
          desc: "Locked into your NBA/NAAC accreditation evidence.",
          recent: mostRecent(achievements.filter((a) => VERIFIED_STATUSES.has(a.status))),
          action: "View all →",
          onAction: () => navigate("/dashboard/achievements"),
        },
      ];

  const toneStyles = {
    blue: { chip: "bg-blue-50 border-blue-200 text-blue-600", hoverBorder: "hover:border-blue-400", badge: "bg-blue-50 text-blue-700 border-blue-200", link: "text-blue-600 hover:text-blue-700" },
    amber: { chip: "bg-amber-50 border-amber-200 text-amber-600", hoverBorder: "hover:border-amber-400", badge: "bg-amber-50 text-amber-700 border-amber-200", link: "text-amber-700 hover:text-amber-800" },
    emerald: { chip: "bg-emerald-50 border-emerald-200 text-emerald-600", hoverBorder: "hover:border-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", link: "text-emerald-700 hover:text-emerald-800" },
  };

  return (
    <div className="space-y-10">
      {/* Header + quick stats */}
      <section>
        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
          {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back, {user.full_name.split(" ")[0]}</h1>
        <p className="text-slate-600 mt-1.5 text-sm max-w-2xl">
          {isReviewer
            ? "Here's what needs verification across your scope, and how evidence completeness is tracking."
            : "Here's what needs your attention, and how your submitted evidence is tracking."}
        </p>

        <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-6 mt-6 border-t border-slate-200 max-w-2xl">
          <div className="flex flex-col">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-tabular">{stats.completeness}%</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Completeness
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-200 pl-4 sm:pl-6">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-tabular">{stats.total}</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Total Records
            </span>
          </div>
          <div className="flex flex-col border-l border-slate-200 pl-4 sm:pl-6">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-tabular">{faculty.length}</span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-sky-500 inline-block" /> Faculty In Scope
            </span>
          </div>
        </div>
      </section>

      {/* Department carousel */}
      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-5 sm:p-6">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading departments…</p>
        ) : (
          <DepartmentCarousel
            departments={departments}
            onSelect={() => navigate("/dashboard/faculty")}
            visible={Math.min(3, departments.length || 1)}
          />
        )}
      </section>

      {/* Intelligence & Action Centre */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider mb-2 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
              </span>
              Live Institutional Stream
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Accreditation Intelligence &amp; Action Centre</h2>
          </div>
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors text-slate-700 text-xs font-semibold flex items-center gap-1.5 self-start"
          >
            <Icon name="refresh" size={15} className="text-blue-600" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 flex flex-col gap-5">
            {cards.map((c) => {
              const t = toneStyles[c.tone];
              return (
                <div key={c.title} className={`group rounded-2xl p-6 bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 ${t.hoverBorder}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${t.chip}`}>
                      <Icon name={c.icon} size={26} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-900">{c.title}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase border ${t.badge}`}>
                          {c.count} {c.countLabel}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{c.desc}</p>
                      {c.recent && (
                        <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs">
                          <span className="text-slate-800 font-medium truncate">
                            {c.recent.title.startsWith(c.recent.faculty_name)
                              ? c.recent.title
                              : `${c.recent.faculty_name} — ${c.recent.title}`}
                          </span>
                          <span className="text-slate-500 font-mono shrink-0">{timeAgo(c.recent.created_at)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">{c.recent?.evidence_id || "No records yet"}</span>
                    <button type="button" onClick={c.onAction} className={`inline-flex items-center gap-1.5 text-xs font-bold group-hover:translate-x-1 transition-all ${t.link}`}>
                      {c.action}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-5 rounded-2xl p-7 bg-white border border-slate-200 shadow-sm flex flex-col items-center">
            <div className="w-full flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Completeness Score</h3>
                <p className="text-xs text-slate-500">Verified evidence vs. total submitted</p>
              </div>
            </div>
            <div className="relative my-8">
              <svg width="200" height="200" viewBox="0 0 160 160" className="-rotate-90">
                <circle cx="80" cy="80" r="66" fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
                <circle
                  cx="80"
                  cy="80"
                  r="66"
                  fill="transparent"
                  stroke="#2563eb"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 66}
                  strokeDashoffset={2 * Math.PI * 66 * (1 - stats.completeness / 100)}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-extrabold text-slate-900 tracking-tight font-tabular">{stats.completeness}%</span>
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold max-w-[100px] leading-tight">Evidence Verified</span>
              </div>
            </div>
            <div className="w-full space-y-4 pt-2">
              {categoryBreakdown.map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-800 flex items-center gap-2 truncate">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.bar} shrink-0`} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className={`font-bold font-mono shrink-0 ${c.text}`}>{c.pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
              {categoryBreakdown.length === 0 && <p className="text-xs text-slate-400">No categories seeded yet.</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Quick submit */}
      {canSubmit && (
        <section className="rounded-3xl p-6 sm:p-10 bg-white border border-slate-200/90 shadow-md">
          <div className="max-w-3xl mb-8 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold mb-3">
                <Icon name="dynamic_form" size={16} className="text-blue-600" />
                Verified Rubrics Pipeline
              </div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Quick Submit Faculty Evidence</h2>
              <p className="text-slate-600 mt-2 text-sm">
                Cascading department → faculty → criteria schema, hashed and stored the moment you upload.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard/achievements/submit")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/25 transition"
            >
              <Icon name="cloud_upload" size={18} />
              Submit achievement
            </button>
          </div>
        </section>
      )}

      {/* HOD directory */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider mb-2 font-bold">
              <Icon name="groups" size={16} className="text-blue-600" />
              Institutional Leadership
            </div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">HOD Directory</h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("/dashboard/faculty")}
            className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Manage faculty <Icon name="arrow_forward" size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {departments
            .filter((d) => d.head_of_department_name)
            .map((d, i) => {
              const gradients = ["from-blue-600 to-indigo-600", "from-sky-500 to-blue-600", "from-cyan-500 to-blue-600", "from-indigo-500 to-blue-600"];
              return (
                <div key={d.id} className="group relative rounded-2xl p-6 bg-white border border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${gradients[i % gradients.length]} p-0.5 shadow-md mb-4`}>
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-lg font-bold text-blue-700 tracking-wider">
                      {d.head_of_department_name
                        .split(" ")
                        .filter((w) => !["Dr.", "Mr.", "Mrs.", "Ms."].includes(w))
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {d.head_of_department_name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">Head of Department</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] bg-blue-50 text-blue-700 border border-blue-200/80 font-medium">
                    <Icon name="apartment" size={13} className="text-blue-600" />
                    {d.name}
                  </div>
                </div>
              );
            })}
          {!loading && departments.length === 0 && <p className="text-sm text-slate-400 col-span-full">No departments yet.</p>}
        </div>
      </section>
    </div>
  );
}
