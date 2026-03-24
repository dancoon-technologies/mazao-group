import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { styles } from './styles';

type Props = {
  step: number;
  canOpenExtraStep: boolean;
  onPressStep0: () => void;
  onPressStep1: () => void;
};

export function RecordVisitStepper({ step, canOpenExtraStep, onPressStep0, onPressStep1 }: Props) {
  return (
    <View style={styles.stepperRow}>
      <Pressable onPress={onPressStep0} style={styles.stepperItem}>
        <View style={[styles.stepperCircle, (step === 0 || step >= 1) && styles.stepperCircleActive]}>
          {step >= 1 ? (
            <MaterialCommunityIcons name="check" size={18} color={colors.white} />
          ) : (
            <Text variant="labelMedium" style={[styles.stepperCircleText, step === 0 && styles.stepperCircleTextActive]}>1</Text>
          )}
        </View>
        <Text variant="labelSmall" style={[styles.stepperLabel, (step === 0 || step >= 1) && styles.stepperLabelActive]}>Visit</Text>
      </Pressable>
      <View style={[styles.stepperLine, step >= 1 && styles.stepperLineActive]} />
      <Pressable
        onPress={() => canOpenExtraStep && onPressStep1()}
        style={styles.stepperItem}
        disabled={!canOpenExtraStep}
      >
        <View style={[styles.stepperCircle, step === 1 && styles.stepperCircleActive]}>
          <Text variant="labelMedium" style={[styles.stepperCircleText, step === 1 && styles.stepperCircleTextActive]}>2</Text>
        </View>
        <Text variant="labelSmall" style={[styles.stepperLabel, step === 1 && styles.stepperLabelActive]}>Extras</Text>
      </Pressable>
    </View>
  );
}
