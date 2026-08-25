import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.jsx'
import { authReady, msalInstance } from './authConfig.js'

const root = createRoot(document.getElementById('root'));
const render = content => root.render(<StrictMode>{content}</StrictMode>);

if (!authReady) {
  render(<main className="configuration-message">Microsoft Entra ID has not been configured. Add the values in <code>frontend/.env</code> and restart the app.</main>);
} else {
  msalInstance.initialize()
    .then(() => render(<MsalProvider instance={msalInstance}><App /></MsalProvider>))
    .catch(() => render(<main className="configuration-message">Microsoft Entra ID could not be initialized. Check the Entra configuration and redirect URI.</main>));
}
