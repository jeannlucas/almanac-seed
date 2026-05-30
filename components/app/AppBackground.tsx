export function AppBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(60%_50%_at_50%_0%,rgba(168,85,247,0.18),transparent_70%)]" />
      <div className="absolute -top-32 right-[-12rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.12),transparent_70%)] blur-3xl" />
    </div>
  );
}
