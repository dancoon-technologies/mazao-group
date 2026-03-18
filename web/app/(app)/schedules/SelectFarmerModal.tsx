"use client";

import type { Farmer } from "@/lib/types";
import {
  Button,
  Modal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";

export interface SelectFarmerModalProps {
  opened: boolean;
  onClose: () => void;
  title?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filteredFarmers: Farmer[];
  selectedFarmerId: string;
  onSelect: (farmerId: string) => void;
  onClear: () => void;
}

export function SelectFarmerModal({
  opened,
  onClose,
  title = "Select farmer",
  searchValue,
  onSearchChange,
  filteredFarmers,
  selectedFarmerId,
  onSelect,
  onClear,
}: SelectFarmerModalProps) {
  const handleClear = () => {
    onClear();
    onClose();
  };

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={title} size="md">
      <Stack gap="md">
        <TextInput
          type="search"
          label="Search"
          placeholder="Search by name or phone…"
          leftSection={<IconSearch size={16} />}
          value={searchValue}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
        />
        <ScrollArea h={320}>
          <Stack gap={0}>
            <FarmerModalOption
              label={`— No specific ${title.replace("Select ", "").toLowerCase()} —`}
              selected={false}
              onClick={handleClear}
            />
            {filteredFarmers.map((f) => (
              <FarmerModalOption
                key={f.id}
                label={`${f.display_name}${f.phone ? ` · ${f.phone}` : ""}`}
                selected={selectedFarmerId === f.id}
                onClick={() => handleSelect(f.id)}
              />
            ))}
          </Stack>
        </ScrollArea>
        {filteredFarmers.length === 0 && searchValue.trim() && (
          <Text size="sm" c="dimmed">
            No matches for &quot;{searchValue.trim()}&quot;
          </Text>
        )}
      </Stack>
    </Modal>
  );
}

function FarmerModalOption({
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
