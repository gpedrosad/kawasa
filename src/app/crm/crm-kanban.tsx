"use client";

import { useState, useTransition } from "react";
import type { PipelineStageId } from "@/config/pipeline";
import type { CrmConversationCard } from "@/services/crm/pipeline";
import { formatDateTimeAr } from "@/utils/datetime";

type StageMeta = {
  id: PipelineStageId;
  label: string;
  conversionEvent: string | null;
  description: string;
};

export function CrmKanban({
  initialConversations,
  stages,
}: {
  initialConversations: CrmConversationCard[];
  stages: StageMeta[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<PipelineStageId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function moveToStage(conversationId: string, stage: PipelineStageId) {
    const previous = conversations;
    const current = previous.find((item) => item.id === conversationId);
    if (!current || current.stage === stage) {
      return;
    }

    setConversations((items) =>
      items.map((item) =>
        item.id === conversationId ? { ...item, stage } : item,
      ),
    );
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/crm/conversations/${conversationId}/stage`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage }),
          },
        );
        const payload = (await response.json()) as {
          ok: boolean;
          data?: {
            conversionRecorded: boolean;
            conversionEvent: string | null;
          };
          error?: { message?: string };
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error?.message ?? "No se pudo mover");
        }

        if (payload.data?.conversionRecorded && payload.data.conversionEvent) {
          setToast(
            `Conversión ${payload.data.conversionEvent} registrada (pending CAPI)`,
          );
        } else {
          setToast(`Movido a ${stages.find((s) => s.id === stage)?.label}`);
        }
      } catch (moveError) {
        setConversations(previous);
        setError(
          moveError instanceof Error
            ? moveError.message
            : "Error al actualizar etapa",
        );
      }
    });
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      {(toast || error) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {toast && (
            <p className="rounded-full bg-teal-900/90 px-3 py-1.5 text-xs text-teal-50">
              {toast}
              <button
                type="button"
                className="ml-2 underline decoration-teal-200/60"
                onClick={() => setToast(null)}
              >
                ok
              </button>
            </p>
          )}
          {error && (
            <p className="rounded-full bg-red-900/90 px-3 py-1.5 text-xs text-red-50">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const cards = conversations.filter((item) => item.stage === stage.id);
          const isOver = overStage === stage.id;

          return (
            <section
              key={stage.id}
              className={`flex w-[280px] shrink-0 flex-col rounded-2xl border bg-white/70 backdrop-blur-sm transition ${
                isOver
                  ? "border-teal-600/50 bg-teal-50/80"
                  : "border-zinc-200/80"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => {
                setOverStage((current) =>
                  current === stage.id ? null : current,
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id =
                  event.dataTransfer.getData("text/conversation-id") ||
                  draggingId;
                setOverStage(null);
                setDraggingId(null);
                if (id) {
                  void moveToStage(id, stage.id);
                }
              }}
            >
              <header className="border-b border-zinc-200/70 px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    {stage.label}
                  </h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600">
                    {cards.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                  {stage.description}
                  {stage.conversionEvent
                    ? ` · Conv: ${stage.conversionEvent}`
                    : ""}
                </p>
              </header>

              <ul className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                {cards.map((card) => (
                  <li
                    key={card.id}
                    draggable={!isPending}
                    onDragStart={(event) => {
                      setDraggingId(card.id);
                      event.dataTransfer.setData(
                        "text/conversation-id",
                        card.id,
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverStage(null);
                    }}
                    className={`cursor-grab rounded-xl border border-zinc-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
                      draggingId === card.id ? "opacity-50" : ""
                    }`}
                  >
                    <p className="text-sm font-medium text-zinc-900">
                      {card.contactName ?? card.phoneNumber ?? "Sin nombre"}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                      {card.phoneNumber ?? "—"}
                    </p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {formatDateTimeAr(card.lastMessageAt)}
                    </p>
                    {card.hasAdTouch && (
                      <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-900">
                        CTWA / ad
                      </p>
                    )}
                  </li>
                ))}
                {cards.length === 0 && (
                  <li className="rounded-xl border border-dashed border-zinc-200 px-3 py-6 text-center text-[11px] text-zinc-400">
                    Soltá acá
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
