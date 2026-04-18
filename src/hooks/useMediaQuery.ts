import { useEffect, useState } from "react";

const COMPACT_VIEWPORT_MIN_DIMENSION_PX = 480;
const COMPACT_VIEWPORT_MIN_AREA_PX = 500_000;

function isCompactViewportSize(width: number, height: number) {
  const shortestEdge = Math.min(width, height);
  const viewportArea = width * height;

  return (
    shortestEdge < COMPACT_VIEWPORT_MIN_DIMENSION_PX ||
    viewportArea < COMPACT_VIEWPORT_MIN_AREA_PX
  );
}

function readViewportFlags() {
  if (typeof window === "undefined") {
    return {
      isCompactViewport: false,
      isCompactLandscape: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const isCompactViewport = isCompactViewportSize(width, height);

  return {
    isCompactViewport,
    isCompactLandscape: isCompactViewport && width > height,
  };
}

export function useIsMobileLandscape() {
  const [is, setIs] = useState(() => readViewportFlags().isCompactLandscape);
  useEffect(() => {
    const update = () => setIs(readViewportFlags().isCompactLandscape);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return is;
}

export function useIsCoarsePointer() {
  const [is, setIs] = useState(() => readViewportFlags().isCompactViewport);
  useEffect(() => {
    const update = () => setIs(readViewportFlags().isCompactViewport);
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return is;
}
