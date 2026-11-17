import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Personality } from '../types.ts';
import {
  RotateCcw,
  Download,
  Loader2,
  X,
  Eye,
  Share2,
  ExternalLink,
  Upload,
  User,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Users,
  Clock,
  Globe,
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
  openFacebookGroup,
  buildResultShareUrl,
  openExternalBrowserWithUrl,
} from '../utils/browser.ts';
import { ResultCardView } from './ResultCardView.tsx';
import { uploadResultImage } from '../utils/api.ts';

interface ResultScreenProps {
  score: number;
  personality: Personality;
  onRestart: () => void;
  initialPlayerName?: string;
  initialResultId?: string | null;
  autoOpenPopup?: boolean;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  score,
  personality,
  onRestart,
  initialPlayerName = '',
  initialResultId = null,
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
  useEffect(() => {
    if (initialResultId && !generatedAssets) {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
      const downloadUrl = `${window.location.origin}${base}/api/download/${initialResultId}`;
      const imageUrl = `${window.location.origin}${base}/api/image/${initialResultId}`;
      setGeneratedAssets({
        blob: null as any,
        blobUrl: imageUrl,
        dataUrl: imageUrl,
        filename: 'chakosh-result.png',
        downloadUrl,
        id: initialResultId,
      });
      if (autoOpenPopup) {
        setShowPopup(true);
      }
    }
  }, [initialResultId, autoOpenPopup]);

