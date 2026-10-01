export default function Icon({ name, className = "", size = 20 }) {
  return (
    <span
      className={`material-symbols-outlined leading-none select-none ${className}`}
      style={{ fontSize: size, width: size, height: size }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
