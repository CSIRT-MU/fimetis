export class LoadingStatus {
    private _mtimes: boolean;
    private _atimes: boolean;
    private _ctimes: boolean;
    private _btimes: boolean;
    private _mtimesFiltered: boolean;
    private _atimesFiltered: boolean;
    private _ctimesFiltered: boolean;
    private _btimesFiltered: boolean;

    get mtimes(): boolean {
        return this._mtimes;
    }

    set mtimes(value: boolean) {
        this._mtimes = value;
    }

    get atimes(): boolean {
        return this._atimes;
    }

    set atimes(value: boolean) {
        this._atimes = value;
    }

    get ctimes(): boolean {
        return this._ctimes;
    }

    set ctimes(value: boolean) {
        this._ctimes = value;
    }

    get btimes(): boolean {
        return this._btimes;
    }

    set btimes(value: boolean) {
        this._btimes = value;
    }

    get mtimesFiltered(): boolean {
        return this._mtimesFiltered;
    }

    set mtimesFiltered(value: boolean) {
        this._mtimesFiltered = value;
    }

    get atimesFiltered(): boolean {
        return this._atimesFiltered;
    }

    set atimesFiltered(value: boolean) {
        this._atimesFiltered = value;
    }

    get ctimesFiltered(): boolean {
        return this._ctimesFiltered;
    }

    set ctimesFiltered(value: boolean) {
        this._ctimesFiltered = value;
    }

    get btimesFiltered(): boolean {
        return this._btimesFiltered;
    }

    set btimesFiltered(value: boolean) {
        this._btimesFiltered = value;
    }

}
