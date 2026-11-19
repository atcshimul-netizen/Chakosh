import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Personality } from '../types.ts';
import {
  RotateCcw,
  Download,
  Loader2,
  X,
  Eye,
  ExternalLink,
  Upload,
  User,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Users,
  Clock,
  Globe,
  Gift,
} from 'lucide-react';
import { soundEffects } from '../utils/sound.ts';
import { toBengaliDigits } from '../data/quizData.ts';
import {
  generateResultAssets,
  processProfileImageFile,
  canShareResultFile,
  shareResultFile,
  GeneratedResultAssets,
} from '../utils/generateResultImage.ts';
import {
  isFacebookInAppBrowser,
  isAndroidDevice,
  isIOSDevice,
  openFacebookGroup,
  buildResultShareUrl,
  openExternalBrowserWithUrl,
} from '../utils/browser.ts';
import { ResultCardView } from './ResultCardView.tsx';
import { uploadResultImage } from '../utils/api.ts';
import { trackDownload, trackShareFacebook, trackShareMessenger } from '../utils/analytics.ts';

interface ResultScreenProps {
  score: number;
  personality: Personality;
  onRestart: () => void;
  initialPlayerName?: string;
  initialResultId?: string | null;
  initialResultBackend?: 'express' | 'php';
  autoOpenPopup?: boolean;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  score,
  personality,
  onRestart,
  initialPlayerName = '',
  initialResultId = null,
  initialResultBackend,
  autoOpenPopup = false,
}) => {
  // Optional personalisation state (client-side only)
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photocard generation & popup state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedResultAssets | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Download / share / 5-second Facebook redirect countdown state
  const [popupNotice, setPopupNotice] = useState<string | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const isFbBrowser = isFacebookInAppBrowser();
  const isAndroid = isAndroidDevice();

  useEffect(() => {
    soundEffects.playCelebration();
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D97706', '#8B4513', '#F59E0B', '#1B4332', '#FDE68A'],
      });
    } catch {}
  }, []);

  // Revoke previous Blob URL cleanly when assets change or unmount
  useEffect(() => {
    return () => {
      if (generatedAssets?.blobUrl && generatedAssets.blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(generatedAssets.blobUrl);
      }
    };
  }, [generatedAssets]);

  // If initialResultId is provided (e.g. redirected from Facebook to Chrome),
  // initialize the download assets and automatically open the download popup.
  // If autoOpenPopup is true without initialResultId (e.g. static hosting deep-link),
  // generate the photocard client-side and open the popup directly.
  useEffect(() => {
    if (initialResultId && !generatedAssets) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const usePhpEndpoint = initialResultBackend === 'php';
      const downloadUrl = usePhpEndpoint
        ? `${window.location.origin}${base}/api/result-image.php?action=download&id=${initialResultId}`
        : `${window.location.origin}${base}/api/download/${initialResultId}`;
      const imageUrl = usePhpEndpoint
        ? `${window.location.origin}${base}/api/result-image.php?action=image&id=${initialResultId}`
        : `${window.location.origin}${base}/api/image/${initialResultId}`;

      setGeneratedAssets({
        blob: null as any,
        blobUrl: imageUrl,
        dataUrl: imageUrl,
        filename: 'chakosh-result.png',
        downloadUrl,
        imageUrl,
        id: initialResultId,
        backend: initialResultBackend,
      });

      if (autoOpenPopup) {
        setShowPopup(true);
      }

      // Background prefetch so native share button works seamlessly in Chrome too
      let cancelled = false;
      fetch(imageUrl)
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          if (!res.ok || !contentType.includes('image/png')) return null;
          return res.blob();
        })
        .then((blob) => {
          if (cancelled || !blob || blob.size === 0) return;
          setGeneratedAssets((prev) => {
            if (!prev || prev.id !== initialResultId) return prev;
            return {
              ...prev,
              blob,
            };
          });
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }

    if (autoOpenPopup && !initialResultId && !generatedAssets && !isGenerating) {
      let cancelled = false;
      setIsGenerating(true);
      generateResultAssets({
        score,
        personality,
        playerName: initialPlayerName,
        profileImageUrl: null,
      })
        .then(async (assets) => {
          if (cancelled) return;
          try {
            const serverRes = await uploadResultImage(assets.blob);
            if (!cancelled) {
              setGeneratedAssets({
                ...assets,
                downloadUrl: serverRes.downloadUrl,
                imageUrl: serverRes.imageUrl,
                id: serverRes.id,
                backend: serverRes.backend,
              });
            }
          } catch {
            if (!cancelled) {
              setGeneratedAssets(assets);
            }
          }
          if (!cancelled) {
            setShowPopup(true);
          }
        })
        .catch(() => {
          // Leave user on result screen cleanly if auto-generation fails
        })
        .finally(() => {
          if (!cancelled) {
            setIsGenerating(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }
  }, [initialResultId, initialResultBackend, autoOpenPopup]);

  // Invalidate cached photocard if player changes name or photo
  useEffect(() => {
    if (!initialResultId || playerName !== initialPlayerName || profileImageUrl) {
      setGeneratedAssets(null);
      setRedirectCountdown(null);
    }
  }, [playerName, profileImageUrl, score, personality.level]);

  // Handle 5-second countdown before redirecting to the Facebook group
  useEffect(() => {
    if (!showPopup || redirectCountdown === null) return;

    if (redirectCountdown <= 0) {
      setRedirectCountdown(null);
      openFacebookGroup();
      setPopupNotice(
        'Facebook অ্যাপে গ্রুপটি খোলা হচ্ছে! সরাসরি না খুললে নিচের "Chakosh Facebook গ্রুপে পোস্ট করুন" বাটনে চাপুন।'
      );
      return;
    }

    const timer = window.setTimeout(() => {
      setRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [showPopup, redirectCountdown]);

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsProcessingPhoto(true);
    try {
      const croppedDataUrl = await processProfileImageFile(file);
      setProfileImageUrl(croppedDataUrl);
      soundEffects.playSelect();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'ছবিটি প্রসেস করতে সমস্যা হয়েছে। দয়া করে অন্য একটি ছবি চেষ্টা করুন।';
      setUploadError(msg);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setIsProcessingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    soundEffects.playTap();
    setProfileImageUrl(null);
    setUploadError(null);
  };

  const handleClosePopup = () => {
    setShowPopup(false);
    setRedirectCountdown(null);
  };

  const handleGenerateAndOpenPopup = async () => {
    soundEffects.playTap();
    setGenerationError(null);
    setPopupNotice(null);
    setRedirectCountdown(null);

    // If opened from an external browser handoff and user hasn't edited name/photo,
    // reopen the preserved photocard directly instead of overwriting it without the photo.
    if (
      generatedAssets &&
      initialResultId &&
      generatedAssets.id === initialResultId &&
      playerName === initialPlayerName &&
      !profileImageUrl
    ) {
      setShowPopup(true);
      return;
    }

    setIsGenerating(true);

    try {
      const assets = await generateResultAssets({
        score,
        personality,
        playerName,
        profileImageUrl,
      });

      let finalAssets: GeneratedResultAssets = assets;
      try {
        const serverRes = await uploadResultImage(assets.blob);
        finalAssets = {
          ...assets,
          downloadUrl: serverRes.downloadUrl,
          imageUrl: serverRes.imageUrl,
          id: serverRes.id,
          backend: serverRes.backend,
        };
      } catch (uploadErr) {
        // Static hosting deployments without PHP/Node support fall back to in-session Blob & Data URL
        console.warn('Server upload unavailable, using client-side photocard download:', uploadErr);
      }

      setGeneratedAssets(finalAssets);

      // Update current browser URL with deep-link state so external browser / Safari menu uses it
      try {
        const shareUrl = buildResultShareUrl({
          score,
          playerName,
          resultId: finalAssets.id,
          backend: finalAssets.backend,
        });
        window.history.replaceState(null, '', shareUrl);
      } catch {}

      setShowPopup(true);
    } catch (err) {
      console.error('Failed to generate result image:', err);
      setGeneratedAssets(null);
      setGenerationError('দুঃখিত, ফটোকার্ড তৈরি করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
      setShowPopup(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenInChrome = () => {
    soundEffects.playTap();
    const resultUrl = buildResultShareUrl({
      score,
      playerName,
      resultId: generatedAssets?.id || undefined,
      backend: generatedAssets?.backend || initialResultBackend,
    });

    try {
      window.history.replaceState(null, '', resultUrl);
    } catch {}

    openExternalBrowserWithUrl(resultUrl);
  };

  const handlePreviewImageError = () => {
    if (!generatedAssets?.id || !generatedAssets.dataUrl.startsWith('http')) return;

    if (!generatedAssets.dataUrl.includes('result-image.php')) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const phpImageUrl = `${window.location.origin}${base}/api/result-image.php?action=image&id=${generatedAssets.id}`;
      const phpDownloadUrl = `${window.location.origin}${base}/api/result-image.php?action=download&id=${generatedAssets.id}`;
      setGeneratedAssets((prev) =>
        prev
          ? {
              ...prev,
              blobUrl: phpImageUrl,
              dataUrl: phpImageUrl,
              imageUrl: phpImageUrl,
              downloadUrl: phpDownloadUrl,
              backend: 'php',
            }
          : prev
      );
      return;
    }

    generateResultAssets({
      score,
      personality,
      playerName,
      profileImageUrl,
    })
      .then((fresh) => setGeneratedAssets(fresh))
      .catch(() => {});
  };

  const handlePopupDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackDownload();
    if (!generatedAssets) {
      e.preventDefault();
      return;
    }
    if (redirectCountdown !== null) {
      e.preventDefault();
      return;
    }
    soundEffects.playTap();
    setPopupNotice(null);
    setRedirectCountdown(5);
  };

      const handlePopupShare = async (platform: 'facebook' | 'messenger' = 'facebook') => {
    if (platform === 'messenger') {
      trackShareMessenger();
    } else {
      trackShareFacebook();
    }
    if (!generatedAssets || !generatedAssets.blob) return;
    soundEffects.playTap();
    setIsSharing(true);
    setPopupNotice(null);

    const shareUrl = 'https://chakosh.nisorgo.com/koto-boro-chakhor/';
    const caption = `আমি "আপনি কত বড় চা-খোর?" কুইজে ১০০-তে ${toBengaliDigits(score)} পেয়েছি! খেতাব: ${personality.title}।\n\nআপনি কত বড় চা-খোর? আপনার স্কোর চেক করতে এখানে খেলুন:\n${shareUrl}`;

    // Auto-copy the exact caption to clipboard so user can paste it anywhere
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(caption);
      }
    } catch {}

    try {
      const result = await shareResultFile(
        generatedAssets.blob,
        generatedAssets.filename,
        score,
        personality,
        shareUrl
      );
      if (result === 'shared') {
        setPopupNotice('শেয়ার শিট সম্পন্ন হয়েছে। আপনি চাইলে ছবিটি গ্যালারিতেও সেভ করতে পারেন।');
      } else if (result === 'unsupported' || result === 'failed') {
        setPopupNotice(
          'এই ব্রাউজারে সরাসরি ফাইল শেয়ার সমর্থিত নয়। দয়া করে "ডাউনলোড করুন" বাটন ব্যবহার করুন অথবা ছবির ওপর চেপে ধরে সেভ করুন।'
        );
      }
    } finally {
      setIsSharing(false);
    }
  };

  const canNativeShare = generatedAssets && generatedAssets.blob
    ? canShareResultFile(generatedAssets.blob, generatedAssets.filename)
    : false;

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 sm:px-4 pt-1.5 pb-6 sm:py-6 flex flex-col items-center">
      {/* 1. Reusable On-Screen Result Card */}
      <ResultCardView
        score={score}
        personality={personality}
        isExportMode={false}
        playerName={playerName}
        profileImageUrl={profileImageUrl}
      />

      {/* 2. Optional Photocard Personalisation Card */}
      <div className="w-full bg-white border border-[#E7D6C3] rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-xs sm:text-sm font-bold text-[#381B0E]">
            ফটোকার্ড পার্সোনালাইজ করুন{' '}
            <span className="text-[11px] font-medium text-[#8C6D58]">(ঐচ্ছিক)</span>
          </h3>
        </div>

        <div className="space-y-2.5">
          {/* Optional Name Input */}
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-[11px] sm:text-xs font-semibold text-[#5C2C16] mb-1"
            >
              আপনার নাম (ঐচ্ছিক)
            </label>
            <div className="relative flex items-center">
              <User className="w-3.5 h-3.5 text-[#8C6D58] absolute left-2.5 pointer-events-none" />
              <input
                id="player-name-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={40}
                placeholder="যেমন: তানভীর আহমেদ"
                className="w-full h-9 sm:h-10 pl-8 pr-8 rounded-lg border border-[#DFCBB5] bg-[#FAF7F2] text-xs sm:text-sm text-[#2C1810] placeholder:text-[#A88C78] focus:outline-none focus:ring-1.5 focus:ring-[#8B4513] focus:bg-white transition-colors"
              />
              {playerName && (
                <button
                  type="button"
                  onClick={() => setPlayerName('')}
                  className="absolute right-2 p-1 rounded-full text-[#8C6D58] hover:text-[#5C2C16]"
                  aria-label="নাম মুছে ফেলুন"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Optional Profile Picture Upload */}
          <div>
            <span className="block text-[11px] sm:text-xs font-semibold text-[#5C2C16] mb-1">
              প্রোফাইল ছবি (ঐচ্ছিক)
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/*"
              onChange={handleProfilePhotoChange}
              className="hidden"
            />

            {profileImageUrl ? (
              <div className="flex items-center justify-between gap-2.5 p-2 rounded-lg border border-[#DFCBB5] bg-[#FAF7F2]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={profileImageUrl}
                    alt="প্রোফাইল প্রিভিউ"
                    className="w-8 h-8 rounded-full object-cover border-2 border-[#8B4513] shrink-0"
                  />
                  <span className="text-xs font-semibold text-[#381B0E] truncate">
                    ছবি যুক্ত হয়েছে
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-[#5C2C16] bg-[#EFE5D7] hover:bg-[#E4D5C1] cursor-pointer"
                  >
                    পরিবর্তন
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1 rounded-md text-rose-700 bg-rose-50 hover:bg-rose-100 cursor-pointer"
                    aria-label="ছবি মুছে ফেলুন"
                    title="ছবি মুছে ফেলুন"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="w-full h-9 sm:h-10 px-3 rounded-lg border border-dashed border-[#C7AE94] bg-[#FAF7F2] hover:bg-[#F4EDE2] text-[#5C2C16] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isProcessingPhoto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>ছবি প্রস্তুত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-[#8B4513]" />
                    <span>ডিভাইস থেকে ছবি নির্বাচন করুন</span>
                  </>
                )}
              </button>
            )}

            {uploadError && (
              <p className="mt-1 text-[11px] text-rose-700 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{uploadError}</span>
              </p>
            )}
          </div>

          <p className="text-[10px] text-[#8C6D58] flex items-center gap-1 pt-0.5 leading-tight">
            <ShieldCheck className="w-3 h-3 text-[#2D6A4F] shrink-0" />
            <span>ফটোকার্ডের ছবিটি সাময়িকভাবে সংরক্ষিত হয়ে ১০ মিনিট পর মুছে যায়।</span>
          </p>
        </div>
      </div>

      {/* 3. Main Action Buttons */}
      <div className="w-full space-y-2 max-w-sm">
        {/* Download Result as Image Button */}
        <button
          onClick={handleGenerateAndOpenPopup}
          disabled={isGenerating || isProcessingPhoto}
          className={`w-full h-12 sm:h-13 px-5 rounded-xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513] ${
            isGenerating || isProcessingPhoto
              ? 'bg-[#E5DACB] text-[#8C6D58] cursor-wait'
              : 'bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-[#FFF9F2]'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>ফটোকার্ড তৈরি হচ্ছে...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>ফলাফল ডাউনলোড করুন</span>
            </>
          )}
        </button>

        {/* Preview Trigger (if already generated for current inputs) */}
        {generatedAssets && (
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            className="w-full text-xs text-[#8B4513] hover:text-[#5C2C16] underline flex items-center justify-center gap-1 py-0.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>ডাউনলোডকৃত কার্ডের প্রিভিউ দেখুন</span>
          </button>
        )}

        {/* Play Again (Reset) Button */}
        <button
          onClick={() => {
            soundEffects.playTap();
            onRestart();
          }}
          className="w-full h-10 px-5 rounded-xl bg-white hover:bg-[#FDFBF7] border border-[#D5C2AF] active:scale-[0.98] text-[#5C2C16] font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>আবার খেলুন</span>
        </button>
      </div>

      {/* 4. Main Result Screen Facebook Group Invitation */}
      <div className="w-full mt-6 bg-[#FAF3EA] border border-[#E2CEB9] rounded-2xl p-5 text-center shadow-xs">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#1877F2]/10 text-[#1877F2] mb-2">
          <Users className="w-5 h-5" />
        </div>
        <p className="text-base sm:text-lg font-bold text-[#381B0E] mb-3">
          আপনার ফলাফলটি আমাদের Facebook গ্রুপে শেয়ার করুন!
        </p>
        <button
          type="button"
          onClick={() => {
            soundEffects.playTap();
            openFacebookGroup();
          }}
          className="inline-flex items-center justify-center gap-2 w-full max-w-xs h-12 px-5 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-sm transition-all cursor-pointer"
        >
          <span>গ্রুপে পোস্ট করুন</span>
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>

      {/* 5. Photocard Preview / Download Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={handleClosePopup}
        >
          <div
            className="bg-[#FAF7F2] rounded-2xl max-w-md w-full p-4 sm:p-5 relative shadow-2xl border border-[#E3D4C1] flex flex-col items-center max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleClosePopup}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-[#EAE0D2] hover:bg-[#DFCDBB] text-[#5C2C16] cursor-pointer"
              title="বন্ধ করুন"
              aria-label="পপআপ বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Photocard Preview or Generation Error */}
            {generatedAssets ? (
              isFbBrowser ? (
                /* Facebook In-App Browser Experience (Directly inspired by reference screenshot) */
                <div className="w-full flex flex-col items-center text-center px-1 pt-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#1E293B] mb-2 tracking-tight">
                    আপনার ফটোকার্ড তৈরি!
                  </h2>

                  <p className="text-xs sm:text-sm text-[#475569] leading-relaxed mb-5 max-w-sm">
                    Facebook/Instagram-এর ভেতরের ব্রাউজারে সরাসরি ডাউনলোড হয় না। নিচের যেকোনো একটি উপায়ে সেভ করুন:
                  </p>

                  {/* Primary Big Green Action Button (Animated to boost CTR) */}
                  <button
                    type="button"
                    onClick={handleOpenInChrome}
                    className="relative overflow-hidden w-full py-4 px-5 rounded-2xl bg-[#0F6048] hover:bg-[#0B4D39] active:scale-[0.98] text-white font-extrabold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transition-all animate-cta-pulse"
                  >
                    {/* Shimmer sweep reflection */}
                    <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none animate-cta-shimmer" />

                    <Globe className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 relative z-10 animate-cta-hop" />
                    <span className="relative z-10 tracking-tight">
                      {isAndroid
                        ? 'Chrome-এ ডাউনলোড করতে ট্যাপ করুন'
                        : 'Safari / ব্রাউজারে ডাউনলোড করতে ট্যাপ করুন'}
                    </span>
                  </button>

                  <p className="text-[11px] sm:text-xs text-[#64748B] mt-2.5 mb-5 leading-relaxed max-w-sm">
                    আপনার রেজাল্ট ও নাম সাথেই যাবে। না খুললে: ওপরের বা নিচের{' '}
                    <span className="font-bold tracking-widest">•••</span> মেনু থেকে{' '}
                    <strong>Open in Chrome / external browser</strong> চাপুন।
                  </p>

                  {/* Option 2: Long press manual save fallback */}
                  <div className="w-full border-t border-[#E2E8F0] pt-4 mb-2 text-center">
                    <p className="text-xs sm:text-sm font-semibold text-[#64748B] mb-2.5">
                      অথবা: নিচের ছবিটিতে চেপে ধরে সেভ করুন:
                    </p>

                    <div className="w-full max-w-[280px] sm:max-w-[320px] mx-auto rounded-xl overflow-hidden border border-[#CBD5E1] shadow-xs aspect-[4/5] bg-white mb-2.5">
                      <img
                        src={generatedAssets.dataUrl}
                        alt="চা-খোর রেজাল্ট কার্ড"
                        className="w-full h-full object-contain"
                        onError={handlePreviewImageError}
                      />
                    </div>

                    <p className="text-xs text-[#64748B] mb-3">
                      ছবির ওপর চেপে ধরে <strong>&quot;Save Image&quot;</strong> বা{' '}
                      <strong>&quot;Download image&quot;</strong> করুন।
                    </p>
                  </div>

                  {/* Viral Reward Contest Box */}
                  <div className="w-full p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30 text-center shadow-2xs mb-2.5">
                    <p className="text-xs sm:text-sm font-bold text-[#92400E] flex items-center justify-center gap-1.5 leading-snug">
                      <Gift className="w-4 h-4 text-[#D97706] shrink-0" />
                      <span>Facebook প্রোফাইলে শেয়ার করে অথবা Messenger-এ ১০ জনকে শেয়ার করে জিতে নিতে পারেন এক কাপ চা 😂!</span>
                    </p>
                  </div>

                  {/* Facebook & Messenger Share Buttons (Same line, 50% width each, using native photocard file share) */}
                  <div className="w-full grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => handlePopupShare('facebook')}
                      disabled={isSharing}
                      className="w-full h-11 px-2 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-75"
                    >
                      {isSharing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span className="truncate">খুলছে...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                          <span className="truncate">Facebook-এ শেয়ার</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePopupShare('messenger')}
                      disabled={isSharing}
                      className="w-full h-11 px-2 rounded-xl bg-gradient-to-r from-[#0084FF] to-[#00C6FF] hover:opacity-95 active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-75"
                    >
                      {isSharing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span className="truncate">খুলছে...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                            <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.302 2.249.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.259 5.888-3.259-6.559 6.963z" />
                          </svg>
                          <span className="truncate">Messenger-এ শেয়ার</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Direct Facebook Group button */}
                  <div className="w-full pt-3 border-t border-[#E6D6C3] text-center space-y-2">
                    <p className="text-xs sm:text-sm font-bold text-[#381B0E]">
                      আপনার চায়ের ব্যক্তিত্ব গ্রুপে শেয়ার করুন!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playTap();
                        openFacebookGroup();
                      }}
                      className="w-full h-11 px-4 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <span>Chakosh Facebook গ্রুপে পোস্ট করুন</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Standard External Browser / Chrome / Safari Experience */
                <>
                  <h3 className="text-base sm:text-lg font-bold text-[#381B0E] mb-3 pr-6 text-center">
                    আপনার চা-খোর ফটোকার্ড
                  </h3>

                  <div className="w-full max-w-[300px] sm:max-w-[340px] mx-auto rounded-xl overflow-hidden border border-[#D8C7B5] shadow-xs aspect-[4/5] bg-white mb-2.5">
                    <img
                      src={generatedAssets.dataUrl}
                      alt="চা-খোর রেজাল্ট কার্ড"
                      className="w-full h-full object-contain"
                      onError={handlePreviewImageError}
                    />
                  </div>

                  <p className="text-xs text-center text-[#7C5A43] mb-3">
                    ডাউনলোডে ক্লিক করলে ছবি ডাউনলোড শুরু হবে এবং ৫ সেকেন্ড পর আপনাকে Facebook গ্রুপে নিয়ে যাওয়া হবে।
                  </p>

                  {/* Primary Direct HTTPS Download & Optional Share Actions */}
                  <div className="w-full space-y-2.5 mb-3">
                    <a
                      href={generatedAssets.downloadUrl || generatedAssets.blobUrl}
                      download={generatedAssets.filename}
                      onClick={handlePopupDownload}
                      className={`w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-[#FFF9F2] text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all ${
                        redirectCountdown !== null ? 'opacity-85 pointer-events-none' : ''
                      }`}
                    >
                      <Download className="w-4 h-4 stroke-[2.5]" />
                      <span>
                        {redirectCountdown !== null
                          ? 'ডাউনলোড অনুরোধ পাঠানো হয়েছে...'
                          : 'ডাউনলোড করুন'}
                      </span>
                    </a>

                    {/* Viral Reward Contest Box */}
                    <div className="w-full p-2.5 sm:p-3 rounded-xl bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30 text-center shadow-2xs">
                      <p className="text-xs sm:text-sm font-bold text-[#92400E] flex items-center justify-center gap-1.5 leading-snug">
                        <Gift className="w-4 h-4 text-[#D97706] shrink-0" />
                        <span>Facebook প্রোফাইলে শেয়ার করে অথবা Messenger-এ ১০ জনকে শেয়ার করে জিতে নিতে পারেন এক কাপ চা 😂!</span>
                      </p>
                    </div>

                    {/* Facebook & Messenger Share Buttons (Same line, 50% width each, using native photocard file share) */}
                    <div className="w-full grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePopupShare('facebook')}
                        disabled={isSharing}
                        className="w-full h-11 px-2 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-75"
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate">খুলছে...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            <span className="truncate">Facebook-এ শেয়ার</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePopupShare('messenger')}
                        disabled={isSharing}
                        className="w-full h-11 px-2 rounded-xl bg-gradient-to-r from-[#0084FF] to-[#00C6FF] hover:opacity-95 active:scale-[0.98] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all disabled:opacity-75"
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                            <span className="truncate">খুলছে...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24">
                              <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.302 2.249.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.259 5.888-3.259-6.559 6.963z" />
                            </svg>
                            <span className="truncate">Messenger-এ শেয়ার</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 5-Second Redirect Countdown Banner */}
                  {redirectCountdown !== null && redirectCountdown > 0 && (
                    <div className="w-full mb-3 p-3.5 rounded-xl bg-[#EEF5FF] border border-[#B9D4FA] text-[#1E3A5F] space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#1877F2] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {toBengaliDigits(redirectCountdown)}
                        </div>
                        <p className="text-xs sm:text-sm font-semibold leading-snug">
                          ফটোকার্ড ডাউনলোডের অনুরোধ পাঠানো হয়েছে!{' '}
                          <span className="text-[#1877F2] font-bold">
                            {toBengaliDigits(redirectCountdown)} সেকেন্ড
                          </span>{' '}
                          পর আপনাকে Facebook গ্রুপে নিয়ে যাওয়া হচ্ছে...
                        </p>
                      </div>

                      <div className="w-full h-1.5 bg-[#D4E4FC] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1877F2] rounded-full transition-all duration-1000 ease-linear"
                          style={{ width: `${((6 - redirectCountdown) / 5) * 100}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playTap();
                            setRedirectCountdown(null);
                            openFacebookGroup();
                          }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#1877F2] hover:underline cursor-pointer"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>এখনই গ্রুপে যান</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundEffects.playTap();
                            setRedirectCountdown(null);
                          }}
                          className="text-xs font-semibold text-[#5C2C16] hover:text-[#381B0E] px-2 py-1 rounded-md bg-white/80 border border-[#D4E4FC] cursor-pointer"
                        >
                          বাতিল করুন
                        </button>
                      </div>
                    </div>
                  )}

                  {popupNotice && (
                    <div className="w-full mb-3 p-3 rounded-xl bg-[#FFF8EB] border border-[#EBD2AA] text-xs text-[#6E4733] leading-relaxed">
                      {popupNotice}
                    </div>
                  )}

                  {/* Always-Visible Facebook Group Invitation in Popup */}
                  <div className="w-full pt-3 border-t border-[#E6D6C3] text-center space-y-2.5">
                    <p className="text-sm font-bold text-[#381B0E]">
                      আপনার চায়ের ব্যক্তিত্ব সবার সঙ্গে শেয়ার করুন!
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        soundEffects.playTap();
                        openFacebookGroup();
                      }}
                      className="w-full h-11 px-4 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                    >
                      <span>Chakosh Facebook গ্রুপে পোস্ট করুন</span>
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )
            ) : (
              <div className="w-full p-4 rounded-xl bg-rose-50 border border-rose-200 text-center mb-4">
                <AlertCircle className="w-7 h-7 text-rose-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-rose-800 mb-3">
                  {generationError || 'ফটোকার্ড তৈরি করতে সমস্যা হয়েছে।'}
                </p>
                <button
                  type="button"
                  onClick={handleGenerateAndOpenPopup}
                  className="px-4 py-2 rounded-lg bg-[#5C2C16] text-white text-xs font-bold cursor-pointer"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
