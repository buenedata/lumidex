'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="text-6xl">📶</div>
      <h1 className="text-2xl font-bold text-white">You&apos;re offline</h1>
      <p className="text-slate-400 max-w-sm">
        No internet connection detected. Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-500 active:scale-95 transition-all"
      >
        Try again
      </button>
    </div>
  );
}
