type BadgeProps = {
  label: string;
  color?: string;
};

/**
 * Colored status pill. `color` is a hex (e.g. from lookup) used for text + soft background.
 */
export default function Badge({ label, color = "#64748b" }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}55`,
      }}
    >
      {label}
    </span>
  );
}
