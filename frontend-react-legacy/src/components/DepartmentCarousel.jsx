import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon.jsx";

const ICONS = {
  AIML: "neurology",
  AIDS: "database",
  COMPS: "terminal",
  EXTC: "cell_tower",
  CIVIL: "foundation",
  MECH: "settings",
};

function iconFor(code) {
  return ICONS[code] || "school";
}

/**
 * Horizontally-sliding department card row — icon chip, name, description,
 * a link, manual arrows + autoplay. `visible` controls how many cards show
 * at once (responsive callers pass a fixed number).
 */
export default function DepartmentCarousel({ departments, onSelect, visible = 3, autoPlayMs = 4000 }) {
  const [start, setStart] = useState(0);
  const timerRef = useRef(null);
  const count = departments.length;

  const maxStart = Math.max(count - visible, 0);

  useEffect(() => {
    if (autoPlayMs <= 0 || count <= visible) return undefined;
    timerRef.current = setInterval(() => {
      setStart((s) => (s >= maxStart ? 0 : s + 1));
    }, autoPlayMs);
    return () => clearInterval(timerRef.current);
  }, [autoPlayMs, count, visible, maxStart]);

  const visibleCards = useMemo(() => {
    if (count <= visible) return departments;
    const items = [];
    for (let i = 0; i < visible; i += 1) {
      items.push(departments[(start + i) % count]);
    }
    return items;
  }, [departments, start, visible, count]);

  const go = (dir) => {
    clearInterval(timerRef.current);
    setStart((s) => {
      const next = s + dir;
      if (next < 0) return maxStart;
      if (next > maxStart) return 0;
      return next;
    });
  };

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 text-blue-600 text-xs uppercase tracking-wider font-bold">
          <Icon name="apartment" size={15} className="text-blue-600" />
          Departments
        </div>
        {count > visible && (
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Previous departments"
              onClick={() => go(-1)}
              className="h-8 w-8 rounded-full grid place-items-center transition bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <Icon name="chevron_left" size={18} />
            </button>
            <button
              type="button"
              aria-label="Next departments"
              onClick={() => go(1)}
              className="h-8 w-8 rounded-full grid place-items-center transition bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${visible}, minmax(0, 1fr))` }}>
        {visibleCards.map((dept) => (
          <button
            type="button"
            key={dept.id ?? dept.code}
            onClick={() => onSelect?.(dept)}
            className="group text-left rounded-2xl p-5 transition duration-300 border bg-white border-slate-200 hover:border-blue-400 shadow-sm hover:shadow-md"
          >
            <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-200 grid place-items-center text-blue-600 mb-4">
              <Icon name={iconFor(dept.code)} size={22} />
            </div>
            <h3 className="font-bold text-slate-900 mb-1">{dept.name}</h3>
            <p className="text-xs text-slate-500 mb-3 font-mono">{dept.code}</p>
            <span className="text-xs font-bold inline-flex items-center gap-1 text-blue-600 group-hover:text-blue-700">
              View department
              <Icon name="arrow_forward" size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </div>

      {count > visible && (
        <div className="flex gap-1.5 justify-center mt-5">
          {Array.from({ length: maxStart + 1 }).map((_, i) => (
            <span key={i} className={"h-1.5 rounded-full transition-all " + (i === start ? "w-6 bg-blue-600" : "w-1.5 bg-slate-200")} />
          ))}
        </div>
      )}
    </div>
  );
}
