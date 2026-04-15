// src/hooks/useDemoRecorder.ts — Records demo video via getDisplayMedia + MediaRecorder

import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";

export type RecordingPhase = "idle" | "requesting" | "intro-prompt" | "intro" | "playing" | "outro" | "stopping";

interface Callbacks {
  /** Called after intro slide completes — should reset game + start autopilot */
  onStartPlaying: () => void;
  /** Called to prepare audio state for the recording */
  prepareAudio: () => void;
  /** Called if recording is stopped or cancelled */
  cleanupAudio: () => void;
}

export function useDemoRecorder(callbacksRef: React.RefObject<Callbacks>) {
  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    callbacksRef.current?.cleanupAudio();
    recorderRef.current = null;
    chunksRef.current = [];
    setRecordingPhase("idle");
  }, [callbacksRef]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return; // already recording

    // Switch the app to the intro scene first, then trigger the browser capture prompt.
    flushSync(() => {
      setRecordingPhase("intro-prompt");
    });

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
        // @ts-expect-error — preferCurrentTab is a newer Chrome API
        preferCurrentTab: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
          ? "video/webm;codecs=vp8,opus"
          : "video/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        downloadBlob(blob);
        cleanup();
      };

      // If user stops sharing via browser chrome
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
        cleanup();
      });

      recorderRef.current = recorder;

      // Give the intro overlay a moment to paint before the first recorded frame.
      await new Promise((resolve) => window.setTimeout(resolve, 280));

      // Prepare audio state immediately before recording begins.
      callbacksRef.current?.prepareAudio();
      recorder.start(1000);
      setRecordingPhase("intro");
    } catch {
      cleanup();
    }
  }, [callbacksRef, cleanup]);

  /** Called when intro slide finishes — transition to gameplay */
  const onIntroComplete = useCallback(() => {
    setRecordingPhase("playing");
    callbacksRef.current?.onStartPlaying();
  }, [callbacksRef]);

  /** Called when autopilot finishes final level — show outro slide */
  const showOutro = useCallback(() => {
    setRecordingPhase("outro");
  }, []);

  /** Called when outro slide finishes — stop recording and download */
  const onOutroComplete = useCallback(() => {
    setRecordingPhase("stopping");
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop(); // triggers onstop → download → cleanup
    } else {
      cleanup();
    }
  }, [cleanup]);

  /** Manual cancel */
  const cancelRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      // Don't download — just stop and clean up
      recorderRef.current.onstop = () => cleanup();
      recorderRef.current.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  return {
    recordingPhase,
    isRecording: recordingPhase !== "idle",
    startRecording,
    onIntroComplete,
    showOutro,
    onOutroComplete,
    cancelRecording,
  };
}

function downloadBlob(blob: Blob) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:.]/g, "-");
  const fileName = `ripple-touch-demo-${stamp}.webm`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
