import React, { useState } from 'react';
import { Wallet, AlertCircle, CheckCircle, ExternalLink, Loader } from 'lucide-react';

const PaymentModal = ({ appointmentId, onPaymentSuccess, onCancel }) => {
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    try {
      const { initiatePayment } = await import('../services/paymentService');
      const result = await initiatePayment(appointmentId);
      
      setTxHash(result.txHash);
      
      // Store payment in Firebase
      const { storePaymentTransaction } = await import('../services/AppointmentSessionService');
      await storePaymentTransaction(appointmentId, result.txHash, {
        from: result.from,
        amount: result.amount,
        blockNumber: result.blockNumber,
        timestamp: result.timestamp
      });
      
      // Wait 2 seconds to show success message
      setTimeout(() => {
        onPaymentSuccess(result);
      }, 2000);
      
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      setProcessing(false);
    }
  };

  const getFaucetLinks = () => {
    return [
      { name: 'Sepolia Faucet', url: 'https://sepoliafaucet.com/' },
      { name: 'Alchemy Faucet', url: 'https://www.alchemy.com/faucets/ethereum-sepolia' },
      { name: 'Google Cloud Faucet', url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia' }
    ];
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {!txHash ? (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Session Entry Payment
              </h2>
              <p className="text-gray-600">
                To access your appointment session, please complete a small payment
              </p>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600">Amount:</span>
                <span className="text-2xl font-bold text-blue-600">0.001 ETH</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Network:</span>
                <span className="text-gray-700 font-medium">Sepolia Testnet</span>
              </div>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 text-sm">{error}</p>
                  {error.includes('Insufficient') && (
                    <div className="mt-3">
                      <p className="text-red-700 text-xs font-medium mb-2">Get free Sepolia ETH:</p>
                      <div className="space-y-1">
                        {getFaucetLinks().map((faucet, index) => (
                          <a
                            key={index}
                            href={faucet.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center text-blue-600 hover:text-blue-700 text-xs"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {faucet.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handlePayment}
                disabled={processing}
                className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center"
              >
                {processing ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  <>
                    <Wallet className="w-5 h-5 mr-2" />
                    Pay with MetaMask
                  </>
                )}
              </button>

              <button
                onClick={onCancel}
                disabled={processing}
                className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

          </>
        ) : (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-600 mb-4">
              Your payment has been confirmed on the blockchain
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <p className="text-xs text-gray-500 mb-1">Transaction Hash:</p>
              <p className="text-sm font-mono text-gray-700 break-all">{txHash.substring(0, 20)}...{txHash.substring(txHash.length - 20)}</p>
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 text-sm flex items-center justify-center mt-2"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View on Etherscan
              </a>
            </div>
            <p className="text-gray-500 text-sm">
              Redirecting to your appointment session...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal