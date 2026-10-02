import { describe, expect, it } from 'vitest';
import { normalizeHost, resolveBrandFromHost } from './brand';

describe('normalizeHost', () => {
  it('remove porta, www e maiúsculas', () => {
    expect(normalizeHost('WWW.GuapiFood.com.br:443')).toBe('guapifood.com.br');
  });
});

describe('resolveBrandFromHost', () => {
  const domains = { 'guapifood.com.br': 'guapifood', 'usefood.com.br': 'usefood' };

  it('usa o domínio cadastrado', () => {
    expect(resolveBrandFromHost('www.guapifood.com.br', domains)).toBe('guapifood');
  });

  it('entende subdomínios de .localhost em desenvolvimento', () => {
    expect(resolveBrandFromHost('guapifood.localhost:5175')).toBe('guapifood');
  });

  it('cai na marca padrão em previews e domínios desconhecidos', () => {
    expect(resolveBrandFromHost('deploy-preview-12--usefood-web.netlify.app', domains)).toBe(
      'usefood',
    );
    expect(resolveBrandFromHost('localhost')).toBe('usefood');
  });
});
