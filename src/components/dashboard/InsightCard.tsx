export default function InsightCard({ text }: { text: string }) {
  if (!text) return null;

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      💡 {text}
    </div>
  );
}