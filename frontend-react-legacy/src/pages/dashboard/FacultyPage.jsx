import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import Modal from "../../components/Modal.jsx";
import StatusBadge from "../../components/StatusBadge.jsx";
import { Field, Select, TextInput } from "../../components/FormField.jsx";

const DESIGNATIONS = [
  ["assistant_professor", "Assistant Professor"],
  ["associate_professor", "Associate Professor"],
  ["professor", "Professor"],
  ["hod", "HOD"],
];

const EMPTY_FORM = {
  email: "",
  full_name: "",
  designation: "assistant_professor",
  employee_id: "",
  contact_number: "",
  department: "",
  temporary_password: "",
};

export default function FacultyPage() {
  const { user } = useAuth();
  const canManage = ["hod", "iqac_admin", "super_admin"].includes(user.role);
  const canPickDepartment = ["iqac_admin", "super_admin"].includes(user.role);

  const [faculty, setFaculty] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'delete'
  const [form, setForm] = useState(EMPTY_FORM);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = () => {
    setLoading(true);
    const requests = [api.get("/faculty/", { params: { page_size: 100 } })];
    if (canPickDepartment) requests.push(api.get("/departments/"));
    Promise.all(requests)
      .then(([facultyRes, deptRes]) => {
        setFaculty(facultyRes.data.results ?? facultyRes.data);
        if (deptRes) setDepartments(deptRes.data.results ?? deptRes.data);
      })
      .catch(() => setError("Could not load faculty."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setForm({ ...EMPTY_FORM, department: canPickDepartment ? "" : user.department?.id ?? "" });
    setFormError("");
    setModal("add");
  };

  const openEdit = (f) => {
    setActive(f);
    setForm({ ...EMPTY_FORM, full_name: f.full_name, designation: f.designation, contact_number: f.contact_number || "" });
    setFormError("");
    setModal("edit");
  };

  const openDelete = (f) => {
    setActive(f);
    setForm({ ...EMPTY_FORM, reason: "" });
    setModal("delete");
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api.post("/faculty/", {
        ...form,
        department: form.department || user.department?.id,
      });
      setModal(null);
      load();
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      await api.patch(`/faculty/${active.id}/`, {
        full_name: form.full_name,
        designation: form.designation,
        contact_number: form.contact_number,
      });
      setModal(null);
      load();
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const submitDelete = async (routeToExit) => {
    setBusy(true);
    setFormError("");
    try {
      await api.delete(`/faculty/${active.id}/`, { data: { reason: form.reason, route_to_exit: routeToExit } });
      setModal(null);
      load();
    } catch (err) {
      setFormError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmExit = async (f, step) => {
    setBusy(true);
    try {
      await api.post(`/faculty/${f.id}/exit/${step}-confirm/`);
      load();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Faculty</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {user.role === "hod" ? "Manage faculty in your department." : "Faculty roster across your scope."}
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 shadow-md shadow-blue-500/25 transition"
          >
            + Add faculty
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-5 py-3">Name</th>
              <th className="text-left font-semibold px-5 py-3">Designation</th>
              <th className="text-left font-semibold px-5 py-3">Department</th>
              <th className="text-left font-semibold px-5 py-3">Employee ID</th>
              <th className="text-left font-semibold px-5 py-3">Status</th>
              {canManage && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {faculty.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/60 transition">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-sky-500 grid place-items-center text-white text-xs font-bold shrink-0">
                      {f.full_name?.[0]}
                    </span>
                    <div>
                      <p className="font-medium text-slate-900">{f.full_name}</p>
                      <p className="text-xs text-slate-400">{f.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600 capitalize">
                  {f.role === "hod" ? "HOD" : f.designation?.replace(/_/g, " ")}
                </td>
                <td className="px-5 py-3.5 text-slate-600">{f.department_name}</td>
                <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{f.employee_id}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={f.status} />
                  {f.status === "exit_initiated" && (
                    <p className="text-[11px] text-slate-400 mt-1">
                      {f.hod_confirmed_at ? "HOD confirmed — awaiting admin" : "Awaiting HOD confirmation"}
                    </p>
                  )}
                </td>
                {canManage && (
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {f.status === "exit_initiated" && user.role === "hod" && !f.hod_confirmed_at && (
                      <button
                        disabled={busy}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-xs mr-3 disabled:opacity-50"
                        onClick={() => confirmExit(f, "hod")}
                      >
                        Confirm exit (HOD)
                      </button>
                    )}
                    {f.status === "exit_initiated" && ["iqac_admin", "super_admin"].includes(user.role) && f.hod_confirmed_at && (
                      <button
                        disabled={busy}
                        className="text-emerald-600 hover:text-emerald-700 font-medium text-xs mr-3 disabled:opacity-50"
                        onClick={() => confirmExit(f, "admin")}
                      >
                        Finalize exit
                      </button>
                    )}
                    <button className="text-blue-600 hover:text-blue-700 font-medium text-xs mr-3" onClick={() => openEdit(f)}>
                      Edit
                    </button>
                    <button className="text-red-600 hover:text-red-700 font-medium text-xs" onClick={() => openDelete(f)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && faculty.length === 0 && <p className="text-sm text-slate-400 px-5 py-8 text-center">No faculty found.</p>}
      </div>

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add faculty member">
        <form onSubmit={submitAdd} className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <Field label="Full name">
            <TextInput required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Dr. Jane Doe" />
          </Field>
          <Field label="Institutional email" hint="Must end in @tcetmumbai.in">
            <TextInput
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane.doe@tcetmumbai.in"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Designation">
              <Select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
                {DESIGNATIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Employee ID">
              <TextInput required value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} />
            </Field>
          </div>
          {canPickDepartment && (
            <Field label="Department">
              <Select required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Contact number">
            <TextInput value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </Field>
          <Field label="Temporary password" hint="10+ chars, upper + lower + digit + symbol">
            <TextInput
              required
              type="text"
              value={form.temporary_password}
              onChange={(e) => setForm({ ...form, temporary_password: e.target.value })}
              placeholder="e.g. Welcome@2026!"
            />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-md shadow-blue-500/25 disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add faculty"}
          </button>
        </form>
      </Modal>

      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Update faculty member">
        <form onSubmit={submitEdit} className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <Field label="Full name">
            <TextInput required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Designation">
            <Select value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}>
              {DESIGNATIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Contact number">
            <TextInput value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </Field>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 shadow-md shadow-blue-500/25 disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </Modal>

      <Modal open={modal === "delete"} onClose={() => setModal(null)} title={`Remove ${active?.full_name ?? ""}`}>
        <div className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>}
          <p className="text-sm text-slate-600">
            This never hard-deletes anything. Choose whether this is a full faculty exit (disables login, archives to
            the alumni view, keeps every achievement/evidence record intact) or just a quick profile deactivation.
          </p>
          <Field label="Reason (optional)">
            <TextInput value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => submitDelete(true)}
              className="w-full rounded-xl bg-red-600 text-white font-semibold py-2.5 hover:bg-red-700 transition disabled:opacity-60"
            >
              Start faculty exit workflow
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => submitDelete(false)}
              className="w-full rounded-xl border border-slate-300 text-slate-700 font-semibold py-2.5 hover:bg-slate-50 transition disabled:opacity-60"
            >
              Just deactivate profile (soft delete)
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function formatError(err) {
  const data = err.response?.data;
  if (!data) return "Something went wrong. Please try again.";
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  const first = Object.entries(data).find(([k]) => k !== "correlation_id");
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return "Something went wrong. Please try again.";
}
