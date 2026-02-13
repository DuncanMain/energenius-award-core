import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { convertToETH } from '@/utils/convert';
import { walletApi } from '@/app/api/walletApi';
import { fetchWithAuth } from '@/app/api/fetchWithAuth';
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

interface Wallet {
  uid: string;
  address: string;
  balanceWei: number;
  history: any[];
}

export function useWallet(uid: string | null) {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevBalance = useRef<number>(0);

  const loadWallet = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await walletApi.getWallet(uid);

      if (res.success) {
        const data = res.data;
        data.balanceWei = Number(convertToETH(data.balanceWei));
        setWallet(data);
        if (prevBalance.current && data.balanceWei > prevBalance.current) {
          const diff = data.balanceWei - prevBalance.current;
          toast.success(`Balance increased by $${diff}`);
        }
        prevBalance.current = data.balanceWei;
      } else {
        setError(res.error || 'Unknown error');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWallet();
    const interval = setInterval(loadWallet, 15000);
    return () => clearInterval(interval);
  }, [uid]);

  const spend = async (
    amount: number,
    label: string,
    onSuccess?: (data: {
      txHash: string;
      amount: number;
      label: string;
    }) => void
  ) => {
    if (!uid) return;

    const confirmed = window.confirm(`Spend $${amount} for "${label}"?`);
    if (!confirmed) return;
    try {
      const response = await walletApi.spend(uid, amount, label);

      if (response.success && response.data) {
        onSuccess?.({
          txHash: response.data.txHash,
          amount,
          label,
        });
        loadWallet();
      } else {
        console.log(response);
        toast.error(response.error || 'Spend failed');
      }
    } catch (err: any) {
      console.log(err);
      toast.error(err.message.message || 'Spend failed');
    }
  };

  return { wallet, loading, error, reload: loadWallet, spend, setWallet };
}
