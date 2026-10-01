export default function ForgotPasswordModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 grid place-items-center font-bold mb-4">
          !
        </div>
        <h3 className="font-semibold text-slate-900 mb-2">Password reset is coming soon</h3>
        <p className="text-sm text-slate-500 mb-6">
          Self-service password reset isn't enabled yet. Until then, please contact your IQAC/Super
          Admin to have your password reset manually.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-xl bg-slate-900 text-white font-medium py-2.5 hover:bg-slate-800 transition"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
