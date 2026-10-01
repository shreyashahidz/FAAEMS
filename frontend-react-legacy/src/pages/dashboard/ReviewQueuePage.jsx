import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import Modal from "../../components/Modal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { Field, TextArea } from "../../components/FormField.jsx";

export default function ReviewQueuePage() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remarksModal, setRemarksModal] = useState(null); // { id, action }
  const [remarks, setRemarks] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get("/achievements/", { params: { page_size: 100 } })
      .then(({ data }) => setAchievements((data.results ?? data).filter((a) => ["submitted", "resubmitted"].includes(a.status))))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const viewDocument = async (doc) => {
    // A plain <a href> wouldn't carry our JWT (it's an Authorization
    // header, not a cookie), so fetch it as an authenticated blob instead.
    const { data } = await api.get(`/evidence-documents/${doc.id}/download/`, { responseType: "blob" });
    const url = URL.createObjectURL(data);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const approve = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/achievements/${id}/review/approve/`);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const openRemarks = (id, action) => {
    setRemarksModal({ id, action });
    setRemarks("");
  };

  const submitRemarks = async (e) => {
    e.preventDefault();
    const { id, action } = remarksModal;
    setBusyId(id);
    try {
      const path = action === "reject" ? "review/reject" : "review/request-corrections";
      await api.post(`/achievements/${id}/${path}/`, { remarks });
      setRemarksModal(null);
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review queue</h1>
        <p className="text-sm text-slate-500 mt-0.5">Submitted achievements awaiting your verification.</p>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card divide-y divide-slate-100 overflow-hidden">
        {achievements.map((a) => (
          <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{a.title}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {a.evidence_id} · {a.faculty_name} · {a.department}
                {a.criterion_path?.length > 0 && <> · {a.criterion_path[a.criterion_path.length - 1]}</>}
              </p>
              {a.documents?.[0] && (
                <button
                  type="button"
                  onClick={() => viewDocument(a.documents[0])}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-1 inline-block"
                >
                  View evidence document →
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={a.status} />
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => approve(a.id)}
                className="text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 px-3 py-1.5 hover:bg-emerald-100 transition disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => openRemarks(a.id, "corrections")}
                className="text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 px-3 py-1.5 hover:bg-amber-100 transition disabled:opacity-50"
              >
                Request corrections
              </button>
              <button
                type="button"
                disabled={busyId === a.id}
                onClick={() => openRemarks(a.id, "reject")}
                className="text-xs font-semibold rounded-lg bg-red-50 text-red-700 px-3 py-1.5 hover:bg-red-100 transition disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
        {!loading && achievements.length === 0 && (
          <p className="text-sm text-slate-400 px-5 py-8 text-center">Nothing waiting for review right now.</p>
        )}
      </div>

      <Modal open={!!remarksModal} onClose={() => setRemarksModal(null)} title="Remarks required">
        <form onSubmit={submitRemarks} className="space-y-4">
          <p className="text-sm text-slate-500">
            {remarksModal?.action === "reject"
              ? "Explain why this record is being rejected."
              : "Explain what needs to be corrected before resubmission."}
          </p>
          <Field label="Remarks">
            <TextArea required rows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </Field>
          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 text-white font-semibold py-2.5 hover:bg-slate-800 transition"
          >
            Submit
          </button>
        </form>
      </Modal>
    </div>
  );
}
