/** Blocking theme boot — keep STORAGE_KEY in sync with theme-provider.tsx */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("opsconcierge-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

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
