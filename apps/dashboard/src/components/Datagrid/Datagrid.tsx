// Adapted from saleor-dashboard: src/components/Datagrid/Datagrid.tsx (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Saleor's Glide wrapper: columns and cells, loading and empty states, row hover, row links (the
// invisible anchor that follows the hovered row, so a row opens on click and in a new tab on
// Cmd/Ctrl/middle-click), checkbox row selection with selection actions, header clicks (sorting),
// row theme overrides, columns with their own click action (not part of the row link), the
// header's column-picker slot with resize/reorder support, cell editing with change tracking
// (`onChange`; edited cells tint until saved, `getCellError` cells turn red) and the per-row
// action bar (`menuItems` / `renderRowActions`). Not yet (each comes with its first user):
// fullscreen, tooltips, adding/removing rows in the grid, the trailing "ghost" row,
// horizontal-swipe history guard.
import "@glideapps/glide-data-grid/dist/index.css";

import DataEditor, {
  type CellClickedEventArgs,
  type DataEditorProps,
  type DataEditorRef,
  type DrawHeaderCallback,
  type EditableGridCell,
  type GridCell,
  type GridColumn,
  type GridMouseEventArgs,
  type GridSelection,
  type HeaderClickedEventArgs,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import { Box, Spinner, useTheme } from "@saleor/macaw-ui";
import {
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { NavigateOptions } from "react-router";

import { DashboardCard } from "../Card";
import { Placeholder } from "../Placeholder/Placeholder";
import { type RowActionItem, RowActions } from "./components/RowActions";
import { DEFAULT_ROW_MARKER_WIDTH } from "./const";
import { useCustomCellRenderers } from "./customCells/customRenderers";
import styles from "./Datagrid.module.css";
import { headerIcons } from "./headerIcons";
import {
  type DatagridChange,
  type OnDatagridChange,
  useDatagridChange,
} from "./hooks/useDatagridChange";
import { EMPTY_COLUMN_ID } from "./hooks/useEmptyColumn";
import { usePointerDragClickGuard } from "./hooks/usePointerDragClickGuard";
import { activateRowAnchor, hideRowAnchorElement, useRowAnchor } from "./hooks/useRowAnchor";
import { useRowAnchorHandler } from "./hooks/useRowAnchorHandler";
import { useRowHover } from "./hooks/useRowHover";
import { getForwardedWheelDelta } from "./rowAnchorWheel";
import { cellHeight, useDatagridTheme } from "./styles";
import type { AvailableColumn } from "./types";
import {
  getCellAction,
  getVisibleGridSelection,
  preventRowClickOnSelectionCheckbox,
} from "./utils";

type GetRowThemeCallback = NonNullable<DataEditorProps["getRowThemeOverride"]>;

export interface GetCellContentOpts {
  /** The edits not yet saved (see useDatagridChange). */
  changes: MutableRefObject<DatagridChange[]>;
  getChangeIndex: (column: string, row: number) => number;
}

/** Saleor's single action-bar width: one icon button per row. */
const ROW_ACTION_BAR_WIDTH = cellHeight;

export interface DatagridProps {
  availableColumns: readonly AvailableColumn[];
  emptyText: string;
  /** Replaces the default dashed placeholder when the grid has no rows. */
  emptyState?: ReactNode;
  getCellContent: (item: Item, opts: GetCellContentOpts) => GridCell;
  /** A cell drawn on the critical background. */
  getCellError?: (item: Item, opts: GetCellContentOpts) => boolean;
  /** Hears each cell edit; mark the cells clean once saved. */
  onChange?: OnDatagridChange;
  /** A row's actions, shown in the sticky right-hand bar. */
  menuItems?: (index: number) => RowActionItem[];
  /** Replaces the default RowActions for a row. */
  renderRowActions?: (index: number) => ReactElement;
  rowActionBarWidth?: number;
  columnSelect?: DataEditorProps["columnSelect"];
  rows: number;
  loading?: boolean;
  /** Rendered over the header while rows are selected (e.g. a bulk delete button). */
  selectionActions?: (selection: number[]) => ReactNode;
  onHeaderClicked?: (colIndex: number, event: HeaderClickedEventArgs) => void;
  /** Renders the column picker in the grid's fixed right-hand header slot. */
  renderColumnPicker?: () => ReactElement;
  onColumnMoved?: (startIndex: number, endIndex: number) => void;
  onColumnResize?: (column: GridColumn, newSize: number) => void;
  /** Scrolls this column into view once, then calls onClearRecentlyAddedColumn. */
  recentlyAddedColumn?: string | null;
  onClearRecentlyAddedColumn?: () => void;
  onRowClick?: (item: Item) => void;
  onRowSelectionChange?: (rowsId: number[], clearSelection: () => void) => void;
  readonly?: boolean;
  hasRowHover?: boolean;
  highlightedRow?: number;
  rowMarkers?: DataEditorProps["rowMarkers"];
  freezeColumns?: DataEditorProps["freezeColumns"];
  verticalBorder?: DataEditorProps["verticalBorder"];
  rowAnchor?: (item: Item) => string;
  rowHeight?: number | ((index: number) => number);
  headerHeight?: number;
  renderHeader?: () => ReactNode;
  navigatorOpts?: NavigateOptions;
  showTopBorder?: boolean;
  themeOverride?: Partial<Theme>;
  getRowThemeOverride?: GetRowThemeCallback;
  rowMarkerWidth?: number;
  rowMarkerTheme?: Partial<Theme>;
}

export const Datagrid = ({
  availableColumns,
  emptyText,
  emptyState,
  getCellContent,
  getCellError,
  onChange,
  menuItems,
  renderRowActions,
  rowActionBarWidth = ROW_ACTION_BAR_WIDTH,
  columnSelect = "none",
  rows,
  loading,
  selectionActions,
  onHeaderClicked,
  renderColumnPicker,
  onColumnMoved,
  onColumnResize,
  recentlyAddedColumn,
  onClearRecentlyAddedColumn,
  onRowClick,
  onRowSelectionChange,
  readonly = false,
  hasRowHover = false,
  highlightedRow,
  rowMarkers = "checkbox",
  freezeColumns = 1,
  verticalBorder,
  rowAnchor,
  rowHeight = cellHeight,
  headerHeight = cellHeight,
  renderHeader,
  navigatorOpts,
  showTopBorder = true,
  themeOverride,
  getRowThemeOverride: getRowThemeOverrideProp,
  rowMarkerWidth,
  rowMarkerTheme: rowMarkerThemeOverride,
}: DatagridProps): ReactElement => {
  const { themeValues, theme } = useTheme();
  const customRenderers = useCustomCellRenderers();
  const datagridTheme = useDatagridTheme(readonly);
  const finalTheme = useMemo(
    () => ({ ...datagridTheme, ...themeOverride }),
    [datagridTheme, themeOverride],
  );
  const rowMarkerTheme = useMemo(
    () => ({
      accentColor: themeValues.colors.background.accent1,
      accentFg: themeValues.colors.background.default1,
      accentLight: themeValues.colors.background.default2,
      ...rowMarkerThemeOverride,
    }),
    [themeValues, rowMarkerThemeOverride],
  );
  const editor = useRef<DataEditorRef | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<GridSelection>();
  const [areCellsDirty, setCellsDirty] = useState(true);
  const { changes, getChangeIndex, onCellEdited } = useDatagridChange(
    availableColumns,
    onChange,
    setCellsDirty,
  );
  const hasMenuItem = (menuItems?.(0).length ?? 0) > 0 || renderRowActions !== undefined;

  const handleGetCellContent = useCallback(
    (item: Item): GridCell => {
      const opts = { changes, getChangeIndex };
      const columnId = availableColumns[item[0]]?.id ?? "";
      const changed = changes.current[getChangeIndex(columnId, item[1])] !== undefined;
      const cell = getCellContent(item, opts);

      if (getCellError?.(item, opts)) {
        return { ...cell, themeOverride: { bgCell: themeValues.colors.background.critical1 } };
      }

      if (changed && areCellsDirty) {
        return {
          ...cell,
          themeOverride: {
            // Saleor's edited-cell tint (not in Macaw's palette).
            bgCell:
              theme === "defaultLight" ? "hsla(215, 100%, 96%, 1)" : "hsla(215, 100%, 21%, 1)",
          },
        };
      }

      return cell;
    },
    [
      areCellsDirty,
      availableColumns,
      changes,
      getCellContent,
      getCellError,
      getChangeIndex,
      theme,
      themeValues,
    ],
  );

  const handleOnCellEdited = useCallback(
    ([column, row]: Item, newValue: EditableGridCell): void => {
      setCellsDirty(true);
      onCellEdited([column, row], newValue);
      // Redraw the row: an edit can change other cells (e.g. the line total).
      editor.current?.updateCells(
        availableColumns.map((_, index) => ({ cell: [index, row] as Item })),
      );
    },
    [onCellEdited, availableColumns],
  );

  // Wheel lands on the overlay, not the grid. Forward axes the scroller can
  // move; leave the rest to the page. Always hide afterwards — page or grid
  // scroll moves the row out from under the cursor, and a parked href is stale.
  const handleRowAnchorWheel = useCallback((event: WheelEvent) => {
    const scroller = editorContainerRef.current?.querySelector<HTMLElement>(".dvn-scroller");
    const delta = scroller ? getForwardedWheelDelta(scroller, event) : null;

    if (scroller && delta) {
      scroller.scrollBy({ left: delta.left, top: delta.top, behavior: "auto" });
      event.preventDefault();
    }

    const anchor = event.currentTarget;

    if (anchor instanceof HTMLAnchorElement) {
      hideRowAnchorElement(anchor);
    }
  }, []);

  const { rowAnchorRef, setRowAnchorRef, setAnchorPosition } = useRowAnchor({
    getRowAnchorUrl: rowAnchor,
    rowMarkers,
    availableColumns,
    onWheel: handleRowAnchorWheel,
  });
  const rowAnchorHandler = useRowAnchorHandler(navigatorOpts);
  const hideActiveRowAnchor = useCallback((): void => {
    if (rowAnchorRef.current) {
      hideRowAnchorElement(rowAnchorRef.current);
    }
  }, [rowAnchorRef]);
  const {
    onClickCapture,
    onPointerCancelCapture,
    onPointerDownCapture,
    onPointerMoveCapture,
    onPointerUpCapture,
    shouldSuppressClick,
  } = usePointerDragClickGuard(hideActiveRowAnchor);
  const { handleRowHover, hoverRow } = useRowHover({
    hasRowHover,
    onRowHover: setAnchorPosition,
  });

  // Glide tracks selection by index and keeps it when the rows behind the grid
  // change. Report only indices that still exist so consumers cannot crash, and
  // rewrite the selection itself once loading is over.
  useEffect(
    function pruneAndReportVisibleRowSelection() {
      if (!selection) {
        return;
      }

      const { visibleRows, prunedSelection } = getVisibleGridSelection(selection, rows);

      if (!loading && prunedSelection) {
        setSelection(prunedSelection);
      }

      onRowSelectionChange?.(visibleRows, () => setSelection(undefined));
    },
    [loading, onRowSelectionChange, selection, rows],
  );

  const handleCellClick = useCallback(
    (item: Item, args: CellClickedEventArgs) => {
      if (shouldSuppressClick()) {
        return;
      }

      if (preventRowClickOnSelectionCheckbox(rowMarkers, item[0])) {
        return;
      }

      const intentToOpenInNewTab = args.metaKey || args.ctrlKey;

      // A plain click goes to onRowClick when given; Cmd/Ctrl-click falls through to the row
      // anchor so the row can open in a new tab.
      if (onRowClick && !intentToOpenInNewTab) {
        onRowClick(item);

        return;
      }

      if (getCellAction(availableColumns, item[0])) {
        return;
      }

      handleRowHover(args);
      activateRowAnchor(rowAnchorRef.current, { openInNewTab: intentToOpenInNewTab });
    },
    [rowMarkers, onRowClick, handleRowHover, rowAnchorRef, shouldSuppressClick, availableColumns],
  );

  const handleGridSelectionChange = (gridSelection: GridSelection) => {
    // In readonly we don't allow selecting cells, but we allow selecting rows.
    if (readonly && gridSelection.current) {
      return;
    }

    setSelection(gridSelection);
  };

  const handleGetThemeOverride = useCallback<GetRowThemeCallback>(
    (row: number) => {
      const customOverride = getRowThemeOverrideProp?.(row);
      const isActiveRow = highlightedRow !== undefined && row === highlightedRow;
      const isHoverRow = row === hoverRow;

      if (!customOverride && !isActiveRow && !isHoverRow) {
        return undefined;
      }

      let stateOverride: Partial<Theme> = {};

      if (isActiveRow) {
        stateOverride = {
          bgCell: themeValues.colors.background.default2,
          bgCellMedium: themeValues.colors.background.default2,
        };
      } else if (isHoverRow) {
        stateOverride = {
          // Grid-specific colors. Transparency matters when we highlight entire row.
          bgCell: theme === "defaultLight" ? "hsla(220, 18%, 97%, 1)" : "hsla(211, 32%, 19%, 1)",
          bgCellMedium: themeValues.colors.background.default1Hovered,
        };

        if (readonly) {
          stateOverride.accentLight = themeValues.colors.background.default1;
        }
      }

      return { ...customOverride, ...stateOverride };
    },
    [getRowThemeOverrideProp, highlightedRow, hoverRow, readonly, theme, themeValues],
  );

  const selectionActionsComponent = useMemo(
    () =>
      selection?.rows && selection.rows.length > 0 && selectionActions
        ? selectionActions(Array.from(selection.rows))
        : null,
    [selection, selectionActions],
  );

  // Scroll to a column the user just added, then clear the request so later column changes
  // (resize, reorder, removal) do not scroll again.
  useEffect(
    function scrollToRecentlyAddedColumn() {
      if (!recentlyAddedColumn || !editor.current) {
        return;
      }

      const columnIndex = availableColumns.findIndex((column) => column.id === recentlyAddedColumn);

      if (columnIndex === -1) {
        return;
      }

      editor.current.scrollTo(columnIndex, 0, "horizontal", 0, 0, { hAlign: "start" });
      onClearRecentlyAddedColumn?.();
    },
    [recentlyAddedColumn, availableColumns, onClearRecentlyAddedColumn],
  );

  // Glide's default header, plus Saleor's grip on a hovered header to show it can be dragged.
  const drawHeader: DrawHeaderCallback = useCallback(
    ({ ctx, rect, isSelected, isHovered, spriteManager, theme, column }) => {
      const columnMeta = availableColumns.find(
        (availableColumn) => availableColumn.id === column.id,
      );

      if (
        (isSelected || isHovered) &&
        column.id !== EMPTY_COLUMN_ID &&
        !columnMeta?.disableReorder
      ) {
        const iconSize = 16;
        const padding = 8;
        const x = rect.x + rect.width - iconSize - padding;
        const y = rect.y + (rect.height - iconSize) / 2;

        spriteManager.drawSprite("gripVertical", "normal", ctx, x, y, iconSize, theme);
      }

      return false;
    },
    [availableColumns],
  );

  const handleColumnResize = useCallback(
    (column: GridColumn, newSize: number) => {
      onColumnResize?.(column, newSize);
    },
    [onColumnResize],
  );

  const handleColumnMoved = useCallback(
    (startIndex: number, endIndex: number) => {
      if (!onColumnMoved) {
        return;
      }

      const startColumn = availableColumns[startIndex];
      const endColumn = availableColumns[endIndex];

      if (startColumn?.disableReorder || endColumn?.disableReorder) {
        return;
      }

      onColumnMoved(startIndex, endIndex);
    },
    [availableColumns, onColumnMoved],
  );

  if (loading) {
    return (
      <Box data-test-id="datagrid-loader" display="flex" justifyContent="center" marginY={9}>
        <Spinner />
      </Box>
    );
  }

  return (
    <Box
      onPointerCancelCapture={onPointerCancelCapture}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
    >
      <DashboardCard position="relative" gap={0}>
        {renderHeader?.()}
        <DashboardCard.Content
          height="100%"
          display="flex"
          flexDirection="column"
          paddingX={0}
          data-test-id="list"
        >
          {rows > 0 ? (
            <>
              {selectionActionsComponent && (
                <div className={styles.actionBtnBar}>{selectionActionsComponent}</div>
              )}
              <div className={styles.editorContainer} ref={editorContainerRef}>
                <Box
                  backgroundColor="default1"
                  borderTopWidth={showTopBorder ? 1 : 0}
                  borderTopStyle="solid"
                  borderColor="default1"
                />
                <DataEditor
                  width="100%"
                  theme={finalTheme}
                  customRenderers={customRenderers}
                  headerIcons={headerIcons}
                  drawHeader={drawHeader}
                  drawFocusRing={false}
                  rowMarkerTheme={rowMarkerTheme}
                  className={`${styles.datagrid} dashboard-datagrid`}
                  getCellContent={handleGetCellContent}
                  onCellEdited={handleOnCellEdited}
                  onPaste
                  columns={availableColumns}
                  rows={rows}
                  freezeColumns={freezeColumns}
                  verticalBorder={verticalBorder}
                  smoothScrollX
                  rowMarkers={rowMarkers}
                  rowSelect="multi"
                  rowSelectionMode="multi"
                  rangeSelect="multi-rect"
                  columnSelect={columnSelect}
                  getCellsForSelection
                  onColumnMoved={handleColumnMoved}
                  onColumnResize={handleColumnResize}
                  onHeaderClicked={onHeaderClicked}
                  onCellClicked={handleCellClick}
                  onGridSelectionChange={handleGridSelectionChange}
                  onItemHovered={(args: GridMouseEventArgs) => handleRowHover(args)}
                  getRowThemeOverride={handleGetThemeOverride}
                  gridSelection={selection}
                  rowHeight={rowHeight}
                  headerHeight={headerHeight}
                  ref={editor}
                  rowMarkerWidth={rowMarkerWidth ?? DEFAULT_ROW_MARKER_WIDTH}
                  rightElementProps={{ sticky: true }}
                  rightElement={
                    renderColumnPicker || hasMenuItem ? (
                      <div className={styles.rowActionBar} style={{ width: rowActionBarWidth }}>
                        <div
                          className={`${styles.columnPicker} ${hasMenuItem ? "" : styles.columnPickerBackground}`}
                        >
                          {renderColumnPicker?.()}
                        </div>
                        {hasMenuItem &&
                          Array.from({ length: rows }, (_, index) =>
                            renderRowActions ? (
                              renderRowActions(index)
                            ) : (
                              <RowActions
                                // biome-ignore lint/suspicious/noArrayIndexKey: one bar per grid row, by position (Saleor's)
                                key={`row-actions-${index}`}
                                menuItems={menuItems?.(index) ?? []}
                              />
                            ),
                          )}
                      </div>
                    ) : undefined
                  }
                />
              </div>
            </>
          ) : (
            <Box paddingX={6} paddingTop={renderHeader ? 5 : undefined} paddingBottom={6}>
              {emptyState ?? (
                <Placeholder>
                  <span data-test-id="empty-data-grid-text">{emptyText}</span>
                </Placeholder>
              )}
            </Box>
          )}
        </DashboardCard.Content>
      </DashboardCard>
      {rowAnchor && (
        // biome-ignore lint/a11y/useAnchorContent: Saleor's invisible, aria-hidden row link; Glide owns keyboard focus
        <a
          ref={setRowAnchorRef}
          className={styles.rowAnchor}
          data-test-id="datagrid-row-anchor"
          tabIndex={-1}
          aria-hidden={true}
          // biome-ignore lint/a11y/useValidAnchor: the href is set on hover by useRowAnchor
          onClick={rowAnchorHandler}
          onClickCapture={onClickCapture}
        />
      )}
    </Box>
  );
};
