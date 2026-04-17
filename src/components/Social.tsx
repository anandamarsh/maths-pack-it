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
import { getGamePageUrl, getGameShareUrl } from "../config/game";

const DEFAULT_DISCUSSIT_URL = import.meta.env.PROD
  ? "https://discussit-widget.vercel.app"
  : "http://localhost:5001";
const LOCAL_DISCUSSIT_URL = (
  (import.meta.env.VITE_DISCUSSIT_URL as string | undefined) ?? DEFAULT_DISCUSSIT_URL
)
  .trim()
  .replace(/\/$/, "");

function getCommentsPageUrl() {
  return getGamePageUrl();
}

export function SocialShare() {
  const t = useT();
  const shareTitle = t("social.shareTitle");
  const shareUrl = getGameShareUrl();

  return (
    <div className="social-share-buttons">
      <TwitterShareButton url={shareUrl} title={shareTitle}>
        <span className="social-share-chip">
          <TwitterIcon size={36} round />
          <span>X</span>
        </span>
      </TwitterShareButton>
      <FacebookShareButton url={shareUrl} hashtag="#interactivemaths">
        <span className="social-share-chip">
          <FacebookIcon size={36} round />
          <span>Facebook</span>
        </span>
      </FacebookShareButton>
      <WhatsappShareButton url={shareUrl} title={shareTitle} separator=" - ">
        <span className="social-share-chip">
          <WhatsappIcon size={36} round />
          <span>WhatsApp</span>
        </span>
      </WhatsappShareButton>
      <LinkedinShareButton url={shareUrl} title={shareTitle} summary={shareTitle}>
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
