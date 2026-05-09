export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        'input-background': 'var(--input-background)',
        sidebar: 'var(--sidebar)',
        'sidebar-foreground': 'var(--sidebar-foreground)',
        'neumo-bg': '#eef0f3',
        'neumo-surface': '#e6e9ec',
        'accent-muted': '#6b7a8a',
        'accent-strong': '#3b82f6'
      },
      borderRadius: {
        sm: 'calc(var(--radius) - 0.5rem)',
        md: 'calc(var(--radius) - 0.375rem)',
        lg: 'calc(var(--radius) - 0.25rem)',
        xl: 'var(--radius)',
        '2xl': 'calc(var(--radius) + 0.5rem)'
      },
      boxShadow: {
        light: 'var(--shadow-light)',
        dark: 'var(--shadow-dark)',
        raised: 'var(--shadow-raised)',
        inset: 'var(--shadow-inset)',
        active: 'var(--shadow-active)',
        glow: 'var(--shadow-glow)',
        'neumo-out': '6px 6px 12px rgba(0,0,0,0.06), -6px -6px 12px rgba(255,255,255,0.9)',
        'neumo-in': 'inset 6px 6px 12px rgba(0,0,0,0.04), inset -6px -6px 12px rgba(255,255,255,0.9)'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif']
      }
    }
  },
  plugins: []
};
