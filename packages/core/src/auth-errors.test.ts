import { describe, expect, it } from 'vitest';
import { mensagemErroCriarLoja, mensagemErroLogin } from './auth-errors';

describe('mensagemErroLogin', () => {
  it('limite de envio vira pedido de espera', () => {
    expect(mensagemErroLogin({ status: 429 })).toMatch(/Espere alguns minutos/);
    expect(mensagemErroLogin({ code: 'over_email_send_rate_limit' })).toMatch(/Espere/);
  });

  it('código errado ou vencido', () => {
    expect(mensagemErroLogin({ code: 'otp_expired' })).toMatch(/Código inválido ou vencido/);
  });

  it('erro desconhecido tem mensagem genérica, nunca o texto técnico', () => {
    const msg = mensagemErroLogin({ code: 'unexpected_failure', message: 'pg error 42P01' });
    expect(msg).toBe('Não deu certo agora. Tente de novo em instantes.');
  });

  it('sem erro, sem mensagem', () => {
    expect(mensagemErroLogin(null)).toBe('');
  });
});

describe('mensagemErroCriarLoja', () => {
  it('endereço repetido e reservado', () => {
    expect(mensagemErroCriarLoja({ code: '23505' })).toMatch(/já é de outra loja/);
    expect(mensagemErroCriarLoja({ code: '23514' })).toMatch(/reservado/);
  });
});
