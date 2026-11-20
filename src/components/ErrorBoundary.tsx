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
        <div className="min-h-screen bg-[#FFFFFF] text-[#111827] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-[#F5F6F8] border border-[#E5E7EB] rounded-lg p-8 space-y-4">
            <p className="text-xs font-mono-tabular uppercase tracking-[0.2em] text-[#465C77] font-semibold">
              NOVA SYSTEM NOTICE
            </p>
            <h1 className="text-xl font-semibold text-[#111827]">화면을 불러오는 중 문제가 발생했습니다</h1>
            <p className="text-sm text-[#667085] leading-relaxed break-words">
              {this.state.message}
            </p>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[42px] px-4 py-2 text-sm font-semibold bg-[#111827] text-[#FFFFFF] rounded-md hover:bg-[#465C77] transition-colors"
              >
                새로고침
              </button>
              <a
                href="/"
                className="min-h-[42px] px-4 py-2 text-sm font-medium border border-[#E5E7EB] bg-[#FFFFFF] text-[#111827] rounded-md hover:border-[#111827] transition-colors inline-flex items-center"
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
