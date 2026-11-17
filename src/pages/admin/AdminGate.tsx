import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, Copy, LogIn, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';
import { copyToClipboardSafe } from '../../lib/utils';
import { useAdmin } from './AdminContext';

export const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authStatus, authError, user, loginWithGoogle, logout, retryAuth } = useAdmin();
  const [copiedUid, setCopiedUid] = useState(false);

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex flex-col items-center justify-center p-6 gap-4">
        <div className="w-8 h-8 border-2 border-[#303741] border-t-[#C5CBD3] rounded-full animate-spin" />
        <p className="text-sm text-[#929AA6]">관리자 인증 및 Firestore 보안 권한을 확인하고 있습니다...</p>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#171C23] border border-[#303741] rounded-lg p-8 space-y-5">
          <div className="flex items-center gap-3 text-amber-300">
            <AlertTriangle size={22} />
            <h1 className="text-lg font-semibold text-[#F3F4F6]">Firebase 연결 오류</h1>
          </div>
          <p className="text-sm text-[#929AA6] leading-relaxed">
            {authError || '데이터베이스와 연결하는 중 일시적인 오류가 발생했습니다.'}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={retryAuth}
              className="min-h-[44px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#F3F4F6]"
            >
              <RefreshCw size={15} />
              <span>다시 시도</span>
            </button>
            <Link
              to="/"
              className="min-h-[44px] px-4 py-2 border border-[#303741] text-[#F3F4F6] rounded-md text-sm inline-flex items-center hover:border-[#C5CBD3]"
            >
              공개 사이트로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'signed_out') {
    return (
      <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#171C23] border border-[#303741] rounded-lg p-8 space-y-6">
          <div className="space-y-2">
            <p className="font-brand text-xs tracking-[0.22em] text-[#C5CBD3]">NOVA ADMIN</p>
            <h1 className="text-2xl font-semibold text-[#F3F4F6]">관리자 대시보드 로그인</h1>
            <p className="text-sm text-[#929AA6] leading-relaxed">
              Firebase Auth 및 Firestore UID 허용 목록(`admins/&#123;uid&#125;`)으로 검증된 관리자만 접근할 수 있습니다.
            </p>
          </div>

          {authError && (
            <div className="p-3 rounded border border-red-400/50 bg-red-950/30 text-xs text-red-200">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={loginWithGoogle}
            className="w-full min-h-[48px] px-5 py-3 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-[#F3F4F6] transition-colors"
          >
            <LogIn size={17} />
            <span>Google 계정으로 로그인</span>
          </button>

          <a
            href="/admin?tab=drops"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[40px] px-4 py-2 border border-[#303741] rounded-md text-xs text-[#C5CBD3] hover:border-[#C5CBD3] flex items-center justify-center"
          >
            미리보기 안에서 로그인이 안 되면 새 창에서 열기 ↗
          </a>

          <div className="pt-2 border-t border-[#303741] flex justify-between items-center text-xs text-[#929AA6]">
            <span>허용 계정만 대시보드 열람 가능</span>
            <Link to="/" className="hover:text-[#F3F4F6]">
              홈으로 →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthorized' && user) {
    const handleCopyUid = async () => {
      const ok = await copyToClipboardSafe(user.uid);
      if (ok) {
        setCopiedUid(true);
        setTimeout(() => setCopiedUid(false), 2500);
      }
    };

    return (
      <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-[#171C23] border border-[#303741] rounded-lg p-8 space-y-6">
          <div className="flex items-center gap-3">
            <ShieldAlert size={22} className="text-[#8068BA] shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-[#F3F4F6]">관리자 접근 권한 없음</h1>
              <p className="text-xs text-[#929AA6]">Firestore `admins` 허용 목록에 등록되지 않은 계정입니다.</p>
            </div>
          </div>

          <div className="border border-[#303741] rounded-md p-4 bg-[#11151A] space-y-3 text-xs">
            <div>
              <p className="text-[#929AA6]">로그인된 이메일</p>
              <p className="font-mono-tabular text-[#F3F4F6] mt-0.5">{user.email || '-'}</p>
            </div>
            <div>
              <p className="text-[#929AA6]">Firebase Auth UID (관리자 등록용)</p>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={user.uid}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full min-h-[38px] px-2.5 py-1 bg-[#080A0D] border border-[#303741] rounded font-mono-tabular text-[#C5CBD3]"
                />
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="min-h-[38px] px-3 bg-[#171C23] border border-[#303741] rounded text-[#F3F4F6] hover:border-[#C5CBD3] shrink-0 inline-flex items-center gap-1.5"
                >
                  {copiedUid ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedUid ? '복사됨' : '복사'}</span>
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#929AA6] leading-relaxed">
            기존 관리자가 관리자 대시보드의 [17. 관리자 설정] 메뉴에 위 UID를 추가하면 즉시 접근 권한이 부여됩니다.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retryAuth}
              className="min-h-[44px] px-4 py-2 bg-[#C5CBD3] text-[#080A0D] rounded-md text-sm font-semibold inline-flex items-center gap-2"
            >
              <RefreshCw size={15} />
              <span>권한 다시 확인</span>
            </button>
            <button
              type="button"
              onClick={logout}
              className="min-h-[44px] px-4 py-2 border border-[#303741] text-[#F3F4F6] rounded-md text-sm inline-flex items-center gap-2 hover:border-[#C5CBD3]"
            >
              <LogOut size={15} />
              <span>다른 계정으로 로그인</span>
            </button>
            <Link
              to="/"
              className="min-h-[44px] px-4 py-2 text-sm text-[#929AA6] hover:text-[#F3F4F6] inline-flex items-center"
            >
              공개 사이트로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
