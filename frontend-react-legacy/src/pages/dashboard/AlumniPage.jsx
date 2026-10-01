import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import Icon from "../../components/Icon.jsx";

export default function AlumniPage() {
  const [alumni, setAlumni] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/faculty/", { params: { include_exited: "true", page_size: 200 } })
      .then(({ data }) => setAlumni((data.results ?? data).filter((f) => f.status === "exited")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = alumni.filter((f) => f.full_name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider mb-2 font-bold">
          <Icon name="history_edu" size={16} className="text-blue-600" />
          Institutional Record
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Alumni Faculty Archive</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Read-only. Exited faculty keep their full achievement/evidence history — it stays linked to their original
          department and still counts in reports and analytics.
        </p>
      </div>

      <div className="relative max-w-sm">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Icon name="search" size={18} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 outline-none transition"
        />
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left font-semibold px-5 py-3">Name</th>
              <th className="text-left font-semibold px-5 py-3">Last Department</th>
              <th className="text-left font-semibold px-5 py-3">Employee ID</th>
              <th className="text-left font-semibold px-5 py-3">Exit Date</th>
              <th className="text-left font-semibold px-5 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50/60 transition">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-slate-200 grid place-items-center text-slate-500 text-xs font-bold shrink-0">
                      {f.full_name?.[0]}
                    </span>
                    <p className="font-medium text-slate-700">{f.full_name}</p>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{f.last_active_department_name || f.department_name}</td>
                <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{f.employee_id}</td>
                <td className="px-5 py-3.5 text-slate-600">{f.exit_date || "—"}</td>
                <td className="px-5 py-3.5 text-slate-500">{f.exit_reason || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <p className="text-sm text-slate-400 px-5 py-8 text-center">No alumni records yet.</p>}
      </div>
    </div>
  );
}
