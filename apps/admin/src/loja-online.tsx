import {
  DIAS_DA_SEMANA,
  formatarPreco,
  formatarTelefone,
  lerCep,
  lerPreco,
  lerTelefone,
  precoParaCampo,
} from '@usefood/core';
import type { AppSupabaseClient, Enums, Tables } from '@usefood/db';
import {
  Alert,
  Button,
  ChoiceGrid,
  Panel,
  SegmentedControl,
  StatusPill,
  Switch,
  TextField,
} from '@usefood/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Tela, Titulo } from './tela';

type Loja = Pick<
  Tables<'restaurants'>,
  | 'slug'
  | 'status'
  | 'description'
  | 'phone'
  | 'postal_code'
  | 'street'
  | 'street_number'
  | 'complement'
  | 'district'
  | 'city'
  | 'state'
  | 'accepts_delivery'
  | 'accepts_pickup'
  | 'delivery_fee_mode'
  | 'delivery_radius_km'
  | 'min_order_cents'
  | 'free_delivery_above_cents'
  | 'prep_minutes_min'
  | 'prep_minutes_max'
> & { location: unknown };
type Bairro = Pick<Tables<'delivery_districts'>, 'id' | 'name' | 'fee_cents'>;
type Faixa = Pick<Tables<'delivery_bands'>, 'id' | 'up_to_km' | 'fee_cents'>;
type Horario = Pick<Tables<'opening_hours'>, 'id' | 'weekday' | 'opens' | 'closes'>;

const CAMPOS =
  'slug, status, description, phone, postal_code, street, street_number, complement, district, city, state, accepts_delivery, accepts_pickup, delivery_fee_mode, delivery_radius_km, min_order_cents, free_delivery_above_cents, prep_minutes_min, prep_minutes_max, location';
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const hora = (t: string) => t.slice(0, 5);

