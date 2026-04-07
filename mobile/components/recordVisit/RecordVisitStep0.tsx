import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Pressable, View } from 'react-native';
import { Button, Chip, HelperText, Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ActivityTypeOption, Farm, Farmer, Route, Schedule } from '@/lib/api';
import { SelectActivityTypesModal } from '@/components/SelectActivityTypesModal';
import { SelectFarmerModal } from '@/components/SelectFarmerModal';
import { SelectFarmModal } from '@/components/SelectFarmModal';
import { colors } from '@/constants/theme';
import { styles } from './styles';

export type RecordVisitLabels = { partner: string; location: string };

function partnerKindSuffix(farmer: Farmer | undefined): string {
  if (!farmer) return '';
  return farmer.is_stockist ? ' · Stockist' : ' · Farmer';
}

function locationKindSuffix(farm: Farm | undefined): string {
  if (!farm) return '';
  return farm.is_outlet ? ' · Outlet' : ' · Farm';
}

type Props = {
  todayRoute: Route | null;
  todayRoutes: Route[];
  acceptedSchedules: Schedule[];
  farmers: Farmer[];
  labels: RecordVisitLabels;
  selectedRouteId: string | null;
  selectedScheduleId: string | null;
  selectedFarmerId: string | null;
  selectedFarmId: string | null;
  mustSelectSchedule: boolean;
  scheduleLockedForFarm: boolean;
  selectedFarmer: Farmer | undefined;
  selectedFarm: Farm | undefined;
  farms: Farm[];
  farmerModalOpen: boolean;
  /** When set, overrides the default “Select partner” title on the farmer picker (e.g. route-from-location flow). */
  farmerModalTitle: string | null;
  farmModalOpen: boolean;
  activityTypesModalOpen: boolean;
  activityTypesOptionsRefreshing: boolean;
  activityTypeOptions: ActivityTypeOption[];
  activityTypes: string[];
  activityLabel: string;
  location: Location.LocationObject | null;
  locationError: string;
  locationLoading: boolean;
  gpsValid: boolean;
  distanceM: number | null;
  maxM: number;
  photoUris: string[];
  submitting: boolean;
  onPickTodayRoute: (route: Route) => void;
  onPickSchedule: (s: Schedule) => void;
  onCloseFarmerModal: () => void;
  onSelectFarmer: (id: string | null) => void;
  onOpenFarmerModal: () => void;
  onCreatePartnerRecord: () => void;
  onCloseFarmModal: () => void;
  onSelectFarm: (id: string | null) => void;
  onOpenFarmModal: () => void;
  onCreateLocationRecord: () => void;
  onCloseActivityTypesModal: () => void;
  onSelectActivityTypes: (values: string[]) => void;
  onOpenActivityTypesModal: () => void;
  refreshLocation: () => void;
  onRemovePhoto: (index: number) => void;
  openCameraModal: () => void;
  onSubmitVisit: () => void;
  onOpenOptionalDetails: () => void;
  /** User has both accepted schedules and a weekly route for today — pick one before the lists. */
  bothVisitLinkOptions: boolean;
  visitLinkMode: 'schedule' | 'route' | null;
  effectiveVisitLinkMode: 'schedule' | 'route' | null;
  onSelectVisitLinkMode: (mode: 'schedule' | 'route') => void;
  partnerType: 'individual' | 'group' | 'stockist';
  onPartnerTypeChange: (t: 'individual' | 'group' | 'stockist') => void;
  /** Filtered by partnerType for the picker; full list still used for schedule chips. */
  farmersForModal: Farmer[];
};

