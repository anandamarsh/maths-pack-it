import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinIcon,
  LinkedinShareButton,
  TwitterIcon,
  TwitterShareButton,
  WhatsappIcon,
  WhatsappShareButton,
} from "react-share";
import { useT } from "../i18n";

const SHARE_URL = "https://interactive-maths.vercel.app/";
const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? "https://discussit-widget.vercel.app"
  : "http://localhost:5001";
const LOCAL_DISCUSSIT_URL = (
  (import.meta.env.VITE_DISCUSSIT_URL as string | undefined) ?? DEFAULT_DISCUSSIT_URL
)
  .trim()
  .replace(/\/$/, "");

function getCommentsPageUrl() {
  if (typeof window === "undefined") return SHARE_URL;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("level");
    url.searchParams.delete("demo");
    return url.toString();
  } catch {
    return window.location.href;
  }
}

export function SocialShare() {
  const t = useT();
  const shareTitle = t("social.shareTitle");

  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={SHARE_URL} title={shareTitle}>
        <span className="social-share-chip">
          <TwitterIcon size={36} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={SHARE_URL} hashtag="#interactivemaths">
        <span className="social-share-chip">
          <FacebookIcon size={36} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={SHARE_URL} title={shareTitle} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={36} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={SHARE_URL} title={shareTitle} summary={shareTitle}>
        <span className="social-share-chip">
          <LinkedinIcon size={36} round />
          <span>LinkedIn</span>
        </span>
      </LinkedinShareButton>
    </div>
  );
}

export function SocialComments() {
  const t = useT();
  const pageUrl = getCommentsPageUrl();
  const iframeUrl = `${LOCAL_DISCUSSIT_URL}/?url=${encodeURIComponent(pageUrl)}&theme=dark`;

  return (
    <div style={{ padding: "0", height: "100%", boxSizing: "border-box" }}>
      <iframe
        data-discussit-comments="true"
        src={iframeUrl}
        title={t("social.commentsTitle")}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          border: 0,
          borderRadius: "0",
          background: "transparent",
        }}
      />
    </div>
  );
}

export function openCommentsComposer() {
  const frame = document.querySelector('iframe[data-discussit-comments="true"]') as HTMLIFrameElement | null;
  frame?.contentWindow?.postMessage({ type: "discussit:open-composer" }, "*");
}
