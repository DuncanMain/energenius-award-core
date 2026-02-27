'use client';
import { useState, useEffect } from 'react';
import { Wallet, History, RefreshCw, AlertCircle, Gift, User } from 'lucide-react';
import WalletBalance from '../../components/WalletBalance';
import AwardList from '../../components/AwardList';
import TransactionList from '../../components/TransactionList';
import { useAuth } from '../../hooks/useAuth';
import { convertToETH } from '@/utils/convert';
import { walletApi } from '../../api/walletApi';
import { useWallet } from '../../hooks/useWallet';
import toast from 'react-hot-toast';
import { Award, AwardsResponse } from '@/models';
import { userApi } from '@/api/userApi';
import { authStorage } from '@/utils/authStorage';
import { useRouter } from 'next/navigation';

export default function WalletPage() {
  const [awards, setAwards] = useState<AwardsResponse[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { uid, jwt } = useAuth();
  const { wallet, spend, setWallet } = useWallet(uid!);
  const router = useRouter();
  useEffect(() => {
    if (!uid) return;
    loadAwards();
  }, [uid, jwt]);

  const loadWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await walletApi.getWallet(uid);
      if (!res.success && res.error?.includes('not found')) {
        const address = `0x${Math.random().toString(16).substr(2, 40)}`;
        const createRes = await walletApi.createWallet(uid!, address);
        if (createRes.success) {
          setWallet(createRes.data);
        }
      }
      if (res.success && res.data) {
        res.data.balanceWei = convertToETH(res.data.balanceWei);
        setWallet(res.data);
      } else {
        throw new Error(res.error || 'Failed to load wallet');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
    setLoading(false);
  };

  const loadAwards = async () => {
    try {
      const res = await walletApi.getAvailableAwards(uid);

      if (res.data && res.success) {
        setAwards(res.data);
      }
    } catch (err) {
      console.error('Failed to load awards:', err);
    }
  };

  const handleCredit = async (amount: number) => {
    if (!uid) return;
    try {
      const res = await walletApi.creditWallet(uid, amount, `Added $${amount}`);
      if (res.success) {
        await loadWallet();
      } else {
        throw new Error(res.error || 'Failed to add funds');
      }
    } catch (err) {
      setError('Failed to add funds');
    }
  };

  const handleAward = async (eventId: string) => {
    if (!uid) return;
    try {
      const res = await walletApi.claimAward(uid, eventId);
      if (res.success) {
        await loadWallet();
        toast.success('Successfully claim award');
      } else {
        throw Error(res.error || 'Failed to claim award');
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Occurred an error to claim award'
      );
    }
  };

  const logout = async () => {
    try {
      const username = authStorage.getUsername();
      const res = await userApi.logout({ username: username || '' });
      console.log(res);
      if (res.data && res.success) {
        toast.success(res.data.message || 'Successfully logged out');
        router.push('/login');
        authStorage.clearAuth();
      }
    } catch (err) {
      authStorage.clearAuth();
      router.push('/login');
      toast.error(err instanceof Error ? err.message : 'Failed to logout');
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
              <h1 className="text-3xl font-bold">AWARD SYSTEM</h1>
              <p className="text-slate-300">Energenius</p>
            </div>
          </div>

          <button
            onClick={() => {
              loadWallet();
              loadAwards();
            }}
            className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => {
              logout();
            }}
            className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl"
          >
            <User className={`w-4 h-4`} />
            Logout
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
              spend={spend}
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
