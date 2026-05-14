interface MethodBadgeProps {
  method: string;
}

const METHOD_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  GET:    { bg: '#dcfce7', fg: '#166534', border: '#bbf7d0' },
  POST:   { bg: '#dbeafe', fg: '#1d4ed8', border: '#bfdbfe' },
  PUT:    { bg: '#ffedd5', fg: '#9a3412', border: '#fed7aa' },
  PATCH:  { bg: '#fef9c3', fg: '#854d0e', border: '#fde68a' },
  DELETE: { bg: '#fee2e2', fg: '#991b1b', border: '#fecaca' },
};

const FALLBACK = { bg: '#f3f4f6', fg: '#374151', border: '#e5e7eb' };

export default function MethodBadge({ method }: MethodBadgeProps) {
  const upper = method.toUpperCase();
  const colors = METHOD_COLORS[upper] ?? FALLBACK;

  return (
    <span
      className="method-badge"
      style={{
        backgroundColor: colors.bg,
        color:           colors.fg,
        borderColor:     colors.border,
      }}
    >
      {upper}
    </span>
  );
}