  // Invalidate cached photocard if player changes name or photo
  useEffect(() => {
    if (!initialResultId) {
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
        'Facebook গ্রুপে নিয়ে যাওয়া হচ্ছে! সরাসরি না খুললে নিচের "Chakosh Facebook গ্রুপে পোস্ট করুন" বাটনে চাপুন।'
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
    setIsGenerating(true);
    setGenerationError(null);
    setPopupNotice(null);
    setRedirectCountdown(null);

    try {
      const assets = await generateResultAssets({
        score,
        personality,
        playerName,
        profileImageUrl,
      });
      const serverRes = await uploadResultImage(assets.blob);
      setGeneratedAssets({
        ...assets,
        downloadUrl: serverRes.downloadUrl,
        id: serverRes.id,
      });

      // Update current browser URL with deep-link state so external browser / Safari menu uses it
      try {
        const shareUrl = buildResultShareUrl({
          score,
          playerName,
          resultId: serverRes.id,
        });
        window.history.replaceState(null, '', shareUrl);
      } catch {}

      setShowPopup(true);
    } catch (err) {
      console.error('Failed to generate or upload result image:', err);
      setGeneratedAssets(null);
      setGenerationError('দুঃখিত, ফটোকার্ড প্রস্তুত বা সার্ভারে আপলোড করতে সমস্যা হয়েছে। দয়া করে আবার চেষ্টা করুন।');
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
    });

    try {
      window.history.replaceState(null, '', resultUrl);
    } catch {}

    openExternalBrowserWithUrl(resultUrl);
  };

  const handlePopupDownload = (e: React.MouseEvent<HTMLAnchorElement>) => {
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

    // Also trigger download via hidden iframe so the current page & timer remain 100% active
    if (generatedAssets.downloadUrl) {
      let iframe = document.getElementById('download-hidden-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'download-hidden-iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
      }
      iframe.src = generatedAssets.downloadUrl;
    }
  };

  const handlePopupShare = async () => {
    if (!generatedAssets || !generatedAssets.blob) return;
    soundEffects.playTap();
    setIsSharing(true);
    setPopupNotice(null);

    try {
      const result = await shareResultFile(
        generatedAssets.blob,
        generatedAssets.filename,
        score,
        personality
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
    <div className="w-full max-w-xl mx-auto px-4 py-6 sm:py-8 flex flex-col items-center">
      {/* 1. Reusable On-Screen Result Card */}
      <ResultCardView
        score={score}
        personality={personality}
        isExportMode={false}
        playerName={playerName}
        profileImageUrl={profileImageUrl}
      />

      {/* 2. Optional Photocard Personalisation Card */}
      <div className="w-full bg-white border border-[#E7D6C3] rounded-2xl p-4 sm:p-5 mb-5 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm sm:text-base font-bold text-[#381B0E]">
            ফটোকার্ড পার্সোনালাইজ করুন{' '}
            <span className="text-xs font-medium text-[#8C6D58]">(ঐচ্ছিক)</span>
          </h3>
        </div>

        <div className="space-y-3">
          {/* Optional Name Input */}
          <div>
            <label
              htmlFor="player-name-input"
              className="block text-xs font-semibold text-[#5C2C16] mb-1.5"
            >
              আপনার নাম (ঐচ্ছিক)
            </label>
            <div className="relative flex items-center">
              <User className="w-4 h-4 text-[#8C6D58] absolute left-3 pointer-events-none" />
              <input
                id="player-name-input"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={40}
                placeholder="যেমন: তানভীর আহমেদ"
                className="w-full h-11 pl-9 pr-9 rounded-xl border border-[#DFCBB5] bg-[#FAF7F2] text-base sm:text-sm text-[#2C1810] placeholder:text-[#A88C78] focus:outline-none focus:ring-2 focus:ring-[#8B4513] focus:bg-white transition-colors"
              />
              {playerName && (
                <button
                  type="button"
                  onClick={() => setPlayerName('')}
                  className="absolute right-2.5 p-1 rounded-full text-[#8C6D58] hover:text-[#5C2C16] hover:bg-[#EFE5D7]"
                  aria-label="নাম মুছে ফেলুন"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Optional Profile Picture Upload */}
          <div>
            <span className="block text-xs font-semibold text-[#5C2C16] mb-1.5">
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
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#DFCBB5] bg-[#FAF7F2]">
                <div className="flex items-center gap-3">
                  <img
                    src={profileImageUrl}
                    alt="প্রোফাইল প্রিভিউ"
                    className="w-11 h-11 rounded-full object-cover border-2 border-[#8B4513] shrink-0"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-[#381B0E]">
                    ছবি যুক্ত হয়েছে
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessingPhoto}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#5C2C16] bg-[#EFE5D7] hover:bg-[#E4D5C1] cursor-pointer"
                  >
                    পরিবর্তন
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="p-1.5 rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 cursor-pointer"
                    aria-label="ছবি মুছে ফেলুন"
                    title="ছবি মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingPhoto}
                className="w-full h-11 px-4 rounded-xl border border-dashed border-[#C7AE94] bg-[#FAF7F2] hover:bg-[#F4EDE2] text-[#5C2C16] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isProcessingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ছবি প্রস্তুত হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-[#8B4513]" />
                    <span>ডিভাইস থেকে ছবি নির্বাচন করুন</span>
                  </>
                )}
              </button>
            )}

            {uploadError && (
              <p className="mt-1.5 text-xs text-rose-700 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{uploadError}</span>
              </p>
            )}
          </div>

          <p className="text-[11px] text-[#8C6D58] flex items-center gap-1.5 pt-0.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
            <span>ফটোকার্ড ডাউনলোডের জন্য কার্ডের ছবিটি সার্ভারে সাময়িকভাবে সংরক্ষিত হয় এবং ১০ মিনিট পর স্বয়ংক্রিয়ভাবে মুছে যায়।</span>
          </p>
        </div>
      </div>

      {/* 3. Main Action Buttons */}
      <div className="w-full space-y-3 max-w-sm">
        {/* Download Result as Image Button */}
        <button
          onClick={handleGenerateAndOpenPopup}
          disabled={isGenerating || isProcessingPhoto}
          className={`w-full h-14 px-6 rounded-xl font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513] ${
            isGenerating || isProcessingPhoto
              ? 'bg-[#E5DACB] text-[#8C6D58] cursor-wait'
              : 'bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-[#FFF9F2]'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>ফটোকার্ড তৈরি হচ্ছে...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5 stroke-[2.5]" />
              <span>ফলাফল ডাউনলোড করুন</span>
            </>
          )}
        </button>

        {/* Preview Trigger (if already generated for current inputs) */}
        {generatedAssets && (
          <button
            type="button"
            onClick={() => setShowPopup(true)}
            className="w-full text-xs text-[#8B4513] hover:text-[#5C2C16] underline flex items-center justify-center gap-1 py-1 cursor-pointer"
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
          className="w-full h-13 px-6 rounded-xl bg-white hover:bg-[#FDFBF7] border border-[#D5C2AF] active:scale-[0.98] text-[#5C2C16] font-bold text-base flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B4513]"
        >
          <RotateCcw className="w-5 h-5" />
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

                  {/* Primary Big Green Action Button */}
                  <button
                    type="button"
                    onClick={handleOpenInChrome}
                    className="w-full py-3.5 px-5 rounded-2xl bg-[#0F6048] hover:bg-[#0B4D39] active:scale-[0.98] text-white font-bold text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-md cursor-pointer transition-all"
                  >
                    <Globe className="w-5 h-5 shrink-0" />
                    <span>{isAndroid ? 'Chrome-এ খুলে ডাউনলোড করুন' : 'Safari / ব্রাউজারে খুলে ডাউনলোড করুন'}</span>
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
                      />
                    </div>

                    <p className="text-xs text-[#64748B] mb-3">
                      ছবির ওপর চেপে ধরে <strong>&quot;Save Image&quot;</strong> বা{' '}
                      <strong>&quot;Download image&quot;</strong> করুন।
                    </p>
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

                    {canNativeShare && (
                      <button
                        type="button"
                        onClick={handlePopupShare}
                        disabled={isSharing}
                        className="w-full h-11 px-4 rounded-xl bg-white hover:bg-[#FDFBF7] border border-[#D5C2AF] active:scale-[0.98] text-[#5C2C16] text-sm font-bold flex items-center justify-center gap-2 shadow-2xs cursor-pointer transition-all"
                      >
                        {isSharing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>শেয়ার অপশন খুলছে...</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-4 h-4 text-[#8B4513]" />
                            <span>শেয়ার বা সেভ করুন</span>
                          </>
                        )}
                      </button>
                    )}
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
