import { lerCep } from '@usefood/core';
import { Button, TextField } from '@usefood/ui';
import { useState } from 'react';
import type { EnderecoSalvo } from '../guardado';

export type EnderecoEditavel = Omit<EnderecoSalvo, 'id'>;

/** Campos do endereço com busca por CEP. Com `comApelido`, pede o nome do endereço (Casa, Trabalho…). */
export function CamposDeEndereco({
  valor,
  onChange,
  comApelido = false,
}: {
  valor: EnderecoEditavel;
  onChange: (e: EnderecoEditavel) => void;
  comApelido?: boolean;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState('');
  const campo = (nome: keyof EnderecoEditavel) => ({
    value: valor[nome],
    onChange: (e: { target: { value: string } }) => onChange({ ...valor, [nome]: e.target.value }),
  });

  async function buscarCep() {
    const cep = lerCep(valor.cep);
    if (!cep) return setAviso('O CEP tem 8 números.');
    setBuscando(true);
    try {
      const j = (await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json()) as {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
      };
      if (j.erro) setAviso('CEP não encontrado. Preencha o endereço.');
      else {
        setAviso('');
        onChange({
          ...valor,
          rua: j.logradouro || valor.rua,
          bairro: j.bairro || valor.bairro,
          cidade: j.localidade || valor.cidade,
        });
      }
    } catch {
      setAviso('Não foi possível buscar o CEP agora. Preencha o endereço.');
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {comApelido && (
        <TextField
          label="Nome do endereço"
          placeholder="Ex.: Casa, Trabalho, Casa da mãe"
          maxLength={30}
          {...campo('apelido')}
        />
      )}
      <div className="flex items-end gap-3">
        <TextField
          label="CEP"
          inputMode="numeric"
          autoComplete="postal-code"
          className="w-40"
          maxLength={9}
          {...campo('cep')}
        />
        <Button variant="secondary" loading={buscando} onClick={() => void buscarCep()}>
          Buscar
        </Button>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
        <TextField label="Rua" autoComplete="address-line1" {...campo('rua')} />
        <TextField label="Número" {...campo('numero')} />
      </div>
      <TextField label="Complemento (opcional)" {...campo('complemento')} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Bairro" {...campo('bairro')} />
        <TextField label="Cidade" {...campo('cidade')} />
      </div>
      <TextField label="Ponto de referência (opcional)" {...campo('referencia')} />
      {aviso && <p className="text-caption text-ink-muted">{aviso}</p>}
    </div>
  );
}

export const enderecoCompleto = (e: EnderecoEditavel) =>
  Boolean(e.rua.trim() && e.numero.trim() && e.bairro.trim());

export function resumoDoEndereco(e: EnderecoEditavel): string {
  return `${e.rua}, ${e.numero}${e.complemento ? ` (${e.complemento})` : ''} · ${e.bairro}`;
}
