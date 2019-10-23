import {Component} from '@angular/core';
import {User} from './models/user.model';
import {AuthenticationService} from './auth/authentication.service';
import {Router} from '@angular/router';
import {UserSettingsService} from './services/userSettings.service';
import {HotkeysService} from 'angular2-hotkeys';
import {DomSanitizer} from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material';
import {CaseService} from './services/case.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']

})
export class AppComponent {
    title = 'TIMESIX 2.0';
    description = 'Angular Frontend';
    currentUser: User;
    advancedMode = false;

    constructor(
        private router: Router,
        private authenticationService: AuthenticationService,
        private userSettingsService: UserSettingsService,
        private matIconRegistry: MatIconRegistry,
        private domSanitizer: DomSanitizer,
        private _hotkeysService: HotkeysService,
        private caseService: CaseService

    ) {
        this.authenticationService.currentUser.subscribe(x => this.currentUser = x);
        this.advancedMode = userSettingsService.advancedMode.getValue();
        this.userSettingsService.advancedMode.subscribe(mode => {this.advancedMode = mode; });

        // Loading custom icons
        this.matIconRegistry.addSvgIcon('zoom-in', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/zoom-in.svg'));
        this.matIconRegistry.addSvgIcon('zoom-out', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/zoom-out.svg'));
        this.matIconRegistry.addSvgIcon('zoom-reset', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/zoom-reset.svg'));
        this.matIconRegistry.addSvgIcon('delete', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/delete.svg'));
        this.matIconRegistry.addSvgIcon('zoom-into-selection', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/zoom-into-selection.svg'));
        this.matIconRegistry.addSvgIcon('extend-back', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/extend-back.svg'));
        this.matIconRegistry.addSvgIcon('extend-forth', this.domSanitizer.bypassSecurityTrustResourceUrl('../assets/icons/extend-forth.svg'));
    }

    setAdvancedMode(mode: boolean) {
        this.userSettingsService.setAdvancedMode(mode);
    }

    getRouter() {
        return this.router;
    }

    /**
     * Logout current user
     */
    logout() {
        this.authenticationService.logout();
        // this.router.navigate(['/login']);
    }

    toggleCheatsheet() {
        this._hotkeysService.cheatSheetToggle.next();
    }

    printSelectedCase() {
        console.log(this.caseService.selectedCase);
    }
}
