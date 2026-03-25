import { useRecordVisitScreen } from '@/lib/recordVisit/useRecordVisitScreen';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  Chip,
  Dialog,
  Portal,
  Snackbar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordVisitCameraModal } from '@/components/recordVisit/RecordVisitCameraModal';
import { RecordVisitStep0 } from '@/components/recordVisit/RecordVisitStep0';
import { RecordVisitStep1 } from '@/components/recordVisit/RecordVisitStep1';
import { RecordVisitStepper } from '@/components/recordVisit/RecordVisitStepper';
import { styles } from '@/components/recordVisit/styles';
import { formHeaderHeight, scrollPaddingKeyboard } from '@/constants/theme';

export default function RecordVisitScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setSelectedFarmId, ...v } = useRecordVisitScreen();

  if (!v.permission) {
    return (
      <Surface style={styles.centered} elevation={0}>
        <ActivityIndicator size="large" />
      </Surface>
    );
  }

  if (!v.permission.granted) {
    return (
      <Surface style={styles.centered} elevation={0}>
        <Text variant="bodyLarge">Camera access is required to record visit proof.</Text>
        <Button mode="contained" onPress={v.requestPermission} style={styles.topBtn}>
          Allow camera
        </Button>
      </Surface>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text variant="labelSmall" style={styles.headerStepLabel}>
            {v.step === 0 ? 'Photo & location' : 'Extra details (optional)'}
          </Text>
          <Text variant="headlineSmall" style={styles.headerTitle}>
            Record visit
          </Text>
        </View>
        <Pressable onPress={() => v.router.back()} style={styles.headerClose} hitSlop={12}>
          <Text variant="headlineMedium" style={styles.headerCloseText}>×</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={formHeaderHeight}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollPaddingKeyboard, flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={true}
        >
          {!v.isOnline && v.isOnline !== null && (
            <Chip icon="cloud-off-outline" style={styles.offlineChip} compact>
              Offline — will sync when back online
            </Chip>
          )}

          <RecordVisitStepper
            step={v.step}
            canOpenExtraStep={v.canOpenExtraStep}
            onPressStep0={() => v.setStep(0)}
            onPressStep1={() => v.setStep(1)}
          />

          {v.step === 0 && (
            <RecordVisitStep0
              todayRoute={v.todayRoute}
              todayRoutes={v.todayRoutes}
              acceptedSchedules={v.acceptedSchedules}
              farmers={v.farmers}
              labels={v.labels}
              selectedRouteStopId={v.selectedRouteStopId}
              selectedRouteId={v.selectedRouteId}
              selectedScheduleId={v.selectedScheduleId}
              selectedFarmerId={v.selectedFarmerId}
              selectedFarmId={v.selectedFarmId}
              mustSelectSchedule={v.mustSelectSchedule}
              scheduleLockedForFarm={v.scheduleLockedForFarm}
              selectedFarmer={v.selectedFarmer}
              selectedFarm={v.selectedFarm}
              farms={v.farms}
              farmerModalOpen={v.farmerModalOpen}
              farmerModalTitle={v.farmerModalTitle}
              farmModalOpen={v.farmModalOpen}
              activityTypesModalOpen={v.activityTypesModalOpen}
              activityTypesOptionsRefreshing={v.activityTypesOptionsRefreshing}
              activityTypeOptions={v.activityTypeOptions}
              activityTypes={v.activityTypes}
              activityLabel={v.activityLabel}
              location={v.location}
              locationError={v.locationError}
              locationLoading={v.locationLoading}
              gpsValid={v.gpsValid}
              distanceM={v.distanceM}
              maxM={v.maxM}
              photoUris={v.photoUris}
              submitting={v.submitting}
              onPickRouteStop={v.pickRouteStop}
              onPickTodayRoute={v.pickTodayRoute}
              onAdHocRouteCustomer={v.adHocRouteCustomer}
              onPickSchedule={v.pickSchedule}
              onFieldVisitNotFromList={v.fieldVisitNotFromList}
              onCloseFarmerModal={v.closeFarmerModal}
              onSelectFarmer={v.selectFarmerAndClose}
              onOpenFarmerModal={v.openFarmerPicker}
              onCloseFarmModal={() => v.setFarmModalOpen(false)}
              onSelectFarm={setSelectedFarmId}
              onOpenFarmModal={() => v.setFarmModalOpen(true)}
              onCloseActivityTypesModal={() => v.setActivityTypesModalOpen(false)}
              onSelectActivityTypes={v.setActivityTypes}
              onOpenActivityTypesModal={() => v.setActivityTypesModalOpen(true)}
              refreshLocation={v.refreshLocation}
              onRemovePhoto={v.removePhotoAt}
              openCameraModal={v.openCameraModal}
              onSubmitVisit={() => v.submit({ skipStep3: true })}
              onOpenOptionalDetails={() => v.setStep(1)}
            />
          )}

          {v.step === 1 && (
            <RecordVisitStep1
              step3Fields={v.step3Fields}
              step3Values={v.step3Values}
              setStep3Values={v.setStep3Values}
              visitFormFieldSchema={v.visitFormFieldSchema}
              productLines={v.productLines}
              setProductLines={v.setProductLines}
              products={v.products}
              productModalOpen={v.productModalOpen}
              productModalFieldKey={v.productModalFieldKey}
              setProductModalOpen={v.setProductModalOpen}
              setProductModalFieldKey={v.setProductModalFieldKey}
              error={v.error}
              submitting={v.submitting}
              onBack={() => v.setStep(0)}
              onSubmit={() => v.submit()}
            />
          )}

          <RecordVisitCameraModal
            visible={v.cameraModalVisible}
            onClose={() => v.setCameraModalVisible(false)}
            cameraRef={v.cameraRef}
            onCapture={v.takePhoto}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <Portal>
        <Dialog visible={v.dialogVisible} onDismiss={v.dismissDialog}>
          <Dialog.Icon icon={v.dialogSuccess ? 'check-circle' : 'alert'} color={v.dialogSuccess ? theme.colors.primary : theme.colors.error} />
          <Dialog.Title>{v.dialogSuccess ? 'Visit Verified' : 'Error'}</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {v.dialogSuccess ? (v.distanceM !== null ? `Distance: ${v.distanceM}m` : 'Visit recorded.') : (v.submitError || 'Failed to submit visit.')}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={v.dismissDialog}>OK</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar
        visible={!!v.snackbarMsg}
        onDismiss={() => v.setSnackbarMsg('')}
        duration={4000}
        wrapperStyle={[styles.snackbarWrapper, { top: insets.top }]}
        style={styles.snackbarTop}
      >
        {v.snackbarMsg}
      </Snackbar>
    </SafeAreaView>
  );
}
