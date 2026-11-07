import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tatak Budz Upholstery Works — Inventory & Job Orders',
  description: 'Inventory and job order management for Tatak Budz Upholstery Works',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
