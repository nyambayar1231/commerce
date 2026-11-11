// Adapted from saleor-dashboard: src/components/AssignWarehouseDialog/AssignWarehouseDialog.tsx
// and src/components/AssignContainerDialog/AssignContainerRows.tsx
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's warehouse picker, simplified per the M3 owner decision: one checkbox per warehouse that
// the variant has no stock row in, with no search and no infinite scroll (our shop has one
// warehouse). Confirm hands the checked warehouses to the card and closes; Cancel and closing
// discard the selection.
import { Box, Checkbox, Text } from "@saleor/macaw-ui";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

import BackButton from "../../../components/BackButton";
import { ConfirmButton } from "../../../components/ConfirmButton/ConfirmButton";
import { DashboardModal } from "../../../components/Modal";
import type { WarehouseFragment } from "../../../graphql/types.generated";
import { messages } from "./messages";

interface AssignWarehouseDialogProps {
  open: boolean;
  warehouses: WarehouseFragment[];
  /** Hide a warehouse the variant already has a stock row in (Saleor's excludeContainer). */
  excludeContainer?: (warehouse: WarehouseFragment) => boolean;
  onSubmit: (warehouses: { id: string; name: string }[]) => void;
  onClose: () => void;
}

export const AssignWarehouseDialog = ({
  open,
  warehouses,
  excludeContainer,
  onSubmit,
  onClose,
}: AssignWarehouseDialogProps) => {
  const intl = useIntl();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // A reopening dialog starts empty: Confirm added the previous selection to the card, and Cancel
  // discards it.
  useEffect(() => {
    if (open) {
      setSelectedIds([]);
    }
  }, [open]);

  const availableWarehouses = excludeContainer
    ? warehouses.filter((warehouse) => !excludeContainer(warehouse))
    : warehouses;

  const toggle = (warehouseId: string) => {
    setSelectedIds((current) =>
      current.includes(warehouseId)
        ? current.filter((id) => id !== warehouseId)
        : [...current, warehouseId],
    );
  };

  const handleConfirm = () => {
    const selected = availableWarehouses.filter((warehouse) => selectedIds.includes(warehouse.id));

    onSubmit(selected.map(({ id, name }) => ({ id, name })));
    onClose();
  };

  return (
    <DashboardModal onChange={onClose} open={open}>
      <DashboardModal.Content size="sm">
        <DashboardModal.Header>{intl.formatMessage(messages.title)}</DashboardModal.Header>
        <DashboardModal.Body>
          {availableWarehouses.length === 0 ? (
            <Box paddingX={6} paddingY={3}>
              <Text color="default2">{intl.formatMessage(messages.noWarehousesAvailable)}</Text>
            </Box>
          ) : (
            <Box display="flex" flexDirection="column">
              {availableWarehouses.map((warehouse) => (
                <Box
                  key={warehouse.id}
                  display="flex"
                  alignItems="center"
                  paddingX={6}
                  paddingY={3}
                  data-test-id={warehouse.name}
                >
                  <Checkbox
                    name={warehouse.id}
                    checked={selectedIds.includes(warehouse.id)}
                    onCheckedChange={() => toggle(warehouse.id)}
                  >
                    <Text>{warehouse.name}</Text>
                  </Checkbox>
                </Box>
              ))}
            </Box>
          )}
        </DashboardModal.Body>
        <DashboardModal.Actions>
          <BackButton onClick={onClose} />
          <ConfirmButton
            data-test-id="assign-and-save-button"
            disabled={selectedIds.length === 0}
            transitionState="default"
            onClick={handleConfirm}
          >
            {intl.formatMessage(messages.confirm)}
          </ConfirmButton>
        </DashboardModal.Actions>
      </DashboardModal.Content>
    </DashboardModal>
  );
};

AssignWarehouseDialog.displayName = "AssignWarehouseDialog";
