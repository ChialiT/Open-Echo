import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { ethers } from "ethers";
import ResponseForm from "./ResponseForm";
import WalletAuth from "./WalletAuth";

const CHAIN_ID = 11155111;
const INFURA_PROJECT_ID = process.env.VITE_INFURA_PROJECT_ID;

// Validate environment variables
if (!INFURA_PROJECT_ID) {
  console.error('🚫 Missing VITE_INFURA_PROJECT_ID environment variable');
}

// Log the first few characters of the Infura ID for debugging (safely)
console.log('Infura Project ID prefix:', INFURA_PROJECT_ID ? `${INFURA_PROJECT_ID.slice(0, 4)}...` : 'not set');

export default function Dashboard() {
  const { logout, user, ready } = usePrivy();
  const [isWalletReady, setIsWalletReady] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkWallet = async () => {
      console.log("🔄 Checking wallet status in Dashboard...");
      console.log("Dashboard state:", {
        ready,
        hasUser: !!user,
        hasWallet: !!user?.wallet,
        hasInfuraId: !!INFURA_PROJECT_ID
      });

      try {
        if (!INFURA_PROJECT_ID) {
          throw new Error("Infura Project ID is not configured");
        }

        if (!ready || !user?.wallet?.address) {
          console.log("⏳ Waiting for wallet initialization...");
          setIsWalletReady(false);
          return;
        }

        // If we have a wallet address, consider the wallet ready
        setIsWalletReady(true);
        console.log("✅ Wallet is ready:", user.wallet.address);

        // Check network using Infura provider
        console.log("🌐 Connecting to Sepolia via Infura...");
        const provider = new ethers.JsonRpcProvider(
          `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`
        );

        const network = await provider.getNetwork();
        const chainId = Number(network.chainId);
        console.log("🔗 Network status:", {
          chainId,
          name: network.name,
          isSepolia: chainId === CHAIN_ID
        });

        setNetworkReady(chainId === CHAIN_ID);
        setError(null);

      } catch (error) {
        console.error("❌ Error checking wallet status:", error);
        setIsWalletReady(false);
        setNetworkReady(false);
        setError(error.message);
      }
    };

    checkWallet();
  }, [ready, user]);

  const walletAddress = user?.wallet?.address;
  const displayAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Initializing...';

  console.log("📊 Dashboard render state:", {
    walletAddress: displayAddress,
    isWalletReady,
    networkReady,
    error,
    componentStates: {
      showWalletInit: !walletAddress,
      showWalletConnecting: !isWalletReady && walletAddress,
      showNetworkWarning: !networkReady && isWalletReady,
      showResponseForm: networkReady && isWalletReady
    }
  });

  return (
    <div className="max-w-2xl w-full mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-600">
              Wallet: {displayAddress}
            </p>
            {!isWalletReady && walletAddress && (
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Initializing...
              </span>
            )}
            {isWalletReady && !networkReady && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                Wrong Network
              </span>
            )}
            {isWalletReady && networkReady && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Connected
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => {
            console.log("👋 User logging out");
            logout();
          }}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      <div className="space-y-6">
        <WalletAuth />
        {error && (
          <div className="bg-red-50 p-4 rounded-md text-red-700">
            {error}
          </div>
        )}
        {!walletAddress ? (
          <div className="bg-yellow-50 p-4 rounded-md text-yellow-700">
            Please wait while we initialize your wallet...
          </div>
        ) : !isWalletReady ? (
          <div className="bg-yellow-50 p-4 rounded-md text-yellow-700">
            Connecting to your wallet...
          </div>
        ) : !networkReady ? (
          <div className="bg-red-50 p-4 rounded-md text-red-700">
            Please make sure you're connected to the Sepolia network
          </div>
        ) : (
          <ResponseForm />
        )}
      </div>
    </div>
  );
}