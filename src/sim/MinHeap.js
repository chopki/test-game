// Binary min-heap keyed by numeric priority (used by the flow field's Dijkstra).
export class MinHeap {
  constructor() {
    this.values = [];
    this.priorities = [];
  }

  get size() {
    return this.values.length;
  }

  push(value, priority) {
    const { values, priorities } = this;
    values.push(value);
    priorities.push(priority);
    let i = values.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (priorities[parent] <= priorities[i]) break;
      this._swap(i, parent);
      i = parent;
    }
  }

  pop() {
    const { values, priorities } = this;
    const value = values[0];
    const priority = priorities[0];
    const lastValue = values.pop();
    const lastPriority = priorities.pop();
    if (values.length > 0) {
      values[0] = lastValue;
      priorities[0] = lastPriority;
      let i = 0;
      const n = values.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < n && priorities[l] < priorities[smallest]) smallest = l;
        if (r < n && priorities[r] < priorities[smallest]) smallest = r;
        if (smallest === i) break;
        this._swap(i, smallest);
        i = smallest;
      }
    }
    return { value, priority };
  }

  _swap(a, b) {
    const { values, priorities } = this;
    [values[a], values[b]] = [values[b], values[a]];
    [priorities[a], priorities[b]] = [priorities[b], priorities[a]];
  }
}
