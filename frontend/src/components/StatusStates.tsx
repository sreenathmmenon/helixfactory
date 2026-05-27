export function StatusStates({ status, message }: { status: "empty" | "loading" | "partial" | "blocked" | "failed"; message: string }) {
  return (
    <div className={`hf-status hf-status-${status}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
