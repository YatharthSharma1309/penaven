export const WIDGET_MESSAGE_TYPE = "opsconcierge-widget";

const CLOSED_SIZE = { width: 88, height: 88 };
const OPEN_SIZE = { width: 420, height: 720 };

export function buildWidgetLauncherScript(embedUrl: string): string {
  return `<script>
  (function () {
    var iframe = document.createElement("iframe");
    iframe.src = ${JSON.stringify(embedUrl)};
    iframe.title = "Penaven chat widget";
    iframe.setAttribute("allow", "clipboard-write");
    function applySize(open) {
      var size = open
        ? { width: ${OPEN_SIZE.width}, height: ${OPEN_SIZE.height} }
        : { width: ${CLOSED_SIZE.width}, height: ${CLOSED_SIZE.height} };
      iframe.style.cssText =
        "border:0;position:fixed;z-index:9999;background:transparent;pointer-events:auto;" +
        "right:16px;bottom:16px;width:" + size.width + "px;height:" + size.height + "px;" +
        "max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);";
    }
    applySize(false);
    window.addEventListener("message", function (event) {
      var data = event && event.data;
      if (!data || data.type !== ${JSON.stringify(WIDGET_MESSAGE_TYPE)}) return;
      if (typeof data.open === "boolean") applySize(data.open);
    });
    document.body.appendChild(iframe);
  })();
</script>`;
}

export function buildWidgetIframeMarkup(embedUrl: string): string {
  return `<iframe
  src="${embedUrl}"
  title="Penaven chat widget"
  allow="clipboard-write"
  style="border:0;position:fixed;right:16px;bottom:16px;width:${CLOSED_SIZE.width}px;height:${CLOSED_SIZE.height}px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);z-index:9999;background:transparent;pointer-events:auto"
></iframe>
<script>
  (function () {
    var iframe = document.currentScript && document.currentScript.previousElementSibling;
    if (!iframe || iframe.tagName !== "IFRAME") return;
    window.addEventListener("message", function (event) {
      var data = event && event.data;
      if (!data || data.type !== "${WIDGET_MESSAGE_TYPE}") return;
      if (typeof data.open !== "boolean") return;
      var size = data.open
        ? { width: ${OPEN_SIZE.width}, height: ${OPEN_SIZE.height} }
        : { width: ${CLOSED_SIZE.width}, height: ${CLOSED_SIZE.height} };
      iframe.style.width = size.width + "px";
      iframe.style.height = size.height + "px";
    });
  })();
</script>`;
}
