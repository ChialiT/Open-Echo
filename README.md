# Open Echo

A decentralized response collection platform built with modern web3 technologies. This project demonstrates the integration of blockchain attestations, token rewards, and secure authentication in a React application.

## 🚀 Features

- **Web3 Authentication** via Privy
- **Blockchain Attestations** using Ethereum Attestation Service (EAS)
- **Token Rewards** with OPECHO ERC-20 token
- **Secure Environment** handling for sensitive data


## 🛠 Technology Stack

- **Frontend**: React + Vite
- **Smart Contracts**: Hardhat + Solidity
- **Authentication**: Privy
- **Blockchain Integration**: 
  - Ethereum Attestation Service (EAS)
  - ethers.js v6
  - Infura (Sepolia testnet)
- **Development Environment**: Cursor IDE

## 🏗 Project Structure

```
Open-Echo/
├── src/
│   ├── components/         # React components
│   ├── contracts/         # Smart contract files
│   ├── eas/              # EAS configuration and schemas
│   └── lib/              # Utility functions and configurations
├── public/               # Static assets
└── ...configuration files
```

## 🚦 Getting Started

1. Clone the repository
```bash
git clone https://github.com/yourusername/Open-Echo.git
cd Open-Echo
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
```
Edit `.env` with your:
- Infura Project ID
- Private key for EAS attestations (use a dedicated wallet, not your main one)

4. Start the development server
```bash
npm run dev
```

## 🔐 Security Notes

- Never commit `.env` files or private keys
- Use a dedicated wallet for EAS attestations
- Keep your Infura Project ID secure

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with assistance from [Cursor](https://cursor.sh/), the AI-powered IDE
- [Privy](https://www.privy.io/) for web3 authentication
- [Ethereum Attestation Service](https://attest.sh/) for blockchain attestations
- [Hardhat](https://hardhat.org/) for smart contract development
- [Vite](https://vitejs.dev/) for frontend tooling
