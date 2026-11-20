/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { CartProvider } from './context/CartContext';
import { SiteProvider } from './context/SiteContext';
import { DropsPage } from './pages/DropsPage';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { NewsPage } from './pages/NewsPage';
import { OripaPage } from './pages/OripaPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SellPage } from './pages/SellPage';
import { ShopPage } from './pages/ShopPage';
import { SponsorsPage } from './pages/SponsorsPage';
import { AdminPage } from './pages/admin/AdminPage';

const NotFoundPage: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-24 text-center space-y-5">
    <p className="font-mono-tabular text-xs tracking-[0.22em] text-[#667085]">404 · PAGE NOT FOUND</p>
    <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] text-balance">
      페이지를 찾을 수 없습니다
    </h1>
    <p className="text-sm text-[#667085]">요청하신 주소가 변경되었거나 존재하지 않습니다.</p>
    <Link
      to="/"
      className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 bg-[#111827] text-[#FFFFFF] hover:bg-[#465C77] rounded-md text-sm font-medium transition-colors"
    >
      NOVA 홈으로 돌아가기
    </Link>
  </div>
);

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route
            path="*"
            element={
              <SiteProvider>
                <CartProvider>
                  <PublicLayout>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/drops" element={<DropsPage />} />
                      <Route path="/shop" element={<ShopPage />} />
                      <Route path="/shop/:id" element={<ProductDetailPage />} />
                      <Route path="/market" element={<ShopPage />} />
                      <Route path="/oripa" element={<OripaPage />} />
                      <Route path="/oripa/:id" element={<OripaPage />} />
                      <Route path="/sell" element={<SellPage />} />
                      <Route path="/news" element={<NewsPage />} />
                      <Route path="/news/:slug" element={<NewsDetailPage />} />
                      <Route path="/events" element={<EventsPage />} />
                      <Route path="/sponsors" element={<SponsorsPage />} />
                      <Route path="/partners" element={<SponsorsPage />} />
                      <Route path="/legal" element={<LegalPage />} />
                      <Route path="/legal/:tab" element={<LegalPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </PublicLayout>
                </CartProvider>
              </SiteProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
