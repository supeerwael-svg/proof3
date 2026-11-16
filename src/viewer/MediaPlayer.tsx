import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Maximize, Minimize, PictureInPicture2, RotateCcw, Volume2, VolumeX,
} from 'lucide-react';

interface MediaPlayerProps {
  url: string;
  kind: 'audio' | 'video';
  mimeType: string;
  fileId: string;
  resumeKey: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// Custom audio/video player with speed, resume, PiP, fullscreen, keyboard shortcuts.
export function MediaPlayer({ url, kind, mimeType, resumeKey }: MediaPlayerProps) {
  const ref = useRef<HTMLMediaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [resumeFrom, setResumeFrom] = useState<number | null>(null);
  const speedMenuOpen = useRef(false);

  // load last position
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`tp_media_${resumeKey}`);
      if (raw) {
        const saved = parseFloat(raw);
        if (saved > 5 && !isNaN(saved)) setResumeFrom(saved);
      }
    } catch { /* ignore */ }
  }, [resumeKey]);

  // save position periodically
  useEffect(() => {
    const id = setInterval(() => {
      const el = ref.current;
      if (el && el.currentTime > 5 && !el.ended) {
        try { localStorage.setItem(`tp_media_${resumeKey}`, String(el.currentTime)); } catch { /* ignore */ }
      }
    }, 3000);
    return () => clearInterval(id);
  }, [resumeKey]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); } else { el.pause(); }
  }, []);

  const seek = useCallback((delta: number) => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
  }, []);

  const setRate = (r: number) => {
    setSpeed(r);
    if (ref.current) ref.current.playbackRate = r;
    speedMenuOpen.current = false;
  };

  const toggleFullscreen = async () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreen(false);
      } else if (kind === 'video') {
        await wrap.requestFullscreen();
        setFullscreen(true);
      }
    } catch { /* unsupported */ }
  };

  const togglePip = async () => {
    const el = ref.current as (HTMLVideoElement | null);
    if (!el || kind !== 'video') return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch { /* unsupported */ }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setTime(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      try { localStorage.removeItem(`tp_media_${resumeKey}`); } catch { /* ignore */ }
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
    };
  }, [resumeKey, url]);

  const fmt = (t: number) => {
    if (!isFinite(t)) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const applyResume = () => {
    const el = ref.current;
    if (el && resumeFrom) {
      el.currentTime = resumeFrom;
      setResumeFrom(null);
      el.play().catch(() => {});
    }
  };

  return (
    <div ref={wrapRef} className="w-full flex flex-col items-center justify-center p-4 gap-4" style={{ background: '#000' }}>
      {kind === 'video' ? (
        <video
          ref={ref as React.RefObject<HTMLVideoElement>}
          src={url}
          className="max-w-full max-h-[70vh] rounded-lg"
          playsInline
          onClick={toggle}
          onLoadedMetadata={applyResume}
        />
      ) : (
        <div className="w-full max-w-md flex flex-col items-center gap-3 pt-8">
          <div className="w-24 h-24 rounded-full bg-primary-600 flex items-center justify-center">
            <Play size={36} className="text-white ms-1" fill="currentColor" />
          </div>
          <audio ref={ref as React.RefObject<HTMLAudioElement>} src={url} onLoadedMetadata={applyResume} className="hidden" />
        </div>
      )}

      {/* Controls */}
      <div className="w-full max-w-md flex flex-col gap-2 bg-slate-900/95 rounded-2xl p-3">
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.1}
          value={time}
          onChange={e => { if (ref.current) ref.current.currentTime = parseFloat(e.target.value); }}
          className="w-full accent-primary-500"
          style={{ accentColor: 'var(--c-primary-500)' }}
        />
        <div className="flex items-center justify-between text-white/80 text-xs font-mono">
          <span>{fmt(time)}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => seek(-10)} className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="back 10s">
              <RotateCcw size={18} />
            </button>
            <button onClick={toggle} className="p-3 rounded-full bg-primary-600 text-white min-w-[48px] min-h-[48px] flex items-center justify-center" aria-label="play/pause">
              {playing ? <Pause size={22} /> : <Play size={22} className="ms-0.5" />}
            </button>
            <button onClick={() => seek(10)} className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="forward 10s">
              <SkipForward size={18} className="scale-x-[-1] rotate-180 hidden" />
            </button>
            <button onClick={() => seek(10)} className="p-2 rounded-lg hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="fwd 10s">
              <SkipBack size={18} className="rotate-180" />
            </button>
          </div>
          <span>{fmt(duration)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
          <button
            onClick={() => setMuted(m => !m)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80"
            aria-label="mute"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="flex gap-1">
            {SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setRate(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold min-w-[36px] min-h-[36px] transition-colors ${
                  speed === s ? 'bg-primary-600 text-white' : 'text-white/70 hover:bg-white/10'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          {kind === 'video' && (
            <>
              <button onClick={togglePip} className="p-2 rounded-lg hover:bg-white/10 text-white/80" aria-label="pip">
                <PictureInPicture2 size={18} />
              </button>
              <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white/80" aria-label="fullscreen">
                {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </>
          )}
        </div>
      </div>
      <span className="hidden">{mimeType}</span>
    </div>
  );
}
