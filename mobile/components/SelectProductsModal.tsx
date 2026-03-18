/**
 * Multi-select modal for products (visit products with quantity sold/given).
 * Same pattern as SelectActivityTypesModal: search, checkmarks, Done.
 */
import type { ProductOption } from "@/lib/api";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from "react-native";
import { Button, Searchbar, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, spacing } from "@/constants/theme";

export interface SelectProductsModalProps {
  visible: boolean;
  onClose: () => void;
  products: ProductOption[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  title?: string;
}

function matchProduct(p: ProductOption, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.trim().toLowerCase();
  return (
    (p.name ?? "").toLowerCase().includes(lower) ||
    (p.code ?? "").toLowerCase().includes(lower)
  );
}

export function SelectProductsModal({
  visible,
  onClose,
  products,
  selectedIds,
  onSelect,
  title = "Select products",
}: SelectProductsModalProps) {
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string[]>(selectedIds);
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
    if (visible) {
      setSearch("");
      setPending(selectedIds);
    }
  }, [visible, selectedIds]);

  const filtered = useMemo(
    () => products.filter((p) => matchProduct(p, search)),
    [products, search]
  );

  const handleToggle = (id: string) => {
    setPending((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleDone = () => {
    onSelect(pending);
    onClose();
  };

  const renderItem = ({ item }: { item: ProductOption }) => {
    const selected = pending.includes(item.id);
    return (
      <Pressable
        style={[styles.option, selected && styles.optionSelected]}
        onPress={() => handleToggle(item.id)}
      >
        <Text variant="bodyMedium" numberOfLines={1} style={styles.optionText}>
          {item.name}
          {item.unit ? ` (${item.unit})` : ""}
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
            placeholder="Search products…"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
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
                    No products match "{search.trim()}"
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
