import { PIPELINE_STAGES } from "@/config/pipeline";
import { listCrmConversations } from "@/services/crm/pipeline";
import { CrmKanban } from "@/app/crm/crm-kanban";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const conversations = await listCrmConversations();

  return (
    <main className="crm-shell min-h-screen px-4 py-6 md:px-6">
      <header className="mx-auto mb-6 flex max-w-[1600px] flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-teal-800/70">
            Kawasa · Funnel
          </p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight text-zinc-900 md:text-4xl">
            Conversaciones
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600">
            Arrastrá cada chat a su etapa. Al soltar en{" "}
            <strong className="font-medium text-zinc-800">Lead</strong> o{" "}
            <strong className="font-medium text-zinc-800">Ganado</strong> se
            registra la conversión (pending Meta CAPI).
          </p>
        </div>
        <p className="text-xs text-zinc-500">
          {conversations.length} conversaciones · sin auth aún (solo local/staff)
        </p>
      </header>

      <CrmKanban
        initialConversations={conversations}
        stages={PIPELINE_STAGES.map((stage) => ({
          id: stage.id,
          label: stage.label,
          conversionEvent: stage.conversionEvent,
          description: stage.description,
        }))}
      />
    </main>
  );
}
