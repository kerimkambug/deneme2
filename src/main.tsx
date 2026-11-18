import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles/base.css';
import './styles/site.css';
import './styles/admin.css';
import { registerSw } from './lib/push';

void registerSw();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
