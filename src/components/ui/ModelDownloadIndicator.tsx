import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

interface ModelDownloadIndicatorProps {
    progress: number; // 0 to 1
    text: string;
    visible: boolean;
}

export const ModelDownloadIndicator: React.FC<ModelDownloadIndicatorProps> = ({ progress, text, visible }) => {
    if (!visible) return null;

    // Convert 0-1 to 0-100%
    const percentage = Math.round(progress * 100);

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Downloading AI Model</Text>
                <Text style={styles.subtitle}>Gemma 2 2B (Google DeepMind)</Text>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${percentage}%` }]} />
                </View>

                <View style={styles.statusRow}>
                    <Text style={styles.statusText}>{text}</Text>
                    <Text style={styles.percentageText}>{percentage}%</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 1000,
    },
    card: {
        backgroundColor: '#1e1e1e',
        padding: 16,
        borderRadius: 12,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    subtitle: {
        color: '#aaa',
        fontSize: 12,
        marginBottom: 12,
    },
    progressContainer: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#4CAF50',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusText: {
        color: '#ccc',
        fontSize: 12,
        flex: 1,
        marginRight: 8,
    },
    percentageText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
