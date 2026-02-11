"use client";

import { useState, useEffect } from "react";
import { Wallet, History, RefreshCw, AlertCircle, Gift } from "lucide-react";
import { parseJwt } from "@/utils/parseJwt";
import WalletBalance from "./components/WalletBalance";
import AwardList from "./components/AwardList";
import TransactionList from "./components/TransactionList";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { useWallet } from "./hooks/useWallet";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

export default function WalletPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return;

    const payload = parseJwt(token);
    setUid(payload.sub);
  }, []);

  const { wallet, loading, reload, spend } = useWallet(uid!);

  useEffect(() => {
    if (!uid) return;
    loadAwards();
  }, [uid]);

  const loadAwards = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/award`);
      if (res.ok) setAwards(await res.json());
    } catch {
      console.error("Failed to load awards");
    }
  };

  const handleCredit = async (amount: number) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/wallets/${uid}/credit`, {
        method: "POST",
        body: JSON.stringify({ amount, description: `Added $${amount}` }),
      });

      if (res.ok) reload(); // ✅
    } catch {
      setError("Failed to add funds");
    }
  };

  const handleAward = async (eventId: string) => {
    try {
      const res = await fetchWithAuth(`${API_URL}/award/event`, {
        method: "POST",
        body: JSON.stringify({ uid, eventId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData?.message?.message || "Failed to claim award");
      }
      if (res.ok) reload();
    } catch (err: any) {
      console.log(err);
      toast.error(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">ENERGENIUS</h1>
              <p className="text-slate-300">Sandbox Wallet</p>
            </div>
          </div>

          <button
            onClick={() => {
              reload();
              loadAwards();
            }}
            className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-300">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto">
              ✕
            </button>
          </div>
        )}

        {loading && !wallet ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-400" />
            <p className="text-slate-400">Loading wallet...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <WalletBalance
              balance={wallet?.balanceWei || 0}
              spend={spend || (() => {})}
              onCredit={handleCredit}
            />

            <div className="bg-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg">Rewards</h3>
              </div>
              <AwardList awards={awards} onClaim={handleAward} />
            </div>

            <div className="lg:col-span-3 bg-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg">Transactions (last 10)</h3>
              </div>
              <TransactionList transactions={wallet?.history || []} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
