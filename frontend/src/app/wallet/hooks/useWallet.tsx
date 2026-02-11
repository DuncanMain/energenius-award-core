import { useState, useEffect, useRef } from "react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import toast from "react-hot-toast";
import { ethers } from "ethers"
const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export function useWallet(uid: string | null) {
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevBalance = useRef<number>(0);

  const convertToETH = (wei: number) => {
    return ethers.formatEther(wei.toString());
  };

  const loadWallet = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/wallet/${uid}`);
      if (res.ok) {
        const data = await res.json();
        data.balanceWei = convertToETH(data.balanceWei);
        setWallet(data);
        // Toast samo ako se balans poveća
        if (prevBalance.current && data.balanceWei > prevBalance.current) {
          const diff = data.balanceWei - prevBalance.current;
          toast.success(`Balance increased by $${convertToETH(diff)}`);
        }
        prevBalance.current = data.balanceWei;
      } else {
        throw new Error("Failed to fetch wallet");
      }
    } catch (err: any) {
      setError(err.message || "Unknown error");
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
    }) => void,
  ) => {
    if (!uid) return;

    const confirmed = window.confirm(`Spend $${amount} for "${label}"?`);
    if (!confirmed) return;

    try {
      const res = await fetchWithAuth(`${API_URL}/spend`, {
        method: "POST",
        body: JSON.stringify({ uid, amount, label }),
      });

      if (!res.ok) throw new Error("Spend failed");

      const data = await res.json();

      onSuccess?.({
        txHash: data.txHash,
        amount,
        label,
      });

      loadWallet();
    } catch (err: any) {
      toast.error(err.message || "Spend failed");
    }
  };

  return { wallet, loading, error, reload: loadWallet, spend };

}
