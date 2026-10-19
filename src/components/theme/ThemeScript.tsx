// Runs in the document head before the first paint. Light is the explicit default.
export function ThemeScript() {
  return (
    <script
      id="landimotos-theme"
      dangerouslySetInnerHTML={{ __html: `(() => {
        let theme = 'light';
        try { if (localStorage.getItem('landimotos-theme') === 'dark') theme = 'dark'; } catch {}
        document.documentElement.dataset.theme = theme;
        document.documentElement.style.colorScheme = theme;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = theme === 'dark' ? '#0e0f11' : '#ffffff';
      })();` }}
    />
  )
}
