import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Se uma tela quebrar, mostra o aviso com "Recarregar" em vez de deixar a página em branco. */
export class LimiteDeErro extends Component<{ children: ReactNode }, { erro: boolean }> {
  override state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('Tela quebrou:', erro, info.componentStack);
  }

  override render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="font-display text-title-screen text-ink">Algo deu errado nesta tela</h1>
        <p className="text-body text-ink-muted">
          Seus dados estão salvos. Recarregue para continuar de onde parou.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-target-pdv self-start rounded-pill bg-brand px-6 text-label text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Recarregar
        </button>
      </main>
    );
  }
}
