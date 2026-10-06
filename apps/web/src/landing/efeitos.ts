// Efeitos das páginas novas, carregados à parte (não atrasam a abertura da página).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

export function iniciarEfeitos(): void {
  // Rolagem macia; os links internos rolam com ela, descontando o cabeçalho
  const lenis = new Lenis({ lerp: 0.1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((tempo) => lenis.raf(tempo * 1000));
  gsap.ticker.lagSmoothing(0);
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const alvo = id && id.length > 1 ? document.querySelector<HTMLElement>(id) : null;
      if (!alvo) return;
      e.preventDefault();
      lenis.scrollTo(alvo, { offset: -72 });
    });
  });

  // O momento principal: o título da abertura sobe palavra por palavra
  const abertura = document.querySelector<HTMLElement>('[data-abertura]');
  const titulo = abertura?.querySelector('h1');
  if (abertura && titulo) {
    gsap.set([titulo, ...abertura.querySelectorAll('[data-entra]')], { visibility: 'visible' });
    const partes = SplitText.create(titulo, { type: 'words,lines', mask: 'lines' });
    const linha = gsap.timeline({ defaults: { ease: 'power4.out' } });
    linha
      .from(partes.words, { yPercent: 110, duration: 1, stagger: 0.07 })
      .from(
        abertura.querySelectorAll('[data-entra]'),
        { y: 24, autoAlpha: 0, duration: 0.8, stagger: 0.08 },
        '-=0.6',
      );
  }

  // Fotos grandes: parallax lento
  gsap.utils.toArray<HTMLElement>('[data-paralaxe-foto]').forEach((foto) => {
    gsap.fromTo(
      foto,
      { yPercent: -6 },
      {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: foto.parentElement ?? foto,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      },
    );
  });

  // Títulos de seção: as linhas sobem ao entrar na tela
  gsap.utils.toArray<HTMLElement>('[data-titulo]').forEach((el) => {
    const partes = SplitText.create(el, { type: 'lines', mask: 'lines' });
    gsap.from(partes.lines, {
      yPercent: 100,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
  });
}
