export function AuthFrame({ children, tagline }: { children: React.ReactNode; tagline: string }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[hsl(160,45%,11%)] p-10 text-white lg:flex lg:flex-col">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -bottom-40 -start-20 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 font-bold">O</div>
          <div>
            <div className="font-semibold tracking-wide">OFFSPRING GROUP</div>
            <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">S.A.R.L. · ERP</div>
          </div>
        </div>
        <div className="relative mt-auto max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">{tagline}</h1>
          <p className="mt-4 text-sm text-emerald-100/70">Inventory batches, refrigerated warehousing, export quotations, container shipments, invoicing and profitability — built for agricultural trade from Lebanon to the world.</p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-xs text-emerald-100/80">
            {["Apples & grapes", "Cold rooms", "GCC · US · MX"].map((t) => <div key={t} className="rounded-lg border border-white/10 bg-white/5 p-3">{t}</div>)}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}
