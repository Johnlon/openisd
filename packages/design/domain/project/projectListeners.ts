export class ProjectListeners {
    readonly #set = new Set<() => void>();
    #depth = 0;
    #pending = false;

    add(fn: () => void): void {
        this.#set.add(fn);
    }

    delete(fn: () => void): void {
        this.#set.delete(fn);
    }

    batch<T>(fn: () => T): T {
        this.#depth++;
        try {
            return fn();
        } finally {
            this.#depth--;
            if (this.#depth === 0 && this.#pending) {
                this.#pending = false;
                this.notify();
            }
        }
    }

    notify(): void {
        if (this.#depth > 0) {
            this.#pending = true;
            return;
        }
        this.#set.forEach((fn) => fn());
    }
}
