import Script from "next/script";

/** Blocking theme boot — keep STORAGE_KEY in sync with theme-provider.tsx */
const THEME_BOOT = `(function(){try{var t=localStorage.getItem("opsconcierge-theme");if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

export function ThemeScript() {
  return (
    <Script id="opsconcierge-theme-boot" strategy="beforeInteractive">
      {THEME_BOOT}
    </Script>
  );
}
