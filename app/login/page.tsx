import { LockKeyhole, Package } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const hasError = Boolean((await searchParams).error);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 px-4">
      <div className="absolute top-0 -left-40 h-[600px] w-[600px] rounded-full bg-sky-500/10 blur-[150px]" />
      <div className="absolute bottom-0 -right-40 h-[600px] w-[600px] rounded-full bg-violet-600/10 blur-[150px]" />
      <div className="relative w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-white">SB&amp;M Inventory Management</h1>
          <p className="mt-2 text-sm text-slate-400">ระบบจัดการคลังสินค้าและจัดสรรสต๊อกแบบโปร่งใส</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center shadow-2xl backdrop-blur-xl sm:p-10">
          <LockKeyhole className="mx-auto h-9 w-9 text-sky-400" />
          <h2 className="mt-4 text-lg font-semibold text-white">เข้าสู่ระบบผ่าน RMC SSO</h2>
          <p className="mt-2 text-sm text-slate-400">รองรับบัญชี Microsoft Azure และ LINE ที่ผูกกับองค์กร</p>
          {hasError ? <p role="alert" className="mt-4 rounded-lg bg-red-950/50 p-3 text-xs text-red-300">เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลระบบ</p> : null}
          <a href={withBasePath("/api/auth/login")} className="mt-6 block w-full rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:from-sky-400 hover:to-indigo-400">เข้าสู่ระบบด้วย RMC SSO</a>
        </div>
        <p className="mt-8 text-center text-xs text-slate-600">&copy; {new Date().getFullYear()} SB&amp;M Co., Ltd. All rights reserved.</p>
      </div>
    </main>
  );
}
