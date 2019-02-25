export class VirtualArrayModel {
    private _length: number;

    get length(): number {
        return this._length;
    }

    set length(value: number) {
        this._length = value;
    }

    constructor() {
        this._length = 0;
    }

    slice() {
        return [];
    }
}
