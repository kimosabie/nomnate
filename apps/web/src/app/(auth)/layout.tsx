export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-500">NomNate</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Family meals, decided together
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
