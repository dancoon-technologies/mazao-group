import type { Farmer } from "@/lib/api";
import { getLabels } from "@/lib/api";
import { appMeta$ } from "@/store/observable";
import { useSelector } from "@legendapp/state/react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Keyboard,
  Platform,
} from "react-native";
import { Button, Text, TextInput } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

export interface SelectFarmerModalProps {
  visible: boolean;
  onClose: () => void;
  farmers: Farmer[];
  selectedFarmerId: string | null;
  onSelect: (farmerId: string | null) => void;
  title?: string;
}

function matchFarmer(f: Farmer, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const name = (f.display_name ?? "").toLowerCase();
  const phone = (f.phone ?? "").replace(/\s/g, "");
  const phoneNorm = lower.replace(/\s/g, "");
  return name.includes(lower) || phone.includes(phoneNorm);
}

export function SelectFarmerModal({
  visible,
  onClose,
  farmers,
  selectedFarmerId,
  onSelect,
  title,
}: SelectFarmerModalProps) {
  const labels = useSelector(() => getLabels(appMeta$.cachedOptions.get()));
  const modalTitle = title ?? `Select ${labels.partner.toLowerCase()}`;
  const [search, setSearch] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (visible) setSearch("");
  }, [visible]);

  const filtered = useMemo(() => {
    return farmers.filter((f) => matchFarmer(f, search));
  }, [farmers, search]);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setSearch("");
    onClose();
  };

  const renderItem = ({ item }: { item: Farmer }) => {
    const label = `${item.display_name}${item.phone ? ` · ${item.phone}` : ""}`;
    const selected = selectedFarmerId === item.id;
    return (
      <Pressable
        style={[styles.option, selected && styles.optionSelected]}
        onPress={() => handleSelect(item.id)}
      >
        <Text variant="bodyMedium" numberOfLines={1} style={styles.optionText}>
          {label || "—"}
        </Text>
        {selected && (
          <MaterialCommunityIcons name="check" size={20} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {modalTitle}
            </Text>
            <Button mode="text" compact onPress={onClose} style={styles.closeBtn}>
              Close
            </Button>
          </View>
          <TextInput
            mode="outlined"
            placeholder="Search by name or phone…"
            value={search}
            onChangeText={setSearch}
            left={<TextInput.Icon icon="magnify" />}
            style={styles.searchInput}
            outlineColor={colors.gray200}
            activeOutlineColor={colors.primary}
          />
          <View style={styles.noFarmerRow}>
            <Button
              mode={selectedFarmerId === null ? "contained" : "outlined"}
              compact
              onPress={() => handleSelect(null)}
              style={styles.noFarmerBtn}
            >
              No {labels.partner.toLowerCase()}
            </Button>
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              search.trim() ? (
                <View style={styles.empty}>
                  <Text variant="bodySmall" style={styles.emptyText}>
                    No {labels.partner.toLowerCase()}s match "{search.trim()}"
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontWeight: "600",
    color: colors.gray900,
  },
  closeBtn: {
    marginRight: -8,
  },
  searchInput: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  noFarmerRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noFarmerBtn: {
    alignSelf: "flex-start",
  },
  list: {
    maxHeight: 320,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray200,
  },
  optionSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    flex: 1,
    marginRight: spacing.sm,
    color: colors.gray900,
  },
  empty: {
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: {
    color: colors.gray500,
  },
});
