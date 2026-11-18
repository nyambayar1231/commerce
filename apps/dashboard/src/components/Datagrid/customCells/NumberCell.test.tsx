// @vitest-environment jsdom
// The number cell's editor as Glide drives it (M14.3 fix rounds). Glide mounts one editor per
// overlay and, when a typed key lands on the canvas instead of the input, re-opens the *same*
// overlay with that key as `initialValue`, synchronously inside the keydown handler (its
// `reselect` keeps the component mounted). The editor has to apply such a key *and* put it in the
// input before the browser dispatches the next one: a key that is only applied on mount is
// dropped, and one whose text and focus arrive a task later (a passive effect) leaves the input
// showing the old, fully selected value, so the rest of the typed number replaces it.
import { cleanup, fireEvent, render } from "@testing-library/react";
import { type ComponentType, useState } from "react";
import { flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { numberCell } from "./cells";
import { type NumberCell, numberCellEmptyValue, numberCellRenderer } from "./NumberCell";

afterEach(cleanup);

interface EditorProps {
  value: NumberCell;
  onChange: (cell: NumberCell) => void;
  initialValue?: string;
  isHighlighted?: boolean;
}

const NumberCellEditor = () => {
  const provideEditor = numberCellRenderer("en").provideEditor as unknown as (cell: NumberCell) => {
    editor: ComponentType<EditorProps>;
  };

  return provideEditor(numberCell(numberCellEmptyValue)).editor;
};

const input = () => document.querySelector<HTMLInputElement>('[data-test-id="number-cell-input"]');
const canvas = () => document.querySelector<HTMLElement>('[data-test-id="glide-canvas"]');

interface OverlayProps {
  value: NumberCell;
  onFinish: (cell: NumberCell) => void;
  editor: ComponentType<EditorProps>;
}

/** Glide's overlay editor, reduced to the parts this editor sees. */
const Overlay = ({ value, onFinish, editor: Editor }: OverlayProps) => {
  // Glide keeps the editor's onChange result as the overlay's own value, next to the cell content.
  const [tempValue, setTempValue] = useState<NumberCell>();
  const [initialValue, setInitialValue] = useState<string>();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Glide's overlay container is not interactive; it only sees Enter bubble from the editor
    <div
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onFinish(tempValue ?? value);
        }
      }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Glide's grid canvas is focusable and owns the keyboard */}
      <div
        data-test-id="glide-canvas"
        tabIndex={-1}
        onKeyDown={(event) => {
          // Glide's `reselect`: a key typed while the canvas has the focus re-opens the same
          // mounted overlay with it as `initialValue`, in the same keydown event. A discrete React
          // event renders and commits synchronously; `flushSync` is that commit without the act()
          // wrapper, which would also run the passive effects the real browser runs later.
          if (event.key.length === 1) {
            flushSync(() => setInitialValue(event.key));
          }
        }}
      />
      <Editor
        value={tempValue ?? value}
        onChange={setTempValue}
        initialValue={initialValue}
        isHighlighted={initialValue === undefined}
      />
    </div>
  );
};

const renderOverlay = (value: number | typeof numberCellEmptyValue) => {
  const onFinish = vi.fn();

  const Editor = NumberCellEditor();

  render(<Overlay value={numberCell(value)} onFinish={onFinish} editor={Editor} />);

  return { onFinish };
};

/** A digit typed with the focus on the grid canvas, as a real keydown reaches it. */
const typeOnCanvas = (key: string) => {
  canvas()?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
};

/** The value the browser leaves in the input for a digit typed at its end. */
const typeIntoInput = (key: string) => {
  const element = input() as HTMLInputElement;

  fireEvent.change(element, { target: { value: `${element.value}${key}` } });
};

describe("number cell editor", () => {
  it("commits what is typed into the focused input", () => {
    const { onFinish } = renderOverlay(numberCellEmptyValue);

    expect(document.activeElement).toBe(input());

    typeIntoInput("7");

    expect(document.activeElement).toBe(input());
    fireEvent.keyDown(input() as HTMLInputElement, { key: "Enter" });
    expect(onFinish).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ value: 7 }) }),
    );
  });

  it("applies a typed key Glide re-seeds the open overlay with and takes the focus back", () => {
    renderOverlay(numberCellEmptyValue);

    // Nothing was typed into the input: Glide moves the focus to the grid and the key lands there.
    canvas()?.focus();
    expect(document.activeElement).toBe(canvas());

    typeOnCanvas("7");

    expect(input()?.value).toBe("7");
    // The rest of the typing and Enter must reach the input now.
    expect(document.activeElement).toBe(input());
  });

  it("seeds a key typed on the canvas into a still-empty cell without losing later input", () => {
    const { onFinish } = renderOverlay(numberCellEmptyValue);

    canvas()?.focus();
    typeOnCanvas("7");
    typeIntoInput("1");

    expect(input()?.value).toBe("71");
    fireEvent.keyDown(input() as HTMLInputElement, { key: "Enter" });
    expect(onFinish).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ value: 71 }) }),
    );
  });

  it("keeps every digit when the first one goes through Glide's re-seed path", () => {
    // The brief's Chrome case: the cell shows 1,000, a double-click opens the editor with it
    // selected, Glide's requestAnimationFrame moves the focus back to the grid, and `2500` is
    // typed. The first digit is the one Glide re-seeds the mounted overlay with.
    const { onFinish } = renderOverlay(1000);

    expect(input()?.value).toBe("1000");

    // Glide's `focus()` runs in a requestAnimationFrame after the overlay opens.
    canvas()?.focus();
    expect(document.activeElement).toBe(canvas());

    typeOnCanvas("2");

    // The key is in the input as soon as the keydown that carried it returns: no keystroke can
    // arrive before it, so the rest of the number continues it instead of replacing "1000".
    expect(input()?.value).toBe("2");
    expect(document.activeElement).toBe(input());

    typeIntoInput("5");
    typeIntoInput("0");
    typeIntoInput("0");

    expect(input()?.value).toBe("2500");
    fireEvent.keyDown(input() as HTMLInputElement, { key: "Enter" });
    expect(onFinish).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ value: 2500 }) }),
    );
  });

  it("keeps the rest of a number that starts with the digit the cell holds", () => {
    const { onFinish } = renderOverlay(5);

    canvas()?.focus();
    typeOnCanvas("5");
    typeIntoInput("2");

    expect(input()?.value).toBe("52");
    fireEvent.keyDown(input() as HTMLInputElement, { key: "Enter" });
    expect(onFinish).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ value: 52 }) }),
    );
  });
});
