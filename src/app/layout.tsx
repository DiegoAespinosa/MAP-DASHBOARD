import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Seguimiento SISMAP · INAPA',
  description: 'Indicadores de INAPA en SISMAP: estado, vencimientos y seguimiento interno',
  icons: { icon: '/favicon.png', apple: '/favicon-192.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
