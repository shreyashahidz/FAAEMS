export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-card-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
