import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { Field, Select } from "../../components/FormField.jsx";
import Icon from "../../components/Icon.jsx";

async function fetchChildren(parentId) {
  const { data } = await api.get("/sub-criteria/", { params: { parent: parentId, page_size: 100 } });
  return data.results ?? data;
}

export default function SubmitAchievementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canActAsOther = ["iqac_admin", "super_admin"].includes(user.role);

  const [departments, setDepartments] = useState([]);
  const [facultyOptions, setFacultyOptions] = useState([]);
  const [topLevelOptions, setTopLevelOptions] = useState([]);
  const [cycles, setCycles] = useState([]);

  const [department, setDepartment] = useState(user.department?.id ?? "");
  const [facultyId, setFacultyId] = useState(user.faculty_profile_id ?? "");
  const [topCriterionId, setTopCriterionId] = useState("");
  const [subPointOptions, setSubPointOptions] = useState([]);
  const [subPointId, setSubPointId] = useState("");
  const [cycleId, setCycleId] = useState("");

  // Dynamic recursive tail — one entry per further-sub-point level, grown
  // or truncated purely by whether the selected node has children. This is
  // what lets an admin add/re-nest tree depth later without a code change.
  const [furtherLevels, setFurtherLevels] = useState([]); // [{ options, selectedId }]
  const [leafId, setLeafId] = useState(""); // set once a selection has zero children

  const [achievement, setAchievement] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [files, setFiles] = useState([]); // EvidenceDocument rows for the draft
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get("/departments/").then(({ data }) => setDepartments(data.results ?? data));
    api.get("/cycles/").then(({ data }) => setCycles(data.results ?? data));
    api.get("/sub-criteria/", { params: { top_level: "true" } }).then(({ data }) => setTopLevelOptions(data.results ?? data));
  }, []);

  useEffect(() => {
    if (!department) {
      setFacultyOptions([]);
      return;
    }
    api.get("/faculty/", { params: { department, page_size: 100 } }).then(({ data }) => {
      setFacultyOptions(data.results ?? data);
    });
  }, [department]);

  const resetFromTopCriterion = () => {
    setSubPointOptions([]);
    setSubPointId("");
    setFurtherLevels([]);
    setLeafId("");
  };

  const handleTopCriterion = async (id) => {
    setTopCriterionId(id);
    resetFromTopCriterion();
    if (!id) return;
    const children = await fetchChildren(id);
    setSubPointOptions(children);
  };

  const handleSubPoint = async (id) => {
    setSubPointId(id);
    setFurtherLevels([]);
    setLeafId("");
    if (!id) return;
    const children = await fetchChildren(id);
    if (children.length === 0) {
      setLeafId(id);
    } else {
      setFurtherLevels([{ options: children, selectedId: "" }]);
    }
  };

  const handleFurtherLevel = async (levelIndex, id) => {
    const updated = furtherLevels.slice(0, levelIndex + 1);
    updated[levelIndex] = { ...updated[levelIndex], selectedId: id };
    setFurtherLevels(updated);
    setLeafId("");
    if (!id) return;
    const children = await fetchChildren(id);
    if (children.length === 0) {
      setLeafId(id);
    } else {
      setFurtherLevels([...updated, { options: children, selectedId: "" }]);
    }
  };

  const pathReady = department && facultyId && topCriterionId && subPointId && cycleId && leafId;

  // Once the full path + year is picked, silently create the draft record
  // — this is NOT "submitting for review" (Step 8 is the explicit,
  // separate action for that), just what makes the attachment panel usable.
  useEffect(() => {
    if (!pathReady || achievement || busy) return;
    setBusy(true);
    setError("");
    const selectedTop = topLevelOptions.find((o) => String(o.id) === String(topCriterionId));
    const selectedSub = subPointOptions.find((o) => String(o.id) === String(subPointId));
    const facultyName = facultyOptions.find((f) => String(f.id) === String(facultyId))?.full_name || "";
    const yearLabel = cycles.find((c) => String(c.id) === String(cycleId))?.label || "";
    const leafLabel =
      furtherLevels.length > 0
        ? furtherLevels[furtherLevels.length - 1].options.find((o) => String(o.id) === String(leafId))?.description
        : selectedSub?.description;
    const autoTitle = [facultyName, leafLabel || selectedSub?.description || selectedTop?.description, yearLabel]
      .filter(Boolean)
      .join(" — ");

    api
      .post("/achievements/", {
        faculty: facultyId,
        cycle: cycleId,
        sub_criterion: leafId,
        title: autoTitle || "Untitled achievement",
      })
      .then(({ data }) => setAchievement(data))
      .catch((err) => setError(err.response?.data?.detail || "Could not start this submission. Please try again."))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathReady]);

  const handleFileSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = "";
    if (!achievement || selected.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of selected) {
        const fd = new FormData();
        fd.append("achievement", achievement.id);
        fd.append("file", file);
        const { data } = await api.post("/evidence-documents/", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFiles((f) => [...f, data]);
      }
    } catch (err) {
      const data = err.response?.data;
      setError(data?.file?.[0] || data?.detail || "Could not attach that file.");
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (doc) => {
    await api.delete(`/evidence-documents/${doc.id}/`);
    setFiles((f) => f.filter((d) => d.id !== doc.id));
  };

  const handleSubmitForReview = async () => {
    if (!achievement || files.length === 0) {
      setError("Attach at least one document before submitting for review.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/achievements/${achievement.id}/submit/`);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not submit for review.");
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = async () => {
    if (achievement) {
      try {
        await api.delete(`/achievements/${achievement.id}/`);
      } catch {
        // best-effort — a stray unused draft is harmless either way
      }
    }
    setDepartment(user.department?.id ?? "");
    setFacultyId(user.faculty_profile_id ?? "");
    setTopCriterionId("");
    resetFromTopCriterion();
    setCycleId("");
    setAchievement(null);
    setFiles([]);
    setSubmitted(false);
    setError("");
  };

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 grid place-items-center mx-auto mb-5">
          <Icon name="task_alt" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Submitted for review</h1>
        <p className="text-slate-500 mb-8">
          {achievement?.evidence_id} has been sent to your reviewer. You'll be notified once it's verified.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/achievements")}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 shadow-md shadow-blue-500/25 transition"
          >
            View my achievements
          </button>
          <button
            type="button"
            onClick={startOver}
            className="rounded-xl border border-slate-300 text-slate-700 font-semibold px-5 py-2.5 hover:bg-slate-50 transition"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  const columns = [
    {
      label: "Department",
      value: department,
      onChange: (v) => {
        setDepartment(v);
        setFacultyId("");
      },
      options: departments.map((d) => [d.id, d.name]),
      enabled: canActAsOther || true,
      disabled: !canActAsOther,
      placeholder: "Select department…",
    },
    {
      label: "Faculty Name",
      value: facultyId,
      onChange: setFacultyId,
      options: facultyOptions.map((f) => [f.id, f.full_name]),
      enabled: !!department,
      disabled: !canActAsOther,
      placeholder: facultyOptions.length === 0 && department ? "No faculty in this department yet" : "Select faculty…",
    },
    {
      label: "Top-Level Criterion",
      value: topCriterionId,
      onChange: handleTopCriterion,
      options: topLevelOptions.map((o) => [o.id, o.description]),
      enabled: !!facultyId,
      placeholder: "Select criterion…",
    },
    {
      label: "Sub-Point",
      value: subPointId,
      onChange: handleSubPoint,
      options: subPointOptions.map((o) => [o.id, o.description]),
      enabled: !!topCriterionId,
      placeholder: "Select sub-point…",
    },
    {
      label: "Year",
      value: cycleId,
      onChange: setCycleId,
      options: cycles.map((c) => [c.id, c.label]),
      enabled: !!subPointId,
      placeholder: "Select year…",
    },
    ...furtherLevels.map((level, i) => ({
      label: i === 0 ? "Further Sub-Point" : `Further Sub-Point (contd.)`,
      value: level.selectedId,
      onChange: (v) => handleFurtherLevel(i, v),
      options: level.options.map((o) => [o.id, o.description]),
      enabled: i === 0 ? !!cycleId : !!furtherLevels[i - 1]?.selectedId,
      placeholder: "Select…",
    })),
  ];

  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider mb-2 font-bold">
          <Icon name="dynamic_form" size={16} className="text-blue-600" />
          Verified Rubrics Pipeline
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Submit an Achievement</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Work left to right — each field unlocks once the one before it is filled.
        </p>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-4 py-2.5">{error}</p>}

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6 sm:p-8">
        <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {columns.map((col, i) => (
            <div key={i} className="flex-1 min-w-[220px]">
              <Field label={col.label}>
                <Select
                  value={col.value}
                  disabled={!col.enabled || col.disabled}
                  onChange={(e) => col.onChange(e.target.value)}
                >
                  <option value="">{col.placeholder}</option>
                  {col.options.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ))}
        </div>
        {busy && <p className="text-xs text-slate-400 mt-3">Preparing your submission…</p>}
      </div>

      {achievement && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-bold text-slate-900 mb-1">Attachments</h2>
            <p className="text-sm text-slate-500">
              Attach one or more supporting documents. You can add more or remove any of them before submitting.
            </p>
          </div>

          <div className="relative border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-2xl p-8 bg-blue-50/30 transition text-center">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="w-14 h-14 rounded-2xl bg-white border border-blue-200 grid place-items-center text-blue-600 mx-auto mb-3">
              <Icon name="cloud_upload" size={26} />
            </div>
            <p className="font-semibold text-slate-900">{uploading ? "Uploading…" : "Click or drag files to this area"}</p>
            <p className="text-xs text-slate-500 mt-1">PDF, JPG or PNG, up to 20MB each — multiple files allowed.</p>
          </div>

          {files.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
              {files.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon name="description" size={18} className="text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 truncate">
                      Attachment #{doc.id} · {(doc.file_size / 1024).toFixed(0)} KB
                      {doc.is_likely_duplicate && (
                        <span className="ml-2 text-amber-600 text-xs font-semibold">possible duplicate</span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(doc)}
                    className="text-rose-600 hover:text-rose-700 text-xs font-semibold shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-3">
            <button type="button" onClick={startOver} className="text-sm font-medium text-slate-500 hover:text-slate-700">
              Start over
            </button>
            <button
              type="button"
              onClick={handleSubmitForReview}
              disabled={submitting || files.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 shadow-md shadow-blue-500/25 transition disabled:opacity-50"
            >
              <Icon name="send" size={18} />
              {submitting ? "Submitting…" : "Submit for Review"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
