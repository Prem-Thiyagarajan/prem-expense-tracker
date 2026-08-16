// File: src/Wrapped/WrappedOverlay.tsx
//
// Full-screen Wrapped story overlay. handoff/README.md §Screens item 11 +
// §Motion + §Shape/shadow/spacing, and the interactive reference markup in
// `handoff/ExpenseTracker Web Prototype.dc.html` (search "wrappedDisplay" /
// "WRAPPED"). This is its own fixed dark field, independent of the app's
// light/dark theme toggle -- every colour below is hardcoded, none of it
// reads the bg/ink/card tokens.
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import type { WrappedStory } from './wrappedStories';

interface WrappedOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Full month name, e.g. "August" -- used for the "{MONTH} WRAPPED · n/N" label. */
  monthLabel: string;
  stories: WrappedStory[];
}

const WrappedOverlay: React.FC<WrappedOverlayProps> = ({ open, onClose, monthLabel, stories }) => {
  const [index, setIndex] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Always reopen on the first card -- mirrors the reference's
  // `openWrapped: () => this.setState({ wrapped: 0 })`.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  // Escape closes, same as the corner ✕.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || stories.length === 0) return null;

  const story = stories[index];
  const isFirst = index === 0;
  const isLast = index === stories.length - 1;

  // Left half = back (closes if already on the first card).
  // Right half = advance (closes if already on the last card).
  const goBack = () => (isFirst ? onClose() : setIndex((i) => i - 1));
  const goNext = () => (isLast ? onClose() : setIndex((i) => i + 1));

  const handleShare = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1E1B16',
        scale: 2,
      });
      const link = document.createElement('a');
      link.download = `${monthLabel.toLowerCase()}-wrapped-${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      // Best-effort: also put a ready-made caption on the clipboard for
      // whatever app the image gets shared through manually. Silently
      // ignored where the Clipboard API isn't available/permitted.
      navigator.clipboard?.writeText(story.shareText).catch(() => {});
    } catch {
      // Rendering the card client-side failed (e.g. unsupported browser) --
      // nothing to fall back to, just leave the overlay as-is.
    }
  };

  // Portal straight to <body>. This overlay is mounted deep inside the
  // Analytics page's own tree (not at the App/MainLayout root, unlike
  // MonthPickerModal/AssistantPanel), and something in that ancestor chain
  // was giving `fixed inset-0` a containing block other than the true
  // viewport -- it rendered a consistent ~24px gap at the top (the sticky
  // Navbar showing through) despite every transform/filter/contain/
  // perspective/will-change check on every ancestor coming back empty.
  // Portaling sidesteps the question entirely: <body> has none of those
  // properties, so this is guaranteed correct regardless of where in the
  // tree it's opened from.
  return createPortal(
    <div className="fixed inset-0 z-[100]" style={{ background: '#1E1B16' }}>
      <style>{'@keyframes wrappedFade { from { opacity: 0 } to { opacity: 1 } }'}</style>

      {/* Tap zones -- left half back, right half advance. */}
      <button
        type="button"
        aria-label="Previous card"
        onClick={goBack}
        className="absolute left-0 top-0 bottom-0 w-1/2 cursor-pointer appearance-none bg-transparent border-0 p-0 outline-none"
      />
      <button
        type="button"
        aria-label="Next card"
        onClick={goNext}
        className="absolute right-0 top-0 bottom-0 w-1/2 cursor-pointer appearance-none bg-transparent border-0 p-0 outline-none"
      />

      {/* Segmented progress bar -- one segment per card. */}
      <div className="absolute top-3.5 left-5 right-5 flex gap-1.5 pointer-events-none">
        {stories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full transition-[background-color] duration-bar ease-linear"
            style={{ background: i <= index ? '#FFD43B' : 'rgba(245,239,226,.22)' }}
          />
        ))}
      </div>

      {/* Corner close. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close Wrapped"
        className="absolute top-[30px] right-[26px] w-[34px] h-[34px] rounded-xl flex items-center justify-center font-body font-bold text-sm appearance-none bg-transparent cursor-pointer"
        style={{ border: '1.5px solid rgba(245,239,226,.45)', color: '#F5EFE2' }}
      >
        ✕
      </button>

      {/* Card content -- cross-fades ~200ms on advance (handoff/README.md §Motion). */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-10 text-center">
        <div
          key={index}
          ref={cardRef}
          style={{ animation: 'wrappedFade 200ms ease', background: '#1E1B16' }}
          className="flex flex-col items-center gap-[22px] py-6"
        >
          <div
            className="font-body font-semibold text-[10.5px]"
            style={{ color: '#FFD43B', letterSpacing: '0.24em' }}
          >
            {monthLabel.toUpperCase()} WRAPPED · {index + 1}/{stories.length}
          </div>
          <div
            className="font-heading font-extrabold text-[34px] leading-tight max-w-[620px]"
            style={{ color: '#F5EFE2', letterSpacing: '-0.02em' }}
          >
            {story.title}
          </div>
          <div
            className="w-[112px] h-[112px] rounded-full flex items-center justify-center text-5xl"
            style={{ background: story.circleColor, border: '2px solid #F5EFE2', boxShadow: '6px 6px 0 rgba(255,212,59,.28)' }}
          >
            {story.emoji}
          </div>
          <div
            className="font-money text-[66px] leading-none"
            style={{ color: '#F5EFE2', letterSpacing: '-0.03em' }}
          >
            {story.big}
          </div>
          <div className="font-body font-medium text-sm leading-relaxed max-w-[460px]" style={{ color: '#ABA28F' }}>
            {story.sub}
          </div>
        </div>
      </div>

      {/* Pinned share pill. */}
      <div className="absolute bottom-[38px] left-0 right-0 flex justify-center">
        <button
          type="button"
          onClick={handleShare}
          className="font-heading font-extrabold text-sm rounded-full px-[30px] py-[13px] cursor-pointer"
          style={{ background: '#FFD43B', border: '2px solid #F5EFE2', color: '#1E1B16' }}
        >
          Share ↗
        </button>
      </div>
    </div>,
    document.body
  );
};

export default WrappedOverlay;
