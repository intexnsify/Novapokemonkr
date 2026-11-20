import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Loader2,
  Pin,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { db, explainFirestoreError } from '../../lib/firebase';
import {
  areDraftsEqual,
  buildNewsPostMarkdown,
  clearLocalDraft,
  draftFromInboxItem,
  estimateInboxDocBytes,
  estimatePostDocBytes,
  getServerUpdatedAtMs,
  loadLocalDraft,
  loadRevisions,
  NewsDraftData,
  NewsRevisionEntry,
  pushRevision,
  saveLocalDraft,
} from '../../lib/newsDraftStore';
import {
  isValidImageUrlValue,
  MAX_NEWS_GALLERY_IMAGES,
  sanitizeGalleryImages,
} from '../../lib/newsImages';
import {
  NewsImageStorageMode,
  uploadNewsImageWithProgress,
  validateImageFile,
} from '../../lib/storage';
import {
  formatKST,
  generateSafeId,
  sanitizeSlug,
} from '../../lib/utils';
import {
  NewsInboxItem,
  NewsInboxStatus,
  NewsTcgCategory,
} from '../../types/nova';
import {
  diagnosePublishPermissions,
  isValidFirestoreId,
  normalizeTcgCategory,
  PublishPermissionStep,
  validateInboxUpdateAgainstRules,
  validatePostPayloadAgainstRules,
} from '../../lib/newsPublishGuard';
import {
  LiveBatchDiagnosticsReport,
  registerBrowserBatchDiagnosticHelpers,
  runLivePublishBatchDiagnostics,
} from '../../lib/newsBatchDiagnostics';
import { SafeImage } from '../../components/SafeImage';
import { NewsGalleryEditor } from '../../components/admin/NewsGalleryEditor';
import { NewsArticlePreviewModal } from '../../components/admin/NewsArticlePreviewModal';
import { User } from 'firebase/auth';

const TCG_CATEGORIES: NewsTcgCategory[] = ['포켓몬 TCG', '원피스 TCG', '기타 TCG'];
const SAFE_FIRESTORE_BYTE_LIMIT = 900 * 1024; // Safety margin below 1,048,576 byte hard cap

export type EditorSaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface EditorErrorBanner {
  stage: 'draft_save' | 'publish' | 'ai_draft' | 'cover_upload' | 'validation';
  title: string;
  detail: string;
  actionHint: string;
  diagnosticSteps?: PublishPermissionStep[];
}

interface NewsArticleEditorProps {
  item: NewsInboxItem;
  user: User | null;
  aiDraftAvailable: boolean;
  netlifyBlobsAvailable: boolean;
  onBack: () => void;
  onNotify: (msg: string) => void;
  onChangeStatus: (item: NewsInboxItem, nextStatus: NewsInboxStatus) => Promise<void>;
  onDelete: (item: NewsInboxItem) => Promise<boolean>;
}

