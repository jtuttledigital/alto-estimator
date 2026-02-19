// src/app/page.tsx
import ChatWidget from "@/components/ChatWidget";

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
  <h1 className="text-2xl font-semibold text-gray-900">
    Alto Moving — Estimate Chat (MVP)
  </h1>
  <p className="text-sm text-gray-600 mt-1">
    Minimal input → usable answer → next best question. Compliant with WA Tariff 15-C (filed rates within bands).
  </p>
</header>

        <ChatWidget />
      </div>
    </main>
  );
}
