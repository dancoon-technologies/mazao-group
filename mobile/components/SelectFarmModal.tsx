import type { Farm } from "@/lib/api";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Button, Searchbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

export interface SelectFarmModalProps {
  visible: boolean;
  onClose: () => void;
  farms: Farm[];
  selectedFarmId: string | null;
  onSelect: (farmId: string | null) => void;
  title?: string;
}

function matchFarm(f: Farm, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  const village = (f.village ?? "").toLowerCase();
  const county = (f.county ?? "").toLowerCase();
  const subCounty = (f.sub_county ?? "").toLowerCase();
  const region = (f.region ?? "").toLowerCase();
  return (
    village.includes(lower) ||
    county.includes(lower) ||
    subCounty.includes(lower) ||
    region.includes(lower)
  );
}

function farmLabel(f: Farm): string {
  const parts = [f.village];
  if (f.county) parts.push(f.county);
  return parts.join(" · ");
}

export function SelectFarmModal({
  visible,
  onClose,
  farms,
  selectedFarmId,
  onSelect,
  title = "Select farm",
}: SelectFarmModalProps) {
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
    return farms.filter((f) => matchFarm(f, search));
  }, [farms, search]);

  const handleSelect = (id: string | null) => {
    onSelect(id);
    setSearch("");
    onClose();
  };

  const renderItem = ({ item }: { item: Farm }) => {
    const label = farmLabel(item);
    const selected = selectedFarmId === item.id;
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.avoiding}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            <Button mode="text" compact onPress={onClose} style={styles.closeBtn}>
              Close
            </Button>
          </View>
          <Searchbar
            placeholder="Search by village, crop, county…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          <View style={styles.noneRow}>
            <Button
              mode={selectedFarmId === null ? "contained" : "outlined"}
              compact
              onPress={() => handleSelect(null)}
              style={styles.noneBtn}
            >
              None
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
                    No farms match "{search.trim()}"
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avoiding: {
    flex: 1,
    justifyContent: "flex-end",
  },
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
  },
  noneRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  noneBtn: {
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
