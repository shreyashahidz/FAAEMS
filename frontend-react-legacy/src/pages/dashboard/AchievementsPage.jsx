import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import StatusBadge from "../../components/StatusBadge.jsx";
import Icon from "../../components/Icon.jsx";

export default function AchievementsPage() {
  const navigate = useNavigate();
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");

  const load = (searchTerm = "") => {
    setLoading(true);
    api
      .get("/achievements/", { params: { page_size: 100, ...(searchTerm ? { search: searchTerm } : {}) } })
      .then(({ data }) => setAchievements(data.results ?? data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Debounced server-side search — real Postgres full-text search, reaches
  // into OCR-extracted evidence text too, not just a client-side filter.
  useEffect(() => {
    const t = setTimeout(() => load(search), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const submitForReview = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/achievements/${id}/submit/`);
      load(search);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My achievements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Certifications, FDPs, publications, and everything else that goes into your NBA/NAAC evidence.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/dashboard/achievements/submit")}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 shadow-md shadow-blue-500/25 transition"
        >
          + Submit achievement
        </button>
      </div>

      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Icon name="search" size={18} />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title, description, evidence text…"
          className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none transition"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card divide-y divide-slate-100 overflow-hidden">
        {achievements.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {a.evidence_id} · {a.cycle_label}
                {a.criterion_path?.length > 0 && <> · {a.criterion_path[a.criterion_path.length - 1]}</>}
              </p>
              {a.status === "corrections_required" && a.remarks && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mt-2 inline-block">
                  IQAC/HOD remarks: {a.remarks}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <StatusBadge status={a.status} />
              {(a.status === "draft" || a.status === "corrections_required") && (
                <button
                  type="button"
                  disabled={busyId === a.id}
                  onClick={() => submitForReview(a.id)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50"
                >
                  {busyId === a.id ? "Submitting…" : "Submit for review →"}
                </button>
              )}
            </div>
          </div>
        ))}
        {!loading && achievements.length === 0 && (
          <p className="text-sm text-slate-400 px-5 py-8 text-center">
            {search ? `No achievements match "${search}".` : "No achievements yet — submit your first one."}
          </p>
        )}
      </div>
    </div>
  );
}
