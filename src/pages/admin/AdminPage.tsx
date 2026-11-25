import {BuybackPrices} from '../../components/BuybackPrices';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Calendar,
  Eye,
  FileText,
  Globe,
  HelpCircle,
  Inbox,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Palette,
  Rss,
  Save,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  X,
  Youtube,
} from 'lucide-react';
import { AdminMenuId, AdminProvider, useAdmin } from './AdminContext';
import { AdminGate } from './AdminGate';
import { AdminsTab, AnalyticsTab, BackupTab, DashboardTab } from './AdminDashboardTab';
import {
  BrandSettingsTab,
  CommunityLinksTab,
  HomeLayoutTab,
  SeoSettingsTab,
  ThemeSettingsTab,
} from './AdminConfigTabs';
import {
  BuybacksTab,
  EventsTab,
  FaqsTab,
  NoticesTab,
  PostsTab,
  ProductsTab,
  ReviewsTab,
  SponsorsTab,
} from './AdminContentTabs';
import { DropsTab } from './AdminDropsTab';
import { AdminNewsInboxTab } from './AdminNewsInboxTab';
import { AdminOripaTab } from './AdminOripaTab';

const MENU_ITEMS: { id: AdminMenuId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: '1. 대시보드', icon: <LayoutDashboard size={15} /> },
  { id: 'brand', label: '2. 브랜드 설정', icon: <Sparkles size={15} /> },
  { id: 'theme', label: '3. 디자인/테마', icon: <Palette size={15} /> },
  { id: 'home_layout', label: '4. 메인 화면 구성', icon: <LayoutGrid size={15} /> },
  { id: 'community', label: '5. 링크/커뮤니티', icon: <Share2 size={15} /> },
  { id: 'products', label: '6. 상품 관리', icon: <Package size={15} /> },
  { id: 'buybacks', label: '7. 매입 신청 관리', icon: <Inbox size={15} /> },
  { id: 'posts', label: '8. 게시글/뉴스', icon: <FileText size={15} /> },
  { id: 'news_inbox', label: '해외 뉴스 수집함', icon: <Rss size={15} /> },
  { id: 'notices', label: '9. 공지사항', icon: <Bell size={15} /> },
  { id: 'sponsors', label: '10. 배너/협찬', icon: <Tag size={15} /> },
  { id: 'events', label: '11. 라이브/이벤트', icon: <Calendar size={15} /> },
  { id: 'reviews', label: '12. 후기 관리', icon: <MessageSquareQuote size={15} /> },
  { id: 'faqs', label: '13. FAQ', icon: <HelpCircle size={15} /> },
  { id: 'analytics', label: '14. 방문/클릭 통계', icon: <BarChart3 size={15} /> },
  { id: 'seo', label: '15. SEO/공유 설정', icon: <Globe size={15} /> },
  { id: 'backup', label: '16. 백업/휴지통', icon: <Archive size={15} /> },
  { id: 'admins', label: '17. 관리자 설정', icon: <ShieldCheck size={15} /> },
  { id: 'drops', label: '18. 정가·추첨 관리', icon: <Ticket size={15} /> },
  { id: 'oripa', label: '19. 오리파 / 라이브 관리', icon: <Youtube size={15} /> },
];

