import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { ButtonVariants } from '../styles/designSystem';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  children: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onPress,
  children,
  testID,
  style,
  textStyle
}) => {
  const getButtonStyle = () => {
    if (disabled || loading) {
      return [ButtonVariants.disabled, style];
    }
    
    return [ButtonVariants[variant], style];
  };

  const getTextStyle = () => {
    const baseStyle = {
      fontSize: ButtonVariants[variant].fontSize,
      fontWeight: ButtonVariants[variant].fontWeight,
      fontFamily: ButtonVariants[variant].fontFamily || 'Inter',
    };

    if (disabled || loading) {
      return [baseStyle, { color: ButtonVariants.disabled.color }, textStyle];
    }

    return [baseStyle, { color: ButtonVariants[variant].color }, textStyle];
  };

  return (
    <TouchableOpacity
      style={[styles.button, getButtonStyle()]}
      onPress={onPress}
      disabled={disabled || loading}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={typeof children === 'string' ? children : undefined}
    >
      {loading ? (
        <ActivityIndicator 
          color={disabled ? ButtonVariants.disabled.color : ButtonVariants[variant].color} 
          size="small" 
        />
      ) : (
        <Text style={getTextStyle()}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});

export default Button;