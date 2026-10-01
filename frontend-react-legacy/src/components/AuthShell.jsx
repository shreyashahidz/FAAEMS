export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-50">
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-blue-100/70 via-sky-50/40 to-transparent blur-[120px] rounded-full" />
        <div className="absolute top-[60%] -left-48 w-[500px] h-[500px] bg-cyan-100/40 blur-[130px] rounded-full" />
        <div className="absolute top-[80%] -right-48 w-[600px] h-[600px] bg-indigo-50/60 blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-hero-grid bg-[length:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white font-bold text-xl tracking-tight">
            F
          </div>
          <div>
            <p className="text-xl tracking-tight text-slate-900 font-bold leading-none">FAEMS</p>
            <p className="text-[11px] font-semibold text-blue-600 tracking-wider uppercase mt-1">
              Thakur College of Engineering
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-7 sm:p-8 bg-white/95 backdrop-blur-2xl border border-slate-200/90 shadow-[0_20px_45px_rgba(30,58,138,0.08),0_2px_10px_rgba(0,0,0,0.04)]">
          <h2 className="text-xl font-bold text-slate-900 mb-1 text-center">{title}</h2>
          {subtitle && <p className="text-sm text-slate-500 mb-6 text-center">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
