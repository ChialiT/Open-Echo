import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App'
import './index.css'

const INFURA_PROJECT_ID = process.env.VITE_INFURA_PROJECT_ID;

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