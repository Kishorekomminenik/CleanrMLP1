// SHINE Design System
// Consistent tokens and components for MVP E2E build

export const DesignTokens = {
  colors: {
    primary: '#3A8DFF',
    primaryText: '#FFFFFF',
    bg: '#FFFFFF',
    muted: '#6C757D',
    danger: '#E4483B',
    success: '#22C55E',
    border: '#F2F4F7',
    focus: '#3A8DFF',
    disabledBg: '#C9D5F1',
    disabledText: '#F0F4FF',
    
    // Surge styling
    surgeChip: {
      bg: '#FEF3C7',
      border: '#F59E0B',
      text: '#92400E'
    },
    
    // Disclaimer styling  
    disclaimer: {
      bg: '#FEF3C7',
      border: '#F59E0B',
      text: '#92400E'
    }
  },
  
  typography: {
    fontFamily: 'Inter',
    h1: 24,
    h2: 20,
    body: 16,
    small: 14
  },
  
  radius: 12,
  elevation: 2,
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24
  }
};

export const ButtonVariants = {
  primary: {
    backgroundColor: DesignTokens.colors.primary,
    color: DesignTokens.colors.primaryText,
    borderRadius: DesignTokens.radius,
    fontWeight: '600' as const,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0
  },
  
  secondary: {
    backgroundColor: '#EEF4FF',
    color: DesignTokens.colors.primary,
    borderRadius: DesignTokens.radius,
    fontWeight: '600' as const,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: DesignTokens.colors.primary
  },
  
  danger: {
    backgroundColor: DesignTokens.colors.danger,
    color: DesignTokens.colors.primaryText,
    borderRadius: DesignTokens.radius,
    fontWeight: '600' as const,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0
  },
  
  ghost: {
    backgroundColor: 'transparent',
    color: DesignTokens.colors.primary,
    borderRadius: DesignTokens.radius,
    fontWeight: '600' as const,
    minHeight: 44,  
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0
  },
  
  disabled: {
    backgroundColor: DesignTokens.colors.disabledBg,
    color: DesignTokens.colors.disabledText,
    borderRadius: DesignTokens.radius,
    fontWeight: '600' as const,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 0,
    opacity: 1.0
  }
};

export const CommonStyles = {
  surgeChip: {
    backgroundColor: DesignTokens.colors.surgeChip.bg,
    borderWidth: 1,
    borderColor: DesignTokens.colors.surgeChip.border,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  
  surgeChipText: {
    color: DesignTokens.colors.surgeChip.text,
    fontSize: 12,
    fontWeight: '600' as const,
    fontFamily: DesignTokens.typography.fontFamily
  },
  
  disclaimer: {
    backgroundColor: DesignTokens.colors.disclaimer.bg,
    borderRadius: DesignTokens.radius,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: DesignTokens.colors.disclaimer.border
  },
  
  disclaimerText: {
    fontSize: 12,
    color: DesignTokens.colors.disclaimer.text,
    textAlign: 'center' as const,
    fontFamily: DesignTokens.typography.fontFamily
  },
  
  fromPrice: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: DesignTokens.colors.success,
    fontFamily: DesignTokens.typography.fontFamily
  }
};

// Watermark configuration
export const WatermarkConfig = {
  screen: {
    enabled: process.env.WATERMARK_ENABLED === 'true',
    text: 'SHINE • STAGING',
    style: {
      opacity: 0.06,
      rotation: -24,
      fontSize: 48,
      color: '#000000',
      repeatPattern: 'tiled'
    }
  },
  
  media: {
    enabled: process.env.WATERMARK_MEDIA_ENABLED === 'true',
    text: 'SHINE',
    position: 'bottom-right',
    opacity: 0.25,
    padding: 8
  }
};

// Mock fixtures flag
export const MockConfig = {
  enabled: process.env.USE_MOCK_FIXTURES === 'true',
  backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'https://service-hub-shine.preview.emergentagent.com/api'
};