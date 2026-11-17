import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || '알 수 없는 오류가 발생했습니다.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('NOVA ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#080A0D] text-[#F3F4F6] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#171C23] border border-[#303741] rounded-lg p-8 space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[#929AA6]">NOVA SYSTEM NOTICE</p>
            <h1 className="text-xl font-semibold text-[#F3F4F6]">화면을 불러오는 중 문제가 발생했습니다</h1>
            <p className="text-sm text-[#929AA6] leading-relaxed break-words">
              {this.state.message}
            </p>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium bg-[#C5CBD3] text-[#080A0D] rounded-md hover:bg-[#F3F4F6] transition-colors"
              >
                새로고침
              </button>
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium border border-[#303741] text-[#F3F4F6] rounded-md hover:border-[#C5CBD3] transition-colors"
              >
                홈으로 이동
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
