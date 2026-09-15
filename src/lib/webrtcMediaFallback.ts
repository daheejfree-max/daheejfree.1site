// ==============================================================================
// WEBRTC MEDIA FALLBACK ENGINE (src/lib/webrtcMediaFallback.ts)
// Provides bulletproof media acquisition with synthetic canvas & WebAudio fallbacks
// Prevents WebRTC calls from hanging on "Acquiring Media..." in restricted iframes or missing hardware
// ==============================================================================

export interface AcquiredMediaResult {
  stream: MediaStream;
  isSynthetic: boolean;
  isAudioOnly: boolean;
  error?: string;
  diagnostic?: {
    code: 'permission_denied' | 'device_in_use' | 'not_found' | 'timeout' | 'unknown';
    message: string;
  };
}

/**
 * Creates a synthetic silent WebAudio track
 */
function createSyntheticAudioTrack(): MediaStreamTrack {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // Muted / silent
      osc.connect(gain);
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();
      const track = dest.stream.getAudioTracks()[0];
      if (track) return track;
    }
  } catch (e) {
    console.warn('[MediaFallback] WebAudio synthetic generator notice:', e);
  }

  // Fallback empty audio track if WebAudio is unavailable
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const dummyStream = (canvas as any).captureStream ? (canvas as any).captureStream(1) : new MediaStream();
  return dummyStream.getAudioTracks()[0] || (dummyStream.getVideoTracks()[0] as any);
}

/**
 * Creates an animated canvas video track with user initials and encryption shield
 */
function createSyntheticVideoTrack(label: string = 'You'): { track: MediaStreamTrack; cleanup: () => void } {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d')!;

  let animationFrameId: number;
  let angle = 0;

  function render() {
    if (!ctx) return;
    angle += 0.03;

    // Dark sleek gradient background
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#09090b');
    grad.addColorStop(1, '#18181b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing subtle outer ring
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2 - 20;
    const radius = 65 + Math.sin(angle) * 3;

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#10b981';
    ctx.stroke();
    ctx.restore();

    // Initials Avatar Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, 52, 0, Math.PI * 2);
    ctx.fillStyle = '#059669';
    ctx.fill();
    ctx.restore();

    // Initial Letter
    ctx.save();
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label.charAt(0).toUpperCase() || 'U', centerX, centerY);
    ctx.restore();

    // Subtitle label
    ctx.save();
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#f4f4f5';
    ctx.textAlign = 'center';
    ctx.fillText(label, centerX, centerY + 85);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText('Encrypted Shariah Stream', centerX, centerY + 105);
    ctx.restore();

    animationFrameId = requestAnimationFrame(render);
  }

  render();

  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(20) : new MediaStream();
  const track = stream.getVideoTracks()[0];

  return {
    track,
    cleanup: () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    },
  };
}

/**
 * Acquire media stream with robust fallback and timeout
 */
