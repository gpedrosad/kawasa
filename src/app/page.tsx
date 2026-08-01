export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
        Kapso CRM Base
      </p>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
        Base lista para WhatsApp Cloud API con Coexistence
      </h1>
      <p className="text-lg leading-relaxed text-zinc-600">
        API routes, servicios, webhooks firmados, tipado estricto e interfaces
        para IA y base de datos. Los secretos viven solo en el servidor.
      </p>
      <ul className="space-y-2 text-zinc-700">
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            POST /api/whatsapp/send-text
          </code>
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            POST /api/whatsapp/send-audio
          </code>
        </li>
        <li>
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">
            POST /api/webhooks/kapso
          </code>
        </li>
      </ul>
      <p className="text-sm text-zinc-500">
        Configura <code>.env.local</code> desde <code>.env.example</code> y
        revisa el README.
      </p>
    </main>
  );
}
