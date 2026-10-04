/** Mensagem de erro em português vinda de uma Edge Function (campo "erro" do corpo). */
export async function mensagemDaFuncao(erro: unknown): Promise<string> {
  const contexto = (erro as { context?: { json?: () => Promise<{ erro?: string }> } } | null)
    ?.context;
  try {
    const corpo = await contexto?.json?.();
    if (corpo?.erro) return corpo.erro;
  } catch {
    // corpo não era JSON
  }
  return 'Não deu certo agora. Confira a internet e tente de novo.';
}
