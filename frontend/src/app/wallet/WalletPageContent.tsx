'use client';
import { useState, useEffect } from "react";
import { Wallet, History, RefreshCw, AlertCircle, Gift } from "lucide-react";
import { parseJwt } from "@/utils/parseJwt";
import WalletBalance from "./components/WalletBalance";
import AwardList from "./components/AwardList";
import TransactionList from "./components/TransactionList";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/";

export default function WalletPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("jwt");
    if (!token) return;
    const payload = parseJwt(token);
    setJwt(token);
    setUid(payload.sub);
  }, []);

  const headers = new Headers();
  if (jwt) {
    headers.set("Authorization", `Bearer ${jwt}`);
    headers.set("Content-Type", "application/json");
  }

  useEffect(() => {
    if (!uid || !jwt) return;
    loadWallet();
    loadAwards();
  }, [uid, jwt]);

  const loadWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/wallet/${uid}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
      } else if (res.status === 404) {
        const address = `0x${Math.random().toString(16).substr(2, 40)}`;
        const createRes = await fetch(`${API_URL}/wallets`, {
          method: "POST",
          headers,
          body: JSON.stringify({ uid, address }),
        });
        if (createRes.ok) setWallet(await createRes.json());
      } else throw new Error("Failed to load wallet");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
    setLoading(false);
  };

  const loadAwards = async () => {
    try {
      const res = await fetch(`${API_URL}/award`, { headers });
      if (res.ok) setAwards(await res.json());
    } catch (err) {
      console.error("Error loading awards:", err);
    }
  };

  const handleCredit = async (amount: number) => {
    try {
      const res = await fetch(`${API_URL}/wallets/${uid}/credit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ amount, description: `Added $${amount}` }),
      });
      if (res.ok) await loadWallet();
    } catch {
      setError("Failed to add funds");
    }
  };

  const handleAward = async (eventId: string) => {
    try {
      const res = await fetch(`${API_URL}/wallets/${uid}/award`, {
        method: "POST",
        headers,
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) await loadWallet();
    } catch {
      setError("Failed to claim award");
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
            onClick={() => { loadWallet(); loadAwards(); }}
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
            <button onClick={() => setError(null)} className="ml-auto">✕</button>
          </div>
        )}

        {loading && !wallet ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-cyan-400" />
            <p className="text-slate-400">Loading wallet...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <WalletBalance balance={wallet?.balance || 0} onCredit={handleCredit} />

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
                <h3 className="font-bold text-lg">Transactions</h3>
              </div>
              <TransactionList transactions={wallet?.history || []} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}