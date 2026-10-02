/** Formato mínimo de um erro do Supabase (Auth ou banco). */
export interface ErroLike {
  code?: string | undefined;
  status?: number | undefined;
  message?: string | undefined;
}

/** Traduz erros de login para frases que o dono do restaurante entende. */
export function mensagemErroLogin(erro: ErroLike | null | undefined): string {
  if (!erro) return '';
  const code = erro.code ?? '';
  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    erro.status === 429
  ) {
    return 'Muitos códigos pedidos em pouco tempo. Espere alguns minutos e tente de novo.';
  }
  if (code === 'otp_expired' || code === 'invalid_credentials') {
    return 'Código inválido ou vencido. Confira os 6 números ou peça um código novo.';
  }
  if (code === 'email_address_invalid' || code === 'validation_failed') {
    return 'Esse e-mail não parece válido. Confira e tente de novo.';
  }
  if (code === 'signup_disabled') return 'O cadastro de novas contas está fechado no momento.';
  return 'Não deu certo agora. Tente de novo em instantes.';
}

/** Traduz erros ao criar um restaurante (função criar_restaurante). */
export function mensagemErroCriarLoja(erro: ErroLike | null | undefined): string {
  if (!erro) return '';
  if (erro.code === '23505') return 'Esse endereço já é de outra loja. Escolha outro.';
  if (erro.code === '23514') return 'Esse endereço é reservado pelo sistema. Escolha outro.';
  if (erro.code === 'P0002') return 'Esta marca não está aceitando lojas novas no momento.';
  return 'Não foi possível criar a loja agora. Tente de novo em instantes.';
}
