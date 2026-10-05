import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import { Alert, Button, ChoiceGrid, Panel, StatusPill, Switch, TextField } from '@usefood/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Colunas, Tela, Titulo } from './tela';

type Mesa = Pick<Tables<'dining_tables'>, 'id' | 'label' | 'area' | 'is_active'>;

/** Jeito de atender e mesas da loja. Só dono e gerente. */
export function Configuracoes({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  const [chamarPor, setChamarPor] = useState<Enums<'call_mode'> | null>(null);
  const [balcao, setBalcao] = useState<Enums<'counter_service'> | null>(null);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    const [cfg, ms] = await Promise.all([
      supabase.from('restaurants').select('call_by, counter_dine_in').eq('id', loja.id).single(),
      supabase
        .from('dining_tables')
        .select('id, label, area, is_active')
        .eq('restaurant_id', loja.id)
        .order('area')
        .order('position'),
    ]);
    if (cfg.error || ms.error) {
      setErro('Não conseguimos carregar as configurações.');
      return;
    }
    setChamarPor(cfg.data.call_by);
    setBalcao(cfg.data.counter_dine_in);
    setMesas(ms.data);
  }, [supabase, loja.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  async function salvarAtendimento(mudanca: {
    call_by?: Enums<'call_mode'>;
    counter_dine_in?: Enums<'counter_service'>;
  }) {
    setErro('');
    setAviso('');
    const { error } = await supabase.from('restaurants').update(mudanca).eq('id', loja.id);
    if (error) {
      setErro('Não foi possível salvar.');
      void carregar();
      return;
    }
    setAviso('Salvo. O PDV já segue o novo jeito de atender.');
  }

  async function alternarMesa(mesa: Mesa, ativa: boolean) {
    const { error } = await supabase
      .from('dining_tables')
      .update({ is_active: ativa })
      .eq('id', mesa.id);
    if (error) setErro('Não foi possível mudar a mesa.');
    void carregar();
  }

  async function removerMesa(mesa: Mesa) {
    const { error } = await supabase.from('dining_tables').delete().eq('id', mesa.id);
    if (error) setErro('Não foi possível remover a mesa.');
    void carregar();
  }

  const areas = [...new Set(mesas.map((m) => m.area))];

  return (
    <Tela larga>
      <Button variant="ghost" className="self-start px-0 lg:hidden" onClick={onVoltar}>
        ← {loja.name}
      </Button>
      <Titulo titulo="Configurações" texto="Como a loja atende e quais mesas ela tem." />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      <Colunas
        esquerda={
          <>
            <Panel title="Atendimento">
              <div className="flex flex-col gap-2">
                <span className="text-body-strong text-ink">
                  Quando o cliente pede no balcão para comer aqui
                </span>
                <ChoiceGrid
                  label="Comer no local pedindo no balcão"
                  options={[
                    { value: 'cliente_busca', label: 'Ele busca no balcão' },
                    { value: 'garcom_leva', label: 'O garçom leva até a mesa' },
                  ]}
                  value={balcao}
                  onChange={(v) => {
                    setBalcao(v);
                    void salvarAtendimento({ counter_dine_in: v });
                  }}
                />
                <p className="text-caption text-ink-muted">
                  {balcao === 'garcom_leva'
                    ? 'O PDV pede o número da mesa, e o pedido não precisa de senha nem de nome.'
                    : 'Quando ficar pronto, o cliente é chamado no balcão.'}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-body-strong text-ink">Chamar o cliente para retirar por</span>
                <ChoiceGrid
                  label="Chamar o cliente por"
                  options={[
                    { value: 'senha', label: 'Senha (047)' },
                    { value: 'nome', label: 'Nome (João)' },
                  ]}
                  value={chamarPor}
                  onChange={(v) => {
                    setChamarPor(v);
                    void salvarAtendimento({ call_by: v });
                  }}
                />
                <p className="text-caption text-ink-muted">
                  Vale para pedidos para viagem e para quem busca no balcão.
                </p>
              </div>
            </Panel>
          </>
        }
        direita={
          <>
            <Panel
              title="Mesas"
              actions={
                <span className="text-caption text-ink-muted">{mesas.length} cadastradas</span>
              }
            >
              {mesas.length === 0 && (
                <p className="text-body text-ink-muted">
                  Cadastre as mesas para usar a tela Mesas e, depois, o QR code de cada mesa.
                </p>
              )}
              {areas.map((area) => (
                <div key={area} className="flex flex-col gap-2">
                  <h3 className="text-label text-ink-muted">{area}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {mesas
                      .filter((m) => m.area === area)
                      .map((m) => (
                        <li
                          key={m.id}
                          className="flex items-center gap-2 rounded-md border border-line bg-canvas py-1 pr-1 pl-3"
                        >
                          <span className="text-body-strong text-ink">{m.label}</span>
                          {!m.is_active && <StatusPill>Inativa</StatusPill>}
                          <Switch
                            checked={m.is_active}
                            onChange={(v) => void alternarMesa(m, v)}
                            label={`Mesa ${m.label}: ativa`}
                          />
                          <Button
                            variant="ghost"
                            className="px-2 text-danger"
                            aria-label={`Remover a mesa ${m.label}`}
                            onClick={() => void removerMesa(m)}
                          >
                            Remover
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
              <NovasMesas
                sugestaoInicio={
                  mesas.reduce((max, m) => Math.max(max, Number(m.label) || 0), 0) + 1
                }
                onCriar={async (de, ate, area) => {
                  setErro('');
                  const { data, error } = await supabase.rpc('criar_mesas', {
                    p_restaurant_id: loja.id,
                    p_de: de,
                    p_ate: ate,
                    p_area: area,
                  });
                  if (error) {
                    setErro(
                      error.code === '22023' && error.message
                        ? error.message
                        : 'Não foi possível criar as mesas.',
                    );
                    return false;
                  }
                  setAviso(data === 1 ? '1 mesa criada.' : `${data} mesas criadas.`);
                  void carregar();
                  return true;
                }}
              />
            </Panel>
          </>
        }
      />
    </Tela>
  );
}

function NovasMesas({
  sugestaoInicio,
  onCriar,
}: {
  sugestaoInicio: number;
  onCriar: (de: number, ate: number, area: string) => Promise<boolean>;
}) {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [area, setArea] = useState('Salão');
  const [salvando, setSalvando] = useState(false);

  const deNumero = Number(de || sugestaoInicio);
  const ateNumero = Number(ate);
  const valido =
    Number.isInteger(deNumero) &&
    Number.isInteger(ateNumero) &&
    deNumero >= 1 &&
    ateNumero >= deNumero;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!valido) return;
    setSalvando(true);
    if (await onCriar(deNumero, ateNumero, area.trim() || 'Salão')) {
      setDe('');
      setAte('');
    }
    setSalvando(false);
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-4"
    >
      <span className="text-body-strong text-ink">Adicionar mesas</span>
      <div className="grid gap-3 sm:grid-cols-[6rem_6rem_minmax(0,1fr)]">
        <TextField
          label="Da mesa"
          inputMode="numeric"
          placeholder={String(sugestaoInicio)}
          value={de}
          onChange={(e) => setDe(e.target.value.replace(/\D/g, ''))}
        />
        <TextField
          label="Até a"
          inputMode="numeric"
          placeholder="20"
          value={ate}
          onChange={(e) => setAte(e.target.value.replace(/\D/g, ''))}
        />
        <TextField
          label="Área"
          placeholder="Salão, Varanda…"
          maxLength={40}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        variant="secondary"
        className="self-start"
        loading={salvando}
        disabled={!valido}
      >
        {valido ? `Criar mesas ${deNumero} a ${ateNumero}` : 'Criar mesas'}
      </Button>
    </form>
  );
}
