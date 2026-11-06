import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Upholstery & Steel Works — Inventory & Job Orders',
  description: 'Inventory and job order management for a tricycle upholstery & steel works shop',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
