import './landing.css';
import { iniciarPaginasNovas } from './paginas-novas';

const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Entrada ao rolar (e barras do gráfico)
const aoVer = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        e.target.classList.add('visivel');
        aoVer.unobserve(e.target);
      }
    }
  },
  { rootMargin: '0px 0px -10% 0px' },
);
document.querySelectorAll('.revelar, [data-ao-ver]').forEach((el) => aoVer.observe(el));

// Parallax leve: só transform (não mexe no layout), um quadro por vez
const paralaxe = [...document.querySelectorAll<HTMLElement>('[data-paralaxe]')];
if (!reduzir && paralaxe.length) {
  let agendado = false;
  const mover = () => {
    agendado = false;
    const meio = window.innerHeight / 2;
    for (const el of paralaxe) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
      const fator = Number(el.dataset.paralaxe) || 0.15;
      el.style.transform = `translate3d(0, ${((r.top + r.height / 2 - meio) * -fator).toFixed(1)}px, 0)`;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!agendado) {
        agendado = true;
        requestAnimationFrame(mover);
      }
    },
    { passive: true },
  );
  mover();
}

// "Do pedido à porta": a etapa no meio da tela define o que o celular mostra
const historia = document.querySelector<HTMLElement>('.historia');
if (historia) {
  const etapas = [...historia.querySelectorAll<HTMLElement>('.etapa')];
  const passo = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        const n = (e.target as HTMLElement).dataset.etapa ?? '1';
        historia.dataset.passo = n;
        etapas.forEach((x) => x.classList.toggle('atual', x === e.target));
      }
    },
    { rootMargin: '-45% 0px -45% 0px' },
  );
  etapas.forEach((x) => passo.observe(x));
}

// Topo ganha sombra ao rolar
const topo = document.querySelector('[data-topo]');
window.addEventListener('scroll', () => topo?.classList.toggle('shadow-md', window.scrollY > 8), {
  passive: true,
});

// Formulário de contato → enviar_lead (sem login), com a origem da campanha
const URL_DO_BANCO = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const CHAVE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

function origem(): Record<string, string> {
  const url = new URL(window.location.href);
  const o: Record<string, string> = { pagina: url.pathname };
  for (const [k, v] of url.searchParams) if (k.startsWith('utm_') && v) o[k] = v.slice(0, 100);
  if (document.referrer) o.referrer = document.referrer.slice(0, 200);
  return o;
}

document.querySelectorAll<HTMLFormElement>('form[data-lead]').forEach((form) => {
  const aviso = form.querySelector<HTMLElement>('[data-aviso]');
  const botao = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!form.reportValidity()) return;
    const d = new FormData(form);
    const texto = (k: string) => String(d.get(k) ?? '').trim();
    const celular = texto('celular').replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(celular)) {
      if (aviso) aviso.textContent = 'Informe o WhatsApp com DDD, por exemplo (17) 99123-4567.';
      return;
    }
    if (!URL_DO_BANCO || !CHAVE) {
      if (aviso)
        aviso.textContent = 'Envio indisponível nesta publicação. Fale com a gente pelo WhatsApp.';
      return;
    }
    botao?.setAttribute('disabled', '');
    if (botao) botao.textContent = 'Enviando…';
    if (aviso) aviso.textContent = '';
    try {
      const r = await fetch(`${URL_DO_BANCO}/rest/v1/rpc/enviar_lead`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: CHAVE,
          Authorization: `Bearer ${CHAVE}`,
        },
        body: JSON.stringify({
          p_tipo: form.dataset.lead,
          p_nome: texto('nome'),
          p_celular: celular,
          p_cidade: texto('cidade'),
          p_uf: texto('uf'),
          p_aceite: d.get('aceite') === 'on',
          p_email: texto('email') || null,
          p_negocio: texto('negocio') || null,
          p_segmento: texto('segmento') || null,
          p_porte: texto('porte') || null,
          p_mensagem: texto('mensagem') || null,
          p_origem: origem(),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string; code?: string };
        throw new Error(j.code === 'P0001' || j.code === '22023' ? j.message : 'falhou');
      }
      form.innerHTML =
        '<div role="status" class="flex flex-col gap-3 py-6"><p class="text-title-screen font-black text-ink">Recebemos seus dados!</p><p class="text-body text-ink-muted">Nossa equipe vai chamar você no WhatsApp para conversar. Obrigado pelo interesse.</p></div>';
    } catch (erro) {
      const msg =
        erro instanceof Error && erro.message !== 'falhou'
          ? erro.message
          : 'Não foi possível enviar agora. Confira a internet e tente de novo.';
      if (aviso) aviso.textContent = msg;
      botao?.removeAttribute('disabled');
      if (botao) botao.textContent = form.dataset.botao ?? 'Enviar';
    }
  });
});

// Ano no rodapé
document
  .querySelectorAll('[data-ano]')
  .forEach((el) => (el.textContent = String(new Date().getFullYear())));

iniciarPaginasNovas();
