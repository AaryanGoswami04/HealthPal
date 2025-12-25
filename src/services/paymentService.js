import { ethers } from 'ethers';

/**
 * Initiates a payment transaction on Sepolia testnet
 * @param {string} appointmentId - Appointment ID for reference
 * @returns {Object} Transaction hash and details
 */
export const initiatePayment = async (appointmentId) => {
  try {
    // Check if MetaMask is installed
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed. Please install MetaMask to make payments.');
    }

    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const patientAddress = await signer.getAddress();

    // Check if on Sepolia network
    const network = await provider.getNetwork();
    const sepoliaChainId = 11155111n; // Sepolia chain ID
    
    if (network.chainId !== sepoliaChainId) {
      // Request network switch to Sepolia
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xaa36a7' }], // Sepolia chain ID in hex
        });
        
        // Retry after network switch
        return await initiatePayment(appointmentId);
      } catch (switchError) {
        if (switchError.code === 4902) {
          throw new Error('Sepolia testnet not found in MetaMask. Please add it manually.');
        }
        throw new Error('Please switch to Sepolia testnet in MetaMask');
      }
    }

    // Payment amount: 0.001 ETH
    const paymentAmount = ethers.parseEther('0.001');
    
    // REPLACE WITH YOUR CLINIC'S RECEIVING WALLET ADDRESS
    const recipientAddress = '0xb61A12137bD296990A7E5e59372A1fA4BAD0134D';
    
    console.log('🔗 Initiating payment transaction...');
    console.log('From:', patientAddress);
    console.log('To:', recipientAddress);
    console.log('Amount:', ethers.formatEther(paymentAmount), 'ETH');
    console.log('Appointment ID:', appointmentId);

    // Simple transaction WITHOUT data field
    // The appointment ID will be linked in Firebase, not on-chain
    const tx = await signer.sendTransaction({
      to: recipientAddress,
      value: paymentAmount
      // NO data field - this avoids the MetaMask internal account error
    });

    console.log('⏳ Transaction sent. Waiting for confirmation...');
    console.log('Transaction hash:', tx.hash);

    // Wait for transaction confirmation (1 block)
    const receipt = await tx.wait(1);
    
    console.log('✅ Payment confirmed!');
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    return {
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      from: patientAddress,
      to: recipientAddress,
      amount: ethers.formatEther(paymentAmount),
      timestamp: new Date().toISOString(),
      appointmentId: appointmentId // Return this for Firebase storage
    };

  } catch (error) {
    console.error('❌ Payment error:', error);
    
    // User-friendly error messages
    if (error.code === 4001) {
      throw new Error('Payment cancelled by user');
    } else if (error.code === 'INSUFFICIENT_FUNDS' || error.message.includes('insufficient funds')) {
      throw new Error('Insufficient ETH balance. Please add Sepolia ETH to your wallet.');
    } else if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network error. Please check your connection and try again.');
    } else if (error.message.includes('user rejected')) {
      throw new Error('Transaction rejected by user');
    } else if (error.message.includes('cannot include data')) {
      throw new Error('Transaction with data not supported. Using simple payment instead.');
    } else {
      throw new Error(error.shortMessage || error.message || 'Payment failed. Please try again.');
    }
  }
};

/**
 * Verifies a payment transaction on Sepolia
 * @param {string} txHash - Transaction hash to verify
 * @returns {Object} Verification result
 */
export const verifyPayment = async (txHash) => {
  try {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    
    console.log('🔍 Verifying payment transaction:', txHash);
    
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return {
        verified: false,
        message: 'Transaction not found'
      };
    }

    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        verified: false,
        message: 'Transaction pending or not confirmed'
      };
    }

    const isSuccess = receipt.status === 1;
    
    return {
      verified: isSuccess,
      message: isSuccess ? 'Payment verified successfully' : 'Transaction failed',
      blockNumber: receipt.blockNumber,
      from: tx.from,
      to: tx.to,
      value: ethers.formatEther(tx.value)
    };

  } catch (error) {
    console.error('❌ Verification error:', error);
    return {
      verified: false,
      message: error.message || 'Verification failed'
    };
  }
};

/**
 * Get Sepolia testnet ETH faucet links
 * @returns {Array} List of faucet URLs
 */
export const getSepoliaFaucets = () => {
  return [
    'https://sepoliafaucet.com/',
    'https://www.alchemy.com/faucets/ethereum-sepolia',
    'https://cloud.google.com/application/web3/faucet/ethereum/sepolia'
  ];
};