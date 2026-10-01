import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Indicadores SISMAP · INAPA',
  description: 'Seguimiento de los indicadores de INAPA en SISMAP',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
