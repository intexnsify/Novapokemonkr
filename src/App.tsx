/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { SiteProvider } from './context/SiteContext';
import { EventsPage } from './pages/EventsPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { NewsDetailPage } from './pages/NewsDetailPage';
import { NewsPage } from './pages/NewsPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { SellPage } from './pages/SellPage';
import { ShopPage } from './pages/ShopPage';
import { AdminPage } from './pages/admin/AdminPage';

const NotFoundPage: React.FC = () => (
  <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center space-y-4">
    <p className="font-brand text-xs tracking-[0.22em] text-[#929AA6]">404</p>
    <h1 className="text-2xl font-semibold text-[#F3F4F6]">페이지를 찾을 수 없습니다</h1>
    <p className="text-sm text-[#929AA6]">요청하신 주소가 변경되었거나 존재하지 않습니다.</p>
    <Link
      to="/"
      className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold"
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
                <PublicLayout>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/shop" element={<ShopPage />} />
                    <Route path="/shop/:id" element={<ProductDetailPage />} />
                    <Route path="/sell" element={<SellPage />} />
                    <Route path="/news" element={<NewsPage />} />
                    <Route path="/news/:slug" element={<NewsDetailPage />} />
                    <Route path="/events" element={<EventsPage />} />
                    <Route path="/legal" element={<LegalPage />} />
                    <Route path="/legal/:tab" element={<LegalPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </PublicLayout>
              </SiteProvider>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
