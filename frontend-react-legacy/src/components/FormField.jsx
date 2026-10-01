export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1.5 normal-case tracking-normal font-normal">{hint}</span>}
    </label>
  );
}

const baseInput =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 " +
  "placeholder:text-slate-400 placeholder:font-normal focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40 " +
  "outline-none transition shadow-sm disabled:bg-slate-50 disabled:text-slate-400";

export function TextInput(props) {
  return <input {...props} className={`${baseInput} ${props.className || ""}`} />;
}

export function TextArea(props) {
  return <textarea {...props} className={`${baseInput} ${props.className || ""}`} />;
}

// Deliberately high-contrast: dark, readable option text at a comfortable
// size, not the browser's tiny default — dropdown legibility was flagged
// explicitly as a requirement.
export function Select({ children, className = "", ...props }) {
  return (
    <div className="relative">
      <select {...props} className={`${baseInput} appearance-none pr-9 cursor-pointer ${className}`}>
        {children}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
        expand_more
      </span>
    </div>
  );
}
