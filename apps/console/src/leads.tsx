import { Titulo } from '@usefood/app';
import { csv, formatarTelefone } from '@usefood/core';
import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  SegmentedControl,
  SelectField,
  Sheet,
  StatusPill,
  TextField,
  type StatusTone,
} from '@usefood/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Lead = Tables<'leads'>;
type Situacao = Enums<'lead_status'>;

const SITUACOES: Record<Situacao, { texto: string; tom: StatusTone }> = {
  novo: { texto: 'Novo', tom: 'destaque' },
  em_contato: { texto: 'Em contato', tom: 'neutro' },
  convertido: { texto: 'Convertido', tom: 'sucesso' },
  descartado: { texto: 'Descartado', tom: 'erro' },
};
const TIPOS = { restaurante: 'Restaurante', franquia: 'Franquia e parceiros' } as const;
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
const origem = (l: Lead) => {
  const o = (l.source ?? {}) as Record<string, string>;
  return [o.utm_source, o.utm_campaign].filter(Boolean).join(' · ') || 'direto';
};

/** Leads das landing pages: restaurantes e candidatos a franqueado ou parceiro. */
export function Leads({ supabase }: { supabase: AppSupabaseClient }) {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [tipo, setTipo] = useState<'todos' | 'restaurante' | 'franquia'>('todos');
  const [situacao, setSituacao] = useState<'todas' | Situacao>('todas');
  const [aberto, setAberto] = useState<Lead | null>(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error) setErro('Não conseguimos carregar os leads.');
    else setLeads(data);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const visiveis = useMemo(
    () =>
      (leads ?? []).filter(
        (l) =>
          (tipo === 'todos' || l.kind === tipo) && (situacao === 'todas' || l.status === situacao),
      ),
    [leads, tipo, situacao],
  );
  const novos = (leads ?? []).filter((l) => l.status === 'novo').length;

  function exportar() {
    const linhas: (string | number)[][] = [
      [
        'Data',
        'Tipo',
        'Nome',
        'WhatsApp',
        'E-mail',
        'Cidade',
        'UF',
        'Negócio',
        'Tipo/perfil',
        'Porte',
        'Mensagem',
        'Origem',
        'Situação',
        'Anotações',
      ],
      ...visiveis.map((l) => [
        quando(l.created_at),
        TIPOS[l.kind],
        l.name,
        formatarTelefone(l.phone),
        l.email ?? '',
        l.city,
        l.state,
        l.business_name ?? '',
        l.segment ?? '',
        l.size ?? '',
        l.message ?? '',
        origem(l),
        SITUACOES[l.status].texto,
        l.notes ?? '',
      ]),
    ];
    const url = URL.createObjectURL(new Blob([csv(linhas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Leads usefood.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Titulo
        titulo="Leads"
        texto={`Contatos das páginas de restaurantes e de franquia${novos ? ` · ${novos} novo${novos > 1 ? 's' : ''}` : ''}`}
        acoes={
          <Button variant="secondary" disabled={!visiveis.length} onClick={exportar}>
            Exportar planilha
          </Button>
        }
      />
      <Alert>{erro}</Alert>
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          label="Tipo"
          options={[
            { value: 'todos', label: 'Todos' },
            { value: 'restaurante', label: 'Restaurantes' },
            { value: 'franquia', label: 'Franquia' },
          ]}
          value={tipo}
          onChange={setTipo}
        />
        <SelectField
          label="Situação"
          className="w-48"
          options={[
            { value: 'todas', label: 'Todas' },
            ...Object.entries(SITUACOES).map(([v, s]) => ({ value: v, label: s.texto })),
          ]}
          value={situacao}
          onChange={(v) => setSituacao(v as 'todas' | Situacao)}
        />
      </div>

      {!leads ? (
        <p className="text-body text-ink-muted">Carregando os leads…</p>
      ) : visiveis.length === 0 ? (
        <p className="text-body text-ink-muted">Nenhum lead aqui ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
          {visiveis.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setAberto(l)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-surface-strong"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-strong text-ink">
                    {l.name}
                    {l.business_name ? ` · ${l.business_name}` : ''}
                  </span>
                  <span className="text-caption text-ink-muted">
                    {TIPOS[l.kind]} · {l.city}/{l.state} · {quando(l.created_at)} · {origem(l)}
                  </span>
                </div>
                <StatusPill tone={SITUACOES[l.status].tom}>{SITUACOES[l.status].texto}</StatusPill>
              </button>
            </li>
          ))}
        </ul>
      )}

      {aberto && (
        <FichaDoLead
          supabase={supabase}
          lead={aberto}
          onFechar={() => setAberto(null)}
          onSalvo={async () => {
            setAberto(null);
            await carregar();
          }}
        />
      )}
    </>
  );
}

function FichaDoLead({
  supabase,
  lead,
  onFechar,
  onSalvo,
}: {
  supabase: AppSupabaseClient;
  lead: Lead;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [status, setStatus] = useState<Situacao>(lead.status);
  const [notas, setNotas] = useState(lead.notes ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setSalvando(true);
    const { error } = await supabase
      .from('leads')
      .update({ status, notes: notas.trim() || null })
      .eq('id', lead.id);
    setSalvando(false);
    if (error) return setErro('Não foi possível salvar.');
    onSalvo();
  }

  const detalhes: [string, string | null][] = [
    ['Tipo', TIPOS[lead.kind]],
    ['WhatsApp', formatarTelefone(lead.phone)],
    ['E-mail', lead.email],
    ['Cidade', `${lead.city}/${lead.state}`],
    ['Negócio', lead.business_name],
    [lead.kind === 'franquia' ? 'Como quer participar' : 'Tipo do restaurante', lead.segment],
    ['Pedidos por dia', lead.size],
    ['Mensagem', lead.message],
    ['Origem', origem(lead)],
    ['Recebido em', quando(lead.created_at)],
  ];

  return (
    <Sheet
      open
      onClose={onFechar}
      title={lead.name}
      footer={
        <div className="flex flex-col gap-2">
          <Alert>{erro}</Alert>
          <Button className="h-target-pdv" loading={salvando} onClick={() => void salvar()}>
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <a
          href={`https://wa.me/55${lead.phone}?text=${encodeURIComponent(`Oi, ${lead.name}! Aqui é da equipe usefood.`)}`}
          target="_blank"
          rel="noreferrer"
        >
          <Button variant="secondary" className="w-full">
            Chamar no WhatsApp
          </Button>
        </a>
        <dl className="grid grid-cols-2 gap-3">
          {detalhes
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className={k === 'Mensagem' ? 'col-span-2' : ''}>
                <dt className="text-caption text-ink-muted">{k}</dt>
                <dd className="text-body text-ink">{v}</dd>
              </div>
            ))}
        </dl>
        <SelectField
          label="Situação"
          options={Object.entries(SITUACOES).map(([v, s]) => ({ value: v, label: s.texto }))}
          value={status}
          onChange={(v) => setStatus(v as Situacao)}
        />
        <TextField
          label="Anotações"
          placeholder="Ex.: ligar quinta à tarde; já usa outro sistema"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>
    </Sheet>
  );
}
