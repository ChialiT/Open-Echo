import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";

const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;
const SEPOLIA_CHAIN_ID = 11155111;

export default function WalletAuth() {
  const { authenticated, user, ready } = usePrivy();
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletStatus, setWalletStatus] = useState('initializing');
  const [networkStatus, setNetworkStatus] = useState('checking');
  const [error, setError] = useState(null);

  useEffect(() => {
    const initWallet = async () => {
      console.log("🔄 Initializing WalletAuth component...");
      console.log("Initial state:", {
        ready,
        authenticated,
        hasUser: !!user,
        hasWallet: !!user?.wallet
      });

      try {
        if (!ready) {
          console.log("⏳ Privy not ready yet");
          setWalletStatus('initializing');
          return;
        }

        if (!authenticated) {
          console.log("🔒 User not authenticated");
          setWalletStatus('unauthenticated');
          return;
        }

        if (!user?.wallet?.address) {
          console.log("⚠️ No wallet found for user");
          setWalletStatus('no-wallet');
          return;
        }

        console.log("👛 Found wallet:", user.wallet.address);
        setWalletAddress(user.wallet.address);
        setWalletStatus('ready');

        if (!INFURA_PROJECT_ID) {
          console.error("🚫 Missing INFURA_PROJECT_ID");
          setError("Missing Infura Project ID");
          setNetworkStatus('error');
          return;
        }

        try {
          console.log("🌐 Connecting to Sepolia via Infura...");
          
          // Create a viem public client
          const client = createPublicClient({
            chain: {
              id: SEPOLIA_CHAIN_ID,
              name: 'Sepolia',
              network: 'sepolia',
              nativeCurrency: {
                name: 'Sepolia Ether',
                symbol: 'ETH',
                decimals: 18
              }
            },
            transport: http(`https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`)
          });

          // Check if we can connect to the network
          const blockNumber = await client.getBlockNumber();
          console.log("🔗 Connected to Sepolia network, block:", blockNumber);
          
          setNetworkStatus('connected');
          setError(null);
        } catch (networkError) {
          console.error("❌ Network connection error:", networkError);
          setNetworkStatus('error');
          setError(`Network error: ${networkError.message}`);
        }
      } catch (error) {
        console.error("❌ Wallet initialization error:", error);
        setWalletStatus('error');
        setNetworkStatus('error');
        setError(`Wallet error: ${error.message}`);
      }
    };

    initWallet();
  }, [authenticated, user, ready]);

  return (
    <div className="p-4 bg-white shadow-md rounded-md space-y-4">
      <h2 className="text-xl font-semibold">Wallet Status</h2>
      
      {walletStatus === 'initializing' && (
        <p className="text-yellow-600">
          Initializing wallet...
        </p>
      )}
      
      {walletStatus === 'no-wallet' && (
        <p className="text-red-500">No wallet available. Please try logging out and back in.</p>
      )}
      
      {walletStatus === 'error' && (
        <p className="text-red-500">Error initializing wallet. Please refresh the page.</p>
      )}
      
      {error && (
        <p className="text-red-500 bg-red-50 p-2 rounded">{error}</p>
      )}
      
      {walletStatus === 'ready' && walletAddress && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-gray-600">Wallet Address:</p>
            <p className="font-mono text-blue-500">
              {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-gray-600">Network Status:</p>
            {networkStatus === 'checking' && (
              <p className="text-yellow-500">Checking network...</p>
            )}
            {networkStatus === 'connected' && (
              <p className="text-green-500">Connected to Sepolia</p>
            )}
            {networkStatus === 'wrong-network' && (
              <p className="text-red-500">Please switch to Sepolia network</p>
            )}
            {networkStatus === 'error' && (
              <p className="text-red-500">Network error</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}