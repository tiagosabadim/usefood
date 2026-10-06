// Comportamentos das páginas novas (início e restaurantes): leves, sem biblioteca.
// Os efeitos com GSAP ficam em ./efeitos e carregam à parte.

export function iniciarPaginasNovas(): void {
  const raiz = document.documentElement;
  const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cabeçalho: branco ao rolar
  const cabecalho = document.querySelector('[data-cabecalho]');
  const atualizarCabecalho = () => cabecalho?.classList.toggle('rolou', window.scrollY > 40);
  window.addEventListener('scroll', atualizarCabecalho, { passive: true });
  atualizarCabecalho();

  // Menu do celular
  const botaoMenu = document.querySelector<HTMLButtonElement>('[data-menu]');
  const painel = document.querySelector<HTMLElement>('[data-menu-painel]');
  const abrirMenu = (aberto: boolean) => {
    if (!botaoMenu || !painel) return;
    painel.hidden = !aberto;
    botaoMenu.setAttribute('aria-expanded', String(aberto));
    botaoMenu.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    if (aberto) cabecalho?.classList.add('rolou');
    else atualizarCabecalho();
  };
  botaoMenu?.addEventListener('click', () => abrirMenu(Boolean(painel?.hidden ?? true)));
  painel?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => abrirMenu(false)));

  // Fotos: carregam perto da tela; sem o arquivo, o lugar continua escuro
  const celular = window.matchMedia('(max-width: 47.99rem)').matches;
  const carregarFoto = (el: HTMLElement) => {
    const nome = (celular && el.dataset.fotoCelular) || el.dataset.foto;
    if (!nome) return;
    const url = `/fotos/${nome}.webp`;
    const img = new Image();
    img.onload = () => {
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('pronta');
    };
    img.src = url;
  };
  const fotos = [...document.querySelectorAll<HTMLElement>('[data-foto]')];
  const perto = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        carregarFoto(e.target as HTMLElement);
        perto.unobserve(e.target);
      }
    },
    { rootMargin: '600px 0px' },
  );
  for (const el of fotos) {
    if (el.hasAttribute('data-foto-agora')) carregarFoto(el);
    else perto.observe(el);
  }

  // Formulário da página inicial: restaurante ou cidade
  document.querySelectorAll<HTMLFormElement>('form[data-perfil]').forEach((form) => {
    const botoes = form.querySelectorAll<HTMLButtonElement>('[data-escolher-perfil]');
    const escolher = (perfil: string) => {
      form.dataset.perfil = perfil;
      form.dataset.lead = perfil === 'cidade' ? 'franquia' : 'restaurante';
      botoes.forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.escolherPerfil === perfil)),
      );
      // Campos escondidos não contam no envio nem na validação
      form.querySelectorAll<HTMLElement>('[data-so]').forEach((grupo) => {
        grupo
          .querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')
          .forEach((c) => {
            c.disabled = grupo.dataset.so !== perfil;
          });
      });
    };
    botoes.forEach((b) =>
      b.addEventListener('click', () => escolher(b.dataset.escolherPerfil ?? 'restaurante')),
    );
    escolher(form.dataset.perfil ?? 'restaurante');
  });

  // Efeitos com GSAP: carregam à parte; se demorarem, a abertura aparece parada
  if (!reduzir && document.querySelector('[data-abertura]')) {
    const liberar = window.setTimeout(() => raiz.classList.remove('animar'), 3000);
    void import('./efeitos')
      .then((m) => m.iniciarEfeitos())
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(liberar);
        raiz.classList.remove('animar');
      });
  } else {
    raiz.classList.remove('animar');
  }
}
