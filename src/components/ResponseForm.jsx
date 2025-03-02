import { useState, useEffect } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { supabase } from '../lib/supabaseClient';
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import schemaInfo from '../eas/config/schema.json';
import { OPECHO_ADDRESS, OPECHO_ABI } from '../eas/config/contracts';

// Network configuration
const CHAIN_ID = 11155111;
const EAS_CONTRACT_ADDRESS = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e";
const INFURA_PROJECT_ID = import.meta.env.VITE_INFURA_PROJECT_ID;
const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY;

// Validation
if (!INFURA_PROJECT_ID) {
  console.error('🚫 Missing VITE_INFURA_PROJECT_ID environment variable');
}

if (!PRIVATE_KEY) {
  console.error('🚫 Missing VITE_PRIVATE_KEY environment variable');
}

export default function ResponseForm() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const [masterProvider, setMasterProvider] = useState(null);
  const [loadingProvider, setLoadingProvider] = useState(true);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [rewardsPoolBalance, setRewardsPoolBalance] = useState('0');
  const [rewardsDistributed, setRewardsDistributed] = useState('0');
  const [nextRewardTime, setNextRewardTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isEligible, setIsEligible] = useState(false);

  useEffect(() => {
    const initProvider = async () => {
      console.log("🔄 Initializing master provider...");
      
      try {
        if (!ready || !wallets[0]) {
          console.log("⏳ Waiting for wallet initialization...");
          setLoadingProvider(true);
          return;
        }

        const userAddress = await wallets[0].address;
        console.log("👤 User wallet:", userAddress);

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
          setSubmitStatus('Provider not connected to Sepolia network');
          setLoadingProvider(false);
          return;
        }

        setMasterProvider(provider);
        console.log("✅ Master provider initialized successfully");
        
        const masterWallet = new ethers.Wallet(PRIVATE_KEY, provider);
        console.log("👛 Using master wallet:", masterWallet.address);
        
        console.log("📝 Initializing contract at:", OPECHO_ADDRESS);
        const opechoContract = new ethers.Contract(OPECHO_ADDRESS, OPECHO_ABI, masterWallet);
        
        console.log("📊 Fetching contract state...");
        const [
          balance, 
          poolBalance, 
          distributed, 
          eligible,
          timeUntilNext,
          paused
        ] = await Promise.all([
          opechoContract.balanceOf(userAddress),
          opechoContract.getRewardsPoolBalance(),
          opechoContract.rewardsDistributed(),
          opechoContract.isEligibleForReward(userAddress),
          opechoContract.getTimeUntilNextReward(userAddress),
          opechoContract.paused()
        ]);

        console.log("📈 Contract state:", {
          userBalance: ethers.formatUnits(balance, 18),
          poolBalance: ethers.formatUnits(poolBalance, 18),
          distributed: ethers.formatUnits(distributed, 18),
          eligible,
          timeUntilNext: Number(timeUntilNext),
          paused
        });

        setTokenBalance(ethers.formatUnits(balance, 18));
        setRewardsPoolBalance(ethers.formatUnits(poolBalance, 18));
        setRewardsDistributed(ethers.formatUnits(distributed, 18));
        setIsEligible(eligible);
        setNextRewardTime(Number(timeUntilNext));
        setIsPaused(paused);
        setLoadingProvider(false);
        
        console.log("✅ Component state updated successfully");
      } catch (error) {
        console.error("❌ Provider initialization error:", error);
        setSubmitStatus(`Error initializing provider: ${error.message}`);
        setLoadingProvider(false);
      }
    };

    initProvider();
  }, [ready, wallets[0]]);

  useEffect(() => {
    let timer;
    if (nextRewardTime > 0) {
      console.log("⏲️ Starting reward countdown:", nextRewardTime);
      timer = setInterval(() => {
        setNextRewardTime(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            console.log("✨ User is now eligible for rewards");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("🚀 Starting submission process...");
    setIsSubmitting(true);
    setSubmitStatus('');

    try {
      if (!wallets[0]) throw new Error('No wallet address found');
      if (!masterProvider) throw new Error('Provider is not initialized');
      if (isPaused) throw new Error('Rewards are currently paused');
      if (!isEligible) throw new Error(`Please wait ${nextRewardTime} seconds before submitting again`);

      const userAddress = await wallets[0].address;
      const timestamp = new Date().toISOString();
      console.log("📝 Submitting response for:", userAddress);

      console.log("💾 Saving to Supabase...");
      const { error: supabaseError } = await supabase
        .from('test_responses')
        .insert([{
          user_id: userAddress,
          response: response === 'true',
          created_at: timestamp
        }]);

      if (supabaseError) throw supabaseError;
      console.log("✅ Saved to Supabase");

      const masterWallet = new ethers.Wallet(PRIVATE_KEY, masterProvider);
      console.log("🔐 Using master wallet:", masterWallet.address);

      console.log("📜 Creating attestation...");
      const eas = new EAS(EAS_CONTRACT_ADDRESS);
      eas.connect(masterWallet);

      const schemaEncoder = new SchemaEncoder("string created_at, string user_id, string response");
      const encodedData = schemaEncoder.encodeData([
        { name: "created_at", value: timestamp, type: "string" },
        { name: "user_id", value: userAddress, type: "string" },
        { name: "response", value: response, type: "string" }
      ]);

      console.log("📤 Submitting attestation...");
      const tx = await eas.attest({
        schema: schemaInfo.uid,
        data: {
          recipient: userAddress,
          expirationTime: 0n,
          revocable: true,
          data: encodedData
        }
      });

      console.log("⏳ Waiting for attestation confirmation...");
      const receipt = await tx.wait();
      console.log("✅ Attestation confirmed in block:", receipt.blockNumber);

      console.log("🎁 Processing reward...");
      const opechoContract = new ethers.Contract(OPECHO_ADDRESS, OPECHO_ABI, masterWallet);
      
      const poolBalance = await opechoContract.getRewardsPoolBalance();
      console.log("💰 Current rewards pool:", ethers.formatUnits(poolBalance, 18), "OPECHO");
      
      console.log("💸 Sending reward transaction...");
      const rewardTx = await opechoContract.rewardUser(userAddress);
      await rewardTx.wait();
      console.log("✅ Reward transaction confirmed");

      console.log("📊 Updating state...");
      const [
        newBalance, 
        newPoolBalance, 
        newDistributed,
        newTimeUntilNext,
        newEligible
      ] = await Promise.all([
        opechoContract.balanceOf(userAddress),
        opechoContract.getRewardsPoolBalance(),
        opechoContract.rewardsDistributed(),
        opechoContract.getTimeUntilNextReward(userAddress),
        opechoContract.isEligibleForReward(userAddress)
      ]);

      console.log("📈 New state:", {
        userBalance: ethers.formatUnits(newBalance, 18),
        poolBalance: ethers.formatUnits(newPoolBalance, 18),
        distributed: ethers.formatUnits(newDistributed, 18),
        timeUntilNext: Number(newTimeUntilNext),
        eligible: newEligible
      });

      setTokenBalance(ethers.formatUnits(newBalance, 18));
      setRewardsPoolBalance(ethers.formatUnits(newPoolBalance, 18));
      setRewardsDistributed(ethers.formatUnits(newDistributed, 18));
      setNextRewardTime(Number(newTimeUntilNext));
      setIsEligible(newEligible);

      setSubmitStatus('✅ Response submitted and tokens rewarded!');
      setResponse('');
      console.log("🎉 Submission process completed successfully");
    } catch (error) {
      console.error("❌ Submission error:", error);
      setSubmitStatus(`Error: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!ready || !authenticated) return null;

  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Now';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md">
      <h2 className="text-xl font-semibold mb-4">Submit Your Response</h2>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Your Balance:</p>
          <p className="text-sm font-medium">{tokenBalance} OPECHO</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Rewards Pool:</p>
          <p className="text-sm font-medium">{rewardsPoolBalance} OPECHO</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Total Rewards Given:</p>
          <p className="text-sm font-medium">{rewardsDistributed} OPECHO</p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">Next Reward Available:</p>
          <p className={`text-sm font-medium ${isEligible ? 'text-green-600' : 'text-yellow-600'}`}>
            {formatTime(nextRewardTime)}
          </p>
        </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Response
          </label>
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            required
          >
            <option value="">Select an option</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !response || loadingProvider || !masterProvider || !isEligible || isPaused}
          className={`w-full py-2 px-4 rounded-md text-white font-medium 
            ${isSubmitting || !response || loadingProvider || !masterProvider || !isEligible || isPaused
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {isSubmitting ? 'Submitting...' : 
           isPaused ? 'Rewards Paused' :
           !isEligible ? `Wait ${formatTime(nextRewardTime)}` :
           'Submit Response'}
        </button>

        {submitStatus && (
          <p className={`text-sm ${submitStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
            {submitStatus}
          </p>
        )}
      </form>
    </div>
  );
}