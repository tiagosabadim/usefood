import { useAppContext } from '@usefood/app';
import { lerTelefone } from '@usefood/core';
import { Alert, Button, SelectField, TextField } from '@usefood/ui';
import { useId, useState, type FormEvent } from 'react';

const UFS =
  'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');
const ERROS = new Set(['P0001', '22023']);

export interface CampoExtra {
  chave: 'negocio' | 'segmento' | 'porte' | 'mensagem';
  rotulo: string;
  opcoes?: string[];
  obrigatorio?: boolean;
}

/** De onde a pessoa veio: parâmetros de campanha (utm_*), a página e o site anterior. */
function origem(): Record<string, string> {
  const url = new URL(window.location.href);
  const o: Record<string, string> = { pagina: url.pathname };
  for (const [k, v] of url.searchParams) if (k.startsWith('utm_') && v) o[k] = v.slice(0, 100);
  if (document.referrer) o.referrer = document.referrer.slice(0, 200);
  return o;
}

/** Formulário de captação das landing pages (restaurantes e franquia), com aceite da LGPD. */
export function FormularioDeLead({
  tipo,
  titulo,
  extras,
  botao,
}: {
  tipo: 'restaurante' | 'franquia';
  titulo: string;
  extras: CampoExtra[];
  botao: string;
}) {
  const { supabase } = useAppContext();
  const aceiteId = useId();
  const [f, setF] = useState({
    nome: '',
    celular: '',
    email: '',
    cidade: '',
    uf: 'SP',
    negocio: '',
    segmento: '',
    porte: '',
    mensagem: '',
  });
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  const campo = (k: keyof typeof f) => ({
    value: f[k],
    onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }),
  });
  const faltaExtra = extras.find((x) => x.obrigatorio && !f[x.chave].trim());
  const faltando = !f.nome.trim()
    ? 'Informe seu nome.'
    : !lerTelefone(f.celular)
      ? 'Informe o WhatsApp com DDD.'
      : !f.cidade.trim()
        ? 'Informe a cidade.'
        : faltaExtra
          ? `Preencha: ${faltaExtra.rotulo.toLowerCase()}.`
          : !aceite
            ? 'Marque o aceite para enviar.'
            : null;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (faltando || !supabase) return;
    setErro('');
    setEnviando(true);
    const { error } = await supabase.rpc('enviar_lead', {
      p_tipo: tipo,
      p_nome: f.nome.trim(),
      p_celular: lerTelefone(f.celular)!,
      p_cidade: f.cidade.trim(),
      p_uf: f.uf,
      p_aceite: aceite,
      p_email: f.email.trim() || null,
      p_negocio: f.negocio.trim() || null,
      p_segmento: f.segmento.trim() || null,
      p_porte: f.porte.trim() || null,
      p_mensagem: f.mensagem.trim() || null,
      p_origem: origem(),
    });
    setEnviando(false);
    if (error)
      return setErro(
        error.code && ERROS.has(error.code)
          ? error.message
          : 'Não foi possível enviar agora. Confira a internet e tente de novo.',
      );
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-lg bg-surface p-6 lg:p-8">
        <h3 className="font-display text-title-screen text-ink">Recebemos seus dados!</h3>
        <p className="text-body text-ink-muted">
          Nossa equipe vai chamar você no WhatsApp para conversar. Obrigado pelo interesse.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 rounded-lg bg-surface p-6 lg:p-8">
      <h3 className="font-display text-title-screen text-ink">{titulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Seu nome" autoComplete="name" maxLength={80} {...campo('nome')} />
        <TextField
          label="WhatsApp com DDD"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(17) 99123-4567"
          {...campo('celular')}
        />
        <TextField
          label="E-mail (opcional)"
          type="email"
          autoComplete="email"
          maxLength={120}
          {...campo('email')}
        />
        <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <TextField
            label="Cidade"
            autoComplete="address-level2"
            maxLength={80}
            {...campo('cidade')}
          />
          <SelectField
            label="UF"
            options={UFS.map((u) => ({ value: u, label: u }))}
            value={f.uf}
            onChange={(uf) => setF({ ...f, uf })}
          />
        </div>
        {extras.map((x) =>
          x.opcoes ? (
            <SelectField
              key={x.chave}
              label={x.rotulo}
              options={[
                { value: '', label: 'Escolha' },
                ...x.opcoes.map((o) => ({ value: o, label: o })),
              ]}
              value={f[x.chave]}
              onChange={(v) => setF({ ...f, [x.chave]: v })}
            />
          ) : (
            <TextField
              key={x.chave}
              label={x.rotulo}
              maxLength={x.chave === 'mensagem' ? 1000 : 80}
              className={x.chave === 'mensagem' ? 'sm:col-span-2' : ''}
              {...campo(x.chave)}
            />
          ),
        )}
      </div>
      <label htmlFor={aceiteId} className="flex items-start gap-3 text-body text-ink">
        <input
          id={aceiteId}
          type="checkbox"
          checked={aceite}
          onChange={(e) => setAceite(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-brand"
        />
        <span>
          Aceito ser contatado pela equipe usefood pelo WhatsApp, telefone ou e-mail sobre este
          interesse.
        </span>
      </label>
      <Alert>{erro}</Alert>
      {faltando && <p className="text-caption text-ink-muted">{faltando}</p>}
      <Button
        type="submit"
        className="h-target-pdv"
        loading={enviando}
        disabled={Boolean(faltando)}
      >
        {botao}
      </Button>
    </form>
  );
}
