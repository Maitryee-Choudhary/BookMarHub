"use client";

import { useEffect } from "react";
import useAuth from "@/utils/useAuth";

export default function LogoutPage() {
  const { signOut } = useAuth();

  useEffect(() => {
    signOut({
      callbackUrl: "/",
      redirect: true,
    });
  }, [signOut]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center font-inter">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Signing you out...</p>
      </div>
    </div>
  );
}