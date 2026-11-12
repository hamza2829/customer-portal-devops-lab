import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './styles.css';

export const metadata: Metadata = {
  title: 'Customer Portal',
  description: 'A customer portal demo with synthetic data.',
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="masthead"><strong>Customer Portal</strong><span>DevOps lab</span></header>
        {children}
      </body>
    </html>
  );
}