/** Tudo o que a loja online precisa: dados, horários, entrega e publicar. Dono e gerente. */
export function LojaOnline({
  supabase,
  loja,
  onVoltar,
}: {
  supabase: AppSupabaseClient;
  loja: { id: string; name: string };
  onVoltar: () => void;
}) {
  const [dados, setDados] = useState<Loja | null>(null);
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [faixas, setFaixas] = useState<Faixa[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [pendencias, setPendencias] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  const carregar = useCallback(async () => {
    const [l, b, f, h, p] = await Promise.all([
      supabase.from('restaurants').select(CAMPOS).eq('id', loja.id).single(),
      supabase
        .from('delivery_districts')
        .select('id, name, fee_cents')
        .eq('restaurant_id', loja.id)
        .order('name'),
      supabase
        .from('delivery_bands')
        .select('id, up_to_km, fee_cents')
        .eq('restaurant_id', loja.id)
        .order('up_to_km'),
      supabase
        .from('opening_hours')
        .select('id, weekday, opens, closes')
        .eq('restaurant_id', loja.id)
        .order('weekday')
        .order('opens'),
      supabase.rpc('pendencias_para_publicar', { p_restaurant_id: loja.id }),
    ]);
    if (l.error || b.error || f.error || h.error) {
      setErro('Não conseguimos carregar os dados da loja.');
      return;
    }
    setDados(l.data);
    setBairros(b.data);
    setFaixas(f.data);
    setHorarios(h.data);
    setPendencias(p.data ?? []);
  }, [supabase, loja.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  const avisar = (texto: string) => {
    setErro('');
    setAviso(texto);
    void carregar();
  };
  const falhar = (texto: string) => {
    setAviso('');
    setErro(texto);
  };

  if (!dados) {
    return (
      <Tela larga>
        <p className="text-body text-ink-muted">{erro || 'Carregando a loja…'}</p>
      </Tela>
    );
  }

  const noAr = dados.status === 'ativo';

  return (
    <Tela larga>
      <Button variant="ghost" className="self-start px-0" onClick={onVoltar}>
        ← {loja.name}
      </Button>
      <Titulo
        titulo="Loja online"
        texto="O que o cliente vê para pedir pela internet: dados, horários e entrega."
      />
      <Alert>{erro}</Alert>
      <Alert tone="sucesso">{aviso}</Alert>

      <Panel
        title="Situação"
        actions={
          <StatusPill tone={noAr ? 'sucesso' : 'neutro'}>
            {noAr ? 'No ar' : dados.status === 'pausado' ? 'Pausada' : 'Em cadastro'}
          </StatusPill>
        }
      >
        {noAr ? (
          <p className="text-body text-ink">
            A loja está no ar em{' '}
            <strong>
              {window.location.host}/{dados.slug}
            </strong>
            .
          </p>
        ) : pendencias.length ? (
          <>
            <p className="text-body text-ink-muted">Para publicar, falta:</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-body text-ink">
              {pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-body text-ink">Tudo pronto para publicar.</p>
        )}
        <div className="flex gap-2">
          {noAr ? (
            <Button
              variant="secondary"
              onClick={async () => {
                const { error } = await supabase.rpc('pausar_loja', { p_restaurant_id: loja.id });
                if (error) falhar('Não foi possível tirar a loja do ar.');
                else avisar('Loja fora do ar. Os dados continuam salvos.');
              }}
            >
              Tirar do ar
            </Button>
          ) : (
            <Button
              disabled={pendencias.length > 0}
              onClick={async () => {
                const { error } = await supabase.rpc('publicar_loja', { p_restaurant_id: loja.id });
                if (error) falhar(error.message);
                else avisar('Loja publicada!');
              }}
            >
              Publicar a loja
            </Button>
          )}
        </div>
      </Panel>

      <DadosDaLoja
        supabase={supabase}
        lojaId={loja.id}
        dados={dados}
        onSalvo={avisar}
        onErro={falhar}
      />
      <Horarios
        supabase={supabase}
        lojaId={loja.id}
        horarios={horarios}
        onSalvo={avisar}
        onErro={falhar}
      />
      <Entrega
        supabase={supabase}
        lojaId={loja.id}
        dados={dados}
        bairros={bairros}
        faixas={faixas}
        onSalvo={avisar}
        onErro={falhar}
      />
    </Tela>
  );
}

interface Acoes {
  supabase: AppSupabaseClient;
  lojaId: string;
  onSalvo: (texto: string) => void;
  onErro: (texto: string) => void;
}

function DadosDaLoja({ supabase, lojaId, dados, onSalvo, onErro }: Acoes & { dados: Loja }) {
  const [f, setF] = useState({
    description: dados.description ?? '',
    phone: dados.phone ? formatarTelefone(dados.phone) : '',
    postal_code: dados.postal_code ?? '',
    street: dados.street ?? '',
    street_number: dados.street_number ?? '',
    complement: dados.complement ?? '',
    district: dados.district ?? '',
    city: dados.city ?? '',
    state: dados.state ?? '',
  });
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [localizando, setLocalizando] = useState(false);
  const campo = (nome: keyof typeof f) => ({
    value: f[nome],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [nome]: e.target.value }),
  });

  async function buscarCep() {
    const cep = lerCep(f.postal_code);
    if (!cep) return onErro('O CEP tem 8 números.');
    setBuscando(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = (await r.json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (j.erro) onErro('CEP não encontrado. Preencha o endereço à mão.');
      else
        setF({
          ...f,
          street: j.logradouro || f.street,
          district: j.bairro || f.district,
          city: j.localidade || f.city,
          state: j.uf || f.state,
        });
    } catch {
      onErro('Não foi possível buscar o CEP agora. Preencha o endereço à mão.');
    } finally {
      setBuscando(false);
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    const telefone = f.phone.trim() ? lerTelefone(f.phone) : null;
    if (f.phone.trim() && !telefone)
      return onErro('Confira o telefone: DDD e número, como (17) 99123-4567.');
    const cep = f.postal_code.trim() ? lerCep(f.postal_code) : null;
    if (f.postal_code.trim() && !cep) return onErro('O CEP tem 8 números.');
    setSalvando(true);
    const vazio = (v: string) => v.trim() || null;
    const { error } = await supabase
      .from('restaurants')
      .update({
        description: vazio(f.description),
        phone: telefone,
        postal_code: cep,
        street: vazio(f.street),
        street_number: vazio(f.street_number),
        complement: vazio(f.complement),
        district: vazio(f.district),
        city: vazio(f.city),
        state: vazio(f.state.toUpperCase()),
      })
      .eq('id', lojaId);
    setSalvando(false);
    if (error) onErro('Não foi possível salvar. Confira os campos.');
    else onSalvo('Dados da loja salvos.');
  }

  function marcarLocalizacao() {
    if (!navigator.geolocation) return onErro('Este aparelho não informa a localização.');
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { error } = await supabase.rpc('definir_localizacao', {
          p_restaurant_id: lojaId,
          p_latitude: pos.coords.latitude,
          p_longitude: pos.coords.longitude,
        });
        setLocalizando(false);
        if (error) onErro(error.message);
        else onSalvo('Localização da loja marcada.');
      },
      () => {
        setLocalizando(false);
        onErro(
          'Não conseguimos a localização. Permita o acesso no navegador e tente de novo, de dentro da loja.',
        );
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <Panel title="Dados da loja">
      <form className="flex flex-col gap-4" onSubmit={salvar}>
        <TextField
          label="Descrição curta"
          hint="Aparece embaixo do nome. Ex.: Pastéis e caldo de cana desde 1998."
          maxLength={300}
          {...campo('description')}
        />
        <TextField
          label="WhatsApp ou telefone"
          inputMode="tel"
          placeholder="(17) 99123-4567"
          {...campo('phone')}
        />
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="CEP"
            inputMode="numeric"
            className="w-40"
            maxLength={9}
            {...campo('postal_code')}
          />
          <Button variant="secondary" loading={buscando} onClick={() => void buscarCep()}>
            Buscar endereço
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <TextField label="Rua" maxLength={120} {...campo('street')} />
          <TextField label="Número" maxLength={20} {...campo('street_number')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Complemento" maxLength={80} {...campo('complement')} />
          <TextField label="Bairro" maxLength={80} {...campo('district')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5rem]">
          <TextField label="Cidade" maxLength={80} {...campo('city')} />
          <TextField label="UF" maxLength={2} {...campo('state')} />
        </div>
        <Button type="submit" className="self-start" loading={salvando}>
          Salvar dados
        </Button>
      </form>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="text-body-strong text-ink">Localização no mapa</span>
        <p className="text-caption text-ink-muted">
          {dados.location ? 'Marcada. ' : 'Ainda não marcada. '}
          Usada na entrega por distância e para a loja aparecer na vitrine da cidade. Faça isso de
          dentro da loja.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          loading={localizando}
          onClick={marcarLocalizacao}
        >
          Usar a localização deste aparelho
        </Button>
      </div>
    </Panel>
  );
}

function Horarios({
  supabase,
  lojaId,
  horarios,
  onSalvo,
  onErro,
}: Acoes & { horarios: Horario[] }) {
  const [dia, setDia] = useState<string>('1');
  const [abre, setAbre] = useState('18:00');
  const [fecha, setFecha] = useState('23:00');
  const [todos, setTodos] = useState(false);

  async function adicionar(evento: FormEvent) {
    evento.preventDefault();
    if (abre === fecha) return onErro('Abrir e fechar não podem ser no mesmo horário.');
    const dias = todos ? [0, 1, 2, 3, 4, 5, 6] : [Number(dia)];
    const { error } = await supabase
      .from('opening_hours')
      .insert(dias.map((d) => ({ restaurant_id: lojaId, weekday: d, opens: abre, closes: fecha })));
    if (error) onErro('Não foi possível salvar o horário.');
    else onSalvo(fecha < abre ? 'Horário salvo. Ele passa da meia-noite.' : 'Horário salvo.');
  }

  return (
    <Panel title="Horários de funcionamento">
      <ul className="flex flex-col gap-2">
        {DIAS_DA_SEMANA.map((nome, d) => {
          const doDia = horarios.filter((h) => h.weekday === d);
          return (
            <li key={nome} className="flex flex-wrap items-center gap-2">
              <span className="w-20 text-body-strong text-ink">{nome}</span>
              {doDia.length === 0 && <span className="text-caption text-ink-muted">Fechado</span>}
              {doDia.map((h) => (
                <span
                  key={h.id}
                  className="flex items-center gap-1 rounded-pill bg-surface-strong py-1 pr-1 pl-3 text-label text-ink"
                >
                  {hora(h.opens)}–{hora(h.closes)}
                  <button
                    type="button"
                    aria-label={`Tirar o horário ${hora(h.opens)} a ${hora(h.closes)} de ${nome}`}
                    className="flex size-8 items-center justify-center rounded-pill text-ink-muted hover:bg-surface"
                    onClick={async () => {
                      const { error } = await supabase
                        .from('opening_hours')
                        .delete()
                        .eq('id', h.id);
                      if (error) onErro('Não foi possível tirar o horário.');
                      else onSalvo('Horário removido.');
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </li>
          );
        })}
      </ul>
      <form
        className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-4"
        onSubmit={adicionar}
      >
        <span className="text-body-strong text-ink">Adicionar horário</span>
        <SegmentedControl
          label="Dia da semana"
          className="flex-wrap self-start"
          options={DIAS_CURTOS.map((d, i) => ({ value: String(i), label: d }))}
          value={todos ? null : dia}
          onChange={(v) => {
            setDia(v);
            setTodos(false);
          }}
        />
        <Switch checked={todos} onChange={setTodos} label="Todos os dias" showLabel />
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Abre"
            type="time"
            className="w-36"
            value={abre}
            onChange={(e) => setAbre(e.target.value)}
          />
          <TextField
            label="Fecha"
            type="time"
            className="w-36"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Adicionar
          </Button>
        </div>
        <p className="text-caption text-ink-muted">
          Fechar depois da meia-noite vale: 18:00 até 02:00 continua aberto na madrugada.
        </p>
      </form>
    </Panel>
  );
}

function Entrega({
  supabase,
  lojaId,
  dados,
  bairros,
  faixas,
  onSalvo,
  onErro,
}: Acoes & { dados: Loja; bairros: Bairro[]; faixas: Faixa[] }) {
  const [delivery, setDelivery] = useState(dados.accepts_delivery);
  const [retirada, setRetirada] = useState(dados.accepts_pickup);
  const [modo, setModo] = useState<Enums<'delivery_fee_mode'>>(dados.delivery_fee_mode);
  const [raio, setRaio] = useState(
    dados.delivery_radius_km ? String(dados.delivery_radius_km).replace('.', ',') : '',
  );
  const [minimo, setMinimo] = useState(
    dados.min_order_cents ? precoParaCampo(dados.min_order_cents) : '',
  );
  const [gratisAcima, setGratisAcima] = useState(
    dados.free_delivery_above_cents ? precoParaCampo(dados.free_delivery_above_cents) : '',
  );
  const [tempoMin, setTempoMin] = useState(String(dados.prep_minutes_min));
  const [tempoMax, setTempoMax] = useState(String(dados.prep_minutes_max));
  const [salvando, setSalvando] = useState(false);
  const [novoBairro, setNovoBairro] = useState({ nome: '', taxa: '' });
  const [novaFaixa, setNovaFaixa] = useState({ km: '', taxa: '' });

  async function salvar() {
    const km = raio.trim() ? Number(raio.replace(',', '.')) : null;
    const min = minimo.trim() ? lerPreco(minimo) : 0;
    const acima = gratisAcima.trim() ? lerPreco(gratisAcima) : null;
    const t1 = Number(tempoMin);
    const t2 = Number(tempoMax);
    if (km !== null && !(km > 0)) return onErro('Confira o raio em km, por exemplo 5.');
    if (min === null || (gratisAcima.trim() && acima === null))
      return onErro('Confira os valores em reais.');
    if (!(t1 >= 5 && t2 >= t1))
      return onErro('Confira o tempo de entrega: o máximo precisa ser maior que o mínimo.');
    setSalvando(true);
    const { error } = await supabase
      .from('restaurants')
      .update({
        accepts_delivery: delivery,
        accepts_pickup: retirada,
        delivery_fee_mode: modo,
        delivery_radius_km: km,
        min_order_cents: min,
        free_delivery_above_cents: acima,
        prep_minutes_min: t1,
        prep_minutes_max: t2,
      })
      .eq('id', lojaId);
    setSalvando(false);
    if (error) onErro('Não foi possível salvar a entrega.');
    else onSalvo('Entrega salva.');
  }

  return (
    <Panel title="Entrega e retirada">
      <Switch checked={delivery} onChange={setDelivery} label="Fazer delivery" showLabel />
      <Switch
        checked={retirada}
        onChange={setRetirada}
        label="O cliente pode pedir e retirar na loja"
        showLabel
      />
      {delivery && (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-body-strong text-ink">Taxa de entrega</span>
            <ChoiceGrid
              label="Taxa de entrega"
              columns={3}
              options={[
                { value: 'gratis', label: 'Grátis' },
                { value: 'bairro', label: 'Por bairro' },
                { value: 'distancia', label: 'Por distância' },
              ]}
              value={modo}
              onChange={setModo}
            />
          </div>
          {modo === 'gratis' && (
            <TextField
              label="Entregar até (km da loja)"
              inputMode="decimal"
              placeholder="Vazio = a cidade toda"
              className="w-56"
              value={raio}
              onChange={(e) => setRaio(e.target.value)}
            />
          )}
          {modo === 'bairro' && (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col divide-y divide-line">
                {bairros.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-body text-ink">{b.name}</span>
                    <span className="text-body text-ink-muted tabular-nums">
                      {b.fee_cents ? formatarPreco(b.fee_cents) : 'Grátis'}
                    </span>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={async () => {
                        const { error } = await supabase
                          .from('delivery_districts')
                          .delete()
                          .eq('id', b.id);
                        if (error) onErro('Não foi possível tirar o bairro.');
                        else onSalvo(`${b.name} removido.`);
                      }}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <form
                className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const taxa = novoBairro.taxa.trim() ? lerPreco(novoBairro.taxa) : 0;
                  if (!novoBairro.nome.trim() || taxa === null) return;
                  const { error } = await supabase
                    .from('delivery_districts')
                    .insert({ restaurant_id: lojaId, name: novoBairro.nome, fee_cents: taxa });
                  if (error)
                    onErro(
                      error.code === '23505'
                        ? 'Esse bairro já está na lista.'
                        : 'Não foi possível salvar o bairro.',
                    );
                  else {
                    setNovoBairro({ nome: '', taxa: '' });
                    onSalvo(`${novoBairro.nome.trim()} adicionado.`);
                  }
                }}
              >
                <TextField
                  label="Bairro"
                  value={novoBairro.nome}
                  onChange={(e) => setNovoBairro({ ...novoBairro, nome: e.target.value })}
                />
                <TextField
                  label="Taxa"
                  inputMode="decimal"
                  placeholder="Grátis"
                  value={novoBairro.taxa}
                  onChange={(e) => setNovoBairro({ ...novoBairro, taxa: e.target.value })}
                />
                <Button type="submit" variant="secondary" disabled={!novoBairro.nome.trim()}>
                  Adicionar
                </Button>
              </form>
            </div>
          )}
          {modo === 'distancia' && (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col divide-y divide-line">
                {faixas.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1 text-body text-ink">
                      Até {String(f.up_to_km).replace('.', ',')} km
                    </span>
                    <span className="text-body text-ink-muted tabular-nums">
                      {f.fee_cents ? formatarPreco(f.fee_cents) : 'Grátis'}
                    </span>
                    <Button
                      variant="ghost"
                      className="text-danger"
                      onClick={async () => {
                        const { error } = await supabase
                          .from('delivery_bands')
                          .delete()
                          .eq('id', f.id);
                        if (error) onErro('Não foi possível tirar a faixa.');
                        else onSalvo('Faixa removida.');
                      }}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
              <form
                className="grid grid-cols-[8rem_7rem_auto] items-end gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const km = Number(novaFaixa.km.replace(',', '.'));
                  const taxa = novaFaixa.taxa.trim() ? lerPreco(novaFaixa.taxa) : 0;
                  if (!(km > 0) || taxa === null) return onErro('Confira a distância e a taxa.');
                  const { error } = await supabase
                    .from('delivery_bands')
                    .insert({ restaurant_id: lojaId, up_to_km: km, fee_cents: taxa });
                  if (error)
                    onErro(
                      error.code === '23505'
                        ? 'Já existe uma faixa com essa distância.'
                        : 'Não foi possível salvar a faixa.',
                    );
                  else {
                    setNovaFaixa({ km: '', taxa: '' });
                    onSalvo('Faixa adicionada.');
                  }
                }}
              >
                <TextField
                  label="Até (km)"
                  inputMode="decimal"
                  value={novaFaixa.km}
                  onChange={(e) => setNovaFaixa({ ...novaFaixa, km: e.target.value })}
                />
                <TextField
                  label="Taxa"
                  inputMode="decimal"
                  placeholder="Grátis"
                  value={novaFaixa.taxa}
                  onChange={(e) => setNovaFaixa({ ...novaFaixa, taxa: e.target.value })}
                />
                <Button type="submit" variant="secondary" disabled={!novaFaixa.km.trim()}>
                  Adicionar
                </Button>
              </form>
              <p className="text-caption text-ink-muted">
                Endereço além da última faixa não recebe entrega. Precisa da localização da loja
                marcada.
              </p>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label="Pedido mínimo"
              inputMode="decimal"
              placeholder="Sem mínimo"
              value={minimo}
              onChange={(e) => setMinimo(e.target.value)}
            />
            {modo !== 'gratis' && (
              <TextField
                label="Entrega grátis acima de"
                inputMode="decimal"
                placeholder="Opcional"
                value={gratisAcima}
                onChange={(e) => setGratisAcima(e.target.value)}
              />
            )}
          </div>
        </>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Tempo de entrega, mínimo (min)"
          inputMode="numeric"
          className="w-56"
          value={tempoMin}
          onChange={(e) => setTempoMin(e.target.value.replace(/\D/g, ''))}
        />
        <TextField
          label="Máximo (min)"
          inputMode="numeric"
          className="w-36"
          value={tempoMax}
          onChange={(e) => setTempoMax(e.target.value.replace(/\D/g, ''))}
        />
      </div>
      <Button className="self-start" loading={salvando} onClick={() => void salvar()}>
        Salvar entrega
      </Button>
    </Panel>
  );
}
