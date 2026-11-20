import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CornerDownLeft,
  GripVertical,
  ImagePlus,
  Link2,
  Loader2,
  RotateCcw,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  NewsImageStorageMode,
  uploadNewsImageWithProgress,
  validateImageFile,
} from '../../lib/storage';
import {
  hasExplicitImagePlacement,
  isValidImageUrlValue,
  MAX_NEWS_GALLERY_IMAGES,
  NEWS_IMAGE_RIGHTS_PRESETS,
} from '../../lib/newsImages';
import { generateSafeId } from '../../lib/utils';
import { NewsImageItem } from '../../types/nova';
import { SafeImage } from '../SafeImage';

interface UploadTaskItem {
  taskId: string;
  file: File;
  fileName: string;
  progress: number;
  stage: string;
  status: 'uploading' | 'done' | 'error';
  mode?: NewsImageStorageMode;
  error?: string;
}

interface NewsGalleryEditorProps {
  images: NewsImageItem[];
  onChange?: (nextImages: NewsImageItem[]) => void;
  onFunctionalChange?: (updater: (prev: NewsImageItem[]) => NewsImageItem[]) => void;
  articleText?: string;
  onInsertMarker?: (marker: string) => void;
  onInsertAtParagraph?: (marker: string, afterParagraphIndex: number) => void;
  defaultSource?: string;
  onNotify?: (msg: string) => void;
  onUploadCountChange?: (activeCount: number) => void;
  getIdToken?: () => Promise<string | null>;
  netlifyBlobsAvailable?: boolean;
  compact?: boolean;
}

