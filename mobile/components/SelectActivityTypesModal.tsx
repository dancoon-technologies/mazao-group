import type { ActivityTypeOption } from "@/lib/api";
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
} from "react-native";
import { Button, Searchbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

export interface SelectActivityTypesModalProps {
  visible: boolean;
  onClose: () => void;
  options: ActivityTypeOption[];
  selectedValues: string[];
  onSelect: (values: string[]) => void;
  title?: string;
}

function matchOption(opt: ActivityTypeOption, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  return (
    (opt.label ?? "").toLowerCase().includes(lower) ||
    (opt.value ?? "").toLowerCase().includes(lower)
  );
}

export function SelectActivityTypesModal({
  visible,
  onClose,
  options,
  selectedValues,
  onSelect,
  title = "Select activities",
}: SelectActivityTypesModalProps) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string[]>(selectedValues);

  React.useEffect(() => {
    if (visible) {
      setSearch("");
      setPending(selectedValues);
    }
  }, [visible, selectedValues]);

  const filtered = useMemo(() => {
    return options.filter((o) => matchOption(o, search));
  }, [options, search]);

  const handleToggle = (value: string) => {
    const isSelected = pending.includes(value);
    if (isSelected && pending.length <= 1) return; // keep at least one
    setPending((prev) =>
      isSelected ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleDone = () => {
    const next = pending.length > 0 ? pending : [options[0]?.value].filter(Boolean);
    onSelect(next);
    onClose();
  };

  const renderItem = ({ item }: { item: ActivityTypeOption }) => {
    const selected = pending.includes(item.value);
    return (
      <Pressable
        style={[styles.option, selected && styles.optionSelected]}
        onPress={() => handleToggle(item.value)}
      >
        <Text variant="bodyMedium" numberOfLines={2} style={styles.optionText}>
          {item.label ?? item.value}
        </Text>
        {selected && (
          <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />
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
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            <Button mode="text" compact onPress={onClose} style={styles.closeBtn}>
              Cancel
            </Button>
          </View>
          <Text variant="bodySmall" style={styles.hint}>
            Tap to add or remove. At least one activity is required.
          </Text>
          <Searchbar
            placeholder="Search activities…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.value}
            renderItem={renderItem}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              search.trim() ? (
                <View style={styles.empty}>
                  <Text variant="bodySmall" style={styles.emptyText}>
                    No activities match "{search.trim()}"
                  </Text>
                </View>
              ) : null
            }
          />
          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.count}>
              {pending.length} selected
            </Text>
            <Button mode="contained" onPress={handleDone} style={styles.doneBtn}>
              Done
            </Button>
          </View>
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
    paddingBottom: spacing.xs,
  },
  title: {
    fontWeight: "600",
    color: colors.gray900,
  },
  closeBtn: {
    marginRight: -8,
  },
  hint: {
    color: colors.gray500,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchInput: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray200,
  },
  count: {
    color: colors.gray500,
  },
  doneBtn: {
    minWidth: 100,
  },
});
