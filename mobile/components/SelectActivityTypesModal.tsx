import type { ActivityTypeOption } from "@/lib/api";
import React, { useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
} from "react-native";
import { ActivityIndicator, Button, Searchbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

export interface SelectActivityTypesModalProps {
  visible: boolean;
  onClose: () => void;
  options: ActivityTypeOption[];
  selectedValues: string[];
  onSelect: (values: string[]) => void;
  title?: string;
  /** When true, show loading instead of list so stale options are not shown while refetching. */
  refreshing?: boolean;
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
  refreshing = false,
}: SelectActivityTypesModalProps) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string[]>(selectedValues);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  React.useEffect(() => {
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

  React.useEffect(() => {
    if (visible) {
      setSearch("");
      setPending(selectedValues);
    }
  }, [visible, selectedValues]);

  const filtered = useMemo(() => {
    const activeOnly = options.filter((o) => o.is_active !== false);
    return activeOnly.filter((o) => matchOption(o, search));
  }, [options, search]);

  const handleToggle = (value: string) => {
    const isSelected = pending.includes(value);
    if (isSelected && pending.length <= 1) return; // keep at least one
    setPending((prev) =>
      isSelected ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleDone = () => {
    const next = pending.length > 0 ? pending : [filtered[0]?.value].filter(Boolean);
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
        <Text variant="bodyMedium" numberOfLines={1} style={styles.optionText}>
          {item.label ?? item.value}
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
          <View
            style={[
              styles.sheet,
              keyboardHeight > 0 && {
                height: Dimensions.get("window").height - keyboardHeight - 24,
                maxHeight: Dimensions.get("window").height - keyboardHeight - 24,
              },
            ]}
          >
          <View style={styles.header}>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            <Button mode="text" compact onPress={onClose} style={styles.closeBtn}>
              Close
            </Button>
          </View>
          <Searchbar
            placeholder="Search activities…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          {refreshing ? (
            <View style={styles.refreshing}>
              <ActivityIndicator size="small" />
              <Text variant="bodySmall" style={styles.emptyText}>Loading activities…</Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.value}
              renderItem={renderItem}
              style={[styles.list, keyboardHeight > 0 && { flex: 1 }]}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text variant="bodySmall" style={styles.emptyText}>
                    {search.trim()
                      ? `No activities match "${search.trim()}"`
                      : options.length === 0
                        ? "No activity types available. Try again later."
                        : "No activities match your search."}
                  </Text>
                </View>
              }
            />
          )}
          <View style={styles.footer}>
            <Text variant="bodySmall" style={styles.count}>
              {pending.length} selected
            </Text>
            <Button mode="contained" onPress={handleDone} style={styles.doneBtn}>
              Done
            </Button>
          </View>
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
    maxHeight: "90%",
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
  list: {
    maxHeight: 480,
  },
  refreshing: {
    minHeight: 200,
    maxHeight: 480,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.sm,
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
