import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import ResponseForm from "./ResponseForm";
import WalletAuth from "./WalletAuth";

export default function Dashboard() {
  const { logout, user, ready } = usePrivy();
  const [isWalletReady, setIsWalletReady] = useState(false);

  useEffect(() => {
    // Simple check if user has a wallet
    if (ready && user?.wallet?.address) {
      console.log("✅ Dashboard: Wallet is ready:", user.wallet.address);
      setIsWalletReady(true);
    } else {
      setIsWalletReady(false);
    }
  }, [ready, user]);

  const walletAddress = user?.wallet?.address;
  const displayAddress = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : 'Initializing...';

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
            {isWalletReady && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Ready
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
        
        {isWalletReady ? (
          <ResponseForm />
        ) : (
          <div className="bg-yellow-50 p-4 rounded-md text-yellow-700">
            Please wait while we initialize your wallet...
          </div>
        )}
      </div>
    </div>
  );
}