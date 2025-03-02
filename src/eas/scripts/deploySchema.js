import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";
import { EAS_CONFIG } from "../config/secrets.js";

async function deploySchema() {
  console.log("🚀 Starting schema deployment...");

  try {
    // 1️⃣ Setup provider
    const provider = new ethers.JsonRpcProvider(
      `https://sepolia.infura.io/v3/${EAS_CONFIG.INFURA_PROJECT_ID}`
    );

    // 2️⃣ Setup wallet
    const wallet = new ethers.Wallet(EAS_CONFIG.PRIVATE_KEY, provider);
    const balance = await provider.getBalance(wallet.address);
    console.log("✅ Wallet address:", wallet.address);
    console.log("✅ Wallet balance:", ethers.formatEther(balance), "ETH");

    if (balance === 0n) {
      throw new Error("❌ Wallet has no ETH. Please fund your wallet with Sepolia ETH first.");
    }

    // 3️⃣ Initialize SchemaRegistry
    const schemaRegistryAddress = "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0";
    console.log("✅ Using Schema Registry at:", schemaRegistryAddress);

    const schemaRegistry = new SchemaRegistry(schemaRegistryAddress);
    schemaRegistry.connect(wallet);

    // 4️⃣ Define Schema
    const schema = "string created_at, string user_id, string response";
    console.log("✅ Registering schema:", schema);

    // 5️⃣ Register Schema
    console.log("📝 Sending registration transaction...");
    const tx = await schemaRegistry.register({
      schema,
      resolverAddress: "0x0000000000000000000000000000000000000000",
      revocable: true
    });

    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("Transaction hash:", receipt.hash);

    // 6️⃣ Save schema information
    const fs = await import('fs');
    const path = await import('path');
    
    const schemaInfo = {
      uid: receipt.logs[0].topics[1], // The schema UID is in the first event's second topic
      schema: schema,
      transactionHash: receipt.hash,
      deployedAt: new Date().toISOString(),
      contractAddress: schemaRegistryAddress,
      resolverAddress: "0x0000000000000000000000000000000000000000",
      revocable: true,
      creator: wallet.address
    };

    const filePath = path.resolve('src/eas/config/schema.json');
    fs.writeFileSync(filePath, JSON.stringify(schemaInfo, null, 2));
    console.log("💾 Schema information saved to:", filePath);

    return schemaInfo.uid;

  } catch (error) {
    console.error("❌ Deployment failed with error:", error);
    throw error;
  }
}

// Run deployment script if executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  deploySchema()
    .then((schemaUID) => {
      console.log("🎉 Schema deployed successfully! UID:", schemaUID);
      process.exit(0);
    })
    .catch(error => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

export { deploySchema };