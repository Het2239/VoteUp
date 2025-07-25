import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BrowserProvider, Contract, JsonRpcSigner } from 'ethers';
import toast from 'react-hot-toast';

// This defines the shape of the data and functions that will be shared via the Web3 context:
// provider: Interface to the Ethereum node (MetaMask).
// signer: Represents the current wallet's signing power.
// account: Current wallet address.
// chainId: Current network ID.
// isConnected: Connection status.
// connectWallet(): Connects MetaMask.
// disconnectWallet(): Clears connection info.
// switchToSepolia(): Forces switch to Sepolia Testnet.
interface Web3ContextType {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  account: string | null;
  chainId: number | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;         // it's (connectWallet) a function with no parameters it returns a Promise that resolves to nothing (void) This implies the function is async or returns a Promise.
  disconnectWallet: () => void;
  switchToSepolia: () => Promise<void>;
} 


// Web3Context is created with undefined as default.
const Web3Context = createContext<Web3ContextType | undefined>(undefined);


// useWeb3 is a custom hook that throws if used outside the provider (safety check).
export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};


// Sepolia Testnet constants
const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/d8cu_4ZQnwo5G_j-l7xXLA0IgBwzrhp9';
// const SEPOLIA_RPC_URL = 'https://virtual.sepolia.rpc.tenderly.co/77f9ca74-f1ae-4fe8-bf89-7c718a879790';



interface Web3ProviderProps {
  children: ReactNode;
}

// These hold the current connection state
export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);               // provider is the interface to the Ethereum node (like MetaMask)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);                     // signer is the wallet's signing power, used to sign transactions
  const [account, setAccount] = useState<string | null>(null);                          
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);



  // This function connects to the wallet and sets the provider, signer, account, chainId, and connection status
  // It checks if MetaMask is installed, requests accounts, and sets the provider and signer
  // If the user is not on Sepolia, it prompts them to switch networks
  // If the connection is successful, it updates the state and shows a success message
  // If there's an error, it logs the error and shows an error message
  // It also listens for account and chain changes to update the state accordingly
  // If the user switches to a different chain, it prompts them to switch back to Sepolia
  const connectWallet = async () => {
  try {
    if (typeof window.ethereum !== 'undefined') {
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);

      if (accounts.length > 0) {
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();

        if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
          toast.error('Please switch to Sepolia Testnet.');
          await switchToSepolia(); 
          return;
        }

        setProvider(provider);
        setSigner(signer);
        setAccount(accounts[0]);
        setChainId(Number(network.chainId));
        setIsConnected(true);
        toast.success('Wallet connected successfully!');
      }
    } else {
      toast.error('MetaMask is not installed. Please install MetaMask to continue.');
    }
  } catch (error: any) {
    console.error('Failed to connect wallet:', error);
    toast.error('Failed to connect wallet. Please try again.');
  }
};


  // This function disconnects the wallet by clearing the provider, signer, account, chainId, and connection status
  // It also shows a success message
  // This is useful for when the user wants to disconnect their wallet from the application and resets the state to its initial values
  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setIsConnected(false);
    toast.success('Wallet disconnected');
  };


  // This function switches the current network to Sepolia Testnet
  // It uses the Ethereum provider to request a network switch
  // If the switch fails because the network is not added, it attempts to add Sepolia
  // If the switch is successful, it updates the chainId state
  // If there's an error, it shows an error message
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}`,
                chainName: 'Sepolia Test Network',
                nativeCurrency: {
                  name: 'Sepolia Ether',
                  symbol: 'ETH',
                  decimals: 18,
                },
                rpcUrls: [SEPOLIA_RPC_URL],
                blockExplorerUrls: ['https://sepolia.etherscan.io/'],
              },
            ],
          });
        } catch (addError) {
          toast.error('Failed to add Sepolia network');
        }
      } else {
        toast.error('Failed to switch to Sepolia network');
      }
    }
  };

  
  // This effect listens for changes in the user's accounts and updates the state accordingly
  // If the user disconnects their wallet, it clears the account state
  // If the user switches accounts, it updates the account state
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setAccount(accounts[0]);
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
  const newChainId = parseInt(chainIdHex, 16);
  setChainId(newChainId);

  if (newChainId !== SEPOLIA_CHAIN_ID) {
    toast.error('Please switch to Sepolia Testnet.');
    disconnectWallet(); // force disconnect if user switches to another chain
  }
};


      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  
  // This effect attempts to auto-connect the wallet when the component mounts
  // It checks if MetaMask is installed and if there are any accounts available
  // If accounts are found, it calls connectWallet to set up the provider and signer
  useEffect(() => {
    const autoConnect = async () => {
      if (typeof window.ethereum !== 'undefined') {
        try {toast.loading('Attempting auto-connect...');
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            await connectWallet();
          }
        } catch (error) {
          console.error('Auto-connect failed:', error);
        }
      }
    };

    autoConnect();
  }, []);

  return (
    <Web3Context.Provider
      value={{
        provider,
        signer,
        account,
        chainId,
        isConnected,
        connectWallet,
        disconnectWallet,
        switchToSepolia,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};