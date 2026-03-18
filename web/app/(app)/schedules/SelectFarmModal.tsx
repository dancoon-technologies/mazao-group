"use client";

import type { Farm } from "@/lib/types";
import {
  Button,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

export interface SelectFarmModalProps {
  opened: boolean;
  onClose: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filteredFarms: Farm[];
  selectedFarmId: string;
  onSelect: (farmId: string) => void;
  onClear: () => void;
}

export function SelectFarmModal({
  opened,
  onClose,
  searchValue,
  onSearchChange,
  filteredFarms,
  selectedFarmId,
  onSelect,
  onClear,
}: SelectFarmModalProps) {
  const handleClear = () => {
    onClear();
    onClose();
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Select farm" size="md">
      <Stack gap="md">
        <TextInput
          type="search"
          label="Search"
          placeholder="Search by village, crop, county…"
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <ScrollArea h={320}>
          <Stack gap={0}>
            <FarmModalOption
              label="— None —"
              selected={false}
              onClick={handleClear}
            />
            {filteredFarms.map((f) => (
              <FarmModalOption
                key={f.id}
                label={f.village}
                selected={selectedFarmId === f.id}
                onClick={() => handleSelect(f.id)}
              />
            ))}
          </Stack>
        </ScrollArea>
        {filteredFarms.length === 0 && searchValue.trim() && (
          <Text size="sm" c="dimmed">
            No farms match &quot;{searchValue.trim()}&quot;
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

function FarmModalOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={selected ? "light" : "subtle"}
      color={selected ? "green" : undefined}
      fullWidth
      justify="flex-start"
      onClick={onClick}
    >
      <Text size="sm" truncate>
        {label}
      </Text>
    </Button>
  );
}
