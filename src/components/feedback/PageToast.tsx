export default function PageToast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className="rounded-2xl border px-4 py-3 shadow-lg text-sm"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text)",
          minWidth: 220,
        }}
      >
        {message}
      </div>
    </div>
  );
}