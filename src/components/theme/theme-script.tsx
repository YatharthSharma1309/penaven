/**
 * Blocking theme boot. Keep STORAGE_KEY and the rule in sync with theme-provider.tsx:
 * a theme picked with the toggle wins, otherwise the operating system's setting.
 */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("opsconcierge-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d){r.classList.add("dark");r.style.colorScheme="dark";}else{r.style.colorScheme="light";}}catch(e){}})();`;

/**
 * A raw inline script, not next/script: `beforeInteractive` is queued until the
 * client bundle loads, which flashes the light theme for dark-theme users.
 */
export function ThemeScript() {
  return (
    <script
      id="opsconcierge-theme-boot"
      dangerouslySetInnerHTML={{ __html: THEME_BOOT }}
    />
  );
}