export const NewsGalleryEditor: React.FC<NewsGalleryEditorProps> = ({
  images,
  onChange,
  onFunctionalChange,
  articleText = '',
  onInsertMarker,
  onInsertAtParagraph,
  defaultSource = '',
  onNotify,
  onUploadCountChange,
  getIdToken,
  netlifyBlobsAvailable = false,
  compact = false,
}) => {
  const imagesRef = useRef<NewsImageItem[]>(images);
  imagesRef.current = images;

  const [tasks, setTasks] = useState<UploadTaskItem[]>([]);
  const [manualUrl, setManualUrl] = useState('');
  const [manualSource, setManualSource] = useState('');
  const [manualRights, setManualRights] = useState<string>(NEWS_IMAGE_RIGHTS_PRESETS[0]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeUploadCount = useMemo(
    () => tasks.filter((t) => t.status === 'uploading').length,
    [tasks]
  );

  useEffect(() => {
    onUploadCountChange?.(activeUploadCount);
  }, [activeUploadCount, onUploadCountChange]);

  const applyImageUpdate = (updater: (prev: NewsImageItem[]) => NewsImageItem[]) => {
    if (onFunctionalChange) {
      onFunctionalChange((prev) => updater(prev).slice(0, MAX_NEWS_GALLERY_IMAGES));
    } else if (onChange) {
      const next = updater(imagesRef.current).slice(0, MAX_NEWS_GALLERY_IMAGES);
      imagesRef.current = next;
      onChange(next);
    }
  };

  const remainingSlots = Math.max(0, MAX_NEWS_GALLERY_IMAGES - images.length);

  const paragraphs = useMemo(() => {
    if (!articleText.trim()) return [];
    return articleText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [articleText]);

  const runSingleFileUpload = async (taskId: string, file: File) => {
    const fileErr = validateImageFile(file, 10 * 1024 * 1024);
    if (fileErr) {
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId ? { ...t, status: 'error', progress: 0, error: fileErr } : t
        )
      );
      onNotify?.(fileErr);
      return;
    }

    try {
      const idToken = getIdToken ? await getIdToken().catch(() => null) : null;
      const res = await uploadNewsImageWithProgress(file, {
        idToken,
        netlifyBlobsAvailable,
        onProgress: (pct, stage) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.taskId === taskId ? { ...t, progress: pct, stage, status: 'uploading' } : t
            )
          );
        },
      });

      const newItem: NewsImageItem = {
        id: generateSafeId('img'),
        url: res.url,
        caption: '',
        source: defaultSource.trim().slice(0, 140),
        rights: '공식 보도자료 · 출처 표기',
        rightsNote: '',
      };

      let appended = false;
      applyImageUpdate((prev) => {
        if (prev.length >= MAX_NEWS_GALLERY_IMAGES) return prev;
        appended = true;
        return [...prev, newItem];
      });

      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId
            ? appended
              ? {
                  ...t,
                  status: 'done',
                  progress: 100,
                  mode: res.mode,
                  stage:
                    res.mode === 'firebase_storage'
                      ? 'Firebase Storage 저장 완료'
                      : res.mode === 'netlify_blobs'
                        ? 'Netlify Blobs 저장 완료'
                        : '경량 WebP 등록 완료',
                }
              : {
                  ...t,
                  status: 'error',
                  error: `최대 ${MAX_NEWS_GALLERY_IMAGES}장 제한을 초과해 추가되지 않았습니다.`,
                }
            : t
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === taskId ? { ...t, status: 'error', error: msg } : t
        )
      );
      onNotify?.(`${file.name} 업로드 실패: ${msg}`);
    }
  };

  const handleMultiFileUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const currentRemaining = Math.max(0, MAX_NEWS_GALLERY_IMAGES - imagesRef.current.length);
    if (currentRemaining <= 0) {
      onNotify?.(`추가 이미지는 최대 ${MAX_NEWS_GALLERY_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }

    const files = Array.from(fileList).slice(0, currentRemaining);
    if (fileList.length > currentRemaining) {
      onNotify?.(`최대 ${MAX_NEWS_GALLERY_IMAGES}장 제한으로 처음 ${files.length}장만 업로드합니다.`);
    }

    const queued: UploadTaskItem[] = files.map((file) => ({
      taskId: generateSafeId('upl'),
      file,
      fileName: file.name,
      progress: 5,
      stage: '업로드 대기 중',
      status: 'uploading',
    }));

    setTasks((prev) => [...queued, ...prev].slice(0, 14));

    // Process sequentially so progress & atomic appends remain predictable and never overwhelm mobile networks
    for (const q of queued) {
      await runSingleFileUpload(q.taskId, q.file);
    }
  };

  const handleRetryTask = async (taskId: string) => {
    const target = tasks.find((t) => t.taskId === taskId);
    if (!target) return;
    setTasks((prev) =>
      prev.map((t) =>
        t.taskId === taskId
          ? { ...t, status: 'uploading', progress: 5, stage: '재시도 중', error: undefined }
          : t
      )
    );
    await runSingleFileUpload(taskId, target.file);
  };

  const handleDismissTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
  };

  const handleAddByUrl = () => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    if (imagesRef.current.length >= MAX_NEWS_GALLERY_IMAGES) {
      onNotify?.(`추가 이미지는 최대 ${MAX_NEWS_GALLERY_IMAGES}장까지 등록할 수 있습니다.`);
      return;
    }
    if (!isValidImageUrlValue(trimmed)) {
      onNotify?.('올바른 이미지 URL(https://... 또는 /...)을 입력해 주세요.');
      return;
    }

    const nextItem: NewsImageItem = {
      id: generateSafeId('img'),
      url: trimmed.slice(0, 200000),
      caption: '',
      source: (manualSource.trim() || defaultSource.trim()).slice(0, 140),
      rights: manualRights,
      rightsNote: '',
    };

    applyImageUpdate((prev) => [...prev, nextItem]);
    setManualUrl('');
    setManualSource('');
    onNotify?.('이미지 URL이 추가되었습니다. 설명·출처·사용 권한을 확인해 주세요.');
  };

  const handleUpdateItem = (id: string, patch: Partial<NewsImageItem>) => {
    applyImageUpdate((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleMove = (index: number, dir: -1 | 1) => {
    applyImageUpdate((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [picked] = copy.splice(index, 1);
      copy.splice(target, 0, picked);
      return copy;
    });
  };

  const handleReorderDrop = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    applyImageUpdate((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const copy = [...prev];
      const [picked] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, picked);
      return copy;
    });
  };

  const handleRemove = (id: string) => {
    applyImageUpdate((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="border border-[#303741] rounded-lg bg-[#11151A] p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ImagePlus size={15} className="text-[#C5CBD3]" />
            <h3 className="text-xs font-semibold text-[#F3F4F6]">
              본문 추가 이미지 ({images.length} / {MAX_NEWS_GALLERY_IMAGES})
            </h3>
            {activeUploadCount > 0 && (
              <span className="text-[11px] font-mono-tabular text-amber-300 inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                <span>{activeUploadCount}건 업로드 중</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#929AA6] leading-relaxed">
            드래그 또는 위/아래 버튼으로 순서를 바꾸고, 원하는 문단 사이에 삽입할 수 있습니다. (업로드 실패 시 기존 작업은 유지됩니다.)
          </p>
        </div>

        <label
          className={`min-h-[38px] px-3.5 py-1.5 rounded text-xs font-medium inline-flex items-center justify-center gap-1.5 shrink-0 border transition-colors ${
            remainingSlots === 0
              ? 'border-[#303741] bg-[#171C23] text-[#929AA6] opacity-50 cursor-not-allowed'
              : 'border-[#C5CBD3]/60 bg-[#171C23] text-[#F3F4F6] hover:border-[#F3F4F6] cursor-pointer'
          }`}
        >
          <Upload size={13} />
          <span>{remainingSlots === 0 ? '최대 10장 도달' : '여러 장 업로드'}</span>
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={remainingSlots === 0}
            onChange={(e) => {
              void handleMultiFileUpload(e.target.files);
              e.currentTarget.value = '';
            }}
            className="sr-only"
          />
        </label>
      </div>

      {/* Per-File Upload Progress & Failure Recovery Queue */}
      {tasks.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-[#929AA6]">
            <span>이미지 업로드 상태</span>
            {activeUploadCount === 0 && (
              <button
                type="button"
                onClick={() => setTasks([])}
                className="text-[#C5CBD3] hover:text-[#F3F4F6]"
              >
                완료 목록 비우기
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {tasks.map((task) => (
              <div
                key={task.taskId}
                className={`border rounded px-3 py-2 text-xs space-y-1.5 ${
                  task.status === 'error'
                    ? 'border-red-400/50 bg-red-950/20'
                    : task.status === 'done'
                      ? 'border-emerald-400/40 bg-emerald-950/15'
                      : 'border-[#303741] bg-[#080A0D]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {task.status === 'uploading' && (
                      <Loader2 size={13} className="text-[#C5CBD3] animate-spin shrink-0" />
                    )}
                    {task.status === 'done' && (
                      <CheckCircle2 size={13} className="text-emerald-300 shrink-0" />
                    )}
                    {task.status === 'error' && (
                      <AlertCircle size={13} className="text-red-300 shrink-0" />
                    )}
                    <span className="truncate text-[#F3F4F6] font-medium">{task.fileName}</span>
                    <span className="text-[11px] text-[#929AA6] truncate">{task.stage}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'uploading' && (
                      <span className="font-mono-tabular text-[11px] text-[#C5CBD3]">
                        {task.progress}%
                      </span>
                    )}
                    {task.status === 'error' && (
                      <button
                        type="button"
                        onClick={() => void handleRetryTask(task.taskId)}
                        className="px-2 py-0.5 text-[11px] border border-[#C5CBD3]/60 rounded text-[#F3F4F6] hover:bg-[#171C23] inline-flex items-center gap-1"
                      >
                        <RotateCcw size={11} />
                        <span>재시도</span>
                      </button>
                    )}
                    {task.status !== 'uploading' && (
                      <button
                        type="button"
                        onClick={() => handleDismissTask(task.taskId)}
                        className="text-[#929AA6] hover:text-[#F3F4F6]"
                        aria-label="상태 닫기"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {task.status === 'uploading' && (
                  <div className="h-1 w-full bg-[#171C23] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8068BA] transition-all duration-200"
                      style={{ width: `${Math.max(5, task.progress)}%` }}
                    />
                  </div>
                )}

                {task.error && <p className="text-[11px] text-red-200">{task.error}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Image by External URL with Source & Rights */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-[#303741]/60">
        <div className="sm:col-span-5 relative">
          <Link2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#929AA6]" />
          <input
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="사용 허가된 이미지 URL 입력 (https://...)"
            disabled={remainingSlots === 0}
            className="w-full min-h-[36px] pl-8 pr-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] disabled:opacity-50"
          />
        </div>
        <input
          type="text"
          value={manualSource}
          onChange={(e) => setManualSource(e.target.value)}
          placeholder={defaultSource ? `출처 (기본: ${defaultSource})` : '출처 (예: Pokémon 공식)'}
          disabled={remainingSlots === 0}
          className="sm:col-span-3 min-h-[36px] px-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] disabled:opacity-50"
        />
        <select
          value={manualRights}
          onChange={(e) => setManualRights(e.target.value)}
          disabled={remainingSlots === 0}
          className="sm:col-span-2 min-h-[36px] px-2 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] disabled:opacity-50"
        >
          {NEWS_IMAGE_RIGHTS_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {preset}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAddByUrl}
          disabled={remainingSlots === 0 || !manualUrl.trim()}
          className="sm:col-span-2 min-h-[36px] px-3 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#C5CBD3] hover:text-[#F3F4F6] hover:border-[#C5CBD3] rounded disabled:opacity-40"
        >
          URL 추가
        </button>
      </div>

      {/* Gallery Image List */}
      {images.length > 0 && (
        <div className={`space-y-3 ${compact ? 'max-h-[520px] overflow-y-auto pr-1' : ''}`}>
          {images.map((img, idx) => {
            const isPlacedInline = hasExplicitImagePlacement(articleText, img, idx);
            const isInlineData = img.url.startsWith('data:image/');
            const isBlobUrl = img.url.startsWith('/api/media/');
            const isDropTarget = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;

            return (
              <div
                key={img.id}
                draggable
                onDragStart={(e) => {
                  setDragIndex(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== idx) setDragOverIndex(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === idx) setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== idx) {
                    handleReorderDrop(dragIndex, idx);
                  }
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`border rounded-md bg-[#080A0D] p-3 grid grid-cols-1 md:grid-cols-12 gap-3 transition-colors ${
                  isDropTarget
                    ? 'border-[#8068BA] bg-[#8068BA]/10'
                    : dragIndex === idx
                      ? 'border-[#C5CBD3] opacity-70'
                      : 'border-[#303741]'
                }`}
              >
                {/* Thumbnail + Order */}
                <div className="md:col-span-3 space-y-2">
                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="font-mono-tabular font-semibold text-[#F3F4F6] inline-flex items-center gap-1 cursor-grab">
                      <GripVertical size={13} className="text-[#929AA6]" />
                      <span>#{idx + 1}</span>
                    </span>
                    <span
                      className={`text-[10px] font-medium ${
                        isPlacedInline ? 'text-emerald-300' : 'text-[#929AA6]'
                      }`}
                    >
                      {isPlacedInline ? '본문 지정 위치' : '자동 분산'}
                    </span>
                  </div>

                  <div className="h-28 w-full rounded border border-[#303741] bg-[#11151A] overflow-hidden flex items-center justify-center">
                    <SafeImage
                      src={img.url}
                      alt={img.caption || `추가 이미지 ${idx + 1}`}
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10px] text-[#929AA6]">
                    <span>
                      {isInlineData
                        ? '인라인 경량'
                        : isBlobUrl
                          ? 'Netlify Blobs'
                          : '외부/Storage URL'}
                    </span>
                    <span className="font-mono-tabular truncate max-w-[100px]" title={img.id}>
                      {img.id}
                    </span>
                  </div>
                </div>

                {/* Metadata Inputs & Actions */}
                <div className="md:col-span-9 space-y-2.5 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, -1)}
                        className="min-h-[32px] px-2 py-1 text-[11px] border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1 disabled:opacity-35"
                        title="순서 위로"
                      >
                        <ArrowUp size={12} />
                        <span>위로</span>
                      </button>
                      <button
                        type="button"
                        disabled={idx === images.length - 1}
                        onClick={() => handleMove(idx, 1)}
                        className="min-h-[32px] px-2 py-1 text-[11px] border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1 disabled:opacity-35"
                        title="순서 아래로"
                      >
                        <ArrowDown size={12} />
                        <span>아래로</span>
                      </button>
                      {onInsertMarker && (
                        <button
                          type="button"
                          onClick={() => onInsertMarker(`[[image:${img.id}]]`)}
                          className="min-h-[32px] px-2.5 py-1 text-[11px] font-medium border border-[#C5CBD3]/60 bg-[#171C23] text-[#F3F4F6] rounded hover:bg-[#C5CBD3] hover:text-[#080A0D] inline-flex items-center gap-1 transition-colors"
                        >
                          <CornerDownLeft size={12} />
                          <span>커서 위치 삽입</span>
                        </button>
                      )}
                      {onInsertAtParagraph && paragraphs.length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') return;
                            onInsertAtParagraph(`[[image:${img.id}]]`, Number(val));
                            e.currentTarget.value = '';
                          }}
                          aria-label="문단 사이에 이미지 삽입"
                          className="min-h-[32px] px-2 py-1 text-[11px] border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3]"
                        >
                          <option value="">문단 사이 삽입...</option>
                          {paragraphs.map((p, pIdx) => (
                            <option key={pIdx} value={pIdx}>
                              {pIdx + 1}문단 뒤 ({p.slice(0, 14).replace(/\s+/g, ' ')}...)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemove(img.id)}
                      className="min-h-[32px] px-2.5 py-1 text-[11px] border border-red-400/40 text-red-200 hover:bg-red-950/30 rounded inline-flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>삭제</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[10px] text-[#929AA6]">
                        설명 문구 (캡션 · 독자 화면에 표시)
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={img.caption || ''}
                        onChange={(e) => handleUpdateItem(img.id, { caption: e.target.value })}
                        placeholder="예: 신규 확장팩 메인 패키지 및 프로모 카드 실물 이미지"
                        className="w-full min-h-[34px] px-2.5 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] text-[#929AA6]">
                        이미지 출처 (예: PokéBeach, 공식 X, 직접 촬영)
                      </label>
                      <input
                        type="text"
                        maxLength={140}
                        value={img.source || ''}
                        onChange={(e) => handleUpdateItem(img.id, { source: e.target.value })}
                        placeholder="출처명 입력"
                        className="w-full min-h-[34px] px-2.5 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="flex items-center gap-1 text-[10px] text-[#929AA6]">
                        <Shield size={10} />
                        <span>사용 권한 구분</span>
                      </label>
                      <select
                        value={
                          NEWS_IMAGE_RIGHTS_PRESETS.includes(
                            (img.rights || '') as (typeof NEWS_IMAGE_RIGHTS_PRESETS)[number]
                          )
                            ? img.rights
                            : '권한 확인 필요'
                        }
                        onChange={(e) => handleUpdateItem(img.id, { rights: e.target.value })}
                        className="w-full min-h-[34px] px-2 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
                      >
                        {NEWS_IMAGE_RIGHTS_PRESETS.map((preset) => (
                          <option key={preset} value={preset}>
                            {preset}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[10px] text-[#929AA6]">
                        사용 권한 상세 메모 (선택 · 허가 일시/보도자료 링크/자체 촬영 기록)
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        value={img.rightsNote || ''}
                        onChange={(e) => handleUpdateItem(img.id, { rightsNote: e.target.value })}
                        placeholder="예: 공식 프레스킷 이미지 출처 표기 조건 / 저작권자 이메일 허가 (2026-04-01)"
                        className="w-full min-h-[34px] px-2.5 text-xs bg-[#11151A] border border-[#303741] rounded text-[#F3F4F6]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
