'use client';

import ProtectedRoute from "@/ProtectedRoute";
import WalletPageContent from "./WalletPageContent"; 

export default function WalletPage() {
  return (
    <ProtectedRoute>
      <WalletPageContent />
    </ProtectedRoute>
  );
}