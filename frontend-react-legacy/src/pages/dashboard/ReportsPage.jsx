import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import Icon from "../../components/Icon.jsx";
import { Field, Select } from "../../components/FormField.jsx";

const QUALITY_METRICS = [
  { key: "missing_achievement_date", label: "Missing Dates", icon: "event_busy", tone: "amber" },
  { key: "missing_issuing_organization", label: "Missing Organization", icon: "domain_disabled", tone: "amber" },
  { key: "duplicate_documents", label: "Duplicate Files", icon: "content_copy", tone: "rose" },
  { key: "low_ocr_confidence_documents", label: "Low OCR Confidence", icon: "visibility_off", tone: "amber" },
  { key: "unverified_documents", label: "Unverified Documents", icon: "hourglass_top", tone: "blue" },
  { key: "open_integrity_alerts", label: "Integrity Alerts", icon: "gpp_maybe", tone: "rose" },
];

const TONE_CLASSES = {
  amber: "bg-amber-50 border-amber-200 text-amber-600",
  rose: "bg-rose-50 border-rose-200 text-rose-600",
  blue: "bg-blue-50 border-blue-200 text-blue-600",
};

export default function ReportsPage() {
  const [frameworks, setFrameworks] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [reports, setReports] = useState([]);
  const [quality, setQuality] = useState(null);
  const [form, setForm] = useState({ framework: "", cycle: "" });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [verifyResults, setVerifyResults] = useState({});
  const [verifyingId, setVerifyingId] = useState(null);

  const load = () => {
    api.get("/frameworks/").then(({ data }) => setFrameworks(data.results ?? data));
    api.get("/cycles/").then(({ data }) => setCycles(data.results ?? data));
    api.get("/reports/").then(({ data }) => setReports(data.results ?? data));
    api.get("/achievements/data-quality/").then(({ data }) => setQuality(data));
  };

  useEffect(load, []);

  const generate = async (e) => {
    e.preventDefault();
    setError("");
    setGenerating(true);
    try {
      await api.post("/reports/generate/", form);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not generate report. Is there any verified evidence for this cycle?");
    } finally {
      setGenerating(false);
    }
  };

  const download = async (report) => {
    const { data } = await api.get(`/reports/${report.id}/download/`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.framework_name}_${report.cycle_label}.docx`.replace(/\s+/g, "_");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const verify = async (report) => {
    setVerifyingId(report.id);
    try {
      const { data } = await api.get(`/reports/${report.id}/verify/`);
      setVerifyResults((v) => ({ ...v, [report.id]: data }));
    } finally {
      setVerifyingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider mb-2 font-bold">
          <Icon name="description" size={16} className="text-blue-600" />
          Accreditation Snapshots
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Every report is built live from verified, IQAC-locked evidence only, and frozen with a SHA-256 checksum so
          it can be proven unchanged later.
        </p>
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900">Data Quality</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dataset hygiene, independent of whether NBA/NAAC targets are met — live counts across your scope.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {QUALITY_METRICS.map((m) => (
            <div key={m.key} className="rounded-2xl bg-white border border-slate-200 shadow-card p-4">
              <div className={`w-9 h-9 rounded-lg border grid place-items-center mb-3 ${TONE_CLASSES[m.tone]}`}>
                <Icon name={m.icon} size={18} />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-tabular">{quality ? quality[m.key] : "—"}</p>
              <p className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
        <h2 className="font-bold text-slate-900 mb-4">Generate a report</h2>
        {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
        <form onSubmit={generate} className="grid sm:grid-cols-3 gap-4 items-end">
          <Field label="Framework">
            <Select required value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })}>
              <option value="">Select framework…</option>
              {frameworks.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Cycle">
            <Select required value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })}>
              <option value="">Select cycle…</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <button
            type="submit"
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-md shadow-blue-500/25 transition disabled:opacity-60"
          >
            <Icon name="auto_awesome" size={18} />
            {generating ? "Generating…" : "Generate report"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-bold text-slate-900 mb-4">Generated reports</h2>
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card divide-y divide-slate-100 overflow-hidden">
          {reports.map((r) => {
            const result = verifyResults[r.id];
            return (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {r.framework_name} — {r.cycle_label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {r.evidence_count} records · generated by {r.generated_by_name} ·{" "}
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono mt-1 truncate">sha256:{r.checksum}</p>
                  {result && (
                    <p className={`text-xs font-semibold mt-1.5 ${result.matches ? "text-emerald-600" : "text-rose-600"}`}>
                      {result.matches ? "✓ Integrity verified — checksum matches" : "✗ Checksum mismatch — file may be corrupted"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => verify(r)}
                    disabled={verifyingId === r.id}
                    className="text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 px-3 py-1.5 hover:bg-slate-200 transition disabled:opacity-50"
                  >
                    {verifyingId === r.id ? "Checking…" : "Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={() => download(r)}
                    className="text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 px-3 py-1.5 hover:bg-blue-100 transition flex items-center gap-1"
                  >
                    <Icon name="download" size={14} />
                    Download
                  </button>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && <p className="text-sm text-slate-400 px-5 py-8 text-center">No reports generated yet.</p>}
        </div>
      </section>
    </div>
  );
}
