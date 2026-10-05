import { rotuloDoPapel, type Papel } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { ListaDeEntregas } from '@usefood/pedidos';
import { Button } from '@usefood/ui';

/** App do entregador: pedidos prontos para sair e as entregas dele, concluídas com o código do cliente. */
export function Entregas({
  supabase,
  lojaId,
  loja,
  pessoa,
  euId,
  onSair,
}: {
  supabase: AppSupabaseClient;
  lojaId: string;
  loja: string;
  pessoa: { nome: string; papel: Papel };
  euId: string;
  onSair: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-5 pt-4 pb-8">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-caption text-ink-muted">{loja}</p>
          <p className="truncate text-body-strong text-ink">
            {pessoa.nome} · {rotuloDoPapel(pessoa.papel)}
          </p>
        </div>
        <Button variant="ghost" onClick={onSair}>
          Sair
        </Button>
      </header>
      <ListaDeEntregas supabase={supabase} lojaId={lojaId} euId={euId} modo="entregador" />
    </main>
  );
}