export const NewsArticleEditor: React.FC<NewsArticleEditorProps> = ({
  item,
  user,
  aiDraftAvailable,
  netlifyBlobsAvailable,
  onBack,
  onNotify,
  onChangeStatus,
  onDelete,
}) => {
  const initialServerDraft = useMemo(() => draftFromInboxItem(item), [item]);
  const initialServerUpdatedAtMs = useMemo(() => getServerUpdatedAtMs(item), [item]);

  // Resolve initial state synchronously from localStorage recovery if present
  const [initInfo] = useState(() => {
    const local = loadLocalDraft(item.id);
    if (local && local.isDirty && !areDraftsEqual(local.draft, initialServerDraft)) {
      return {
        draft: local.draft,
        recoveredAt: local.localSavedAt,
        isDirty: true,
        baseServerMs: local.baseServerUpdatedAtMs || initialServerUpdatedAtMs,
      };
    }
    return {
      draft: initialServerDraft,
      recoveredAt: null as string | null,
      isDirty: false,
      baseServerMs: initialServerUpdatedAtMs,
    };
  });

  const [draft, setDraft] = useState<NewsDraftData>(initInfo.draft);
  const draftRef = useRef<NewsDraftData>(initInfo.draft);
  const serverBaselineRef = useRef<NewsDraftData>(initialServerDraft);
  const baseServerMsRef = useRef<number>(initInfo.baseServerMs);

  const [isDirty, setIsDirty] = useState<boolean>(initInfo.isDirty);
  const isDirtyRef = useRef<boolean>(initInfo.isDirty);

  const [saveStatus, setSaveStatus] = useState<EditorSaveStatus>(
    initInfo.isDirty ? 'dirty' : 'saved'
  );
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(initInfo.recoveredAt);
  const [lastServerSavedAt, setLastServerSavedAt] = useState<string | null>(null);
  const [recoveredLocalAt, setRecoveredLocalAt] = useState<string | null>(initInfo.recoveredAt);
  const [serverNewerNotice, setServerNewerNotice] = useState(false);

  const [errorBanner, setErrorBanner] = useState<EditorErrorBanner | null>(null);
  const [localStorageWarning, setLocalStorageWarning] = useState<string | null>(null);

  // Upload states
  const [coverUploadState, setCoverUploadState] = useState<{
    uploading: boolean;
    progress: number;
    stage: string;
    mode?: NewsImageStorageMode;
    error?: string;
  }>({ uploading: false, progress: 0, stage: '' });
  const [galleryActiveUploads, setGalleryActiveUploads] = useState(0);
  const activeUploadCount = (coverUploadState.uploading ? 1 : 0) + galleryActiveUploads;
  const activeUploadCountRef = useRef(0);
  activeUploadCountRef.current = activeUploadCount;

  const [aiBusy, setAiBusy] = useState(false);
  const [statusActionBusy, setStatusActionBusy] = useState(false);
  const [liveBatchDiagBusy, setLiveBatchDiagBusy] = useState(false);
  const [liveBatchDiagReport, setLiveBatchDiagReport] =
    useState<LiveBatchDiagnosticsReport | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [revisions, setRevisions] = useState<NewsRevisionEntry[]>(() => loadRevisions(item.id));
  const [revisionsOpen, setRevisionsOpen] = useState(false);

  // Concurrency & stale response guards
  const editVersionRef = useRef<number>(0);
  const saveLockRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  const summaryTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Expose live browser DevTools diagnostic hook bound to active article + draft
  useEffect(() => {
    registerBrowserBatchDiagnosticHelpers(() => ({
      targetInboxItem: item,
      draft: draftRef.current,
    }));
  }, [item]);

  // Sync from Firestore onSnapshot ONLY when local editor is clean and no uploads are active
  useEffect(() => {
    const nextServerDraft = draftFromInboxItem(item);
    const nextServerMs = getServerUpdatedAtMs(item);
    serverBaselineRef.current = nextServerDraft;

    if (isDirtyRef.current || activeUploadCountRef.current > 0 || saveLockRef.current) {
      if (nextServerMs > baseServerMsRef.current && !areDraftsEqual(nextServerDraft, draftRef.current)) {
        setServerNewerNotice(true);
      }
      return;
    }

    baseServerMsRef.current = nextServerMs;
    setServerNewerNotice(false);
    if (!areDraftsEqual(nextServerDraft, draftRef.current)) {
      draftRef.current = nextServerDraft;
      setDraft(nextServerDraft);
    }
  }, [item]);

  // Warn before closing tab if unsaved changes or active uploads exist
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current || activeUploadCountRef.current > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const persistLocalSnapshot = useCallback(
    (nextDraft: NewsDraftData, nextDirty: boolean) => {
      const nowIso = new Date().toISOString();
      const res = saveLocalDraft(item.id, {
        draft: nextDraft,
        localSavedAt: nowIso,
        baseServerUpdatedAtMs: baseServerMsRef.current,
        isDirty: nextDirty,
      });
      if (res.ok) {
        setLastLocalSavedAt(nowIso);
        setLocalStorageWarning(null);
      } else if (res.error) {
        setLocalStorageWarning(res.error);
      }
    },
    [item.id]
  );

  // Core atomic updater — ALWAYS uses functional state updater to eliminate stale closures
  const updateDraft = useCallback(
    (
      updater: (prev: NewsDraftData) => NewsDraftData,
      options?: { immediateLocalSave?: boolean }
    ) => {
      editVersionRef.current += 1;
      setDraft((prev) => {
        const next = updater(prev);
        draftRef.current = next;
        const dirty = !areDraftsEqual(next, serverBaselineRef.current);
        isDirtyRef.current = dirty;
        setIsDirty(dirty);
        setSaveStatus((prevStatus) => {
          if (saveLockRef.current) return 'saving';
          if (dirty) return 'dirty';
          return prevStatus === 'error' ? 'dirty' : 'saved';
        });

        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }

        if (options?.immediateLocalSave) {
          persistLocalSnapshot(next, dirty);
        } else {
          debounceTimerRef.current = window.setTimeout(() => {
            persistLocalSnapshot(draftRef.current, isDirtyRef.current);
          }, 350);
        }

        return next;
      });
    },
    [persistLocalSnapshot]
  );

  const getIdTokenSafe = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch {
      return null;
    }
  }, [user]);

  const handleUploadCoverImage = async (file?: File) => {
    if (!file) return;
    const fileErr = validateImageFile(file, 10 * 1024 * 1024);
    if (fileErr) {
      setCoverUploadState({ uploading: false, progress: 0, stage: '', error: fileErr });
      setErrorBanner({
        stage: 'cover_upload',
        title: '대표 이미지 파일 형식/용량 오류',
        detail: fileErr,
        actionHint: '10MB 이하의 JPG, PNG, WEBP, GIF 이미지를 선택해 주세요. 기존 작성 내용은 보존되었습니다.',
      });
      return;
    }

    setErrorBanner(null);
    setCoverUploadState({ uploading: true, progress: 5, stage: '업로드 준비 중' });

    try {
      const idToken = await getIdTokenSafe();
      const res = await uploadNewsImageWithProgress(file, {
        idToken,
        netlifyBlobsAvailable,
        onProgress: (pct, stage) => {
          setCoverUploadState((prev) => ({ ...prev, uploading: true, progress: pct, stage }));
        },
      });

      // Atomic functional update — preserves koreanTitle, novaSummary, galleryImages, etc.
      updateDraft((prev) => ({ ...prev, coverImage: res.url }), { immediateLocalSave: true });
      setCoverUploadState({
        uploading: false,
        progress: 100,
        stage:
          res.mode === 'firebase_storage'
            ? 'Firebase Storage 저장 완료'
            : res.mode === 'netlify_blobs'
              ? 'Netlify Blobs 저장 완료'
              : '경량 WebP 최적화 완료',
        mode: res.mode,
      });
      onNotify(
        res.mode === 'inline'
          ? '대표 이미지가 경량 WebP로 등록되었습니다.'
          : '대표 이미지가 스토리지에 업로드되었습니다.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCoverUploadState({ uploading: false, progress: 0, stage: '', error: msg });
      setErrorBanner({
        stage: 'cover_upload',
        title: '대표 이미지 업로드 실패',
        detail: msg,
        actionHint: '작성 중인 제목·요약·본문 이미지는 그대로 유지되었습니다. 다시 업로드하거나 이미지 URL을 입력해 주세요.',
      });
      onNotify(`대표 이미지 업로드 실패: ${msg}`);
    }
  };

  const handleInsertMarkerAtCursor = useCallback(
    (marker: string) => {
      const el = summaryTextareaRef.current;
      updateDraft(
        (prev) => {
          const value = prev.novaSummary || '';
          if (!el) {
            return {
              ...prev,
              novaSummary: value ? `${value}\n\n${marker}\n` : `${marker}\n`,
            };
          }
          const start = el.selectionStart ?? value.length;
          const end = el.selectionEnd ?? value.length;
          const prefix = value.slice(0, start);
          const suffix = value.slice(end);
          const insertBlock = `${prefix && !prefix.endsWith('\n') ? '\n\n' : ''}${marker}${
            suffix && !suffix.startsWith('\n') ? '\n\n' : '\n'
          }`;
          return {
            ...prev,
            novaSummary: `${prefix}${insertBlock}${suffix}`.slice(0, 3000),
          };
        },
        { immediateLocalSave: true }
      );
      onNotify('선택한 위치에 이미지가 삽입되었습니다.');
    },
    [onNotify, updateDraft]
  );

  const handleInsertMarkerAfterParagraph = useCallback(
    (marker: string, afterParagraphIndex: number) => {
      updateDraft(
        (prev) => {
          const value = prev.novaSummary || '';
          const blocks = value
            .split(/\n{2,}/)
            .map((b) => b.trim())
            .filter(Boolean);
          if (blocks.length === 0 || afterParagraphIndex < 0 || afterParagraphIndex >= blocks.length) {
            return {
              ...prev,
              novaSummary: value ? `${value}\n\n${marker}` : marker,
            };
          }
          const nextBlocks = [...blocks];
          nextBlocks.splice(afterParagraphIndex + 1, 0, marker);
          return {
            ...prev,
            novaSummary: nextBlocks.join('\n\n').slice(0, 3000),
          };
        },
        { immediateLocalSave: true }
      );
      onNotify(`${afterParagraphIndex + 1}문단 뒤에 이미지를 배치했습니다.`);
    },
    [onNotify, updateDraft]
  );

  const handleGenerateAiDraft = async () => {
    if (!user || !aiDraftAvailable) return;
    setAiBusy(true);
    setErrorBanner(null);
    try {
      const token = await user.getIdToken(true);
      const current = draftRef.current;
      const res = await fetch('/api/news/ai-draft', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalTitle: item.originalTitle,
          sourceName: item.sourceName,
          publishedAtSource: item.publishedAtSource || '',
          tcgCategory: current.tcgCategory,
          metadataSnippet: item.metadataSnippet || '',
          originalUrl: item.originalUrl,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        koreanTitle?: string;
        novaSummary?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'AI 초안 생성 실패');
      }

      updateDraft(
        (prev) => ({
          ...prev,
          koreanTitle: (json.koreanTitle || prev.koreanTitle).slice(0, 160),
          novaSummary: (json.novaSummary || prev.novaSummary).slice(0, 3000),
        }),
        { immediateLocalSave: true }
      );
      const nextRevs = pushRevision(item.id, 'ai_draft', 'AI 초안 생성 직후', draftRef.current);
      setRevisions(nextRevs);
      onNotify('AI 한국어 제목·요약 초안을 생성했습니다. 검토 후 초안 저장 또는 게시 승인해 주세요.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorBanner({
        stage: 'ai_draft',
        title: 'AI 초안 생성 실패',
        detail: msg,
        actionHint: '기존 작성 내용은 유지되었습니다. 직접 한국어 제목과 요약을 작성해 계속 진행할 수 있습니다.',
      });
      onNotify(`AI 초안 오류: ${msg}`);
    } finally {
      setAiBusy(false);
    }
  };

  // Document byte budget & pre-publish validation
  const validation = useMemo(() => {
    const titleTrim = draft.koreanTitle.trim();
    const summaryTrim = draft.novaSummary.trim();
    const markdown = buildNewsPostMarkdown(item, summaryTrim || ' ');
    const inboxBytes = estimateInboxDocBytes(item, draft);
    const postBytes = estimatePostDocBytes(item, draft, markdown);
    const maxBytes = Math.max(inboxBytes, postBytes);

    const coverValid = !draft.coverImage.trim() || isValidImageUrlValue(draft.coverImage);
    const invalidGalleryCount = draft.galleryImages.filter((g) => !isValidImageUrlValue(g.url)).length;
    const missingRightsCount = draft.galleryImages.filter(
      (g) => !g.source?.trim() || !g.rights?.trim() || g.rights === '권한 확인 필요'
    ).length;

    const blockers: string[] = [];
    if (activeUploadCount > 0) {
      blockers.push(`이미지 ${activeUploadCount}건 업로드가 진행 중입니다. 완료 후 게시할 수 있습니다.`);
    }
    if (!titleTrim) {
      blockers.push('한국어 제목을 입력해 주세요.');
    } else if (titleTrim.length > 160) {
      blockers.push('한국어 제목은 160자 이하여야 합니다.');
    }
    if (!summaryTrim) {
      blockers.push('NOVA 자체 요약을 입력해 주세요.');
    } else if (summaryTrim.length > 3000) {
      blockers.push('NOVA 자체 요약은 3,000자 이하여야 합니다.');
    }
    if (!coverValid) {
      blockers.push('대표 이미지 URL 형식이 올바르지 않습니다.');
    }
    if (invalidGalleryCount > 0) {
      blockers.push(`유효하지 않은 본문 이미지 URL이 ${invalidGalleryCount}건 있습니다.`);
    }
    if (maxBytes > SAFE_FIRESTORE_BYTE_LIMIT) {
      blockers.push(
        `문서 예상 크기(${Math.round(maxBytes / 1024)}KB)가 Firestore 안전 한도(900KB)를 초과했습니다. 인라인 이미지를 줄이거나 외부 URL을 사용해 주세요.`
      );
    }

    const warnings: string[] = [];
    if (missingRightsCount > 0) {
      warnings.push(`출처 또는 사용 권한 확인이 필요한 본문 이미지가 ${missingRightsCount}장 있습니다.`);
    }
    if (!draft.coverImage.trim() && draft.galleryImages.length === 0) {
      warnings.push('대표 이미지 없이 텍스트 뉴스로 게시됩니다.');
    }

    return {
      titleOk: titleTrim.length > 0 && titleTrim.length <= 160,
      summaryOk: summaryTrim.length > 0 && summaryTrim.length <= 3000,
      uploadsDone: activeUploadCount === 0,
      sizeOk: maxBytes <= SAFE_FIRESTORE_BYTE_LIMIT,
      estimatedKB: Math.round(maxBytes / 1024),
      blockers,
      warnings,
      canPublish: blockers.length === 0,
    };
  }, [activeUploadCount, draft, item]);

  const handleSaveDraft = async () => {
    if (saveLockRef.current) return;
    if (activeUploadCount > 0) {
      setErrorBanner({
        stage: 'validation',
        title: '이미지 업로드 진행 중',
        detail: `${activeUploadCount}건의 이미지 업로드가 완료된 뒤 서버에 저장할 수 있습니다.`,
        actionHint: '잠시만 기다리면 업로드가 끝나며, 현재 입력 내용은 로컬에 자동 보관 중입니다.',
      });
      return;
    }

    const snapshotVersion = editVersionRef.current;
    const snapshotDraft: NewsDraftData = {
      ...draftRef.current,
      galleryImages: sanitizeGalleryImages(draftRef.current.galleryImages),
    };

    const inboxBytes = estimateInboxDocBytes(item, snapshotDraft);
    if (inboxBytes > SAFE_FIRESTORE_BYTE_LIMIT) {
      setSaveStatus('error');
      setErrorBanner({
        stage: 'validation',
        title: 'Firestore 문서 용량 한도 초과',
        detail: `예상 문서 크기 ${Math.round(inboxBytes / 1024)}KB (안전 한도 900KB 초과)`,
        actionHint: '인라인 이미지 수를 줄이거나 외부 URL·Storage 이미지를 사용해 용량을 줄여 주세요.',
      });
      return;
    }

    saveLockRef.current = true;
    setSaveStatus('saving');
    setErrorBanner(null);

    const normalizedTcgCategory = normalizeTcgCategory(snapshotDraft.tcgCategory);
    const inboxDraftUpdate = {
      koreanTitle: snapshotDraft.koreanTitle.trim().slice(0, 160),
      novaSummary: snapshotDraft.novaSummary.trim().slice(0, 3000),
      tcgCategory: normalizedTcgCategory,
      coverImage: snapshotDraft.coverImage.trim().slice(0, 200000),
      galleryImages: snapshotDraft.galleryImages,
      isPinned: Boolean(snapshotDraft.isPinned),
    };

    try {
      await updateDoc(doc(db, 'news_inbox', item.id), {
        ...inboxDraftUpdate,
        updatedAt: serverTimestamp(),
      });

      const savedIso = new Date().toISOString();
      serverBaselineRef.current = { ...snapshotDraft, tcgCategory: normalizedTcgCategory };
      baseServerMsRef.current = Date.now();
      setLastServerSavedAt(savedIso);
      setServerNewerNotice(false);

      const nextRevs = pushRevision(item.id, 'manual_save', '수집함 초안 저장', snapshotDraft);
      setRevisions(nextRevs);

      // Concurrency guard: if user typed or uploaded while save was in-flight, keep dirty!
      if (editVersionRef.current === snapshotVersion) {
        isDirtyRef.current = false;
        setIsDirty(false);
        setSaveStatus('saved');
        setRecoveredLocalAt(null);
        persistLocalSnapshot(snapshotDraft, false);
      } else {
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveStatus('dirty');
        persistLocalSnapshot(draftRef.current, true);
      }

      onNotify('수집함 초안이 서버에 저장되었습니다.');
    } catch (err) {
      const explained = explainFirestoreError(err);
      let draftRuleViolations: string[] = [];
      if (explained.isPermission) {
        try {
          const inboxSnap = await getDoc(doc(db, 'news_inbox', item.id));
          draftRuleViolations = validateInboxUpdateAgainstRules({
            item,
            rawServerData: inboxSnap.exists() ? (inboxSnap.data() as Record<string, unknown>) : null,
            updatePayload: {
              ...inboxDraftUpdate,
              status: item.status,
              publishedPostId: item.publishedPostId || '',
            },
          });
        } catch {
          // Ignore secondary probe failure and fall back to explained error
        }
      }

      setSaveStatus('error');
      setErrorBanner({
        stage: 'draft_save',
        title: `초안 저장 실패 · ${explained.title}`,
        detail:
          draftRuleViolations.length > 0
            ? `${explained.detail} (규칙 검증 상세: ${draftRuleViolations.join(' / ')})`
            : explained.detail,
        actionHint: explained.actionHint,
      });
      onNotify(`초안 저장 실패: ${explained.title}`);
    } finally {
      saveLockRef.current = false;
    }
  };

  const handlePublish = async () => {
    if (saveLockRef.current) return;
    if (!validation.canPublish) {
      setErrorBanner({
        stage: 'validation',
        title: '게시 승인 전 확인이 필요합니다',
        detail: validation.blockers.join(' / '),
        actionHint: '위 항목을 보완한 뒤 다시 게시 승인을 눌러 주세요. 작성 중인 내용은 모두 유지됩니다.',
      });
      onNotify(validation.blockers[0] || '게시 전 필수 항목을 확인해 주세요.');
      return;
    }

    const snapshotVersion = editVersionRef.current;
    const snapshotDraft: NewsDraftData = {
      ...draftRef.current,
      tcgCategory: normalizeTcgCategory(draftRef.current.tcgCategory),
      galleryImages: sanitizeGalleryImages(draftRef.current.galleryImages),
    };

    const finalTitle = snapshotDraft.koreanTitle.trim().slice(0, 160);
    const finalSummary = snapshotDraft.novaSummary.trim().slice(0, 3000);
    const markdownContent = buildNewsPostMarkdown(item, finalSummary);
    const cleanPlainSummary = finalSummary
      .replace(/\[\[image:[a-zA-Z0-9_\-]+\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    saveLockRef.current = true;
    setSaveStatus('saving');
    setErrorBanner(null);

    const hasValidExistingPostId = isValidFirestoreId(item.publishedPostId);
    const postId = hasValidExistingPostId ? item.publishedPostId! : generateSafeId('post');
    const postRef = doc(db, 'posts', postId);
    const inboxRef = doc(db, 'news_inbox', item.id);

    const buildFallbackSlug = () => {
      const candidate = sanitizeSlug(
        `news-${item.id.replace(/^inbox_/, '').slice(0, 12)}-${Date.now().toString(36)}`
      ).slice(0, 120);
      return isValidFirestoreId(candidate)
        ? candidate
        : `news-${Date.now().toString(36)}`.slice(0, 120);
    };

    let postFieldsForRules = {
      title: finalTitle,
      slug: buildFallbackSlug(),
      category: 'TCG 뉴스',
      tcgCategory: snapshotDraft.tcgCategory,
      sourceName: (item.sourceName || 'NOVA').slice(0, 100),
      sourceUrl: (item.originalUrl || '').slice(0, 500),
      publishedAtSource: (item.publishedAtSource || '').slice(0, 80),
      inboxItemId: item.id.slice(0, 128),
      summary: (cleanPlainSummary || finalTitle).slice(0, 400),
      content: markdownContent.slice(0, 30000),
      coverImage: snapshotDraft.coverImage.trim().slice(0, 200000),
      galleryImages: snapshotDraft.galleryImages,
      isPinned: Boolean(snapshotDraft.isPinned),
      isSample: false,
      scheduledAt: null,
      seoTitle: finalTitle.slice(0, 120),
      seoDescription: (cleanPlainSummary || finalTitle).slice(0, 300),
      visibilityState: 'published',
    };

    const inboxUpdateFieldsForRules = {
      koreanTitle: finalTitle,
      novaSummary: finalSummary,
      tcgCategory: snapshotDraft.tcgCategory,
      coverImage: snapshotDraft.coverImage.trim().slice(0, 200000),
      galleryImages: snapshotDraft.galleryImages,
      isPinned: Boolean(snapshotDraft.isPinned),
      status: 'approved',
      publishedPostId: postId,
    };

    let failedStage: 'read_existing_post' | 'batch_commit' = 'read_existing_post';

    try {
      const existingPostSnap = hasValidExistingPostId ? await getDoc(postRef) : null;
      const existingPostData = existingPostSnap?.exists()
        ? (existingPostSnap.data() as Record<string, unknown>)
        : null;

      // Preserve existing valid slug and createdAt when updating an already-published article
      const preservedSlug =
        existingPostData && isValidFirestoreId(existingPostData.slug)
          ? existingPostData.slug
          : buildFallbackSlug();

      postFieldsForRules = {
        ...postFieldsForRules,
        slug: preservedSlug,
      };

      // Pre-flight client rule validation before hitting Firestore writeBatch
      const preflightPostViolations = validatePostPayloadAgainstRules({
        postId,
        isUpdate: Boolean(existingPostSnap?.exists()),
        existingPostData,
        payload: postFieldsForRules,
      });
      const preflightInboxViolations = validateInboxUpdateAgainstRules({
        item,
        updatePayload: inboxUpdateFieldsForRules,
      });

      if (preflightPostViolations.length > 0 || preflightInboxViolations.length > 0) {
        const combined = [...preflightPostViolations, ...preflightInboxViolations];
        setSaveStatus('error');
        setErrorBanner({
          stage: 'validation',
          title: '게시 승인 전 Firestore 보안 규칙 필드 검증에 맞지 않는 항목이 있습니다',
          detail: combined.join(' / '),
          actionHint: '표시된 필드를 수정하거나 이미지·문서 길이를 조정한 뒤 다시 시도해 주세요. 작성 내용은 보존됩니다.',
        });
        onNotify(combined[0]);
        return;
      }

      const basePostPayload = {
        ...postFieldsForRules,
        updatedAt: serverTimestamp(),
      };

      // Atomic batch commit: either both posts/{postId} and news_inbox/{item.id} succeed, or neither does!
      const batch = writeBatch(db);
      if (existingPostSnap?.exists()) {
        batch.update(postRef, basePostPayload);
      } else {
        batch.set(postRef, {
          ...basePostPayload,
          createdAt: serverTimestamp(),
        });
      }

      batch.update(inboxRef, {
        ...inboxUpdateFieldsForRules,
        updatedAt: serverTimestamp(),
      });

      failedStage = 'batch_commit';
      await batch.commit();

      const savedIso = new Date().toISOString();
      serverBaselineRef.current = snapshotDraft;
      baseServerMsRef.current = Date.now();
      setLastServerSavedAt(savedIso);
      setServerNewerNotice(false);

      const nextRevs = pushRevision(
        item.id,
        'publish',
        item.status === 'approved' ? '공개 게시글 업데이트' : '최초 게시 승인',
        snapshotDraft
      );
      setRevisions(nextRevs);

      if (editVersionRef.current === snapshotVersion) {
        isDirtyRef.current = false;
        setIsDirty(false);
        setSaveStatus('saved');
        setRecoveredLocalAt(null);
        persistLocalSnapshot(snapshotDraft, false);
      } else {
        isDirtyRef.current = true;
        setIsDirty(true);
        setSaveStatus('dirty');
        persistLocalSnapshot(draftRef.current, true);
      }

      onNotify(
        item.status === 'approved'
          ? '공개된 NOVA 뉴스 게시글이 안전하게 업데이트되었습니다.'
          : 'NOVA 뉴스 페이지에 공개 게시되었습니다.'
      );
    } catch (err) {
      const explained = explainFirestoreError(err);
      let diagnosticSteps: PublishPermissionStep[] | undefined;

      if (explained.isPermission) {
        try {
          diagnosticSteps = await diagnosePublishPermissions({
            db,
            user,
            postId,
            inboxItemId: item.id,
            failedStage,
            postPayloadInput: {
              postId,
              payload: postFieldsForRules,
            },
            inboxPayloadInput: {
              item,
              updatePayload: inboxUpdateFieldsForRules,
            },
          });
        } catch {
          diagnosticSteps = undefined;
        }
      }

      const stageLabel =
        failedStage === 'read_existing_post'
          ? `기존 게시글 조회(posts/${postId})`
          : `원자적 배치 커밋(posts/${postId} + news_inbox/${item.id})`;
      const failingSteps = diagnosticSteps?.filter((s) => !s.ok).map((s) => `${s.step}: ${s.detail}`);

      setSaveStatus('error');
      setErrorBanner({
        stage: 'publish',
        title: `게시 승인 실패 · ${explained.title}`,
        detail:
          failingSteps && failingSteps.length > 0
            ? `[거부 단계: ${stageLabel}] ${failingSteps.join(' / ')} (원본 오류: ${explained.detail})`
            : `[거부 단계: ${stageLabel}] ${explained.detail}`,
        actionHint: `${explained.actionHint} 기존 공개 뉴스 데이터와 작성 중인 초안은 손상되지 않았습니다.`,
        diagnosticSteps,
      });
      onNotify(`게시 승인 실패: ${explained.title}`);
    } finally {
      saveLockRef.current = false;
    }
  };

  const handleRunLiveBatchDiagnostics = async () => {
    if (liveBatchDiagBusy) return;
    setLiveBatchDiagBusy(true);
    try {
      const report = await runLivePublishBatchDiagnostics({
        targetDb: db,
        targetUser: user,
        targetInboxItem: item,
        targetInboxItemId: item.id,
        draft: draftRef.current,
      });
      setLiveBatchDiagReport(report);
      console.group('[NOVA] Live Firestore writeBatch Isolation Report');
      console.log('Conclusion:', report.conclusion);
      console.log('Likely Constraint:', report.likelyConstraint);
      console.table(
        report.probes.map((p) => ({
          id: p.id,
          ok: p.ok,
          code: p.code,
          targetPath: p.targetPath,
          message: p.message,
        }))
      );
      if (report.isolatedFieldFailures.length > 0) {
        console.warn('Isolated Field Failures:', report.isolatedFieldFailures);
      }
      console.groupEnd();
      onNotify(
        report.likelyConstraint === 'passed_all'
          ? '실시간 writeBatch 격리 테스트를 모두 통과했습니다.'
          : '실시간 writeBatch 격리 테스트가 거부 원인을 확인했습니다.'
      );
    } finally {
      setLiveBatchDiagBusy(false);
    }
  };

  const handleRestoreServerVersion = () => {
    const serverDraft = draftFromInboxItem(item);
    pushRevision(item.id, 'restore_backup', '서버 버전 복원 전 자동 백업', draftRef.current);
    setRevisions(loadRevisions(item.id));
    editVersionRef.current += 1;
    draftRef.current = serverDraft;
    setDraft(serverDraft);
    isDirtyRef.current = false;
    setIsDirty(false);
    setSaveStatus('saved');
    setRecoveredLocalAt(null);
    setServerNewerNotice(false);
    clearLocalDraft(item.id);
    onNotify('서버에 저장된 최신 버전으로 되돌렸습니다.');
  };

  const handleRestoreRevision = (rev: NewsRevisionEntry) => {
    const backupRevs = pushRevision(
      item.id,
      'restore_backup',
      '이전 버전 복구 전 자동 백업',
      draftRef.current
    );
    setRevisions(backupRevs);
    updateDraft(() => ({
      ...rev.draft,
      galleryImages: sanitizeGalleryImages(rev.draft.galleryImages),
    }), { immediateLocalSave: true });
    onNotify(`${formatKST(rev.savedAt)} 버전을 불러왔습니다. 확인 후 저장해 주세요.`);
  };

  const handleBackClick = () => {
    if (activeUploadCount > 0) {
      onNotify('이미지 업로드가 진행 중입니다. 완료 후 목록으로 돌아가 주세요.');
      return;
    }
    if (isDirty) {
      persistLocalSnapshot(draftRef.current, true);
      onNotify('작성 중인 내용이 브라우저 로컬 임시저장에 보관되었습니다.');
    }
    onBack();
  };

  const renderSaveStatusBadge = () => {
    if (saveStatus === 'saving') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C5CBD3] whitespace-nowrap shrink-0">
          <Loader2 size={13} className="animate-spin" />
          <span>저장 중...</span>
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-300 whitespace-nowrap shrink-0">
          <AlertCircle size={13} />
          <span>오류</span>
        </span>
      );
    }
    if (saveStatus === 'dirty') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 whitespace-nowrap shrink-0">
          <Clock size={13} />
          <span>변경 사항 있음</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 whitespace-nowrap shrink-0">
        <CheckCircle2 size={13} />
        <span>저장 완료</span>
      </span>
    );
  };

  const isBusySaving = saveStatus === 'saving';

  return (
    <>
      <div className="fixed inset-0 z-40 lg:static lg:inset-auto lg:z-auto bg-[#080A0D] flex flex-col lg:block">
        {/* Sticky Editor Top Bar */}
        <div className="sticky top-0 lg:top-16 z-30 border-b border-[#303741] bg-[#080A0D]/95 backdrop-blur px-4 py-3 lg:px-0 lg:pb-4 lg:mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackClick}
              className="min-h-[38px] px-3 py-1.5 border border-[#303741] bg-[#171C23] text-[#F3F4F6] rounded text-xs font-medium hover:border-[#C5CBD3] inline-flex items-center gap-1.5 shrink-0"
            >
              <ArrowLeft size={14} />
              <span>수집함 목록</span>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs">
                {renderSaveStatusBadge()}
                {lastLocalSavedAt && (
                  <span className="hidden sm:inline font-mono-tabular text-[11px] text-[#929AA6] truncate">
                    · 자동 임시저장 {formatKST(lastLocalSavedAt)}
                  </span>
                )}
                {lastServerSavedAt && !isDirty && (
                  <span className="hidden md:inline font-mono-tabular text-[11px] text-[#929AA6] truncate">
                    · 서버 반영 {formatKST(lastServerSavedAt)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-medium border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded hover:border-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Eye size={14} />
              <span>공개 페이지 미리보기</span>
            </button>

            <button
              type="button"
              disabled={isBusySaving || activeUploadCount > 0}
              onClick={() => void handleSaveDraft()}
              className="min-h-[38px] px-3.5 py-1.5 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#F3F4F6] rounded hover:border-[#C5CBD3] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <Save size={14} />
              <span>초안 저장</span>
            </button>

            <button
              type="button"
              disabled={isBusySaving || !validation.canPublish}
              onClick={() => void handlePublish()}
              className="min-h-[38px] px-4 py-1.5 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded hover:bg-[#F3F4F6] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              <span>{item.status === 'approved' ? '게시글 업데이트' : '게시 승인'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Editor Body (mobile scrolls inside fullscreen shell; desktop flows naturally) */}
        <div className="flex-1 overflow-y-auto lg:overflow-visible px-4 py-4 lg:p-0 space-y-5">
          {/* Recovery / Server Conflict / Error Banners */}
          {recoveredLocalAt && (
            <div className="border border-amber-400/40 bg-amber-950/20 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <p className="font-semibold text-amber-200">
                  새로고침 전 작성 중이던 로컬 임시저장본을 복구했습니다
                </p>
                <p className="text-amber-100/80 font-mono-tabular text-[11px]">
                  임시저장 시각: {formatKST(recoveredLocalAt)} KST · 확인 후 [초안 저장] 또는 [게시 승인]을 눌러 서버에 반영하세요.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRestoreServerVersion}
                className="px-3 py-1.5 border border-amber-300/40 rounded text-amber-100 hover:bg-amber-900/40 text-[11px] font-medium shrink-0"
              >
                서버 저장본으로 되돌리기
              </button>
            </div>
          )}

          {serverNewerNotice && (
            <div className="border border-[#8068BA]/50 bg-[#8068BA]/10 rounded-lg p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-[#E3DCF7]">
                백그라운드에서 서버 데이터가 갱신되었으나, 현재 작성 중인 입력 내용을 보호하기 위해 덮어쓰지 않았습니다.
              </p>
              <button
                type="button"
                onClick={handleRestoreServerVersion}
                className="px-3 py-1 border border-[#8068BA]/60 rounded text-[#E3DCF7] hover:bg-[#8068BA]/20 text-[11px]"
              >
                서버 최신본 불러오기
              </button>
            </div>
          )}

          {localStorageWarning && (
            <div className="border border-amber-400/40 bg-amber-950/20 rounded-lg px-4 py-2.5 text-xs text-amber-200">
              브라우저 로컬 임시저장 공간 경고: {localStorageWarning}
            </div>
          )}

          {errorBanner && (
            <div className="border border-red-400/50 bg-red-950/25 rounded-lg p-4 space-y-2.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-red-200 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{errorBanner.title}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setErrorBanner(null)}
                  className="text-red-200/80 hover:text-white text-[11px]"
                >
                  닫기
                </button>
              </div>
              <p className="text-red-100/90 leading-relaxed">{errorBanner.actionHint}</p>
              <p className="font-mono-tabular text-[11px] text-red-200/70 break-all">
                원인 상세: {errorBanner.detail}
              </p>

              {errorBanner.diagnosticSteps && errorBanner.diagnosticSteps.length > 0 && (
                <div className="pt-2 border-t border-red-400/30 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-red-100">
                      writeBatch 단계별 권한·규칙 진단 결과
                    </p>
                    {errorBanner.stage === 'publish' && (
                      <button
                        type="button"
                        disabled={liveBatchDiagBusy}
                        onClick={() => void handleRunLiveBatchDiagnostics()}
                        className="px-2.5 py-1 rounded border border-red-300/40 bg-red-900/40 text-red-100 hover:bg-red-900/70 text-[11px] font-medium disabled:opacity-50"
                      >
                        {liveBatchDiagBusy
                          ? 'writeBatch 격리 테스트 중...'
                          : '실시간 writeBatch 격리 테스트'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {errorBanner.diagnosticSteps.map((diag) => (
                      <div
                        key={diag.step}
                        className={`rounded px-2.5 py-1.5 border text-[11px] flex items-start gap-2 ${
                          diag.ok
                            ? 'border-emerald-400/30 bg-emerald-950/20 text-emerald-100'
                            : 'border-red-400/40 bg-red-950/40 text-red-100'
                        }`}
                      >
                        {diag.ok ? (
                          <CheckCircle2 size={13} className="text-emerald-300 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle size={13} className="text-red-300 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium">{diag.step}</p>
                          <p className="text-[10px] opacity-85 break-all">{diag.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {liveBatchDiagReport && (
                    <div className="mt-2 pt-2 border-t border-red-400/30 space-y-1.5">
                      <p className="text-[11px] font-semibold text-amber-200">
                        실시간 writeBatch 격리 결과 ({liveBatchDiagReport.likelyConstraint}):{' '}
                        {liveBatchDiagReport.conclusion}
                      </p>
                      <div className="space-y-1">
                        {liveBatchDiagReport.probes.map((probe) => (
                          <div
                            key={probe.id}
                            className={`rounded px-2.5 py-1 border text-[10px] flex items-start justify-between gap-2 ${
                              probe.ok
                                ? 'border-emerald-400/25 bg-emerald-950/20 text-emerald-100'
                                : 'border-red-400/40 bg-red-950/40 text-red-100'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{probe.label}</p>
                              {!probe.ok && (
                                <p className="opacity-85 break-all">
                                  {probe.code}: {probe.message}
                                </p>
                              )}
                            </div>
                            <span className="font-mono-tabular shrink-0">
                              {probe.ok ? 'PASS' : 'DENIED'}
                            </span>
                          </div>
                        ))}
                        {liveBatchDiagReport.isolatedFieldFailures.map((fieldFail) => (
                          <div
                            key={fieldFail.id}
                            className="rounded px-2.5 py-1 border border-amber-400/40 bg-amber-950/30 text-[10px] text-amber-100 flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="font-medium">{fieldFail.label}</p>
                              <p className="opacity-85 break-all">
                                {fieldFail.code}: {fieldFail.message}
                              </p>
                            </div>
                            <span className="font-mono-tabular shrink-0">REJECTED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main 2-Column Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): Korean Title, Category, Summary, Gallery */}
            <div className="lg:col-span-8 space-y-5 min-w-0">
              <section className="border border-[#303741] rounded-lg p-4 sm:p-5 bg-[#171C23] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-[#929AA6]">
                      <label htmlFor="news-korean-title">한국어 제목 (NOVA 공개 제목) *</label>
                      <span className="font-mono-tabular">{draft.koreanTitle.length} / 160</span>
                    </div>
                    <input
                      id="news-korean-title"
                      type="text"
                      maxLength={160}
                      value={draft.koreanTitle}
                      onChange={(e) =>
                        updateDraft((prev) => ({ ...prev, koreanTitle: e.target.value }))
                      }
                      placeholder="한국어로 번역·정리한 기사 제목을 입력하세요"
                      className="w-full min-h-[42px] px-3 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] focus:outline-none focus:border-[#C5CBD3]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="news-tcg-category" className="block text-[11px] text-[#929AA6]">
                      TCG 카테고리
                    </label>
                    <select
                      id="news-tcg-category"
                      value={draft.tcgCategory}
                      onChange={(e) =>
                        updateDraft((prev) => ({
                          ...prev,
                          tcgCategory: e.target.value as NewsTcgCategory,
                        }))
                      }
                      className="w-full min-h-[42px] px-3 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                    >
                      {TCG_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="news-nova-summary" className="text-[11px] text-[#929AA6]">
                      NOVA 자체 요약 (원문 복제 금지 · 문단 사이 빈 줄로 구분) *
                    </label>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-tabular text-[11px] text-[#929AA6]">
                        {draft.novaSummary.length} / 3,000
                      </span>
                      {aiDraftAvailable && (
                        <button
                          type="button"
                          disabled={aiBusy}
                          onClick={() => void handleGenerateAiDraft()}
                          className="px-2.5 py-1 border border-[#8068BA]/60 bg-[#8068BA]/15 text-[#E3DCF7] rounded text-[11px] font-medium inline-flex items-center gap-1 hover:border-[#C5CBD3] disabled:opacity-50"
                        >
                          <Sparkles size={12} />
                          <span>{aiBusy ? '생성 중...' : 'AI 한국어 초안'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    id="news-nova-summary"
                    ref={summaryTextareaRef}
                    rows={8}
                    maxLength={3000}
                    value={draft.novaSummary}
                    onChange={(e) =>
                      updateDraft((prev) => ({ ...prev, novaSummary: e.target.value }))
                    }
                    placeholder="원문을 확인한 뒤 한국어 독자를 위한 NOVA 자체 요약을 문단별로 작성하세요. 아래 [본문 추가 이미지]에서 커서 위치 삽입 또는 문단 사이 삽입을 누르면 원하는 위치에 사진이 배치됩니다."
                    className="w-full px-3 py-2.5 text-sm bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6] leading-relaxed focus:outline-none focus:border-[#C5CBD3]"
                  />
                </div>
              </section>

              {/* Gallery Images (up to 10) */}
              <NewsGalleryEditor
                images={draft.galleryImages}
                onFunctionalChange={(updater) =>
                  updateDraft(
                    (prev) => ({
                      ...prev,
                      galleryImages: updater(prev.galleryImages).slice(0, MAX_NEWS_GALLERY_IMAGES),
                    }),
                    { immediateLocalSave: true }
                  )
                }
                articleText={draft.novaSummary}
                onInsertMarker={handleInsertMarkerAtCursor}
                onInsertAtParagraph={handleInsertMarkerAfterParagraph}
                defaultSource={item.sourceName}
                onNotify={onNotify}
                onUploadCountChange={setGalleryActiveUploads}
                getIdToken={getIdTokenSafe}
                netlifyBlobsAvailable={netlifyBlobsAvailable}
              />
            </div>

            {/* Right Column (4 cols): Cover Image, Source Info, Publish Checklist, Revisions */}
            <div className="lg:col-span-4 space-y-5">
              {/* Cover Image Card */}
              <section className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-[#F3F4F6]">대표 이미지 (썸네일)</h3>
                  {draft.coverImage && (
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft((prev) => ({ ...prev, coverImage: '' }), {
                          immediateLocalSave: true,
                        });
                        setCoverUploadState({ uploading: false, progress: 0, stage: '' });
                      }}
                      className="text-[11px] text-[#929AA6] hover:text-red-300"
                    >
                      이미지 제거
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`min-h-[38px] px-3 py-1.5 bg-[#11151A] border rounded text-xs inline-flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      coverUploadState.uploading
                        ? 'border-[#8068BA] text-[#E3DCF7] opacity-75 pointer-events-none'
                        : 'border-[#C5CBD3]/60 text-[#F3F4F6] hover:border-[#F3F4F6]'
                    }`}
                  >
                    <Upload size={13} />
                    <span>
                      {coverUploadState.uploading
                        ? `업로드 중 (${coverUploadState.progress}%)`
                        : draft.coverImage
                          ? '대표 이미지 교체'
                          : '대표 이미지 올리기'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={coverUploadState.uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = '';
                        void handleUploadCoverImage(file);
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                {coverUploadState.uploading && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#C5CBD3]">
                      <span>{coverUploadState.stage}</span>
                      <span className="font-mono-tabular">{coverUploadState.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-[#080A0D] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#8068BA] transition-all duration-200"
                        style={{ width: `${Math.max(5, coverUploadState.progress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {!coverUploadState.uploading && coverUploadState.stage && !coverUploadState.error && (
                  <p className="text-[11px] text-emerald-300">{coverUploadState.stage}</p>
                )}

                {coverUploadState.error && (
                  <p className="text-[11px] text-red-300">{coverUploadState.error}</p>
                )}

                <input
                  type="text"
                  value={draft.coverImage}
                  onChange={(e) =>
                    updateDraft((prev) => ({ ...prev, coverImage: e.target.value }))
                  }
                  placeholder="또는 사용 권한이 있는 이미지 URL 입력"
                  className="w-full min-h-[36px] px-2.5 text-xs bg-[#080A0D] border border-[#303741] rounded text-[#F3F4F6]"
                />

                {draft.coverImage && (
                  <div className="h-40 w-full rounded border border-[#303741] overflow-hidden bg-[#080A0D] flex items-center justify-center">
                    <SafeImage
                      src={draft.coverImage}
                      alt="대표 이미지 미리보기"
                      className="max-w-full max-h-full w-auto h-auto object-contain"
                    />
                  </div>
                )}

                {item.metadataImageUrl && (
                  <p className="text-[11px] text-[#929AA6] truncate">
                    피드 참고 썸네일:{' '}
                    <a
                      href={item.metadataImageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-[#C5CBD3]"
                    >
                      원본 확인 ↗
                    </a>
                  </p>
                )}

                <label className="flex items-center gap-2 text-xs text-[#C5CBD3] cursor-pointer pt-2 border-t border-[#303741]/70">
                  <input
                    type="checkbox"
                    checked={draft.isPinned}
                    onChange={(e) =>
                      updateDraft((prev) => ({ ...prev, isPinned: e.target.checked }), {
                        immediateLocalSave: true,
                      })
                    }
                  />
                  <Pin size={12} className="text-[#8068BA]" />
                  <span>주요 뉴스 상단 고정</span>
                </label>
              </section>

              {/* Original Source Reference */}
              <section className="border border-[#303741] rounded-lg p-4 bg-[#11151A] space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#F3F4F6]">원문 출처 정보</span>
                  <a
                    href={item.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#C5CBD3] hover:text-[#F3F4F6] inline-flex items-center gap-1 underline"
                  >
                    <span>원문 열기</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <p className="text-[#929AA6] leading-relaxed">
                  {item.sourceName}
                  {item.publishedAtSource ? ` · ${formatKST(item.publishedAtSource)} KST` : ''}
                  {item.metadataAuthor ? ` · ${item.metadataAuthor}` : ''}
                </p>
                <p className="text-[#F3F4F6] font-medium leading-snug break-words">
                  {item.originalTitle}
                </p>
                {item.metadataSnippet && (
                  <p className="text-[11px] text-[#929AA6] leading-relaxed break-words">
                    {item.metadataSnippet}
                  </p>
                )}
                {item.duplicateSimilarityNote && (
                  <p className="text-[11px] text-amber-200 bg-amber-950/25 border border-amber-400/30 rounded px-2.5 py-1.5">
                    {item.duplicateSimilarityNote}
                  </p>
                )}
              </section>

              {/* Pre-Publish Validation Panel */}
              <section className="border border-[#303741] rounded-lg p-4 bg-[#171C23] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[#F3F4F6]">게시 전 검증</h3>
                  <span
                    className={`font-mono-tabular text-[11px] ${
                      validation.sizeOk ? 'text-[#929AA6]' : 'text-red-300'
                    }`}
                  >
                    문서 {validation.estimatedKB} / 900 KB
                  </span>
                </div>

                <ul className="space-y-1.5 text-[11px]">
                  <li className={validation.titleOk ? 'text-emerald-300' : 'text-amber-200'}>
                    {validation.titleOk ? '✓' : '·'} 한국어 제목 입력 ({draft.koreanTitle.trim().length}자)
                  </li>
                  <li className={validation.summaryOk ? 'text-emerald-300' : 'text-amber-200'}>
                    {validation.summaryOk ? '✓' : '·'} NOVA 자체 요약 입력 ({draft.novaSummary.trim().length}자)
                  </li>
                  <li className={validation.uploadsDone ? 'text-emerald-300' : 'text-amber-200'}>
                    {validation.uploadsDone ? '✓' : '·'} 이미지 업로드 완료 상태
                  </li>
                  <li className={validation.sizeOk ? 'text-emerald-300' : 'text-red-300'}>
                    {validation.sizeOk ? '✓' : '✕'} Firestore 문서 크기 안전 한도 내
                  </li>
                </ul>

                {validation.warnings.length > 0 && (
                  <div className="border-t border-[#303741] pt-2 space-y-1 text-[11px] text-amber-200/90">
                    {validation.warnings.map((w, idx) => (
                      <p key={idx} className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div className="border-t border-[#303741] pt-3 flex flex-wrap items-center justify-between gap-2">
                  {item.status !== 'ignored' ? (
                    <button
                      type="button"
                      disabled={statusActionBusy}
                      onClick={async () => {
                        setStatusActionBusy(true);
                        await onChangeStatus(item, 'ignored');
                        setStatusActionBusy(false);
                      }}
                      className="min-h-[34px] px-2.5 py-1 text-[11px] border border-[#303741] bg-[#11151A] text-[#929AA6] hover:text-[#F3F4F6] rounded inline-flex items-center gap-1"
                    >
                      <EyeOff size={12} />
                      <span>기사 무시</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={statusActionBusy}
                      onClick={async () => {
                        setStatusActionBusy(true);
                        await onChangeStatus(item, 'pending');
                        setStatusActionBusy(false);
                      }}
                      className="min-h-[34px] px-2.5 py-1 text-[11px] border border-[#303741] bg-[#11151A] text-[#C5CBD3] hover:text-[#F3F4F6] rounded"
                    >
                      승인 대기로 복원
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={statusActionBusy}
                    onClick={async () => {
                      setStatusActionBusy(true);
                      const deleted = await onDelete(item);
                      setStatusActionBusy(false);
                      if (deleted) onBack();
                    }}
                    className="min-h-[34px] px-2.5 py-1 text-[11px] border border-red-400/40 text-red-200 rounded inline-flex items-center gap-1 hover:bg-red-950/30"
                  >
                    <Trash2 size={12} />
                    <span>수집함 삭제</span>
                  </button>
                </div>
              </section>

              {/* Revision History & Restore */}
              <section className="border border-[#303741] rounded-lg p-4 bg-[#11151A] space-y-2.5 text-xs">
                <button
                  type="button"
                  onClick={() => setRevisionsOpen((v) => !v)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <span className="font-semibold text-[#F3F4F6] inline-flex items-center gap-1.5">
                    <History size={13} className="text-[#C5CBD3]" />
                    <span>수정 내역 · 버전 복구 ({revisions.length})</span>
                  </span>
                  <span className="text-[11px] text-[#929AA6]">
                    {revisionsOpen ? '접기' : '보기'}
                  </span>
                </button>

                {revisionsOpen && (
                  <div className="space-y-2 pt-2 border-t border-[#303741]/70">
                    {revisions.length === 0 ? (
                      <p className="text-[11px] text-[#929AA6]">
                        [초안 저장] 또는 [게시 승인]을 실행하면 이 기사의 복구 가능한 버전 기록이 저장됩니다.
                      </p>
                    ) : (
                      revisions.map((rev) => (
                        <div
                          key={rev.id}
                          className="border border-[#303741] rounded bg-[#080A0D] p-2.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-medium text-[#C5CBD3]">{rev.label}</span>
                            <span className="font-mono-tabular text-[#929AA6]">
                              {formatKST(rev.savedAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#F3F4F6] truncate">
                            {rev.draft.koreanTitle || '(제목 없음)'} · 이미지 {rev.draft.galleryImages.length}장
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRestoreRevision(rev)}
                            className="min-h-[28px] px-2 py-0.5 border border-[#303741] bg-[#171C23] text-[11px] text-[#C5CBD3] hover:border-[#C5CBD3] hover:text-[#F3F4F6] rounded inline-flex items-center gap-1"
                          >
                            <RotateCcw size={11} />
                            <span>이 버전으로 복구</span>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Action Footer (compact, within 15% height cap) */}
        <div className="lg:hidden sticky bottom-0 z-30 border-t border-[#303741] bg-[#080A0D]/95 backdrop-blur px-3 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="min-h-[40px] px-3 text-xs border border-[#303741] bg-[#11151A] text-[#C5CBD3] rounded inline-flex items-center justify-center gap-1"
          >
            <Eye size={14} />
            <span>미리보기</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusySaving || activeUploadCount > 0}
              onClick={() => void handleSaveDraft()}
              className="min-h-[40px] px-3.5 text-xs font-medium border border-[#303741] bg-[#171C23] text-[#F3F4F6] rounded disabled:opacity-50"
            >
              초안 저장
            </button>
            <button
              type="button"
              disabled={isBusySaving || !validation.canPublish}
              onClick={() => void handlePublish()}
              className="min-h-[40px] px-4 text-xs font-semibold bg-[#C5CBD3] text-[#080A0D] rounded disabled:opacity-50"
            >
              {item.status === 'approved' ? '업데이트' : '게시 승인'}
            </button>
          </div>
        </div>
      </div>

      {previewOpen && (
        <NewsArticlePreviewModal
          item={item}
          draft={draft}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
};
