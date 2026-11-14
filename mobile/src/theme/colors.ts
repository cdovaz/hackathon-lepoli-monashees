/**
 * RIVIO — Design tokens e estilos oficiais (rivio.com.br)
 * Fonte: CSS real do site (tokens.css, base.css, site.css, home.css linhas 1–1321)
 * Tokens extraídos do Figma "Rivio Home v10", frame desktop de 1440 × 816.
 */

export const rivio = {
  // Paleta oficial 1.1 e 1.2
  palette: {
    light01: '#F7F9FF',        // Light Colors/Light-01: fundo do body, seções claras
    dark01: '#181B1F',         // Dark Colors/Dark-01: rail, superfícies de destaque, CTA
    dark02: '#31353D',         // Dark-02: texto padrão do body
    dark03: '#49505C',         // Dark-03: texto secundário
    dark05: '#7A8599',         // Dark-05: muted, base da barra de rolagem e do texto "apagado"
    blue: '#6694FF',           // Brand/Blue/Base: acento, foco, primário
    blueHover: '#4D7AE8',
    purple: '#E992FF',         // Brand/Purple/Base
    yellow: '#FFBE78',         // Brand/Yellow/Base
    superficie: '#F0F5FF',     // Superfície pálida de molduras de ícone/KPI
    superficieAlta: '#E2EBFF', // Superfície alta, nível acima
  },
  brand: {
    900: '#181B1F', // Dark-01
    800: '#31353D', // Dark-02
    700: '#49505C', // Dark-03
    600: '#6694FF', // Brand Blue Base oficial (botões, seleção, links)
    500: '#7DA4FF',
    400: '#6694FF', // "Pulso" e indicador ativo
    200: '#E2EBFF', // Superfície alta, foco
    100: '#F0F5FF', // Superfície pálida / molduras
    50:  '#F7F9FF', // Light-01
  },
  ink: {
    900: '#181B1F', // Dark-01
    700: '#31353D', // Dark-02
    600: '#49505C', // Dark-03
    400: '#7A8599', // Dark-05
  },
  surface: {
    base: '#F7F9FF',   // Light-01: Fundo da aplicação
    subtle: '#F0F5FF', // Superfície sutil
    card: '#FFFFFF',   // Cards brancos
    cardElevated: '#E2EBFF',
    line: 'rgba(49, 53, 61, 0.12)',
    fieldLine: '#CBD5E8',
  },
  clinical: {
    ok: { fg: '#15574C', bg: '#EEF8F4', border: '#C4DFD8' },
    warn: { fg: '#80520D', bg: '#FFF7E6', border: '#E8D4A6' },
    danger: { fg: '#9F1239', bg: '#FFF1F2', border: '#FECDD3' },
    info: { fg: '#2A68DF', bg: '#F0F5FF', border: '#E2EBFF' },
    neutral: { fg: '#49505C', bg: '#F0F5FF', border: '#DDE5F5' },
    ai: { fg: '#9030C0', bg: '#FBF0FF', border: '#EFC5FF' },
  },
  series: {
    hr: '#E0607E',
    hrv: '#6694FF',
    sleep: '#E992FF',
    spo2: '#3DA9FC',
    activity: '#FFBE78',
    lab: '#6694FF',
    refArea: 'rgba(102, 148, 255, 0.08)',
    medLine: '#6694FF',
  },
  radius: {
    marca: 2,
    chip: 4,
    caixa: 8,
    sm: 4,
    md: 8,
    lg: 16,
    pill: 1000,
  },
};

/**
 * Mapeamento legado compatível com componentes existentes
 */
export const theme = {
  colors: {
    background: rivio.surface.base,
    surface: rivio.surface.card,
    surfaceSubtle: rivio.surface.subtle,
    border: rivio.surface.line,
    borderHighlight: rivio.brand[200],
    fieldBorder: rivio.surface.fieldLine,
    secondaryBorder: '#CBD5E8',

    textPrimary: rivio.ink[900],
    textSecondary: rivio.ink[600],
    textMuted: rivio.ink[400],

    primary: rivio.brand[600],
    primaryDark: rivio.palette.blueHover,
    primaryLight: rivio.brand[50],
    primaryBorder: rivio.brand[200],
    primaryHighlight: rivio.brand[100],
    brandRail: rivio.brand[900],
    brandDot: rivio.palette.blue,

    secondary: rivio.clinical.info.fg,
    secondaryLight: rivio.clinical.info.bg,

    accentSuccess: rivio.clinical.ok.fg,
    accentSuccessLight: rivio.clinical.ok.bg,
    badgePositiveBg: rivio.clinical.ok.bg,
    badgePositiveText: rivio.clinical.ok.fg,
    badgePositiveBorder: rivio.clinical.ok.border,

    accentWarning: rivio.clinical.warn.fg,
    accentWarningLight: rivio.clinical.warn.bg,
    badgeWarningBg: rivio.clinical.warn.bg,
    badgeWarningText: rivio.clinical.warn.fg,
    badgeWarningBorder: rivio.clinical.warn.border,

    accentDanger: rivio.clinical.danger.fg,
    accentDangerLight: rivio.clinical.danger.bg,
    accentDangerBorder: rivio.clinical.danger.border,

    badgeNeutralBg: rivio.clinical.neutral.bg,
    badgeNeutralText: rivio.clinical.neutral.fg,
    badgeNeutralBorder: rivio.clinical.neutral.border,

    purple: rivio.palette.purple,
    purpleLight: rivio.clinical.ai.bg,
    aiBorder: rivio.clinical.ai.border,
  },
  shadows: {
    card: {
      shadowColor: '#181B1F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    hover: {
      shadowColor: '#6694FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 4,
    },
    danger: {
      shadowColor: '#9F1239',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 3,
    },
  },
  radius: rivio.radius,
};
