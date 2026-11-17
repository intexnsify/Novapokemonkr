import React, { useEffect, useState } from 'react';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackTitle?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#11151A] via-[#171C23] to-[#080A0D] border border-[#303741]/70 text-[#929AA6] select-none ${className}`}
        role="img"
        aria-label={alt || fallbackTitle || 'NOVA Collectible'}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          className="text-[#C5CBD3]/60 mb-2"
          aria-hidden="true"
        >
          <polygon points="12 2 15 9 22 12 15 15 12 22 9 15 2 12 9 9 12 2" />
        </svg>
        <span className="font-brand text-[10px] tracking-[0.22em] text-[#C5CBD3]/70 uppercase px-3 text-center truncate max-w-full">
          {fallbackTitle || 'NOVA ARCHIVE'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || fallbackTitle || 'NOVA'}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
      {...rest}
    />
  );
};
