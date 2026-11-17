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
} from 'lucide-react';
import { soundEffects } from '../utils/sound.ts';
import {
  generateResultAssets,
  processProfileImageFile,
  canShareResultFile,
  shareResultFile,
  triggerBrowserDownload,
  GeneratedResultAssets,
} from '../utils/generateResultImage.ts';
import {
  FACEBOOK_GROUP_URL,
  isFacebookInAppBrowser,
  isIOSDevice,
  isAndroidDevice,
  attemptOpenInExternalBrowser,
} from '../utils/browser.ts';
import { ResultCardView } from './ResultCardView.tsx';

interface ResultScreenProps {
  score: number;
  personality: Personality;
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  score,
  personality,
  onRestart,
}) => {
  // Optional personalisation state (client-side only)
  const [playerName, setPlayerName] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photocard generation & popup state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAssets, setGeneratedAssets] = useState<GeneratedResultAssets | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Download / share status inside popup (never assumes automatic download succeeded)
  const [popupNotice, setPopupNotice] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [externalBrowserHint, setExternalBrowserHint] = useState<string | null>(null);
  const [showFallbackHelp, setShowFallbackHelp] = useState(false);

  const inFacebookBrowser = isFacebookInAppBrowser();
  const isIOS = isIOSDevice();
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

  // Invalidate cached photocard if player changes name or photo
  useEffect(() => {
    setGeneratedAssets(null);
  }, [playerName, profileImageUrl, score, personality.level]);

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

  const handleGenerateAndOpenPopup = async () => {
    soundEffects.playTap();
    setIsGenerating(true);
    setGenerationError(null);
    setPopupNotice(null);
    setExternalBrowserHint(null);

    try {
      const assets = await generateResultAssets({
        score,
        personality,
        playerName,
        profileImageUrl,
      });
      setGeneratedAssets(assets);
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

  const handlePopupDownload = () => {
    if (!generatedAssets) return;
    soundEffects.playTap();
    try {
      triggerBrowserDownload(generatedAssets.blob, generatedAssets.filename);
      setPopupNotice(
        inFacebookBrowser
          ? 'ডাউনলোডের অনুরোধ পাঠানো হয়েছে এবং Facebook গ্রুপ খোলা হচ্ছে। Facebook ব্রাউজারে ফাইল সেভ না হলে উপরের ছবির ওপর চেপে ধরে "Save Image" ব্যবহার করুন অথবা নিচের Open in External Browser অপশন দেখুন।'
          : 'ফটোকার্ড ডাউনলোড শুরু হয়েছে এবং আপনাকে সরাসরি আমাদের Facebook গ্রুপে নিয়ে যাওয়া হচ্ছে। ডাউনলোড না হলে এই ট্যাবে ফিরে এসে ছবিটি চেপে ধরে "Save Image" করুন।'
      );
    } catch {
      setPopupNotice(
        'সরাসরি ডাউনলোড শুরু করা যায়নি। দয়া করে উপরের ছবির ওপর চেপে ধরে "Save Image" ব্যবহার করুন বা শেয়ার অপশন চেষ্টা করুন।'
      );
    }
  };

  const handlePopupShare = async () => {
    if (!generatedAssets) return;
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

  const handleOpenExternalBrowser = () => {
    soundEffects.playTap();
    const outcome = attemptOpenInExternalBrowser();
    if (outcome === 'ios-manual') {
      setExternalBrowserHint(
        'iPhone-এ Facebook অ্যাপের ভেতর থেকে ওয়েবসাইট সরাসরি Safari খুলতে পারে না। অনুগ্রহ করে স্ক্রিনের নিচে বা উপরে থাকা মেনু (•••) আইকনে ট্যাপ করে "Open in Safari" বা "Open in External Browser" নির্বাচন করুন।'
      );
    } else if (outcome === 'android-intent') {
      setExternalBrowserHint(
        'বাইরের ব্রাউজারে (Chrome) খোলার চেষ্টা করা হচ্ছে। না খুললে উপরের ডানদিকের ⋮ মেনু থেকে "Open in Chrome / External Browser" নির্বাচন করুন।'
      );
    } else {
      setExternalBrowserHint(
        'বাইরের ব্রাউজারে খোলার চেষ্টা করা হয়েছে। না খুললে আপনার ব্রাউজার মেনু থেকে "Open in External Browser" নির্বাচন করে পেজটি খুলুন।'
      );
    }
  };

  const canNativeShare = generatedAssets
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
            <span>আপনার নাম ও ছবি শুধুমাত্র আপনার ব্রাউজারেই প্রসেস হয়, কোনো সার্ভারে পাঠানো হয় না।</span>
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
              : 'bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-[#FFFBF5]'
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
        <a
          href={FACEBOOK_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => soundEffects.playTap()}
          className="inline-flex items-center justify-center gap-2 w-full max-w-xs h-12 px-5 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white font-bold text-sm sm:text-base shadow-sm transition-all"
        >
          <span>গ্রুপে পোস্ট করুন</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* 5. Photocard Preview / Download Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="bg-[#FAF7F2] rounded-2xl max-w-md w-full p-4 sm:p-5 relative shadow-2xl border border-[#E3D4C1] flex flex-col items-center max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPopup(false)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-[#EAE0D2] hover:bg-[#DFCDBB] text-[#5C2C16] cursor-pointer"
              title="বন্ধ করুন"
              aria-label="পপআপ বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-[#381B0E] mb-3 pr-6 text-center">
              আপনার চা-খোর ফটোকার্ড
            </h3>

            {/* Photocard Preview or Generation Error */}
            {generatedAssets ? (
              <>
                <div className="w-full max-w-[300px] sm:max-w-[340px] mx-auto rounded-xl overflow-hidden border border-[#D8C7B5] shadow-xs aspect-[4/5] bg-white mb-2.5">
                  <img
                    src={generatedAssets.dataUrl}
                    alt="চা-খোর রেজাল্ট কার্ড"
                    className="w-full h-full object-contain"
                  />
                </div>

                <p className="text-xs text-center text-[#7C5A43] mb-3">
                  ডাউনলোডে ক্লিক করলে ছবি ডাউনলোডের পাশাপাশি আপনাকে সরাসরি Facebook গ্রুপে নিয়ে যাওয়া হবে। অটোমেটিক সেভ না হলে ছবিটি চেপে ধরে{' '}
                  <strong>&quot;Save Image&quot;</strong> /{' '}
                  <strong>&quot;Download image&quot;</strong> করুন।
                </p>

                {/* Primary Download (+ Direct Facebook Group) & Optional Share Actions */}
                <div className="w-full space-y-2.5 mb-3">
                  <a
                    href={FACEBOOK_GROUP_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handlePopupDownload}
                    className="w-full h-12 px-4 rounded-xl bg-gradient-to-r from-[#D97706] via-[#B45309] to-[#8B4513] hover:from-[#B45309] hover:to-[#78350F] active:scale-[0.98] text-[#FFF9F2] text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>ডাউনলোড করুন</span>
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

                {popupNotice && (
                  <div className="w-full mb-3 p-3 rounded-xl bg-[#FFF8EB] border border-[#EBD2AA] text-xs text-[#6E4733] leading-relaxed">
                    {popupNotice}
                  </div>
                )}
              </>
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

            {/* Facebook In-App Browser / Restricted Browser Fallback Section */}
            {!inFacebookBrowser && !showFallbackHelp && (
              <button
                type="button"
                onClick={() => setShowFallbackHelp(true)}
                className="mb-3 text-xs text-[#8B4513] hover:text-[#5C2C16] underline cursor-pointer"
              >
                ডাউনলোড করতে সমস্যা হচ্ছে?
              </button>
            )}

            {(inFacebookBrowser || showFallbackHelp) && (
              <div className="w-full mb-4 p-3.5 rounded-xl bg-amber-50/90 border border-amber-300 text-left space-y-2.5">
                <p className="text-xs font-bold text-[#5C2C16]">
                  {inFacebookBrowser
                    ? 'Facebook ব্রাউজার থেকে ডাউনলোডে সমস্যা হলে:'
                    : 'অটোমেটিক ডাউনলোড সীমিত হলে:'}
                </p>
                {isIOS ? (
                  <p className="text-xs text-[#6E4733] leading-relaxed">
                    iPhone-এ Facebook বা ইন-অ্যাপ ব্রাউজার থেকে সরাসরি ডাউনলোড সীমিত হতে পারে। স্ক্রিনের নিচে বা উপরে থাকা মেনু (<strong>•••</strong>) আইকনে ট্যাপ করে{' '}
                    <strong>Open in Safari</strong> বা{' '}
                    <strong>Open in External Browser</strong> বেছে নিন, অথবা উপরের ছবির ওপর চেপে ধরে ম্যানুয়ালি সেভ করুন।
                  </p>
                ) : isAndroid ? (
                  <p className="text-xs text-[#6E4733] leading-relaxed">
                    ইন-অ্যাপ ব্রাউজার থেকে ডাউনলোড না হলে নিচের বাটনে ট্যাপ করে Chrome বা বাইরের ব্রাউজারে খুলুন, অথবা উপরের ছবিটি চেপে ধরে ম্যানুয়ালি সেভ করুন।
                  </p>
                ) : (
                  <p className="text-xs text-[#6E4733] leading-relaxed">
                    অটোমেটিক ডাউনলোড কাজ না করলে বাইরের ব্রাউজারে পেজটি খুলুন অথবা ছবিটি চেপে ধরে / রাইট-ক্লিক করে ম্যানুয়ালি সেভ করুন।
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleOpenExternalBrowser}
                  className="w-full h-10 px-4 rounded-lg bg-[#5C2C16] hover:bg-[#451A03] text-[#FFF9F2] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in External Browser</span>
                </button>

                {externalBrowserHint && (
                  <p className="text-[11px] text-[#5C2C16] bg-white/80 p-2 rounded-lg border border-amber-200 leading-relaxed">
                    {externalBrowserHint}
                  </p>
                )}
              </div>
            )}

            {/* Always-Visible Facebook Group Invitation in Popup */}
            <div className="w-full pt-3 border-t border-[#E6D6C3] text-center space-y-2.5">
              <p className="text-sm font-bold text-[#381B0E]">
                আপনার চায়ের ব্যক্তিত্ব সবার সঙ্গে শেয়ার করুন!
              </p>
              <a
                href={FACEBOOK_GROUP_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundEffects.playTap()}
                className="w-full h-11 px-4 rounded-xl bg-[#1877F2] hover:bg-[#1464CC] active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
              >
                <span>Chakosh Facebook গ্রুপে পোস্ট করুন</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