export function RecordVisitStep0({
  todayRoute,
  todayRoutes,
  acceptedSchedules,
  farmers,
  labels,
  selectedRouteId,
  selectedScheduleId,
  selectedFarmerId,
  selectedFarmId,
  mustSelectSchedule,
  scheduleLockedForFarm,
  selectedFarmer,
  selectedFarm,
  farms,
  farmerModalOpen,
  farmerModalTitle,
  farmModalOpen,
  activityTypesModalOpen,
  activityTypesOptionsRefreshing,
  activityTypeOptions,
  activityTypes,
  activityLabel,
  location,
  locationError,
  locationLoading,
  gpsValid,
  distanceM,
  maxM,
  photoUris,
  submitting,
  onPickTodayRoute,
  onPickSchedule,
  onCloseFarmerModal,
  onSelectFarmer,
  onOpenFarmerModal,
  onCreatePartnerRecord,
  onCloseFarmModal,
  onSelectFarm,
  onOpenFarmModal,
  onCreateLocationRecord,
  onCloseActivityTypesModal,
  onSelectActivityTypes,
  onOpenActivityTypesModal,
  refreshLocation,
  onRemovePhoto,
  openCameraModal,
  onSubmitVisit,
  onOpenOptionalDetails,
  bothVisitLinkOptions,
  visitLinkMode,
  effectiveVisitLinkMode,
  onSelectVisitLinkMode,
  partnerType,
  onPartnerTypeChange,
  farmersForModal,
}: Props) {
  const requiresPlanChoice = acceptedSchedules.length > 0 || todayRoutes.length > 0;
  const isStockistContext =
    (Boolean(selectedScheduleId) && Boolean(selectedFarmer?.is_stockist)) ||
    (!selectedScheduleId && partnerType === 'stockist');
  const isGroupContext =
    (Boolean(selectedScheduleId) && Boolean(selectedFarmer?.is_group) && !Boolean(selectedFarmer?.is_stockist)) ||
    (!selectedScheduleId && partnerType === 'group');
  const partnerLabel = isStockistContext ? 'SACCO' : isGroupContext ? 'Farm group' : labels.partner;
  const locationLabel = isStockistContext ? 'Outlet' : labels.location;
  const showWeeklySection = effectiveVisitLinkMode === 'route' && todayRoutes.length > 0;
  const showScheduleSection = effectiveVisitLinkMode === 'schedule' && acceptedSchedules.length > 0;

  return (
    <>
      {bothVisitLinkOptions ? (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>1) Visit source *</Text>
          <View style={styles.scheduleChips}>
            <Chip
              selected={visitLinkMode === 'schedule'}
              onPress={() => onSelectVisitLinkMode('schedule')}
              style={styles.scheduleChip}
              compact
            >
              Scheduled plan
            </Chip>
            <Chip
              selected={visitLinkMode === 'route'}
              onPress={() => onSelectVisitLinkMode('route')}
              style={styles.scheduleChip}
              compact
            >
              Today&apos;s route
            </Chip>
          </View>
          {visitLinkMode === null && mustSelectSchedule ? (
            <HelperText type="error" style={styles.errorHint}>
              Choose planned visit or weekly route.
            </HelperText>
          ) : null}
        </Surface>
      ) : null}

      {showWeeklySection ? (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>1) Today&apos;s route</Text>
          {todayRoutes.length > 1 ? (
            <View style={styles.scheduleChips}>
              {todayRoutes.map((r) => (
                <Chip
                  key={r.id}
                  selected={selectedRouteId === r.id}
                  onPress={() => onPickTodayRoute(r)}
                  style={styles.scheduleChip}
                  compact
                >
                  {r.notes || r.name || 'Route'}
                </Chip>
              ))}
            </View>
          ) : (
            <Text variant="bodySmall" style={styles.muted}>
              {(todayRoute ?? todayRoutes[0])?.notes || (todayRoute ?? todayRoutes[0])?.name || 'Today’s route'} · multiple visits OK
            </Text>
          )}
          {showWeeklySection && mustSelectSchedule && !selectedRouteId ? (
            <HelperText type="error" style={styles.errorHint}>
              {todayRoutes.length > 1
                ? 'Select a route, then pick a customer.'
                : 'Pick a customer below.'}
            </HelperText>
          ) : null}
        </Surface>
      ) : null}
      {showScheduleSection ? (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>1) Scheduled plan *</Text>
          <View style={styles.scheduleChips}>
            {acceptedSchedules.map((s) => {
              const f = farmers.find((x) => x.id === s.farmer);
              const partnerLine =
                (f?.display_name ?? s.farmer_display_name ?? s.farmer ?? '—') + partnerKindSuffix(f);
              const dateStr = s.scheduled_date;
              return (
                <Chip
                  key={s.id}
                  selected={selectedScheduleId === s.id}
                  onPress={() => onPickSchedule(s)}
                  style={styles.scheduleChip}
                  compact
                >
                  {dateStr} — {partnerLine} · {labels.location}: {s.farm_display_name ?? 'None'}
                </Chip>
              );
            })}
          </View>
          {mustSelectSchedule && (
            <HelperText type="error" style={styles.errorHint}>
              {requiresPlanChoice && todayRoutes.length > 0 && !bothVisitLinkOptions
                ? 'Pick a planned visit or weekly route above.'
                : 'Select a planned visit.'}
            </HelperText>
          )}
        </Surface>
      ) : null}

      {todayRoutes.length === 0 && acceptedSchedules.length === 0 ? (
        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} style={styles.warningBoxIcon} />
          <View style={styles.warningBoxContent}>
            <Text variant="labelLarge" style={styles.warningBoxTitle}>No eligible plan</Text>
            <Text variant="bodySmall" style={styles.warningBoxText}>
              You can record visits only from today&apos;s route or an accepted planned visit.
            </Text>
          </View>
        </View>
      ) : null}

      {!mustSelectSchedule && (
        <>
          <Text variant="labelMedium" style={styles.step2SectionTitle}>
            {`2) ${partnerLabel} and ${locationLabel}`}
          </Text>
          {!selectedScheduleId ? (
            <>
              <View style={styles.partnerTypeRow}>
                <Button
                  mode={partnerType === 'individual' ? 'contained-tonal' : 'text'}
                  compact
                  onPress={() => onPartnerTypeChange('individual')}
                  style={[
                    styles.partnerTypeBtn,
                    partnerType === 'individual' ? styles.partnerTypeBtnActive : styles.partnerTypeBtnInactive,
                  ]}
                  labelStyle={styles.partnerTypeBtnLabel}
                >
                  Individual
                </Button>
                <Button
                  mode={partnerType === 'group' ? 'contained-tonal' : 'text'}
                  compact
                  onPress={() => onPartnerTypeChange('group')}
                  style={[
                    styles.partnerTypeBtn,
                    partnerType === 'group' ? styles.partnerTypeBtnActive : styles.partnerTypeBtnInactive,
                  ]}
                  labelStyle={styles.partnerTypeBtnLabel}
                >
                  Farm group
                </Button>
                <Button
                  mode={partnerType === 'stockist' ? 'contained-tonal' : 'text'}
                  compact
                  onPress={() => onPartnerTypeChange('stockist')}
                  style={[
                    styles.partnerTypeBtn,
                    partnerType === 'stockist' ? styles.partnerTypeBtnActive : styles.partnerTypeBtnInactive,
                  ]}
                  labelStyle={styles.partnerTypeBtnLabel}
                >
                  SACCO
                </Button>
              </View>
              <Button
                mode="outlined"
                onPress={onOpenFarmerModal}
                style={styles.farmerSelectBtn}
                contentStyle={styles.farmerSelectBtnContent}
                icon="account-search"
              >
                {selectedFarmerId
                  ? `Change ${partnerLabel.toLowerCase()}`
                  : `Select ${partnerLabel.toLowerCase()} *`}
              </Button>
            </>
          ) : null}
          <SelectFarmerModal
            visible={farmerModalOpen}
            onClose={onCloseFarmerModal}
            farmers={farmersForModal}
            selectedFarmerId={selectedFarmerId}
            onSelect={onSelectFarmer}
            title={farmerModalTitle ?? `Select ${partnerLabel.toLowerCase()}`}
            noPartnerLabel={
              partnerType === 'stockist'
                ? 'No SACCO'
                : partnerType === 'group'
                  ? 'No farm group'
                  : `No ${labels.partner.toLowerCase()}`
            }
            onCreateNew={onCreatePartnerRecord}
            createNewLabel={`Create new ${partnerLabel.toLowerCase()}`}
          />
          {selectedFarmer && (
            <View style={styles.farmerCard}>
              <View style={styles.farmerCardAvatar}>
                <Text variant="titleLarge" style={styles.farmerCardAvatarText}>
                  {(selectedFarmer.display_name || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.farmerCardBody}>
                <Text variant="titleMedium" style={styles.farmerCardName}>{selectedFarmer.display_name ?? '—'}</Text>
                <Text variant="bodySmall" style={styles.farmerCardMeta}>
                  {selectedFarmer.is_stockist ? 'Selected SACCO' : selectedFarmer.is_group ? 'Selected farm group' : 'Selected farmer'}
                </Text>
                {selectedFarmer.phone ? (
                  <View style={styles.farmerCardPhone}>
                    <MaterialCommunityIcons name="phone" size={16} color="#DB2777" />
                    <Text variant="bodySmall" style={styles.farmerCardPhoneText}>{selectedFarmer.phone}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.farmerCardTag}>
                <Chip mode="flat" style={styles.activeChip} textStyle={styles.activeChipText} compact>
                  {selectedFarmer.is_stockist ? 'SACCO' : selectedFarmer.is_group ? 'Farm group' : 'Farmer'}
                </Chip>
              </View>
            </View>
          )}

          <Text variant="labelMedium" style={styles.step2SectionTitle}>
            {`${locationLabel.toUpperCase()} *`}
          </Text>
          <Text variant="bodySmall" style={styles.hint}>
            Choose a saved {locationLabel.toLowerCase()}.
          </Text>
          {(scheduleLockedForFarm && selectedFarm) ? (
            <View style={styles.farmDisplay}>
              <View style={styles.selectedLocationRow}>
                <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                <View style={styles.selectedLocationTextWrap}>
                  <Text variant="labelMedium" style={styles.selectedLocationTitle}>
                    Selected {selectedFarm.is_outlet ? 'outlet' : 'farm'}
                  </Text>
                  <Text variant="bodyLarge" style={styles.selectedLocationValue}>
                    {selectedFarm.village}
                    {locationKindSuffix(selectedFarm)}
                  </Text>
                </View>
              </View>
            </View>
          ) : selectedFarmer && !scheduleLockedForFarm ? (
            farms.length === 0 ? (
              <Text variant="bodySmall" style={styles.muted}>
                No {locationLabel.toLowerCase()}s for this {partnerLabel.toLowerCase()}
              </Text>
            ) : (
              <>
                <Button
                  mode="outlined"
                  onPress={onOpenFarmModal}
                  style={styles.farmSelectBtn}
                  contentStyle={styles.farmSelectBtnContent}
                  icon="barn"
                >
                  {selectedFarm
                    ? `${selectedFarm.village}${locationKindSuffix(selectedFarm)}`
                    : `Select ${locationLabel.toLowerCase()}`}
                </Button>
                {selectedFarm ? (
                  <View style={styles.farmDisplay}>
                    <View style={styles.selectedLocationRow}>
                      <MaterialCommunityIcons name="map-marker" size={20} color={colors.primary} />
                      <View style={styles.selectedLocationTextWrap}>
                        <Text variant="labelMedium" style={styles.selectedLocationTitle}>
                          Selected {selectedFarm.is_outlet ? 'outlet' : 'farm'}
                        </Text>
                        <Text variant="bodyLarge" style={styles.selectedLocationValue}>
                          {selectedFarm.village}
                          {locationKindSuffix(selectedFarm)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                <SelectFarmModal
                  visible={farmModalOpen}
                  onClose={onCloseFarmModal}
                  farms={farms}
                  selectedFarmId={selectedFarmId}
                  onSelect={onSelectFarm}
                  title={`Select ${locationLabel.toLowerCase()}`}
                  onCreateNew={onCreateLocationRecord}
                  createNewLabel={`Create new ${locationLabel.toLowerCase()}`}
                />
              </>
            )
          ) : null}

          <Text variant="labelMedium" style={styles.step2SectionTitle}>Activities</Text>
          <Button
            mode="outlined"
            onPress={onOpenActivityTypesModal}
            style={styles.farmSelectBtn}
            contentStyle={styles.farmSelectBtnContent}
            icon="format-list-checks"
          >
            {activityLabel}
          </Button>
          <SelectActivityTypesModal
            visible={activityTypesModalOpen}
            onClose={onCloseActivityTypesModal}
            options={activityTypeOptions}
            selectedValues={activityTypes}
            onSelect={onSelectActivityTypes}
            title="Select activities"
            refreshing={activityTypesOptionsRefreshing}
          />

          <View style={[styles.locationCard, location && gpsValid && styles.locationCardVerified]}>
            <View style={styles.locationCardLeft}>
              <MaterialCommunityIcons
                name="map-marker"
                size={24}
                color={location && gpsValid ? colors.primary : colors.gray500}
                style={styles.locationCardIcon}
              />
              <View style={styles.locationCardText}>
                {locationError ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                    <Text variant="bodySmall" style={styles.locationStatusError}>{locationError}</Text>
                  </>
                ) : locationLoading ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                    <Text variant="bodySmall" style={styles.locationStatus}>Getting GPS…</Text>
                  </>
                ) : location && gpsValid && distanceM !== null ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitleVerified}>Within range ✓</Text>
                    <Text variant="bodySmall" style={styles.locationCardDetail}>
                      {distanceM}m / max {maxM}m
                    </Text>
                  </>
                ) : location ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>
                      {distanceM !== null && !gpsValid ? 'Too far' : 'Location'}
                    </Text>
                    <Text variant="bodySmall" style={styles.locationStatus}>
                      {distanceM !== null ? `${distanceM}m (max ${maxM}m)` : 'Captured'}
                    </Text>
                    {distanceM !== null && !gpsValid && (
                      <HelperText type="error">Within {maxM}m required.</HelperText>
                    )}
                  </>
                ) : (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                    <Text variant="bodySmall" style={styles.locationStatus}>No fix yet</Text>
                  </>
                )}
              </View>
            </View>
            <Pressable onPress={refreshLocation} disabled={locationLoading} style={styles.locationRefreshBtn}>
              <MaterialCommunityIcons name="refresh" size={24} color={location && gpsValid ? colors.primary : colors.gray500} />
            </Pressable>
          </View>

          <Text variant="labelMedium" style={styles.step2SectionTitle}>Photos *</Text>
          {photoUris.length > 0 ? (
            <View style={styles.photosRow}>
              {photoUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                  <Button
                    mode="text"
                    compact
                    icon="close"
                    onPress={() => onRemovePhoto(index)}
                    style={styles.photoThumbRemove}
                    accessibilityLabel="Remove photo"
                  >
                    {' '}
                  </Button>
                </View>
              ))}
              <Pressable style={styles.photoAddBtn} onPress={openCameraModal}>
                <MaterialCommunityIcons name="camera-plus" size={40} color={colors.primary} />
                <Text variant="bodySmall" style={styles.photoAddLabel}>Add photo</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.photoPlaceholder} onPress={openCameraModal}>
              <MaterialCommunityIcons name="camera" size={48} color={colors.gray500} />
              <Text variant="bodyLarge" style={styles.photoPlaceholderText}>Add photo</Text>
              <Text variant="bodySmall" style={styles.photoPlaceholderHint}>Minimum 1</Text>
            </Pressable>
          )}

          <View style={[styles.stepActions, styles.stepActionsWrap]}>
            <Button
              mode="contained"
              onPress={onSubmitVisit}
              loading={submitting}
              disabled={
                submitting ||
                photoUris.length === 0 ||
                !location ||
                (location && distanceM !== null && !gpsValid)
              }
              style={styles.nextBtn}
              contentStyle={styles.nextBtnContent}
              icon="check"
            >
              Save visit now
            </Button>
            <Button
              mode="outlined"
              onPress={onOpenOptionalDetails}
              disabled={
                photoUris.length === 0 ||
                !location ||
                (location && distanceM !== null && !gpsValid)
              }
              style={styles.nextBtn}
              contentStyle={styles.nextBtnContent}
              icon="playlist-plus"
            >
              Continue to additional fields
            </Button>
          </View>
        </>
      )}
    </>
  );
}
