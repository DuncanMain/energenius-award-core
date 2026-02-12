"use client";

import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Wallet,
  TrendingUp,
  Gift,
  History,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { parseJwt } from "@/utils/parseJwt";
import { useAuth } from "./hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3003/";

export default function WalletDashboard() {
  const [wallet, setWallet] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { jwt, uid } = useAuth();

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

        if (createRes.ok) {
          const data = await createRes.json();
          setWallet(data);
        } else {
          throw new Error("Failed to create wallet");
        }
      } else {
        throw new Error("Failed to load wallet");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
    setLoading(false);
  };

  const loadAwards = async () => {
    try {
      const res = await fetch(`${API_URL}/award`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAwards(data);
      }
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

      if (res.ok) {
        await loadWallet();
      }
    } catch (err) {
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

      if (res.ok) {
        await loadWallet();
      }
    } catch (err) {
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
            onClick={() => {
              loadWallet();
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
            <div className="lg:col-span-2 bg-gradient-to-br from-cyan-600 to-blue-600 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-cyan-100 mb-2">Total Balance</p>
                  <h2 className="text-5xl font-bold">
                    ${wallet?.balance?.toFixed(2) || "0.00"}
                  </h2>
                </div>
                <div className="bg-white/20 p-3 rounded-xl">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCredit(100)}
                  className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold"
                >
                  Add $100
                </button>
                <button
                  onClick={() => handleCredit(50)}
                  className="bg-white text-blue-600 px-6 py-3 rounded-xl font-semibold"
                >
                  Add $50
                </button>
              </div>
            </div>

            <div className="bg-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg">Rewards</h3>
              </div>
              <div className="space-y-2">
                {awards?.map((award) => (
                  <button
                    key={award.id}
                    onClick={() => handleAward(award.eventId)}
                    className="w-full bg-slate-700 hover:bg-slate-600 p-3 rounded-xl text-left"
                  >
                    <div className="font-semibold">{award.title}</div>
                    <div className="text-cyan-400">+${award.encAmount}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-3 bg-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-lg">Transactions</h3>
              </div>
              <div className="space-y-2">
                {wallet?.transactions?.length === 0 ? (
                  <p className="text-slate-400 text-center py-8">
                    No transactions yet
                  </p>
                ) : (
                  wallet?.transactions?.map((tx: any) => (
                    <div
                      key={tx.txId}
                      className="bg-slate-700 p-4 rounded-xl flex justify-between"
                    >
                      <div>
                        <div className="font-semibold">{tx.description}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(tx.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div
                        className={`font-bold ${tx.type === "credit" ? "text-green-400" : "text-red-400"}`}
                      >
                        {tx.type === "credit" ? "+" : "-"}$
                        {tx.amount.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
