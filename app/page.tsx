// Server component: the date is computed on the server when the page is
// prerendered during `next build`, so it shows the build date.
const buildDate = new Date().toISOString().slice(0, 10);

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Valstone 2026 Hackathon</h1>
      <p className="text-lg">Dry run — pipeline check</p>
      <p className="text-sm text-zinc-500">Built {buildDate}</p>
    </main>
  );
}
