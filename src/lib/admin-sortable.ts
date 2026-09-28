// Drag-to-reorder for an Admin <ul>, with no dependency. Uses Pointer Events
// (mouse, pen and touch behave the same) on an explicit drag handle: the
// handle sets `touch-action: none`, so on a phone dragging it reorders while
// swiping anywhere else on the row still scrolls the page. Up/down buttons
// give the same result without dragging (keyboard, accessibility, and moving
// an item a long way on a small screen).
//
// Expected markup: each direct child of `list` is an item with `data-id`
// and, inside it, optional `[data-drag-handle]`, `[data-move-up]`,
// `[data-move-down]` and `[data-position]` elements.

interface SortableOptions {
  // Called with the ids in their new order after every change. If it
  // rejects, the list snaps back to the previous order.
  onChange: (ids: string[]) => Promise<void>;
  status?: HTMLElement | null;
}

const DRAGGING_CLASSES = ['bg-(--color-paper-raised)', 'shadow-lg', 'relative', 'z-10', 'opacity-95'];
const EDGE_PX = 80;

export function initSortable(list: HTMLElement, { onChange, status }: SortableOptions) {
  const items = () => [...list.children] as HTMLElement[];
  const currentIds = () => items().map((el) => el.dataset.id!);

  let saved = currentIds();
  let saving: Promise<void> = Promise.resolve();

  function refresh() {
    const all = items();
    all.forEach((el, index) => {
      const position = el.querySelector('[data-position]');
      if (position) position.textContent = String(index + 1);
      const up = el.querySelector<HTMLButtonElement>('[data-move-up]');
      const down = el.querySelector<HTMLButtonElement>('[data-move-down]');
      if (up) up.disabled = index === 0;
      if (down) down.disabled = index === all.length - 1;
    });
  }

  function say(message: string) {
    if (status) status.textContent = message;
  }

  // Saves are queued, so two quick moves can't reach the server out of order.
  function commit() {
    const ids = currentIds();
    if (ids.every((id, i) => id === saved[i])) return;
    const previous = saved;
    saved = ids;
    say('Saving…');
    saving = saving.then(async () => {
      try {
        await onChange(ids);
        say('Order saved.');
      } catch (error) {
        // Restore the last order the server confirmed.
        const byId = new Map(items().map((el) => [el.dataset.id!, el]));
        previous.forEach((id) => list.appendChild(byId.get(id)!));
        saved = previous;
        refresh();
        say(error instanceof Error ? error.message : 'Could not save the new order.');
      }
    });
  }

  function move(item: HTMLElement, direction: -1 | 1) {
    const sibling = direction < 0 ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    if (direction < 0) list.insertBefore(item, sibling);
    else list.insertBefore(sibling, item);
    refresh();
    commit();
    item.querySelector<HTMLButtonElement>(direction < 0 ? '[data-move-up]' : '[data-move-down]')?.focus();
  }

  list.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-move-up], [data-move-down]');
    const item = button?.closest<HTMLElement>('[data-id]');
    if (!button || !item || button.disabled) return;
    move(item, button.hasAttribute('data-move-up') ? -1 : 1);
  });

  list.addEventListener('pointerdown', (event) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-handle]');
    const item = handle?.closest<HTMLElement>('[data-id]');
    if (!handle || !item || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    item.classList.add(...DRAGGING_CLASSES);

    let pointerY = event.clientY;
    let raf = 0;

    // Places the dragged item before the first other item whose midpoint is
    // below the pointer (or last, if none is).
    function place() {
      const others = items().filter((el) => el !== item);
      const before = others.find((el) => {
        const rect = el.getBoundingClientRect();
        return pointerY < rect.top + rect.height / 2;
      });
      const target = before ?? null;
      if (target ? item!.nextElementSibling !== target : list.lastElementChild !== item) {
        list.insertBefore(item!, target);
        refresh();
      }
    }

    // Scrolls the page while the pointer is held near the top/bottom edge,
    // so an item can be dragged past what's currently on screen.
    function autoScroll() {
      const speed =
        pointerY < EDGE_PX ? -(EDGE_PX - pointerY) / 4
        : pointerY > innerHeight - EDGE_PX ? (pointerY - (innerHeight - EDGE_PX)) / 4
        : 0;
      if (speed) {
        window.scrollBy(0, speed);
        place();
      }
      raf = requestAnimationFrame(autoScroll);
    }
    raf = requestAnimationFrame(autoScroll);

    // Listeners live on window, not the handle: moving the row in the DOM
    // detaches and re-attaches the handle, which would drop pointer capture
    // (and every later move/up event) mid-drag.
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      pointerY = e.clientY;
      place();
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) return;
      cancelAnimationFrame(raf);
      item.classList.remove(...DRAGGING_CLASSES);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      commit();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  });

  refresh();
}
