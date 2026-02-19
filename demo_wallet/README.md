# zkLogin Wallet dApp

A production-ready zkLogin wallet built with React, TypeScript, and Vite. Login with Google to get a Sui wallet - no seed phrases, no passwords.

## Features

- 🔐 **Secure**: Uses zkLogin with zero-knowledge proofs
- ⚡ **Fast**: Sign in with Google OAuth in seconds
- 🌐 **Decentralized**: Your keys, your crypto, your control
- 💎 **Production-Ready**: TailwindCSS + shadcn/ui components
- 🔄 **State Management**: Zustand with persistence
- 🎨 **Modern Stack**: React 19 + TypeScript + Vite

## Architecture

```
User → Google OAuth → Salt Server (ALB) → zkLogin Address → Sui Network
```

1. User clicks "Login with Google"
2. Generate ephemeral keys and compute nonce
3. Redirect to Google OAuth
4. Receive JWT from Google
5. Fetch salt from deployed Salt Server
6. Compute zkLogin address
7. Generate ZK proof from Mysten Prover
8. Display wallet with balance

## Prerequisites

- Node.js 22.5.0+
- npm 10.8.2+
- Google OAuth Client ID

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Edit `.env` and add your Google OAuth Client ID:

```env
# Google OAuth
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
VITE_REDIRECT_URI=http://localhost:5173/auth/callback

# Salt Server (already deployed)
VITE_SALT_SERVER_URL=http://zklogin-prod-alb-346534019.ap-northeast-2.elb.amazonaws.com/v1/salt

# Mysten Labs Prover
VITE_PROVER_URL=https://prover.mystenlabs.com/v1

# Sui Network
VITE_SUI_NETWORK=testnet
VITE_SUI_RPC_URL=https://fullnode.testnet.sui.io

# Server-side Sponsor (gasless demo)
# Never expose this as VITE_*.
SPONSORED_TX_ENABLED=true
SPONSOR_PRIVATE_KEY=suiprivkey1...
SUI_RPC_URL=https://fullnode.testnet.sui.io
```

For production server (`npm run prod` / PM2 / Docker), make sure `SPONSOR_PRIVATE_KEY` is injected as a runtime secret.

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Navigate to "Credentials" → "Create Credentials" → "OAuth client ID"
5. Application type: Web application
6. Authorized JavaScript origins:
   - `http://localhost:5173`
   - (Add production domain later)
7. Authorized redirect URIs:
   - `http://localhost:5173/auth/callback`
   - (Add production redirect URI later)
8. Copy the Client ID to your `.env` file

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

If you want gasless sponsored transactions in local dev, run the sponsor server too:

```bash
npm run build:server
SPONSORED_TX_ENABLED=true \
SPONSOR_PRIVATE_KEY=suiprivkey1... \
SUI_RPC_URL=https://fullnode.testnet.sui.io \
node dist-server/index.js
```

## Build

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Project Structure

```
dapp/
├── src/
│   ├── components/
│   │   ├── ui/              # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   └── wallet/          # Wallet-specific components
│   │       ├── LoginButton.tsx
│   │       ├── WalletAddress.tsx
│   │       └── BalanceCard.tsx
│   ├── pages/
│   │   ├── LandingPage.tsx        # Marketing + login
│   │   ├── AuthCallbackPage.tsx   # OAuth callback handler
│   │   └── DashboardPage.tsx      # Main wallet interface
│   ├── services/
│   │   ├── auth.service.ts        # OAuth flow
│   │   ├── salt.service.ts        # Salt Server integration
│   │   ├── prover.service.ts      # ZK Proof generation
│   │   ├── wallet.service.ts      # Sui network interactions
│   │   └── storage.service.ts     # sessionStorage management
│   ├── store/
│   │   └── wallet.store.ts        # Zustand global state
│   ├── utils/
│   │   ├── zklogin.utils.ts       # zkLogin utilities
│   │   └── cn.ts                  # Tailwind class merging
│   ├── types/
│   │   ├── wallet.types.ts
│   │   └── zklogin.types.ts
│   ├── App.tsx                    # Router setup
│   └── main.tsx                   # Entry point
├── .env.example
├── package.json
└── README.md
```

## How It Works

### 1. OAuth Flow

```typescript
// User clicks "Login with Google"
const { keypair, nonce } = await generateEphemeralKeyPair();
// Save ephemeral keys to sessionStorage
// Redirect to Google OAuth with nonce
```

### 2. Salt Retrieval

```typescript
// After OAuth callback
const salt = await saltService.fetchSalt(jwt);
// Calls: POST http://zklogin-prod-alb-346534019.../v1/salt
```

### 3. Address Computation

```typescript
const zkAddress = await walletService.computeZkLoginAddress(jwt, salt);
// Uses: genAddressSeed + computeZkLoginAddress from @mysten/sui
```

### 4. ZK Proof Generation

```typescript
const zkProof = await proverService.generateZkProof({
  jwt,
  salt,
  ephemeralPublicKey,
  maxEpoch,
  randomness
});
// Calls: https://prover.mystenlabs.com/v1
```

## Security

- ✅ JWT stored in sessionStorage only (auto-cleared on browser close)
- ✅ Private keys never logged or exposed
- ✅ .env files excluded from Git
- ✅ Salt Server validates JWT signatures
- ✅ ZK proofs protect user privacy

## Troubleshooting

### CORS Issues with Salt Server

If you encounter CORS errors when calling the Salt Server:

1. **Option 1**: Run Chrome with CORS disabled (development only):
   ```bash
   open -na "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome-dev
   ```

2. **Option 2**: Contact server admin to add CORS headers:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type
   ```

### Google OAuth Errors

- **"redirect_uri_mismatch"**: Check that `http://localhost:5173/auth/callback` is added to authorized redirect URIs in Google Cloud Console
- **"invalid_client"**: Verify `VITE_GOOGLE_CLIENT_ID` in `.env` matches your Google OAuth Client ID

### ZK Proof Timeout

If ZK proof generation takes too long (>10 seconds):
- Check network connection
- Verify Mysten Prover is accessible
- Try again (sometimes the prover service is slow)

### Sponsored Transaction Disabled

- If send/claim fails with sponsor error, check server env:
  - `SPONSORED_TX_ENABLED=true`
  - `SPONSOR_PRIVATE_KEY=suiprivkey1...`
  - `SUI_RPC_URL=https://fullnode.testnet.sui.io`
- Confirm server logs show:
  - `Sponsored TX: enabled`
  - `Sponsor Address: 0x...`

## Tech Stack

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript 5
- **Styling**: TailwindCSS 3
- **State**: Zustand 4
- **Routing**: React Router 6
- **Sui SDK**: @mysten/sui 1.45.2

## Next Steps

### MVP Features (Implemented)
- ✅ Google OAuth login
- ✅ zkLogin address computation
- ✅ Salt Server integration
- ✅ Balance display

### Future Enhancements
- [ ] Send SUI transactions
- [ ] Transaction history
- [ ] NFT display
- [ ] Multi-provider OAuth (Facebook, Apple, Twitter)
- [ ] Mobile responsive design
- [ ] PWA support

## License

Apache-2.0

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ using [Sui zkLogin](https://docs.sui.io/concepts/cryptography/zklogin)
