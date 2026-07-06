import Link from "next/link";

export default function SignedOutPage() {
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-white"><div><h1 className="text-2xl font-bold">ออกจากระบบแล้ว</h1><p className="mt-2 text-sm text-slate-400">Session ของ SB&amp;M และ RMC SSO ถูกปิดเรียบร้อย</p><Link href="/login" className="mt-6 inline-block rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold">เข้าสู่ระบบอีกครั้ง</Link></div></main>;
}
