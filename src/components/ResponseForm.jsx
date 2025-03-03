import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { supabase } from '../lib/supabaseClient';
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from 'ethers';
import { 
  createPublicClient, 
  http, 
  formatEther
} from 'viem';
import { OPECHO_ADDRESS, OPECHO_ABI } from '../eas/config/contracts';
import schemaInfo from '../eas/config/schema.json';

// Network configuration
const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;
const SEPOLIA_CHAIN_ID = 11155111;
const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";

// Master wallet for transactions (has funds)
const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY;

// Validation
if (!INFURA_PROJECT_ID) {
  console.error('🚫 Missing VITE_INFURA_PROJECT_ID environment variable');
}

if (!PRIVATE_KEY) {
  console.error('🚫 Missing VITE_PRIVATE_KEY environment variable');
}

/**
 * ResponseForm Component
 * 
 * This component handles user responses, submits them to Supabase,
 * creates attestations on EAS, and rewards users with OPECHO tokens.
 * 
 * It uses a master wallet to pay for gas fees, so users don't need ETH.
 */
export default function ResponseForm() {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [publicClient, setPublicClient] = useState(null);
  const [masterWallet, setMasterWallet] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [rewardsPoolBalance, setRewardsPoolBalance] = useState('0');
  const [rewardsDistributed, setRewardsDistributed] = useState('0');
  const [nextRewardTime, setNextRewardTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [error, setError] = useState(null);

  // Initialize blockchain providers and contract state
  useEffect(() => {
    const initProvider = async () => {
      try {
        if (!ready || !wallets[0]) {
          setLoadingProvider(true);
          return;
        }

        const userAddress = await wallets[0].address;

        if (!INFURA_PROJECT_ID || !PRIVATE_KEY) {
          throw new Error("Missing required environment variables");
        }

        // Create chain configuration
        const sepoliaChain = {
          id: SEPOLIA_CHAIN_ID,
          name: 'Sepolia',
          network: 'sepolia',
          nativeCurrency: {
            name: 'Sepolia Ether',
            symbol: 'ETH',
            decimals: 18
          }
        };

        // Create viem public client with rate limiting protection
        const client = createPublicClient({
          chain: sepoliaChain,
          transport: http(`https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`, {
            retryCount: 5,
            retryDelay: 1000,
            timeout: 30000
          })
        });
        setPublicClient(client);

        // Initialize master wallet with private key
        try {
          const masterWalletInstance = new ethers.Wallet(PRIVATE_KEY);
          const ethersProvider = new ethers.JsonRpcProvider(`https://sepolia.infura.io/v3/${INFURA_PROJECT_ID}`);
          const connectedWallet = masterWalletInstance.connect(ethersProvider);
          
          // Check balance
          const balance = await ethersProvider.getBalance(masterWalletInstance.address);
          
          if (balance < ethers.parseEther("0.01")) {
            console.warn("⚠️ Master wallet has low balance, transactions may fail");
          }
          
          setMasterWallet(connectedWallet);
        } catch (walletError) {
          setError(`Master wallet error: ${walletError.message}`);
        }
        
        try {
          // Get contract state
          const [
            balance,
            poolBalance,
            distributed,
            eligible,
            timeUntilNext,
            paused
          ] = await Promise.all([
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'balanceOf',
              args: [userAddress]
            }).catch(() => 0n),
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'getRewardsPoolBalance',
              args: []
            }).catch(() => 0n),
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'rewardsDistributed',
              args: []
            }).catch(() => 0n),
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'isEligibleForReward',
              args: [userAddress]
            }).catch(() => true),
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'getTimeUntilNextReward',
              args: [userAddress]
            }).catch(() => 0n),
            client.readContract({
              address: OPECHO_ADDRESS,
              abi: OPECHO_ABI,
              functionName: 'paused',
              args: []
            }).catch(() => false)
          ]);
          
          setTokenBalance(formatEther(balance));
          setRewardsPoolBalance(formatEther(poolBalance));
          setRewardsDistributed(formatEther(distributed));
          setIsEligible(eligible);
          setNextRewardTime(Number(timeUntilNext));
          setIsPaused(paused);
          setLoadingProvider(false);
          setError(null);
        } catch (contractError) {
          setError(`Contract error: ${contractError.message}`);
          setLoadingProvider(false);
        }
      } catch (error) {
        setError(`Provider error: ${error.message}`);
        setLoadingProvider(false);
      }
    };

    initProvider();
  }, [ready, wallets[0]]);

  // Countdown timer for next reward
  useEffect(() => {
    let timer;
    if (nextRewardTime > 0) {
      timer = setInterval(() => {
        setNextRewardTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setIsEligible(true);
            clearInterval(timer);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [nextRewardTime]);

  /**
   * Handle form submission
   * 1. Save response to Supabase
   * 2. Create attestation on EAS
   * 3. Reward user with OPECHO tokens
   * 4. Update UI state
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('');

    try {
      // Validation checks
      if (!wallets[0]) throw new Error('No wallet address found');
      if (!publicClient) throw new Error('Provider is not initialized');
      if (!masterWallet) throw new Error('Master wallet is not initialized');
      if (isPaused) throw new Error('Rewards are currently paused');
      if (!isEligible) throw new Error(`Please wait ${nextRewardTime} seconds before submitting again`);

      const userAddress = await wallets[0].address;
      const timestamp = new Date().toISOString();

      // Step 1: Save to Supabase
      try {
        const { error: supabaseError } = await supabase
          .from('test_responses')
          .insert([{
            user_id: userAddress,
            response: response === 'true',
            created_at: timestamp
          }]);

        if (supabaseError) throw supabaseError;
      } catch (supabaseError) {
        throw new Error(`Supabase error: ${supabaseError.message}`);
      }

      // Step 2: Create attestation using master wallet
      try {
        // Initialize EAS SDK with the master wallet
        const eas = new EAS(EAS_CONTRACT_ADDRESS);
        eas.connect(masterWallet);

        const schemaEncoder = new SchemaEncoder("string created_at, string user_id, string response");
        const encodedData = schemaEncoder.encodeData([
          { name: "created_at", value: timestamp, type: "string" },
          { name: "user_id", value: userAddress, type: "string" },
          { name: "response", value: response, type: "string" }
        ]);

        const tx = await eas.attest({
          schema: schemaInfo.uid,
          data: {
            recipient: userAddress,
            expirationTime: 0n,
            revocable: true,
            data: encodedData
          }
        });

        await tx.wait();
      } catch (easError) {
        throw new Error(`EAS attestation failed: ${easError.message}`);
      }

      // Step 3: Process reward using master wallet
      try {
        // Create contract instance with master wallet
        const contract = new ethers.Contract(OPECHO_ADDRESS, OPECHO_ABI, masterWallet);
        
        // Send reward transaction
        const tx = await contract.rewardUser(userAddress);
        await tx.wait();
      } catch (contractError) {
        throw new Error(`Reward transaction failed: ${contractError.message}`);
      }

      // Step 4: Update state
      const [
        newBalance, 
        newPoolBalance, 
        newDistributed,
        newTimeUntilNext,
        newEligible
      ] = await Promise.all([
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'balanceOf',
          args: [userAddress]
        }).catch(() => 0n),
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'getRewardsPoolBalance',
          args: []
        }).catch(() => 0n),
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'rewardsDistributed',
          args: []
        }).catch(() => 0n),
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'getTimeUntilNextReward',
          args: [userAddress]
        }).catch(() => 0n),
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'isEligibleForReward',
          args: [userAddress]
        }).catch(() => false)
      ]);

      setTokenBalance(formatEther(newBalance));
      setRewardsPoolBalance(formatEther(newPoolBalance));
      setRewardsDistributed(formatEther(newDistributed));
      setNextRewardTime(Number(newTimeUntilNext));
      setIsEligible(newEligible);

      setSubmitStatus('✅ Response submitted and tokens rewarded!');
      setResponse('');
    } catch (error) {
      setSubmitStatus(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format time for display
  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Now';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white shadow-md rounded-md p-6">
      <h2 className="text-xl font-semibold mb-4">Submit Response</h2>
      
      {error && (
        <div className="bg-red-50 p-4 rounded-md text-red-700 mb-4">
          {error}
        </div>
      )}
      
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Your Balance:</span>
          <span className="font-semibold">{tokenBalance} OPECHO</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Rewards Pool:</span>
          <span className="font-semibold">{rewardsPoolBalance} OPECHO</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Total Rewards Given:</span>
          <span className="font-semibold">{rewardsDistributed} OPECHO</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Next Reward Available:</span>
          <span className={`font-semibold ${isEligible ? 'text-green-600' : 'text-yellow-600'}`}>
            {formatTime(nextRewardTime)}
          </span>
        </div>
        {masterWallet && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Gas Fees:</span>
            <span className="font-semibold text-green-600">Covered by Master Wallet</span>
          </div>
        )}
      </div>
      
      {isPaused && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-yellow-700 text-sm">
            ⚠️ Rewards are currently paused by the contract owner
          </p>
        </div>
      )}
      
      {loadingProvider && (
        <p className="text-sm text-yellow-600 mb-4">
          ⏳ Initializing blockchain connection...
        </p>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-700 mb-2">Your Response:</label>
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="w-full p-2 border rounded"
            disabled={isSubmitting || loadingProvider}
          >
            <option value="">Select your response</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        
        <button
          type="submit"
          disabled={!response || isSubmitting || loadingProvider || !isEligible || isPaused || !masterWallet}
          className={`w-full py-2 px-4 rounded ${
            !response || isSubmitting || loadingProvider || !isEligible || isPaused || !masterWallet
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 
           isPaused ? 'Rewards Paused' :
           !masterWallet ? 'Master Wallet Not Ready' :
           !isEligible ? `Wait ${formatTime(nextRewardTime)}` :
           'Submit Response'}
        </button>
        
        {submitStatus && (
          <div className={`p-2 rounded ${
            submitStatus.includes('Error') 
              ? 'bg-red-100 text-red-700' 
              : 'bg-green-100 text-green-700'
          }`}>
            {submitStatus}
          </div>
        )}
      </form>
    </div>
  );
}