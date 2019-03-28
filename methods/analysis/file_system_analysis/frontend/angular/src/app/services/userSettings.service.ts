import { Injectable } from '@angular/core';
import {BehaviorSubject} from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
    advancedMode: BehaviorSubject<boolean> = new BehaviorSubject(false);

    constructor() {
        this.advancedMode.next(false);
        this.advancedMode.next(JSON.parse(localStorage.getItem('advancedMode')));
    }

    setAdvancedMode(mode: boolean) {
        this.advancedMode.next(mode);
        localStorage.setItem('advancedMode', JSON.stringify(this.advancedMode.getValue()));
    }
}
