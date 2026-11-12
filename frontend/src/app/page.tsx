export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-xl rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          SplitBill — Shared Expense Manager
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Phase 1 environment initialized. Shared expense management and net
          balance calculation will be added in upcoming phases.
        </p>
      </div>
    </main>
  );
}
