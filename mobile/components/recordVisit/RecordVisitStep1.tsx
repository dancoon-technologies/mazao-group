import type { Dispatch, SetStateAction } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Surface, Text, TextInput } from 'react-native-paper';
import type { ActivityFormFieldOption, ProductOption, VisitFormFieldSchemaItem } from '@/lib/api';
import { getStep3InputType, type Step3Values } from '@/lib/constants/visitFormFields';
import { SelectProductsModal } from '@/components/SelectProductsModal';
import type { VisitProductLine } from '@/lib/recordVisit/types';
import { styles } from './styles';

export type { VisitProductLine };

type Props = {
  step3Fields: ActivityFormFieldOption[];
  step3Values: Step3Values;
  setStep3Values: Dispatch<SetStateAction<Step3Values>>;
  visitFormFieldSchema: Record<string, VisitFormFieldSchemaItem> | null | undefined;
  productLines: VisitProductLine[];
  setProductLines: Dispatch<SetStateAction<VisitProductLine[]>>;
  products: ProductOption[];
  productModalOpen: boolean;
  productModalFieldKey: string | null;
  setProductModalOpen: Dispatch<SetStateAction<boolean>>;
  setProductModalFieldKey: Dispatch<SetStateAction<string | null>>;
  error: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function RecordVisitStep1({
  step3Fields,
  step3Values,
  setStep3Values,
  visitFormFieldSchema,
  productLines,
  setProductLines,
  products,
  productModalOpen,
  productModalFieldKey,
  setProductModalOpen,
  setProductModalFieldKey,
  error,
  submitting,
  onBack,
  onSubmit,
}: Props) {
  return (
    <>
      <Surface style={styles.section} elevation={0}>
        <Text variant="labelLarge" style={styles.fieldLabel}>Additional details</Text>
        <Text variant="bodySmall" style={styles.hint}>
          {step3Fields.length ? 'Relevant fields for this activity type.' : 'Optional details.'}
        </Text>
        {step3Fields.map((f) => {
          const requiredLabel = f.required ? `${f.label} (required)` : f.label;
          const value = step3Values[f.key] ?? '';
          const setValue = (v: string) => setStep3Values((prev) => ({ ...prev, [f.key]: v }));
          const inputType = getStep3InputType(f.key, visitFormFieldSchema);
          if (inputType === 'product') {
            return null;
          }
          return (
            <TextInput
              key={f.key}
              label={requiredLabel}
              value={value}
              onChangeText={setValue}
              mode="outlined"
              keyboardType={inputType === 'number' ? 'decimal-pad' : inputType === 'integer' ? 'number-pad' : undefined}
              multiline={inputType === 'multiline'}
              numberOfLines={inputType === 'multiline' ? 2 : undefined}
              placeholder={f.label}
              style={styles.input}
            />
          );
        })}
      </Surface>

      {step3Fields.some((f) => f.key === 'product_lines') && (
        <Surface style={styles.section} elevation={0}>
          <Text variant="labelLarge" style={styles.fieldLabel}>Products</Text>
          <Text variant="bodySmall" style={styles.hint}>
            Optional. Record products sold or given during this visit.
          </Text>
          {productLines.map((line, index) => {
            const productLabel = line.product_name + (line.product_unit ? ` (${line.product_unit})` : '');
            return (
              <View key={`${line.product_id}-${index}`} style={styles.productLineCard}>
                <Text variant="labelMedium" numberOfLines={1}>{productLabel}</Text>
                <View style={styles.productLineRow}>
                  <TextInput
                    label="Qty sold"
                    value={line.quantity_sold}
                    onChangeText={(t) => setProductLines((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], quantity_sold: t };
                      return next;
                    })}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    placeholder="0"
                    style={styles.productLineInput}
                  />
                  <TextInput
                    label="Qty given"
                    value={line.quantity_given}
                    onChangeText={(t) => setProductLines((prev) => {
                      const next = [...prev];
                      next[index] = { ...next[index], quantity_given: t };
                      return next;
                    })}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    placeholder="0"
                    style={styles.productLineInput}
                  />
                  <Button
                    mode="text"
                    compact
                    icon="delete-outline"
                    onPress={() => setProductLines((prev) => prev.filter((_, i) => i !== index))}
                    style={styles.productLineRemove}
                    accessibilityLabel="Remove product"
                  >
                    Remove
                  </Button>
                </View>
              </View>
            );
          })}
          <Button
            mode="outlined"
            onPress={() => {
              setProductModalFieldKey('product_lines');
              setProductModalOpen(true);
            }}
            icon="plus"
            style={styles.productFocusButton}
          >
            Add product
          </Button>
          <SelectProductsModal
            visible={productModalOpen && productModalFieldKey === 'product_lines'}
            onClose={() => {
              setProductModalOpen(false);
              setProductModalFieldKey(null);
            }}
            products={products}
            selectedIds={[]}
            onSelect={(ids) => {
              const toAdd = products.filter((p) => ids.includes(p.id)).map((p) => ({
                product_id: p.id,
                product_name: p.name,
                product_unit: p.unit,
                quantity_sold: '',
                quantity_given: '',
              }));
              setProductLines((prev) => [...prev, ...toAdd]);
              setProductModalOpen(false);
              setProductModalFieldKey(null);
            }}
            title="Select products"
          />
        </Surface>
      )}

      {error ? (
        <HelperText type="error" style={styles.errorBlock}>{error}</HelperText>
      ) : null}

      <Surface style={styles.actionsSection} elevation={0}>
        <Button mode="outlined" onPress={onBack} style={styles.nextBtn}>
          Back
        </Button>
        <Button
          mode="contained"
          onPress={onSubmit}
          loading={submitting}
          disabled={submitting}
          style={styles.submitBtn}
          accessibilityLabel="Record visit"
        >
          Record Visit
        </Button>
      </Surface>
    </>
  );
}
