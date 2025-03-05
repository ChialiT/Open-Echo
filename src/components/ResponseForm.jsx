import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { createPublicClient, http, formatEther } from 'viem';
import { sepolia } from 'viem/chains';
import { supabase } from '../lib/supabaseClient';
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { OPECHO_ADDRESS, OPECHO_ABI } from '../eas/config/contracts';
import schemaInfo from '../eas/config/schema.json';

// Network configuration
const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;
const ALCHEMY_API_KEY = "X1glLCI8gOevLIBnA1IIXZJItOXrYq_O";
const ALCHEMY_URL = `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
const SEPOLIA_CHAIN_ID = 11155111;
const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const ENTRY_POINT_ADDRESS = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; // EntryPoint 0.7 address

// EAS Schema information
const SCHEMA_UID = "0x46e9a3b4d4a9c6dc0d7ce8c857e3e7db611ace3fb1049b7873277589a9c29dae"; // Replace with your actual schema UID

/**
 * ResponseForm Component
 * 
 * This component handles user responses, submits them to Supabase,
 * creates attestations on EAS, and rewards users with OPECHO tokens.
 * 
 * It uses Alchemy as the provider to connect to the Sepolia network.
 */
export default function ResponseForm() {
  const { ready } = usePrivy();
  const { wallets } = useWallets();
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [publicClient, setPublicClient] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [rewardsPoolBalance, setRewardsPoolBalance] = useState('0');
  const [rewardsDistributed, setRewardsDistributed] = useState('0');
  const [nextRewardTime, setNextRewardTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const [error, setError] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [viewOnlyMode, setViewOnlyMode] = useState(false);
  const [alchemyReady, setAlchemyReady] = useState(false);
  const [bypassTimeLimit, setBypassTimeLimit] = useState(false); // Debug mode to bypass time limits
  const [success, setSuccess] = useState(null);

  // Fetch contract state (balances, eligibility, etc.)
  const fetchContractState = async () => {
    if (!publicClient || !wallets[0]) return;
    
    try {
      const userAddress = wallets[0].address;
      
      // Get contract state
      const [
        balance,
        poolBalance,
        distributed,
        eligible,
        timeUntilNext,
        paused
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
          functionName: 'isEligibleForReward',
          args: [userAddress]
        }).catch(() => true),
        publicClient.readContract({
          address: OPECHO_ADDRESS,
          abi: OPECHO_ABI,
          functionName: 'getTimeUntilNextReward',
          args: [userAddress]
        }).catch(() => 0n),
        publicClient.readContract({
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
    } catch (contractError) {
      console.error("❌ Contract state error:", contractError);
      setError(`Contract error: ${contractError.message}`);
    }
  };

  // Initialize blockchain providers and contract state
  useEffect(() => {
    const initProvider = async () => {
      setLoadingProvider(true);
      setError(null);
      
      try {
        console.log("🌐 Creating public client with Alchemy...");
        // Create a public client with Alchemy provider
        const client = createPublicClient({
          chain: sepolia,
          transport: http(ALCHEMY_URL)
        });
        
        setPublicClient(client);
        
        // Test Alchemy connection
        try {
          console.log("🔄 Initializing ethers provider with Alchemy...");
          const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);
          const blockNumber = await provider.getBlockNumber();
          console.log("✅ Alchemy connection successful, latest block:", blockNumber);
          
          // Check user's ETH balance
          if (wallets[0]) {
            const balance = await provider.getBalance(wallets[0].address);
            const ethBalance = ethers.formatEther(balance);
            console.log("💰 User balance:", ethBalance, "ETH");
          }
          
          setAlchemyReady(true); // Alchemy provider is ready
          setViewOnlyMode(false);
          setError(null);
        } catch (alchemyError) {
          console.error("❌ Alchemy connection error:", alchemyError);
          console.error("Error details:", alchemyError.stack);
          setError(`Alchemy error: ${alchemyError.message}. Network connection may not work.`);
          setAlchemyReady(false);
          setViewOnlyMode(true);
        }
      } catch (error) {
        console.error("❌ Provider initialization error:", error);
        setError(`Provider error: ${error.message}`);
        setAlchemyReady(false);
        setViewOnlyMode(true);
      } finally {
        setLoadingProvider(false);
      }
    };

    if (ready && wallets.length > 0) {
      initProvider();
      fetchContractState();
    } else {
      setLoadingProvider(false);
      
      if (!ready || wallets.length === 0) {
        setViewOnlyMode(true);
        setError("Please connect your wallet to submit responses.");
      }
    }
  }, [ready, wallets]);

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

  // Update contract state periodically
  useEffect(() => {
    if (!publicClient || !wallets[0] || !alchemyReady) return;
    
    // Initial fetch
    fetchContractState();
    
    // Set up interval to refresh contract state every 30 seconds
    const intervalId = setInterval(() => {
      fetchContractState();
    }, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, [publicClient, wallets[0], alchemyReady]);

  /**
   * Handle form submission
   * 1. Save response to Supabase
   * 2. Reward user with OPECHO tokens
   * 3. Update UI state
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!response) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Validation checks
      if (!wallets[0]) throw new Error('No wallet address found');
      if (!publicClient) throw new Error('Provider is not initialized');
      if (!alchemyReady) throw new Error('Alchemy provider is not initialized');
      if (isPaused) throw new Error('Rewards are currently paused');
      
      const userAddress = wallets[0].address;
      
      // Step 1: Save to Supabase
      console.log("📝 Saving response to Supabase...");
      try {
        // Try with test_responses table first
        let result = await supabase
          .from('test_responses')
          .insert([{
            user_id: userAddress,
            response: response === 'true',
            created_at: new Date().toISOString()
          }]);
        
        // If there's an error, try with responses table
        if (result.error) {
          console.log("⚠️ First table attempt failed, trying alternate table structure");
          result = await supabase
            .from('responses')
            .insert([{
              wallet_address: userAddress,
              response_text: response,
              timestamp: new Date().toISOString()
            }]);
        }
        
        if (result.error) {
          console.error("❌ Supabase error:", result.error);
          throw new Error(`Supabase error: ${result.error.message || 'Unknown error'}`);
        }
        
        console.log("✅ Response saved to Supabase");
      } catch (supabaseError) {
        console.error("❌ Supabase error:", supabaseError);
        throw new Error(`Supabase error: ${supabaseError.message || 'Unknown error'}`);
      }
      
      // Skip EAS attestation for now
      console.log("⏭️ Skipping EAS attestation due to issues with the schema or gas");
      
      // Step 2: Reward user with OPECHO tokens
      console.log("🎁 Rewarding user with OPECHO tokens...");
      try {
        // Create a wallet using the private key from environment variables
        const privateKey = import.meta.env.VITE_PRIVATE_KEY;
        if (!privateKey) {
          throw new Error("Missing private key for rewards");
        }
        
        const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log("🔑 Using wallet for rewards:", wallet.address);
        
        // Create contract instance
        const contract = new ethers.Contract(
          OPECHO_ADDRESS,
          OPECHO_ABI,
          wallet
        );
        
        // Call rewardUser function
        const tx = await contract.rewardUser(userAddress);
        await tx.wait();
        console.log("✅ User rewarded with OPECHO tokens");
        
        // Update token balance
        const newBalance = await contract.balanceOf(userAddress);
        setTokenBalance(ethers.formatEther(newBalance));
      } catch (rewardError) {
        console.error("❌ Reward error:", rewardError);
        throw new Error(`Reward failed: ${rewardError.message}`);
      }
      
      // Success!
      setSuccess("Your response has been submitted and you've been rewarded with 5 OPECHO tokens!");
      setResponse("");
      
      // Update contract state
      fetchContractState();
    } catch (error) {
      console.error("❌ Submission error:", error);
      setError(`Error: ${error.message}`);
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
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Submit Response</h2>
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
        >
          {showDebug ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>
      
      {showDebug && (
        <div className="bg-gray-50 p-3 rounded-md mb-4 text-xs font-mono">
          <h3 className="font-semibold mb-2">Environment Variables:</h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>INFURA_PROJECT_ID:</span>
              <span>{INFURA_PROJECT_ID ? `${INFURA_PROJECT_ID.slice(0, 4)}...${INFURA_PROJECT_ID.slice(-4)}` : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>ALCHEMY_API_KEY:</span>
              <span>{ALCHEMY_API_KEY ? `${ALCHEMY_API_KEY.slice(0, 4)}...${ALCHEMY_API_KEY.slice(-4)}` : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>OPECHO_ADDRESS:</span>
              <span>{OPECHO_ADDRESS ? `${OPECHO_ADDRESS.slice(0, 6)}...${OPECHO_ADDRESS.slice(-4)}` : 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span>Alchemy Provider:</span>
              <span>{alchemyReady ? '✅ Ready' : '❌ Not initialized'}</span>
            </div>
            <div className="flex justify-between">
              <span>View Only Mode:</span>
              <span>{viewOnlyMode ? '✅ Active' : '❌ Inactive'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Bypass Time Limits:</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={bypassTimeLimit} 
                  onChange={() => setBypassTimeLimit(!bypassTimeLimit)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>
      )}
      
      {viewOnlyMode && (
        <div className="bg-yellow-50 p-4 rounded-md text-yellow-700 mb-4">
          <p className="font-semibold">View Only Mode</p>
          <p>Due to a connection issue with Alchemy, you can only view your balance but cannot submit responses.</p>
          <p className="text-sm mt-2">Please check your network connection and try again later.</p>
        </div>
      )}
      
      {error && !viewOnlyMode && (
        <div className="bg-red-50 p-4 rounded-md text-red-700 mb-4">
          <p className="font-semibold">Error:</p>
          <p>{error}</p>
          {error.includes("Alchemy") && (
            <div className="mt-2 text-sm">
              <p>This is a network connection issue. Please ensure:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Your internet connection is stable</li>
                <li>The Sepolia network is operational</li>
                <li>You have Sepolia ETH for gas fees</li>
              </ul>
            </div>
          )}
        </div>
      )}
      
      {bypassTimeLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
          <p className="text-yellow-700 text-sm flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Debug Mode: Time limits for rewards are bypassed
          </p>
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
        {alchemyReady && (
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Gas Fees:</span>
            <span className="font-semibold text-yellow-600">
              Requires Sepolia ETH
            </span>
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
            disabled={isSubmitting || loadingProvider || viewOnlyMode}
          >
            <option value="">Select your response</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
        
        <button
          type="submit"
          disabled={!response || isSubmitting || loadingProvider || (!isEligible && !bypassTimeLimit) || isPaused || !alchemyReady || viewOnlyMode}
          className={`w-full py-2 px-4 rounded ${
            !response || isSubmitting || loadingProvider || (!isEligible && !bypassTimeLimit) || isPaused || !alchemyReady || viewOnlyMode
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {isSubmitting ? 'Submitting...' : 
           viewOnlyMode ? 'View Only Mode' :
           isPaused ? 'Rewards Paused' :
           !alchemyReady ? 'Alchemy Not Connected' :
           !isEligible && !bypassTimeLimit ? `Wait ${formatTime(nextRewardTime)}` :
           bypassTimeLimit && !isEligible ? 'Submit (Time Limit Bypassed)' :
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
      
      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {/* Success message */}
      {success && (
        <div className="mt-4 p-3 bg-green-100 text-green-700 rounded-md">
          {success}
        </div>
      )}
    </div>
  );
}