import { bootstrap } from '@usefood/app';
import { App } from './App';
import './index.css';

void bootstrap({ app: 'web', element: <App /> });

// App instalável: o service worker guarda os arquivos do app (só na versão publicada)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js'));
}
