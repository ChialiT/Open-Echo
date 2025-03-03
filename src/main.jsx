import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App'
import './index.css'

const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;

// Validate environment variables
if (!INFURA_PROJECT_ID) {
  console.error('🚫 Missing VITE_INFURA_PROJECT_ID environment variable');
}

// Log the first few characters of the Infura ID for debugging (safely)
console.log('Infura Project ID prefix:', INFURA_PROJECT_ID ? `${INFURA_PROJECT_ID.slice(0, 4)}...` : 'not set');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cm7qhzme2007r6yudwawav3pp"
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: { theme: 'light' },
        embeddedWallets: {
          noPrompt: false,
          requireUserPasswordOnCreate: false,
          defaultChainId: 11155111,
          chains: [{
            id: 11155111,
            name: 'Sepolia',
            rpcUrl: `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`,
            blockExplorerUrl: 'https://sepolia.etherscan.io'
          }]
        }
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
) 