const AdminShell: React.FC = () => {
  const {
    user,
    logout,
    activeMenu,
    setActiveMenu,
    hasUnsavedChanges,
    savingConfig,
    publishingConfig,
    saveDraftConfig,
    publishDraftToLive,
    discardDraftChanges,
    statusToast,
    quotaWarning,
  } = useAdmin();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuChange = (id: AdminMenuId) => {
    setActiveMenu(id);
    setMobileNavOpen(false);
  };

  const handlePreviewDraft = async () => {
    if (hasUnsavedChanges) {
      await saveDraftConfig();
    }
    navigate('/?preview=draft');
  };

  const renderContent = () => {
    switch (activeMenu) {
      case 'dashboard':
        return <DashboardTab />;
      case 'brand':
        return <BrandSettingsTab />;
      case 'theme':
        return <ThemeSettingsTab />;
      case 'home_layout':
        return <HomeLayoutTab />;
      case 'community':
        return <CommunityLinksTab />;
      case 'products':
        return <ProductsTab />;
      case 'buybacks':
        return <><BuybackPrices/><BuybacksTab /></>;
      case 'posts':
        return <PostsTab />;
      case 'news_inbox':
        return <AdminNewsInboxTab />;
      case 'notices':
        return <NoticesTab />;
      case 'sponsors':
        return <SponsorsTab />;
      case 'events':
        return <EventsTab />;
      case 'reviews':
        return <ReviewsTab />;
      case 'faqs':
        return <FaqsTab />;
      case 'analytics':
        return <AnalyticsTab />;
      case 'seo':
        return <SeoSettingsTab />;
      case 'backup':
        return <BackupTab />;
      case 'admins':
        return <AdminsTab />;
      case 'drops':
        return <DropsTab />;
      case 'oripa':
        return <AdminOripaTab />;
      default:
        return <DashboardTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex flex-col">
      {/* Admin Top Bar */}
      <header className="sticky top-0 z-40 h-16 border-b border-[#303741] bg-[#080A0D]/95 backdrop-blur px-4 sm:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            className="lg:hidden w-10 h-10 flex items-center justify-center border border-[#303741] rounded text-[#F3F4F6]"
            aria-label="관리자 메뉴 열기"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <Link
            to="/"
            className="font-brand text-sm font-bold tracking-[0.2em] text-[#F3F4F6] whitespace-nowrap"
          >
            NOVA ADMIN
          </Link>
          {hasUnsavedChanges && (
            <span className="hidden sm:inline text-xs text-amber-300 font-medium whitespace-nowrap">
              · 미저장 변경사항 있음
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={savingConfig}
            onClick={() => saveDraftConfig()}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#F3F4F6] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            <Save size={14} />
            <span className="hidden sm:inline">{savingConfig ? '저장 중...' : '초안 저장'}</span>
          </button>

          <button
            type="button"
            onClick={handlePreviewDraft}
            className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Eye size={14} />
            <span className="hidden md:inline">공개 전 미리보기</span>
          </button>

          <button
            type="button"
            disabled={publishingConfig}
            onClick={() => publishDraftToLive()}
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded hover:bg-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
          >
            <Send size={14} />
            <span>{publishingConfig ? '게시 중...' : '변경사항 게시'}</span>
          </button>

          <button
            type="button"
            onClick={logout}
            title={user?.email || '로그아웃'}
            className="min-h-[38px] px-2.5 py-1.5 text-xs border border-[#303741] text-[#929AA6] rounded hover:text-[#F3F4F6]"
            aria-label="로그아웃"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {quotaWarning && (
        <div className="border-b border-amber-400/50 bg-amber-950/40 px-4 sm:px-6 py-2.5 flex items-start gap-2.5 text-xs text-amber-100">
          <AlertTriangle size={15} className="text-amber-300 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{quotaWarning}</p>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="border-b border-amber-400/40 bg-amber-950/30 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-amber-200">
            저장되지 않은 브랜드·테마·구성 변경사항이 있습니다.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={discardDraftChanges}
              className="px-2.5 py-1 border border-[#303741] rounded text-[#929AA6] hover:text-[#F3F4F6]"
            >
              변경 취소
            </button>
            <button
              type="button"
              onClick={() => saveDraftConfig()}
              className="px-3 py-1 bg-[#C5CBD3] text-[#080A0D] rounded font-semibold"
            >
              초안 저장
            </button>
          </div>
        </div>
      )}

      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm border border-[#C5CBD3] bg-[#171C23] text-[#F3F4F6] px-4 py-3 rounded-md text-xs shadow-lg">
          {statusToast}
        </div>
      )}

      <div className="flex-1 flex relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-[#303741] bg-[#11151A] p-3 space-y-1">
          {MENU_ITEMS.map((item) => {
            const active = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMenuChange(item.id)}
                className={`w-full min-h-[38px] px-3 py-2 rounded text-xs font-medium flex items-center gap-2.5 text-left transition-colors ${
                  active
                    ? 'bg-[#171C23] text-[#F3F4F6] border border-[#303741]'
                    : 'text-[#929AA6] hover:text-[#F3F4F6]'
                }`}
              >
                <span className={active ? 'text-[#C5CBD3]' : 'text-[#929AA6]'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Mobile Drawer Sidebar */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 top-16 z-30 bg-[#080A0D]/80 flex">
            <aside className="w-64 h-full overflow-y-auto border-r border-[#303741] bg-[#11151A] p-3 space-y-1">
              {MENU_ITEMS.map((item) => {
                const active = activeMenu === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuChange(item.id)}
                    className={`w-full min-h-[42px] px-3 py-2 rounded text-xs font-medium flex items-center gap-2.5 text-left ${
                      active
                        ? 'bg-[#171C23] text-[#F3F4F6] border border-[#303741]'
                        : 'text-[#929AA6]'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </aside>
            <div className="flex-1" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        {/* Main Admin Content */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 max-w-6xl">{renderContent()}</main>
      </div>
    </div>
  );
};

export const AdminPage: React.FC = () => {
  return (
    <AdminProvider>
      <AdminGate>
        <AdminShell />
      </AdminGate>
    </AdminProvider>
  );
};
