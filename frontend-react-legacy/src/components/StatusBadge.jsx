const STYLES = {
  draft: "bg-slate-100 text-slate-600 border-slate-200",
  submitted: "bg-blue-50 text-blue-700 border-blue-200",
  hod_review: "bg-blue-50 text-blue-700 border-blue-200",
  corrections_required: "bg-amber-50 text-amber-700 border-amber-200",
  resubmitted: "bg-amber-50 text-amber-700 border-amber-200",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
  iqac_locked: "bg-indigo-50 text-indigo-700 border-indigo-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  exit_initiated: "bg-amber-50 text-amber-700 border-amber-200",
  exited: "bg-slate-100 text-slate-500 border-slate-200",
};

const LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  hod_review: "HOD Review",
  corrections_required: "Corrections Required",
  resubmitted: "Resubmitted",
  verified: "Verified",
  iqac_locked: "IQAC Locked",
  rejected: "Rejected",
  active: "Active",
  exit_initiated: "Exit Initiated",
  exited: "Exited",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${STYLES[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {LABELS[status] || status}
    </span>
  );
}
