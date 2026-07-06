"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, Eye, EyeOff, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    // Simulate short loader for premium feel
    setTimeout(() => {
      router.push("/items");
    }, 800);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      {/* Background blobs for premium gradient aesthetic */}
      <div className="absolute top-0 -left-40 h-[600px] w-[600px] rounded-full bg-sky-500/10 blur-[150px]" />
      <div className="absolute bottom-0 -right-40 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[150px]" />

      <div className="relative w-full max-w-[440px]">
        {/* Logo and Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">
            SB&M Inventory Management
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            ระบบจัดการคลังสินค้าและจัดสรรสต๊อกแบบโปร่งใส
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <h2 className="text-lg font-semibold text-white">เข้าสู่ระบบ</h2>
          <p className="mt-1 text-xs text-slate-400">กรอกข้อมูลผู้ใช้งานเพื่อเข้าสู่ระบบการจัดการ</p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-slate-300">
                อีเมลผู้ใช้งาน
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none ring-sky-500/20 transition-all focus:border-sky-500 focus:ring-4"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-xs font-medium text-slate-300">
                  รหัสผ่าน
                </label>
                <a href="#" className="text-xs text-sky-400 hover:underline">
                  ลืมรหัสผ่าน?
                </a>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-600 outline-none ring-sky-500/20 transition-all focus:border-sky-500 focus:ring-4"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="h-4 w-4 rounded-sm border-slate-800 bg-slate-950/60 text-sky-600 focus:ring-0 focus:ring-offset-0"
              />
              <label htmlFor="remember" className="ml-2 text-xs text-slate-400 select-none">
                จดจำการเข้าสู่ระบบ
              </label>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 py-6 text-sm font-semibold text-white transition-all hover:from-sky-400 hover:to-indigo-400 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-70"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>กำลังตรวจสอบข้อมูล...</span>
                </div>
              ) : (
                "เข้าสู่ระบบ"
              )}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-slate-600">
          &copy; {new Date().getFullYear()} SB&M Co., Ltd. All rights reserved.
        </p>
      </div>
    </main>
  );
}