export async function acquireMediaWithFallback(options: {
  video?: boolean;
  audio?: boolean;
  userLabel?: string;
  timeoutMs?: number;
}): Promise<AcquiredMediaResult> {
  const wantsVideo = options.video !== false;
  const wantsAudio = options.audio !== false;
  const label = options.userLabel || 'You';
  const timeout = options.timeoutMs || 7000;
  let diagnosticInfo: AcquiredMediaResult['diagnostic'] = undefined;

  // 1. Try real hardware getUserMedia with a 7-second timeout promise
  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    // Helper to race a getUserMedia call with timeout
    const tryGetUserMediaWithTimeout = async (constraints: MediaStreamConstraints, ms: number) => {
      let timer: any;
      const timeoutPromise = new Promise<{ stream: null; timedOut: boolean }>((resolve) => {
        timer = setTimeout(() => resolve({ stream: null, timedOut: true }), ms);
      });

      try {
        const streamPromise = navigator.mediaDevices.getUserMedia(constraints).then((stream) => ({
          stream,
          timedOut: false,
        }));
        const result = await Promise.race([streamPromise, timeoutPromise]);
        clearTimeout(timer);
        return result;
      } catch (err: any) {
        clearTimeout(timer);
        throw err;
      }
    };

    try {
      // Step A: Attempt audio + video if video is requested
      if (wantsVideo) {
        try {
          const result = await tryGetUserMediaWithTimeout(
            {
              audio: wantsAudio ? { echoCancellation: true, noiseSuppression: true } : false,
              video: {
                width: { ideal: 640, max: 1280 },
                height: { ideal: 480, max: 720 },
                facingMode: 'user',
              },
            },
            timeout
          );

          if (result.stream && result.stream.getTracks().length > 0) {
            return {
              stream: result.stream,
              isSynthetic: false,
              isAudioOnly: false,
            };
          }

          if (result.timedOut) {
            console.warn('[MediaFallback] Audio+Video acquisition timed out after 7s, falling back to audio-only...');
            diagnosticInfo = {
              code: 'timeout',
              message: 'Camera acquisition timed out after 7 seconds. Retrying audio only.',
            };
          }
        } catch (vidErr: any) {
          console.warn('[MediaFallback] Video acquisition failed:', vidErr?.name, vidErr?.message);
          if (vidErr?.name === 'NotAllowedError' || vidErr?.name === 'PermissionDeniedError') {
            diagnosticInfo = {
              code: 'permission_denied',
              message: 'Camera permission denied. Check your browser settings.',
            };
          } else if (vidErr?.name === 'NotReadableError' || vidErr?.name === 'TrackStartError') {
            diagnosticInfo = {
              code: 'device_in_use',
              message: 'Camera is currently in use by another application.',
            };
          } else if (vidErr?.name === 'NotFoundError' || vidErr?.name === 'DevicesNotFoundError') {
            diagnosticInfo = {
              code: 'not_found',
              message: 'No camera hardware found on this device.',
            };
          }
        }

        // Step B: Seamlessly fallback to audio-only if video failed or timed out
        if (wantsAudio) {
          try {
            console.info('[MediaFallback] Seamlessly attempting audio-only fallback...');
            const audioResult = await tryGetUserMediaWithTimeout(
              { audio: { echoCancellation: true, noiseSuppression: true } },
              timeout
            );

            if (audioResult.stream && audioResult.stream.getTracks().length > 0) {
              return {
                stream: audioResult.stream,
                isSynthetic: false,
                isAudioOnly: true,
                error: 'Camera unavailable or timed out. Switched seamlessly to voice-only mode.',
              };
            }
          } catch (audioErr: any) {
            console.warn('[MediaFallback] Audio-only fallback also failed:', audioErr?.name, audioErr?.message);
            if (audioErr?.name === 'NotAllowedError' || audioErr?.name === 'PermissionDeniedError') {
              diagnosticInfo = {
                code: 'permission_denied',
                message: 'Microphone permission denied. Please allow microphone access.',
              };
            } else if (audioErr?.name === 'NotReadableError' || audioErr?.name === 'TrackStartError') {
              diagnosticInfo = {
                code: 'device_in_use',
                message: 'Microphone is currently in use by another application.',
              };
            }
          }
        }
      } else if (wantsAudio) {
        // Only audio was requested
        try {
          const audioResult = await tryGetUserMediaWithTimeout(
            { audio: { echoCancellation: true, noiseSuppression: true } },
            timeout
          );

          if (audioResult.stream && audioResult.stream.getTracks().length > 0) {
            return {
              stream: audioResult.stream,
              isSynthetic: false,
              isAudioOnly: true,
            };
          }
        } catch (audioErr: any) {
          console.warn('[MediaFallback] Audio acquisition failed:', audioErr?.name, audioErr?.message);
          if (audioErr?.name === 'NotAllowedError' || audioErr?.name === 'PermissionDeniedError') {
            diagnosticInfo = {
              code: 'permission_denied',
              message: 'Microphone permission denied. Please allow microphone access.',
            };
          } else if (audioErr?.name === 'NotReadableError' || audioErr?.name === 'TrackStartError') {
            diagnosticInfo = {
              code: 'device_in_use',
              message: 'Microphone is currently in use by another application.',
            };
          }
        }
      }
    } catch (err: any) {
      console.warn('[MediaFallback] Hardware media acquisition non-fatal error:', err?.message || err);
    }
  }

  // 2. Hardware failed or timed out: Build resilient synthetic MediaStream
  console.info('[MediaFallback] Initializing synthetic stream for uninterrupted WebRTC connectivity...');
  const syntheticStream = new MediaStream();

  if (wantsVideo) {
    try {
      const { track } = createSyntheticVideoTrack(label);
      if (track) syntheticStream.addTrack(track);
    } catch (e) {
      console.warn('[MediaFallback] Video canvas generation notice:', e);
    }
  }

  if (wantsAudio) {
    try {
      const audioTrack = createSyntheticAudioTrack();
      if (audioTrack) syntheticStream.addTrack(audioTrack);
    } catch (e) {
      console.warn('[MediaFallback] Audio synthetic generator notice:', e);
    }
  }

  const errorMessage =
    diagnosticInfo?.message ||
    'Hardware camera or microphone was not immediately accessible (in use, timed out, or permission blocked). Connected with Privacy Stream.';

  return {
    stream: syntheticStream,
    isSynthetic: true,
    isAudioOnly: !wantsVideo,
    error: errorMessage,
    diagnostic: diagnosticInfo || {
      code: 'device_in_use',
      message: errorMessage,
    },
  };
}
