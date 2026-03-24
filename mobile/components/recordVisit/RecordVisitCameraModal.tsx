import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CameraView } from 'expo-camera';
import type { RefObject } from 'react';
import { styles } from './styles';

type Props = {
  visible: boolean;
  onClose: () => void;
  cameraRef: RefObject<CameraView | null>;
  onCapture: () => void;
};

export function RecordVisitCameraModal({ visible, onClose, cameraRef, onCapture }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.cameraModal}>
        <View style={styles.cameraModalHeader}>
          <Text variant="titleMedium" style={styles.cameraModalTitle}>
            Take photo
          </Text>
          <Pressable onPress={onClose} style={styles.cameraModalClose} hitSlop={12}>
            <Text variant="titleLarge" style={styles.cameraModalCloseText}>×</Text>
          </Pressable>
        </View>
        <View style={styles.cameraModalCamera}>
          <CameraView style={StyleSheet.absoluteFill} ref={cameraRef} />
          <View style={styles.cameraModalOverlay}>
            <Pressable style={styles.captureButton} onPress={onCapture}>
              <View style={styles.captureButtonInner} />
            </Pressable>
            <Text variant="bodyMedium" style={styles.cameraModalHint}>
              Tap to capture
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}
