import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import Modal from "../../components/Modal.jsx";
import { Field, TextInput } from "../../components/FormField.jsx";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/departments/")
      .then(({ data }) => setDepartments(data.results ?? data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.post("/departments/", form);
      setForm({ name: "", code: "" });
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "Could not create department.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Every department shown on faculty dashboards and the achievement wizard comes from here.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 shadow-md shadow-blue-500/25"
        >
          + Add department
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className="rounded-2xl bg-white border border-slate-200 shadow-card p-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-sky-500 grid place-items-center text-white font-bold mb-4">
              {d.code.slice(0, 2)}
            </div>
            <p className="font-semibold text-slate-900">{d.name}</p>
            <p className="text-xs text-slate-500 font-mono mt-1">{d.code}</p>
          </div>
        ))}
        {!loading && departments.length === 0 && <p className="text-sm text-slate-400">No departments yet.</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add department">
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <Field label="Department name">
            <TextInput required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="AI & ML" />
          </Field>
          <Field label="Code" hint="Short unique code, e.g. AIML">
            <TextInput required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="AIML" />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-md shadow-blue-500/25 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add department"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
