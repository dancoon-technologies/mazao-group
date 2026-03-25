import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { Pressable, View } from 'react-native';
import { Button, Chip, HelperText, Surface, Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ActivityTypeOption, Farm, Farmer, Route, RouteStop, Schedule } from '@/lib/api';
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
  selectedRouteStopId: string | null;
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
  onPickRouteStop: (stop: RouteStop) => void;
  onPickTodayRoute: (route: Route) => void;
  onAdHocRouteCustomer: () => void;
  onPickSchedule: (s: Schedule) => void;
  onFieldVisitNotFromList: () => void;
  onCloseFarmerModal: () => void;
  onSelectFarmer: (id: string | null) => void;
  onOpenFarmerModal: () => void;
  onCloseFarmModal: () => void;
  onSelectFarm: (id: string | null) => void;
  onOpenFarmModal: () => void;
  onCloseActivityTypesModal: () => void;
  onSelectActivityTypes: (values: string[]) => void;
  onOpenActivityTypesModal: () => void;
  refreshLocation: () => void;
  onRemovePhoto: (index: number) => void;
  openCameraModal: () => void;
  onSubmitVisit: () => void;
  onOpenOptionalDetails: () => void;
};

export function RecordVisitStep0({
  todayRoute,
  todayRoutes,
  acceptedSchedules,
  farmers,
  labels,
  selectedRouteStopId,
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
  onPickRouteStop,
  onPickTodayRoute,
  onAdHocRouteCustomer,
  onPickSchedule,
  onFieldVisitNotFromList,
  onCloseFarmerModal,
  onSelectFarmer,
  onOpenFarmerModal,
  onCloseFarmModal,
  onSelectFarm,
  onOpenFarmModal,
  onCloseActivityTypesModal,
  onSelectActivityTypes,
  onOpenActivityTypesModal,
  refreshLocation,
  onRemovePhoto,
  openCameraModal,
  onSubmitVisit,
  onOpenOptionalDetails,
}: Props) {
  const requiresPlanChoice = acceptedSchedules.length > 0 || todayRoutes.length > 0;

  return (
    <>
      {!selectedScheduleId && todayRoute ? (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>Weekly route (today)</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Routes can include visits even when there are no planned stops. Pick a stop when listed, or record from your current location and choose the farmer or stockist — the visit stays on this route.
          </Text>
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
                  {r.notes || r.name || 'Route'} ({r.stops?.length ?? 0})
                </Chip>
              ))}
            </View>
          ) : null}
          {todayRoute.stops && todayRoute.stops.length > 0 ? (
            <View style={styles.scheduleChips}>
              {todayRoute.stops.map((stop) => {
                const f = farmers.find((x) => x.id === stop.farmer);
                const partnerLine =
                  (stop.farmer_display_name ?? f?.display_name ?? '—') + partnerKindSuffix(f);
                return (
                  <Chip
                    key={stop.id}
                    selected={selectedRouteStopId === stop.id}
                    onPress={() => onPickRouteStop(stop)}
                    style={styles.scheduleChip}
                    compact
                  >
                    {partnerLine} · {labels.location}: {stop.farm_display_name ?? '—'}
                  </Chip>
                );
              })}
            </View>
          ) : (
            <Text variant="bodySmall" style={styles.muted}>
              No stops on this plan — tap below to refresh your GPS, then choose the farmer or stockist for this route.
            </Text>
          )}
          {mustSelectSchedule && acceptedSchedules.length === 0 && !selectedRouteId ? (
            <HelperText type="error" style={styles.errorHint}>
              {todayRoutes.length > 1
                ? 'Select which route you are on, then a stop or “Record from here”.'
                : 'Select a stop on this route, or “Record from here” to choose farmer or stockist at your location.'}
            </HelperText>
          ) : null}
          <Button
            mode="outlined"
            compact
            icon="crosshairs-gps"
            onPress={onAdHocRouteCustomer}
            style={styles.routeAdHocBtn}
          >
            Record from here — choose farmer or stockist
          </Button>
        </Surface>
      ) : null}
      {acceptedSchedules.length > 0 ? (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>Planned visit *</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Accepted schedules for today or earlier. Each line shows Farmer vs Stockist when known.
          </Text>
          <View style={styles.scheduleChips}>
            {acceptedSchedules.map((s) => {
              const f = farmers.find((x) => x.id === s.farmer);
              const partnerLine =
                (f?.display_name ?? s.farmer_display_name ?? s.farmer ?? '—') + partnerKindSuffix(f);
              const dateStr = s.scheduled_date;
              return (
                <Chip
                  key={s.id}
                  selected={selectedScheduleId === s.id && !selectedRouteId}
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
            <>
              <HelperText type="error" style={styles.errorHint}>
                {requiresPlanChoice && todayRoutes.length > 0
                  ? 'Select a planned visit or today’s weekly route (see above).'
                  : 'Select a planned visit from the list.'}
              </HelperText>
              {!requiresPlanChoice ? (
                <Button
                  mode="text"
                  compact
                  onPress={onFieldVisitNotFromList}
                  style={styles.skipPlanBtn}
                >
                  Field visit (not from this list)
                </Button>
              ) : null}
            </>
          )}
        </Surface>
      ) : todayRoutes.length === 0 && acceptedSchedules.length === 0 ? (
        <View style={styles.warningBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={22} color={colors.warning} style={styles.warningBoxIcon} />
          <View style={styles.warningBoxContent}>
            <Text variant="labelLarge" style={styles.warningBoxTitle}>Nothing to visit yet</Text>
            <Text variant="bodySmall" style={styles.warningBoxText}>
              Add an accepted schedule in Schedules, or submit today’s route under Plan visits → Weekly routes. If you have neither, you can record a field visit and pick a customer below.
            </Text>
          </View>
        </View>
      ) : null}

      {!mustSelectSchedule && (
        <>
          <Text variant="labelMedium" style={styles.step2SectionTitle}>
            {selectedScheduleId
              ? `${labels.partner.toUpperCase()} & ${labels.location.toUpperCase()} (from schedule)`
              : selectedRouteId
                ? `${labels.partner.toUpperCase()} & ${labels.location.toUpperCase()} (weekly route)`
                : `${labels.partner.toUpperCase()} & ${labels.location.toUpperCase()}`}
          </Text>
          {!selectedScheduleId ? (
            <Button
              mode="outlined"
              onPress={onOpenFarmerModal}
              style={styles.farmerSelectBtn}
              contentStyle={styles.farmerSelectBtnContent}
              icon="account-search"
            >
              {selectedFarmerId
                ? `Change ${labels.partner.toLowerCase()}`
                : `Select ${labels.partner.toLowerCase()} *`}
            </Button>
          ) : null}
          <SelectFarmerModal
            visible={farmerModalOpen}
            onClose={onCloseFarmerModal}
            farmers={farmers}
            selectedFarmerId={selectedFarmerId}
            onSelect={onSelectFarmer}
            title={farmerModalTitle ?? `Select ${labels.partner.toLowerCase()}`}
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
                {selectedFarmer.phone ? (
                  <View style={styles.farmerCardPhone}>
                    <MaterialCommunityIcons name="phone" size={16} color="#DB2777" />
                    <Text variant="bodySmall" style={styles.farmerCardPhoneText}>{selectedFarmer.phone}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.farmerCardTag}>
                <Chip mode="flat" style={styles.activeChip} textStyle={styles.activeChipText} compact>
                  {selectedFarmer.is_stockist ? 'Stockist' : 'Farmer'}
                </Chip>
              </View>
            </View>
          )}

          <Text variant="labelMedium" style={styles.step2SectionTitle}>
            {`${labels.location.toUpperCase()} (optional)`}
          </Text>
          <Text variant="bodySmall" style={styles.hint}>
            Farm vs outlet is shown when this {labels.location.toLowerCase()} is saved on the partner record.
          </Text>
          {(scheduleLockedForFarm && selectedFarm) ? (
            <View style={styles.farmDisplay}>
              <Text variant="bodyLarge">
                {selectedFarm.village}
                {locationKindSuffix(selectedFarm)}
              </Text>
            </View>
          ) : selectedFarmer && !scheduleLockedForFarm ? (
            farms.length === 0 ? (
              <Text variant="bodySmall" style={styles.muted}>No {labels.location.toLowerCase()}s for this {labels.partner.toLowerCase()}</Text>
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
                    : `Select ${labels.location.toLowerCase()}`}
                </Button>
                <SelectFarmModal
                  visible={farmModalOpen}
                  onClose={onCloseFarmModal}
                  farms={farms}
                  selectedFarmId={selectedFarmId}
                  onSelect={onSelectFarm}
                  title={`Select ${labels.location.toLowerCase()}`}
                />
              </>
            )
          ) : null}

          <Text variant="labelMedium" style={styles.step2SectionTitle}>ACTIVITY TYPES</Text>
          <Text variant="bodySmall" style={styles.hint}>You can record more than one activity per visit.</Text>
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
                    <Text variant="bodySmall" style={styles.locationStatus}>Getting location…</Text>
                  </>
                ) : location && gpsValid && distanceM !== null ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitleVerified}>Location Verified ✓</Text>
                    <Text variant="bodySmall" style={styles.locationCardDetail}>
                      {distanceM}m away · within {maxM}m limit
                    </Text>
                  </>
                ) : location ? (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>
                      {distanceM !== null && !gpsValid ? 'Out of range' : 'Location'}
                    </Text>
                    <Text variant="bodySmall" style={styles.locationStatus}>
                      {distanceM !== null ? `${distanceM}m (max ${maxM}m)` : 'Location captured'}
                    </Text>
                    {distanceM !== null && !gpsValid && (
                      <HelperText type="error">Must be within {maxM}m to record this visit.</HelperText>
                    )}
                  </>
                ) : (
                  <>
                    <Text variant="labelLarge" style={styles.locationCardTitle}>Location</Text>
                    <Text variant="bodySmall" style={styles.locationStatus}>Location not captured</Text>
                  </>
                )}
              </View>
            </View>
            <Pressable onPress={refreshLocation} disabled={locationLoading} style={styles.locationRefreshBtn}>
              <MaterialCommunityIcons name="refresh" size={24} color={location && gpsValid ? colors.primary : colors.gray500} />
            </Pressable>
          </View>

          <Text variant="labelMedium" style={styles.step2SectionTitle}>PHOTO EVIDENCE *</Text>
          <Text variant="bodySmall" style={styles.hint}>You can add more than one photo. At least one required.</Text>
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
              <Text variant="bodyLarge" style={styles.photoPlaceholderText}>Tap to take photo</Text>
              <Text variant="bodySmall" style={styles.photoPlaceholderHint}>At least one required for verification</Text>
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
              Submit visit
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
              Optional details
            </Button>
          </View>
        </>
      )}
    </>
  );
}
