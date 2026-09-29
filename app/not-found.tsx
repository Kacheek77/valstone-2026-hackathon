import Link from "next/link";
import { Page } from "@/components/ui";

export default function NotFound() {
  return (
    <Page>
      <div className="mx-auto mt-16 max-w-md rounded-xl border border-[#d9dee3] bg-[#eef0f2] px-6 py-8 text-center">
        <p className="text-lg font-semibold">That page does not exist.</p>
        <p className="mt-1 text-sm text-[#5a6975]">The link may be out of date, or the record was removed.</p>
        <div className="mt-4 flex justify-center gap-4 text-sm">
          <Link href="/" className="text-[#3a728a] underline">Welcome</Link>
          <Link href="/dashboard" className="text-[#3a728a] underline">Dashboard</Link>
        </div>
      </div>
    </Page>
  );
}
