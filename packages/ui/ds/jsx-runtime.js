// As prévias do design system carregam o React 18 como global (window.React).
// Este arquivo faz o JSX compilado usar esse React em vez de importar um próprio.
import React from 'react';

function criar(type, props, key, estatico) {
  const { children, ...resto } = props || {};
  const final = key === undefined ? resto : { ...resto, key };
  if (estatico && Array.isArray(children)) return React.createElement(type, final, ...children);
  return children === undefined
    ? React.createElement(type, final)
    : React.createElement(type, final, children);
}

export const Fragment = React.Fragment;
export const jsx = (type, props, key) => criar(type, props, key, false);
export const jsxs = (type, props, key) => criar(type, props, key, true);
