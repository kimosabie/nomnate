export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-medium leading-none">
            <span className="text-flame">Nom</span>
            <span className="text-herb">Nate</span>
          </h1>
          <p className="text-slate mt-2 text-sm">
            Family dinner, decided together
          </p>
        </div>
        <div className="bg-white rounded-[14px] border border-cream-border p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
