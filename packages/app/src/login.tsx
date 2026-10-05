import { mensagemErroLogin } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Alert, Button, TextField } from '@usefood/ui';
import { useState, type FormEvent } from 'react';
import { Tela, Titulo } from './tela';

/** Entrada sem senha: e-mail → código (6 a 8 números, conforme o projeto). Conta nova é criada no primeiro acesso. */
export function Login({ supabase }: { supabase: AppSupabaseClient }) {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [aguardando, setAguardando] = useState(false);

  async function pedirCodigo() {
    setErro('');
    setAguardando(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setAguardando(false);
    if (error) {
      setErro(mensagemErroLogin(error));
      return false;
    }
    return true;
  }

  async function enviarEmail(evento: FormEvent) {
    evento.preventDefault();
    if (await pedirCodigo()) setEtapa('codigo');
  }

  async function reenviar() {
    setAviso('');
    if (await pedirCodigo()) setAviso('Mandamos um código novo.');
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    setErro('');
    setAguardando(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: codigo,
      type: 'email',
    });
    setAguardando(false);
    // Deu certo: a sessão muda e o App troca de tela sozinho.
    if (error) setErro(mensagemErroLogin(error));
  }

  if (etapa === 'email') {
    return (
      <Tela>
        <Titulo
          titulo="Entre no seu restaurante"
          texto="Digite seu e-mail. Vamos mandar um código de acesso, sem senha para decorar."
        />
        <form className="flex flex-col gap-5" onSubmit={enviarEmail}>
          <TextField
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Alert>{erro}</Alert>
          <Button type="submit" loading={aguardando}>
            Receber código
          </Button>
        </form>
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo
        titulo="Confira seu e-mail"
        texto={
          <>
            Mandamos um código para <strong className="text-ink">{email.trim()}</strong>. Ele vale
            por 1 hora.
          </>
        }
      />
      <form className="flex flex-col gap-5" onSubmit={confirmar}>
        <TextField
          label="Código"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,8}"
          maxLength={8}
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
          hint={aviso || 'Não chegou? Olhe a caixa de spam.'}
        />
        <Alert>{erro}</Alert>
        <Button type="submit" loading={aguardando} disabled={codigo.length < 6}>
          Entrar
        </Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => void reenviar()} disabled={aguardando}>
          Mandar outro código
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEtapa('email');
            setCodigo('');
            setErro('');
            setAviso('');
          }}
        >
          Usar outro e-mail
        </Button>
      </div>
    </Tela>
  );
}
