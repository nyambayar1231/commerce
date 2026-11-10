// Adapted from saleor-dashboard: src/components/ConditionalFilter/UI/EventEmitter.ts
// (BSD-3-Clause, Copyright (c) 2020-2021, Saleor Commerce)
// See THIRD_PARTY_LICENSES.md
// Rows talk to FiltersArea through DOM events, as Saleor. Only the events the panel handles are
// kept: the right-hand focus/input/scroll events drive the category picker's API pages; the
// attribute and blur events are dropped with those controls.
import type {
  ConditionChangeData,
  LeftOperatorChangeData,
  RightOperatorChangeData,
  RightOperatorFocusData,
  RightOperatorInputValueChangeData,
  RightOperatorScrollEndData,
  RowAddData,
  RowRemoveData,
} from "./types";

export class FilterEventEmitter extends EventTarget {
  type = "filterChange";

  addRow() {
    this.dispatchEvent(
      new CustomEvent<RowAddData>(this.type, {
        detail: {
          type: "row.add",
        },
      }),
    );
  }

  removeRow(index: number) {
    this.dispatchEvent(
      new CustomEvent<RowRemoveData>(this.type, {
        detail: {
          type: "row.remove",
          path: `${index}`,
          index,
        },
      }),
    );
  }

  changeLeftOperator(index: number, value: LeftOperatorChangeData["value"]) {
    this.dispatchEvent(
      new CustomEvent<LeftOperatorChangeData>(this.type, {
        detail: {
          type: "leftOperator.onChange",
          path: `${index}`,
          value,
          index,
        },
      }),
    );
  }

  changeCondition(index: number, value: ConditionChangeData["value"]) {
    this.dispatchEvent(
      new CustomEvent<ConditionChangeData>(this.type, {
        detail: {
          type: "condition.onChange",
          path: `${index}.condition.selected`,
          value,
          index,
        },
      }),
    );
  }

  changeRightOperator(index: number, value: RightOperatorChangeData["value"]) {
    this.dispatchEvent(
      new CustomEvent<RightOperatorChangeData>(this.type, {
        detail: {
          type: "rightOperator.onChange",
          path: `${index}.condition.selected.value`,
          value,
          index,
        },
      }),
    );
  }

  focusRightOperator(index: number) {
    this.dispatchEvent(
      new CustomEvent<RightOperatorFocusData>(this.type, {
        detail: {
          type: "rightOperator.onFocus",
          path: `${index}.condition.selected.value`,
          index,
        },
      }),
    );
  }

  inputChangeRightOperator(index: number, value: string) {
    this.dispatchEvent(
      new CustomEvent<RightOperatorInputValueChangeData>(this.type, {
        detail: {
          type: "rightOperator.onInputValueChange",
          path: `${index}.condition.selected.value`,
          index,
          value,
        },
      }),
    );
  }

  scrollEndRightOperator(index: number) {
    this.dispatchEvent(
      new CustomEvent<RightOperatorScrollEndData>(this.type, {
        detail: {
          type: "rightOperator.onScrollEnd",
          path: `${index}.condition.selected.value`,
          index,
        },
      }),
    );
  }
}
