import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const CHAIN_ID = 11155111;
const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;

export default function WalletAuth() {
  const { authenticated, user, ready } = usePrivy();
  const [walletAddress, setWalletAddress] = useState(null);
  const [walletStatus, setWalletStatus] = useState('initializing');
  const [networkStatus, setNetworkStatus] = useState('checking');

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

        console.log("🌐 Connecting to Sepolia via Infura...");
        const provider = new ethers.JsonRpcProvider(
          `https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`
        );

        const network = await provider.getNetwork();
        console.log("🔗 Connected to network:", {
          name: network.name,
          chainId: Number(network.chainId)
        });

        const chainId = Number(network.chainId);
        if (chainId !== CHAIN_ID) {
          console.error("❌ Wrong network:", chainId);
          setNetworkStatus('wrong-network');
          return;
        }

        console.log("✅ Connected to Sepolia network");
        setNetworkStatus('connected');

      } catch (error) {
        console.error("❌ Wallet initialization error:", error);
        setWalletStatus('error');
        setNetworkStatus('error');
      }
    };

    initWallet();
  }, [authenticated, user, ready]);

  return (
    <div className="p-4 bg-white shadow-md rounded-md space-y-4">
      {walletStatus === 'initializing' && (
        <p className="text-yellow-600">
          Initializing wallet...
        </p>
      )}
      
      {walletStatus === 'no-wallet' && (
        <p className="text-red-500">No wallet available. Please try logging out and back in.</p>
      )}
      
      {walletStatus === 'provider-error' && (
        <p className="text-red-500">Error connecting to wallet provider. Please refresh and try again.</p>
      )}
      
      {walletStatus === 'error' && (
        <p className="text-red-500">Error initializing wallet. Please refresh the page.</p>
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