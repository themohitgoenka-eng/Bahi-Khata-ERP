// Design System Tokens: Premium Dark Blue Glassmorphism / Frosted Glass UI

export const THEME = {
  colors: {
    mainBg: '#06111F',
    secondaryBg: '#081A2D',
    deepNavy: '#0A2036',
    surface: 'rgba(18, 48, 76, 0.48)',
    surfaceLight: 'rgba(32, 70, 105, 0.42)',
    surfaceDark: 'rgba(8, 27, 46, 0.62)',
    sidebar: 'rgba(7, 25, 43, 0.72)',
    header: 'rgba(12, 35, 58, 0.58)',
    card: 'rgba(18, 48, 76, 0.45)',
    cardHover: 'rgba(55, 120, 175, 0.18)',
    input: 'rgba(8, 30, 51, 0.55)',
    reportSolid: '#081A2D',
    primaryAccent: '#2588E8',
    brightBlue: '#39A7FF',
    cyanAccent: '#52C7FF',
    button: '#2588E8',
    primaryBtn: '#2588E8',
    btnText: '#F1F7FC',
    mainText: '#F1F7FC',
    secondaryText: '#B7C9D9',
    mutedText: '#7F98AE',
    disabledText: '#5C7184',
    border: 'rgba(112, 185, 245, 0.28)',
    borderStrong: 'rgba(100, 190, 255, 0.45)',
    hover: 'rgba(55, 120, 175, 0.18)',
    activeNav: 'rgba(37, 136, 232, 0.20)',
    positiveCredit: '#55D68A',
    negativeDebit: '#FF647C',
    warning: '#F2C94C',
    purpleAccent: '#9B7CFF',
    information: '#52C7FF',
    glassBg: 'rgba(18, 48, 76, 0.42)',
  },
  typography: {
    primaryFont: "'Inter', sans-serif",
    displayFont: "'DM Serif Display', serif",
    hierarchy: {
      pageTitle: 'text-2xl sm:text-3xl font-semibold tracking-tight text-[#F1F7FC]',
      sectionTitle: 'text-lg sm:text-xl font-semibold text-[#F1F7FC]',
      cardTitle: 'text-sm sm:text-base font-semibold text-[#F1F7FC]',
      body: 'text-sm font-normal text-[#F1F7FC]',
      secondary: 'text-xs text-[#B7C9D9]',
      muted: 'text-xs text-[#7F98AE]',
      button: 'text-xs sm:text-sm font-medium',
      financialAmount: 'text-lg sm:text-xl font-semibold font-mono tracking-tight text-[#F1F7FC]',
    },
  },
  classes: {
    // Glassmorphic surfaces
    glassPanel:
      'bg-[rgba(18,48,76,0.48)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_35px_rgba(0,0,0,0.30),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-[20px]',
    glassCard:
      'bg-[rgba(18,48,76,0.45)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.25)] shadow-[0_12px_30px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-[18px] transition-all duration-180 hover:-translate-y-0.5 hover:border-[rgba(100,190,255,0.45)]',
    solidCard:
      'bg-[rgba(18,48,76,0.45)] backdrop-blur-[16px] border border-[rgba(112,185,245,0.25)] shadow-[0_8px_24px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] rounded-[16px]',
    reportCard:
      'bg-[rgba(13,38,62,0.48)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.22)] shadow-[0_12px_30px_rgba(0,0,0,0.25)] rounded-[18px]',
    
    // Inputs & Forms
    input:
      'bg-[rgba(8,30,51,0.55)] border border-[rgba(112,185,245,0.22)] text-[#F1F7FC] placeholder:text-[#7F98AE] focus:outline-none focus:border-[#39A7FF] focus:ring-2 focus:ring-[#39A7FF]/20 rounded-xl px-3 py-2 text-xs transition duration-180',
    inputLabel:
      'block text-xs font-medium text-[#B7C9D9] mb-1 tracking-wide',

    // Buttons
    btnPrimary:
      'bg-gradient-to-br from-[rgba(37,136,232,0.90)] to-[rgba(42,107,180,0.90)] hover:brightness-110 active:brightness-95 text-[#F1F7FC] border border-[rgba(82,199,255,0.45)] shadow-[0_6px_18px_rgba(37,136,232,0.20)] font-semibold px-3.5 py-1.5 rounded-xl text-xs transition duration-180 cursor-pointer flex items-center justify-center gap-1.5',
    btnSecondary:
      'bg-[rgba(30,67,98,0.55)] hover:bg-[rgba(55,120,175,0.30)] text-[#B7C9D9] hover:text-[#F1F7FC] border border-[rgba(112,185,245,0.25)] font-medium px-3.5 py-1.5 rounded-xl text-xs transition duration-180 cursor-pointer flex items-center justify-center gap-1.5',
    btnDanger:
      'bg-[rgba(255,100,124,0.12)] hover:bg-[rgba(255,100,124,0.22)] text-[#FF647C] border border-[rgba(255,100,124,0.35)] font-medium px-3.5 py-1.5 rounded-xl text-xs transition duration-180 cursor-pointer flex items-center justify-center gap-1.5',
    btnSuccess:
      'bg-[rgba(85,214,138,0.12)] hover:bg-[rgba(85,214,138,0.22)] text-[#55D68A] border border-[rgba(85,214,138,0.35)] font-medium px-3.5 py-1.5 rounded-xl text-xs transition duration-180 cursor-pointer flex items-center justify-center gap-1.5',

    // Tables
    tableWrapper:
      'bg-[rgba(13,38,62,0.48)] backdrop-blur-[18px] border border-[rgba(112,185,245,0.22)] rounded-[18px] overflow-hidden shadow-[0_12px_35px_rgba(0,0,0,0.30)]',
    tableHeader:
      'bg-[rgba(35,76,112,0.25)] text-[#B7C9D9] text-[11px] font-semibold uppercase tracking-wider border-b border-[rgba(112,185,245,0.18)]',
    tableRow:
      'border-b border-[rgba(112,185,245,0.08)] hover:bg-[rgba(57,167,255,0.08)] transition-colors duration-180',
    tableRowSelected:
      'bg-[rgba(37,136,232,0.14)] border-b border-[rgba(112,185,245,0.18)]',

    // Status Badges
    badgeAvailable:
      'bg-[rgba(85,214,138,0.15)] text-[#55D68A] border border-[rgba(85,214,138,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
    badgeLowStock:
      'bg-[rgba(242,201,76,0.15)] text-[#F2C94C] border border-[rgba(242,201,76,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
    badgeOutOfStock:
      'bg-[rgba(255,100,124,0.15)] text-[#FF647C] border border-[rgba(255,100,124,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
    badgeInProgress:
      'bg-[rgba(37,136,232,0.15)] text-[#39A7FF] border border-[rgba(37,136,232,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
    badgeInfo:
      'bg-[rgba(82,199,255,0.15)] text-[#52C7FF] border border-[rgba(82,199,255,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
    badgePurple:
      'bg-[rgba(155,124,255,0.15)] text-[#9B7CFF] border border-[rgba(155,124,255,0.35)] text-[10px] font-medium px-2.5 py-0.5 rounded-full',
  },
} as const;
