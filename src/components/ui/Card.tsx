import { StyleSheet, View, Pressable, ViewStyle } from 'react-native';
import { ReactNode } from 'react';
import { colors, shadows, borderRadius, spacing } from '@/lib/design/theme';

interface CardProps {
    children: ReactNode;
    onPress?: () => void;
    style?: ViewStyle | ViewStyle[];
    elevated?: boolean;
}

export default function Card({ children, onPress, style, elevated = false }: CardProps) {
    const Component = onPress ? Pressable : View;

    return (
        <Component
            onPress={onPress}
            style={[
                styles.card,
                elevated && shadows.md,
                style,
            ]}
        >
            {children}
        </Component>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
});
