import { useAppContext } from '@usefood/app';
import { checkStoreSlug, mensagemErroCriarLoja, slugify } from '@usefood/core';
import type { AppSupabaseClient } from '@usefood/db';
import { Button, TextField } from '@usefood/ui';
import { useState, type FormEvent } from 'react';
import { Aviso, Tela, Titulo } from './tela';

/** Primeira loja da conta: nome e endereço. O resto do cadastro vem na E04. */
export function CriarRestaurante({
  supabase,
  onCriado,
}: {
  supabase: AppSupabaseClient;
  onCriado: () => void;
}) {
  const { brand } = useAppContext();
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [erro, setErro] = useState('');
  const [aguardando, setAguardando] = useState(false);

  const endereco = slugEditado ? slug : slugify(nome);
  const checagem = endereco ? checkStoreSlug(endereco) : null;
  const erroEndereco =
    checagem && !checagem.ok
      ? checagem.reason === 'reservado'
        ? 'Esse endereço é reservado pelo sistema. Escolha outro.'
        : 'Use de 3 a 40 letras minúsculas, números ou hífen.'
      : undefined;

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    if (!checagem?.ok) return;
    setErro('');
    setAguardando(true);
    const { error } = await supabase.rpc('criar_restaurante', {
      p_marca: brand,
      p_nome: nome.trim(),
      p_slug: endereco,
    });
    setAguardando(false);
    if (error) {
      setErro(mensagemErroCriarLoja(error));
      return;
    }
    onCriado();
  }

  return (
    <Tela>
      <Titulo
        titulo="Vamos criar sua loja"
        texto="Só o nome e o endereço por enquanto. Dá para mudar depois."
      />
      <form className="flex flex-col gap-5" onSubmit={criar}>
        <TextField
          label="Nome da loja"
          autoComplete="organization"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <TextField
          label="Endereço da loja"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={endereco}
          onChange={(e) => {
            setSlugEditado(true);
            setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
          }}
          error={erroEndereco}
          hint={
            endereco
              ? `Seu link vai ser ${window.location.host}/${endereco}`
              : 'É o link que seus clientes vão usar.'
          }
        />
        <Aviso>{erro}</Aviso>
        <Button type="submit" loading={aguardando} disabled={!checagem?.ok || !nome.trim()}>
          Criar minha loja
        </Button>
      </form>
    </Tela>
  );
}
