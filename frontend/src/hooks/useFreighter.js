import { useState, useCallback } from 'react';
import {
  isConnected,
  isAllowed,
  requestAccess,
  getPublicKey,
  signTransaction,
  getNetwork,
} from '@stellar/freighter-api';

export function useFreighter() {
  const [publicKey, setPublicKey] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(async () => {
    setError(null);

    // Check if Freighter extension is present
    const connected = await isConnected();
    if (!connected) {
      setError('Freighter wallet extension not detected. Please install it from freighter.app');
      return null;
    }

    setConnecting(true);
    try {
      // Request permission if not yet granted
      const allowed = await isAllowed();
      if (!allowed) {
        await requestAccess();
      }

      const key = await getPublicKey();
      setPublicKey(key);
      return key;
    } catch (err) {
      setError(err.message || 'Failed to connect wallet');
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setError(null);
  }, []);

  const signTx = useCallback(async (xdr, network = 'TESTNET') => {
    const connected = await isConnected();
    if (!connected) throw new Error('Freighter not installed');
    const result = await signTransaction(xdr, { network });
    // Freighter v2 returns the signed XDR as a string directly
    return typeof result === 'string' ? result : result.signedTransaction;
  }, []);

  const getFreighterNetwork = useCallback(async () => {
    const connected = await isConnected();
    if (!connected) return null;
    return getNetwork();
  }, []);

  return {
    publicKey,
    connecting,
    error,
    isConnected: !!publicKey,
    connect,
    disconnect,
    signTransaction: signTx,
    getNetwork: getFreighterNetwork,
  };
}
